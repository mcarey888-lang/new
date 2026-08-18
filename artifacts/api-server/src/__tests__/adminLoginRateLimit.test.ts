/**
 * Rate-limit tests for POST /admin/login.
 *
 * Vitest runs each test file in its own module registry, so the
 * loginRateLimiter instance (and its in-memory counter) is fresh here —
 * no cross-file contamination from adminEndpoints.test.ts.
 *
 * Heavy services, Clerk, and the DB are mocked so no real infra is needed.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Minimal mocks ─────────────────────────────────────────────────────────────

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAuth:     () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getAuth:         (_req: express.Request) => ({ userId: null }),
}));

vi.mock("@workspace/db", () => {
  const resolvedEmpty = () => Promise.resolve([]);
  const makeTerminal = (): Record<string, unknown> => ({
    limit:   () => makeTerminal(),
    offset:  resolvedEmpty,
    orderBy: () => makeTerminal(),
    where:   () => makeTerminal(),
    groupBy: () => makeTerminal(),
    then:    (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  });
  return {
    db: {
      select: () => ({ from: () => makeTerminal() }),
      insert: () => ({ values: () => Promise.resolve([]) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
    },
    users:                       { clerkUserId: {}, isAdmin: {} },
    adminAuditLog:               { adminIdentity: {}, action: {}, resourceId: {}, metadata: {} },
    trackedHillSessions:         { id: {}, completionType: {}, dataQualityScore: {}, adminApproved: {}, usedForVerification: {}, hillId: {}, routeId: {}, createdAt: {} },
    canonicalHills:              { confidenceScore: {}, verifiedSampleCount: {} },
    signatureChallenges:         { challengeId: {} },
    challengeStages:             { challengeId: {}, stageOrder: {} },
    atlasAssets:                 { assetId: {}, approved: {}, archived: {} },
    mountainVerificationTests:   { mountainName: {}, createdAt: {} },
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq:   vi.fn((_col: unknown, _val: unknown) => ({})),
    and:  vi.fn((...conds: unknown[]) => conds),
    desc: vi.fn((col: unknown) => col),
    gte:  vi.fn((_col: unknown, _val: unknown) => ({})),
    sql:  actual.sql,
  };
});

vi.mock("../lib/auditLog.js", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_KEY = "rate-limit-test-key-abc-9999";

function addStubLogger(app: express.Express) {
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as Record<string, unknown>).log = {
      info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
}

/** Build a minimal express app wrapping just the admin login route. */
async function buildLoginApp({ trustProxy = false }: { trustProxy?: boolean | number } = {}) {
  process.env.ADMIN_API_KEY = TEST_KEY;
  const { adminRouter } = await import("../routes/admin.js");
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use(express.json());
  addStubLogger(app);
  app.use("/admin", adminRouter);
  return app;
}

// ── Suite 1: core rate-limit behaviour ───────────────────────────────────────

describe("POST /admin/login — brute-force rate limit (core)", () => {
  let app: express.Express;

  // Vitest isolates module registries per file so loginRateLimiter's
  // in-memory counter starts at zero for this test file.
  beforeAll(async () => { app = await buildLoginApp(); });

  it("allows the first 5 failed attempts (returns 401, not 429)", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/admin/login")
        .send({ password: "wrong-password" });
      expect(res.status).toBe(401);
    }
  });

  it("returns 429 on the 6th consecutive failed attempt", async () => {
    const res = await request(app)
      .post("/admin/login")
      .send({ password: "wrong-password" });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many failed login/i);
  });

  it("sets RateLimit-* standard headers on the 429 response", async () => {
    const res = await request(app)
      .post("/admin/login")
      .send({ password: "wrong-password" });
    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty("ratelimit-limit");
    expect(res.headers["ratelimit-remaining"]).toBe("0");
  });
});

// ── Suite 2: successful requests do NOT consume failure slots ─────────────────
//
// skipSuccessfulRequests means a correct password does not increment the
// failed-attempt counter.  However, it does NOT reset or bypass an already-
// reached limit — a blocked IP must wait for the window to expire.

describe("POST /admin/login — successful requests do not consume failure slots", () => {
  // This suite uses a separate express app to get a fresh limiter store.
  // Because vi.mock() is hoisted and module-level, the import of adminRouter
  // inside buildLoginApp() resolves to the same module instance; the rate-limit
  // store state at this point is independent of the suite above because each
  // buildLoginApp() call uses the SAME module but the SAME limiter instance.
  //
  // To get a truly isolated counter we set up supertest with a different
  // X-Forwarded-For IP (trust proxy enabled) so attempts are keyed separately
  // from the loopback IP used in suite 1.

  let app: express.Express;
  const CLEAN_IP = "203.0.113.42"; // TEST-NET-3 — guaranteed not used elsewhere

  beforeAll(async () => {
    // trust proxy: 1 so X-Forwarded-For is honoured and ipKeyGenerator sees
    // the real client IP rather than the loopback address.
    app = await buildLoginApp({ trustProxy: 1 });
  });

  it("4 failures followed by a success: the success is not counted, leaving 1 failure slot remaining", async () => {
    // Send 4 wrong attempts from CLEAN_IP
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post("/admin/login")
        .set("X-Forwarded-For", CLEAN_IP)
        .send({ password: "wrong" });
      expect(res.status).toBe(401);
    }

    // Correct password must not be blocked (only 4 of 5 failures used)
    const ok = await request(app)
      .post("/admin/login")
      .set("X-Forwarded-For", CLEAN_IP)
      .send({ password: TEST_KEY });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe("string");

    // Success was not counted → one more failure slot still available
    const fifth = await request(app)
      .post("/admin/login")
      .set("X-Forwarded-For", CLEAN_IP)
      .send({ password: "wrong" });
    expect(fifth.status).toBe(401); // 5th failure, still under limit
  });

  it("6th failure from the same IP is blocked even after an intervening success", async () => {
    // CLEAN_IP now has 5 failures on record from the previous test.
    // One more wrong attempt must be blocked.
    const res = await request(app)
      .post("/admin/login")
      .set("X-Forwarded-For", CLEAN_IP)
      .send({ password: "wrong" });
    expect(res.status).toBe(429);
  });
});

// ── Suite 3: separate IPs have independent counters ───────────────────────────

describe("POST /admin/login — separate client IPs have independent counters", () => {
  let app: express.Express;
  const IP_A = "198.51.100.10"; // TEST-NET-2
  const IP_B = "198.51.100.20"; // different host in the same class-C, but different /56 IPv4 key

  beforeAll(async () => {
    app = await buildLoginApp({ trustProxy: 1 });
  });

  it("exhausting the limit for IP_A does not block IP_B", async () => {
    // Exhaust all 5 failure slots for IP_A
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/admin/login")
        .set("X-Forwarded-For", IP_A)
        .send({ password: "wrong" });
    }
    // IP_A is now blocked
    const blockedA = await request(app)
      .post("/admin/login")
      .set("X-Forwarded-For", IP_A)
      .send({ password: "wrong" });
    expect(blockedA.status).toBe(429);

    // IP_B still has its own fresh counter — must not be blocked
    const okB = await request(app)
      .post("/admin/login")
      .set("X-Forwarded-For", IP_B)
      .send({ password: "wrong" });
    expect(okB.status).toBe(401);
  });
});
