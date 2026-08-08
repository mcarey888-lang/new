import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

// ── Spy on auditLog ───────────────────────────────────────────────────────────
const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/auditLog.js", () => ({ writeAuditLog: mockWriteAuditLog }));

/**
 * VX admin endpoint auth guard tests.
 *
 * Now uses the unified requireAdminAuth middleware (signed session tokens via
 * ADMIN_API_KEY) instead of the old x-vx-admin-key header mechanism.
 * The old VIRTUAL_ENGINE_ADMIN_KEY env var is no longer consulted.
 */

// ── Mock @clerk/express before any route imports ──────────────────────────────

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth:     () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth:         (_req: unknown) => ({ userId: null }),
}));

// ── Mock @workspace/db ────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => {
  const makeTerminal = (): Record<string, unknown> => ({
    from:    () => makeTerminal(),
    where:   () => makeTerminal(),
    orderBy: () => makeTerminal(),
    limit:   () => makeTerminal(),
    offset:  () => Promise.resolve([]),
    groupBy: () => makeTerminal(),
    then:    (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  });

  return {
    db: {
      select: vi.fn().mockReturnValue(makeTerminal()),
      insert: vi.fn().mockReturnValue({ values: () => Promise.resolve([]) }),
      update: vi.fn().mockReturnValue({ set: () => ({ where: () => Promise.resolve([]) }) }),
    },
    virtualExpeditions:  { id: {}, mountainSlug: {}, status: {}, featured: {}, spreadsheetMountainId: {} },
    expeditionRoutes:    { id: {}, virtualExpeditionId: {}, spreadsheetRouteId: {}, active: {} },
    trainingRoutes:      { id: {}, region: {}, active: {} },
    routeDna:            { id: {}, expeditionRouteId: {}, trainingRouteId: {}, calculationVersion: {} },
    matchWeights:        { id: {}, metric: {}, version: {}, active: {}, weight: {} },
    routeMatches:        { id: {}, expeditionRouteId: {}, trainingRouteId: {}, algorithmVersion: {}, score: {}, matchReasons: {}, warnings: {}, calculatedAt: {} },
    importReviewItems:   { id: {}, status: {}, createdAt: {} },
    users:               { clerkUserId: {}, isAdmin: {} },
    adminAuditLog:       { adminIdentity: {}, action: {}, resourceId: {}, metadata: {} },
  };
});

// ── Mock route services so handlers succeed past auth ─────────────────────────
vi.mock("../services/routeDna.js", () => ({
  calculateDna:        vi.fn().mockReturnValue({}),
  upsertExpeditionDna: vi.fn().mockResolvedValue(undefined),
  upsertTrainingDna:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/routeMatching.js", () => ({
  matchExpeditionRouteAgainstTraining: vi.fn().mockResolvedValue({}),
  recalculateAllMatches:               vi.fn().mockResolvedValue({ created: 2, updated: 3 }),
  loadActiveWeights:                   vi.fn().mockResolvedValue([]),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq:        (..._args: unknown[]) => ({}),
    and:       (..._args: unknown[]) => ({}),
    desc:      (..._args: unknown[]) => ({}),
    count:     (..._args: unknown[]) => ({}),
    isNotNull: (..._args: unknown[]) => ({}),
  };
});

// ── Minimal HTTP helper ───────────────────────────────────────────────────────

import http from "http";
import express from "express";
import { buildAdminSessionToken } from "../lib/adminSessionToken.js";

async function callEndpoint(
  app: express.Express,
  method: "GET" | "POST",
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      const options: http.RequestOptions = {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers: { "Content-Type": "application/json", ...headers },
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          server.close();
          try {
            resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) as Record<string, unknown> });
          } catch {
            resolve({ status: res.statusCode ?? 500, body: {} });
          }
        });
      });

      req.on("error", () => { server.close(); resolve({ status: 500, body: {} }); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

function addStubLogger(app: express.Express) {
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as Record<string,unknown>).log = {
      info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
}

const TEST_KEY = "vx-test-admin-key-signed-9876";

async function buildApp(): Promise<express.Express> {
  process.env.ADMIN_API_KEY = TEST_KEY;
  const app = express();
  app.use(express.json());
  addStubLogger(app);
  const { default: vxRouter } = await import("../routes/virtual-expedition-engine.js");
  app.use(vxRouter);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("VX admin endpoints — unified requireAdminAuth guard (signed session tokens)", () => {
  let app: express.Express;
  let signedToken: string;

  beforeAll(async () => {
    app = await buildApp();
    signedToken = buildAdminSessionToken(TEST_KEY);
  });

  afterAll(() => {
    delete process.env.ADMIN_API_KEY;
  });

  beforeEach(() => { mockWriteAuditLog.mockClear(); });

  it("POST /vx/admin/recalculate-dna returns 401 with no token", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("POST /vx/admin/recalculate-dna returns 401 with raw API key (old mechanism rejected)", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna", {
      Authorization: `Bearer ${TEST_KEY}`,
    });
    expect(res.status).toBe(401);
  });

  it("POST /vx/admin/recalculate-dna returns 401 with old x-vx-admin-key header", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna", {
      "x-vx-admin-key": TEST_KEY,
    });
    expect(res.status).toBe(401);
  });

  it("POST /vx/admin/recalculate-matches returns 401 with no token", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-matches");
    expect(res.status).toBe(401);
  });

  it("POST /vx/admin/recalculate-dna passes auth guard with signed token and writes audit log", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna", {
      Authorization: `Bearer ${signedToken}`,
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      "vx-recalculate-dna",
      null,
      expect.any(Object),
    );
  });

  it("POST /vx/admin/recalculate-matches passes auth guard with signed token and writes audit log", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-matches", {
      Authorization: `Bearer ${signedToken}`,
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      "vx-recalculate-matches",
      null,
      expect.any(Object),
    );
  });

  it("GET /vx/admin/review-queue returns 401 with no token", async () => {
    const res = await callEndpoint(app, "GET", "/vx/admin/review-queue");
    expect(res.status).toBe(401);
  });

  it("GET /vx/admin/review-queue returns 200 with signed token (audit not required for read-only)", async () => {
    const res = await callEndpoint(app, "GET", "/vx/admin/review-queue", {
      Authorization: `Bearer ${signedToken}`,
    });
    expect(res.status).toBe(200);
  });
});
