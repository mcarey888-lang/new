import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { buildAdminSessionToken } from "../lib/adminSessionToken.js";

// ── Spy on auditLog so we can assert writes ───────────────────────────────────
const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/auditLog.js", () => ({ writeAuditLog: mockWriteAuditLog }));

/**
 * Admin endpoint auth guard tests.
 *
 * Covers:
 *   - POST /admin/login          — password verification
 *   - GET  /admin/me             — token validation
 *   - GET  /admin/hill-verification/sessions  — reads require admin
 *   - POST /admin/hill-verification/approve/:id
 *   - POST /admin/hill-verification/reject/:id
 *   - POST /artwork/approve/:id  — write requires admin
 *   - GET  /artwork/status       — read is public
 *   - POST /atlas/approve/:id    — write requires admin
 *   - GET  /atlas/brands         — read is public
 *
 * The DB and Clerk are fully mocked so no real infra is needed.
 */

// ── Mock @clerk/express before any route imports ──────────────────────────────

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAuth:     () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getAuth:         (_req: express.Request) => ({ userId: null }),
}));

// ── Mock @workspace/db ────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("@workspace/db", () => {
  // Fully chainable select mock that resolves to [] at any terminal point.
  // Supports .from().where().orderBy().limit().offset() in any order.
  const resolvedEmpty = () => Promise.resolve([]);
  const makeTerminal = (): Record<string, unknown> => ({
    limit:   () => makeTerminal(),
    offset:  resolvedEmpty,
    orderBy: () => makeTerminal(),
    where:   () => makeTerminal(),
    groupBy: () => makeTerminal(),
    then:    (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  });
  const makeSelectChain = () => ({
    from: () => makeTerminal(),
  });

  // Minimal insert chain
  const makeInsertChain = () => ({
    values: () => Promise.resolve([]),
  });

  // Minimal update chain
  const makeUpdateChain = () => ({
    set: () => ({
      where: () => Promise.resolve([]),
    }),
  });

  return {
    db: {
      select: (...a: unknown[]) => { mockDbSelect(...a); return makeSelectChain(); },
      insert: (...a: unknown[]) => { mockDbInsert(...a); return makeInsertChain(); },
      update: (...a: unknown[]) => { mockDbUpdate(...a); return makeUpdateChain(); },
    },
    // Table stubs used by routes (just need to exist as objects)
    users:                    { clerkUserId: {}, isAdmin: {} },
    adminAuditLog:            { adminIdentity: {}, action: {}, resourceId: {}, metadata: {} },
    trackedHillSessions:      { id: {}, completionType: {}, dataQualityScore: {}, adminApproved: {}, usedForVerification: {}, hillId: {}, routeId: {}, createdAt: {} },
    canonicalHills:           { confidenceScore: {}, verifiedSampleCount: {} },
    signatureChallenges:      { challengeId: {} },
    challengeStages:          { challengeId: {}, stageOrder: {} },
    atlasAssets:              { assetId: {}, approved: {}, archived: {} },
    mountainVerificationTests: { mountainName: {}, createdAt: {} },
  };
});

// ── Mock drizzle-orm operators ────────────────────────────────────────────────

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

// ── Mock heavy services so route files load without crashing ─────────────────

vi.mock("../services/artwork/artworkService.js",  () => ({
  generateChallengeArtwork: vi.fn().mockResolvedValue({ status: "ok" }),
  approveChallengeArtwork:  vi.fn().mockResolvedValue(undefined),
  rejectChallengeArtwork:   vi.fn().mockResolvedValue(undefined),
  clearChallengeArtwork:    vi.fn().mockResolvedValue(undefined),
  bulkGenerateArtwork:      vi.fn().mockResolvedValue({}),
  getArtworkStatus:         vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/artwork/artworkStorage.js",  () => ({
  streamArtworkImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/artwork/promptBuilder.js",   () => ({
  buildExpeditionPrompt: vi.fn().mockReturnValue({ prompt: "test", hash: "abc" }),
}));

vi.mock("../services/atlas/atlasService.js", () => ({
  generateAtlasAsset:       vi.fn().mockResolvedValue({ status: "ok" }),
  approveAtlasAsset:        vi.fn().mockResolvedValue(undefined),
  rejectAtlasAsset:         vi.fn().mockResolvedValue(undefined),
  archiveAtlasAsset:        vi.fn().mockResolvedValue(undefined),
  publishAtlasAsset:        vi.fn().mockResolvedValue({ ok: true }),
  clearAtlasAsset:          vi.fn().mockResolvedValue(undefined),
  bulkGenerateAtlasAssets:  vi.fn().mockResolvedValue({}),
  getAtlasStatus:           vi.fn().mockResolvedValue([]),
  getAllBrands:              vi.fn().mockResolvedValue([]),
  getAllAssetTypes:          vi.fn().mockResolvedValue([]),
  updateStyleLock:          vi.fn().mockResolvedValue(undefined),
  createAtlasAsset:         vi.fn().mockResolvedValue("new-asset-id"),
  importAtlasAsset:         vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../services/atlas/atlasStorage.js", () => ({
  streamAtlasImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/atlas/atlasGitHubService.js", () => ({
  publishAtlasAssets: vi.fn().mockResolvedValue([]),
  getGitHubStatus:    vi.fn().mockResolvedValue({ ok: true }),
  getPublishQueue:    vi.fn().mockResolvedValue([]),
}));

// ── Stub pino logger ──────────────────────────────────────────────────────────

function addStubLogger(app: express.Express) {
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as Record<string,unknown>).log = {
      info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
}

// ── Build a minimal app with the three admin route groups ─────────────────────

const TEST_KEY   = "test-admin-key-xyz-9876";
// Pre-built signed token for TEST_KEY — used in all auth-passing assertions.
// buildAdminSessionToken is a pure function; calling it at module scope is safe.
const SIGNED_TOKEN = buildAdminSessionToken(TEST_KEY);

async function buildApp() {
  process.env.ADMIN_API_KEY = TEST_KEY;
  const app = express();
  app.use(express.json());
  addStubLogger(app);

  const { adminRouter }                = await import("../routes/admin.js");
  const { default: hillVerifRouter }   = await import("../routes/hill-verification-admin.js");
  const { artworkRouter }              = await import("../routes/artwork.js");
  const { atlasRouter }                = await import("../routes/atlas.js");
  const { default: mtnVerifRouter }    = await import("../routes/mountain-verification.js");

  app.use("/admin",                            adminRouter);
  app.use("/admin/hill-verification",          hillVerifRouter);
  app.use("/artwork",                          artworkRouter);
  app.use("/atlas",                            atlasRouter);
  app.use(mtnVerifRouter); // routes registered as /mountain-verification-test, etc.

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Mountain verification routes — auth guard on write/compute endpoints", () => {
  let app: express.Express;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(() => { delete process.env.ADMIN_API_KEY; });
  beforeEach(() => { mockWriteAuditLog.mockClear(); });

  it("POST /mountain-verification-test returns 401 with no token", async () => {
    const res = await request(app)
      .post("/mountain-verification-test")
      .send({ mountainName: "Ben Nevis" });
    expect(res.status).toBe(401);
  });

  it("POST /mountain-verification-test returns 401 with wrong token", async () => {
    const res = await request(app)
      .post("/mountain-verification-test")
      .set("Authorization", "Bearer bad-token")
      .send({ mountainName: "Ben Nevis" });
    expect(res.status).toBe(401);
  });

  it("GET /mountain-verification-results returns 401 with no token", async () => {
    const res = await request(app).get("/mountain-verification-results");
    expect(res.status).toBe(401);
  });

  it("POST /mountain-verification-test/batch returns 401 with no token", async () => {
    const res = await request(app).post("/mountain-verification-test/batch");
    expect(res.status).toBe(401);
  });

  it("GET /mountain-verification-results returns non-401 with signed token and writes audit log", async () => {
    const res = await request(app)
      .get("/mountain-verification-results")
      .set("Authorization", `Bearer ${SIGNED_TOKEN}`);
    // Auth guard passed; handler may succeed or fail internally — either is fine here
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    // Audit log must be written on success
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      "mountain-verification-results-view",
      expect.toSatisfy((v: unknown) => v === null || typeof v === "string"),
      expect.any(Object),
    );
  });
});

describe("POST /admin/login — server-side password verification", () => {
  let app: express.Express;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(() => { delete process.env.ADMIN_API_KEY; });

  it("returns 400 when no password is provided", async () => {
    const res = await request(app).post("/admin/login").send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 with wrong password", async () => {
    const res = await request(app).post("/admin/login").send({ password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with a signed token on correct password — raw key is NOT returned", async () => {
    const res = await request(app).post("/admin/login").send({ password: TEST_KEY });
    expect(res.status).toBe(200);
    // Token must be an opaque signed token — never the raw ADMIN_API_KEY
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token).not.toBe(TEST_KEY);
    expect(res.body.token.length).toBeGreaterThan(20);
  });
});

describe("GET /admin/me — token validation", () => {
  let app: express.Express;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(() => { delete process.env.ADMIN_API_KEY; });

  it("returns 401 with no token", async () => {
    const res = await request(app).get("/admin/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await request(app).get("/admin/me").set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct token", async () => {
    const res = await request(app)
      .get("/admin/me")
      .set("Authorization", `Bearer ${SIGNED_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("Hill verification admin routes — auth guard", () => {
  let app: express.Express;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(() => { delete process.env.ADMIN_API_KEY; });

  it("GET /admin/hill-verification/sessions returns 401 with no token", async () => {
    const res = await request(app).get("/admin/hill-verification/sessions");
    expect(res.status).toBe(401);
  });

  it("GET /admin/hill-verification/sessions returns 401 with raw API key (raw key no longer accepted)", async () => {
    const res = await request(app)
      .get("/admin/hill-verification/sessions")
      .set("Authorization", `Bearer ${TEST_KEY}`);
    expect(res.status).toBe(401);
  });

  it("GET /admin/hill-verification/sessions returns 200 with signed session token", async () => {
    const res = await request(app)
      .get("/admin/hill-verification/sessions")
      .set("Authorization", `Bearer ${SIGNED_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it("GET /admin/hill-verification/stats returns 401 with no token", async () => {
    const res = await request(app).get("/admin/hill-verification/stats");
    expect(res.status).toBe(401);
  });

  it("POST /admin/hill-verification/approve/1 returns 401 with no token", async () => {
    const res = await request(app).post("/admin/hill-verification/approve/1");
    expect(res.status).toBe(401);
  });

  it("POST /admin/hill-verification/reject/1 returns 401 with no token", async () => {
    const res = await request(app).post("/admin/hill-verification/reject/1");
    expect(res.status).toBe(401);
  });
});

describe("Artwork routes — admin guard on write, public read", () => {
  let app: express.Express;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(() => { delete process.env.ADMIN_API_KEY; });

  it("GET /artwork/status is public (no token needed)", async () => {
    const res = await request(app).get("/artwork/status");
    expect(res.status).toBe(200);
  });

  it("POST /artwork/approve/:id returns 401 with no token", async () => {
    const res = await request(app).post("/artwork/approve/some-challenge");
    expect(res.status).toBe(401);
  });

  it("POST /artwork/reject/:id returns 401 with no token", async () => {
    const res = await request(app).post("/artwork/reject/some-challenge");
    expect(res.status).toBe(401);
  });

  it("DELETE /artwork/:id returns 401 with no token", async () => {
    const res = await request(app).delete("/artwork/some-challenge");
    expect(res.status).toBe(401);
  });

  it("POST /artwork/approve/:id passes auth guard with signed token (not 401)", async () => {
    const res = await request(app)
      .post("/artwork/approve/some-challenge")
      .set("Authorization", `Bearer ${SIGNED_TOKEN}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /artwork/generate/:id requires admin", async () => {
    const res = await request(app).post("/artwork/generate/some-challenge");
    expect(res.status).toBe(401);
  });
});

describe("Atlas routes — admin guard on write, public read", () => {
  let app: express.Express;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(() => { delete process.env.ADMIN_API_KEY; });

  it("GET /atlas/brands is public (no token needed)", async () => {
    const res = await request(app).get("/atlas/brands");
    expect(res.status).toBe(200);
  });

  it("GET /atlas/status is public (no token needed)", async () => {
    const res = await request(app).get("/atlas/status");
    expect(res.status).toBe(200);
  });

  it("POST /atlas/approve/:id returns 401 with no token", async () => {
    const res = await request(app).post("/atlas/approve/some-asset");
    expect(res.status).toBe(401);
  });

  it("POST /atlas/reject/:id returns 401 with no token", async () => {
    const res = await request(app).post("/atlas/reject/some-asset");
    expect(res.status).toBe(401);
  });

  it("DELETE /atlas/:id returns 401 with no token", async () => {
    const res = await request(app).delete("/atlas/some-asset");
    expect(res.status).toBe(401);
  });

  it("POST /atlas/approve/:id passes auth guard with signed token (not 401)", async () => {
    const res = await request(app)
      .post("/atlas/approve/some-asset")
      .set("Authorization", `Bearer ${SIGNED_TOKEN}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /atlas/generate/:id requires admin", async () => {
    const res = await request(app).post("/atlas/generate/some-asset");
    expect(res.status).toBe(401);
  });

  it("PATCH /atlas/brands/:id/style-lock requires admin", async () => {
    const res = await request(app).patch("/atlas/brands/1/style-lock").send({ styleLock: {} });
    expect(res.status).toBe(401);
  });
});
