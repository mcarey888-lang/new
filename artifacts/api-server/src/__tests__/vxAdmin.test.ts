import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

/**
 * Admin endpoint guard tests.
 *
 * These tests import the Express app and call the admin endpoints
 * with and without the x-vx-admin-key header, asserting auth behavior.
 *
 * We mock @workspace/db entirely to avoid needing a real database.
 */

// ── Mock @workspace/db before importing any routes ───────────────────────────

vi.mock("@workspace/db", () => {
  const selectChain = {
    from: vi.fn(),
  };
  selectChain.from.mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit:   vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    }),
    orderBy: vi.fn().mockResolvedValue([]),
  });

  const insertChain = {
    values: vi.fn(),
  };
  insertChain.values.mockReturnValue({
    onConflictDoUpdate: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    }),
  });

  return {
    db: {
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    // Schema table stubs — routes destructure these to build queries
    virtualExpeditions:  { id: {}, mountainSlug: {}, status: {}, featured: {}, spreadsheetMountainId: {} },
    expeditionRoutes:    { id: {}, virtualExpeditionId: {}, spreadsheetRouteId: {}, active: {} },
    trainingRoutes:      { id: {}, region: {}, active: {} },
    routeDna:            { id: {}, expeditionRouteId: {}, trainingRouteId: {}, calculationVersion: {} },
    matchWeights:        { id: {}, metric: {}, version: {}, active: {}, weight: {} },
    routeMatches:        { id: {}, expeditionRouteId: {}, trainingRouteId: {}, algorithmVersion: {}, score: {}, matchReasons: {}, warnings: {}, calculatedAt: {} },
    importReviewItems:   { id: {}, status: {} },
  };
});

// Mock drizzle operators (routes import from drizzle-orm)
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

// ── Minimal HTTP helper (no supertest dependency) ─────────────────────────────

import http from "http";
import express from "express";

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

// ── Stub pino logger on requests ──────────────────────────────────────────────

function addStubLogger(app: express.Express) {
  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = {
      info:  () => {},
      warn:  () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
}

// ── Build a minimal Express app with the VX routes ───────────────────────────

async function buildApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());
  addStubLogger(app);

  const { default: vxRouter } = await import("../routes/virtual-expedition-engine.js");
  app.use(vxRouter);

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("VX admin endpoints — auth guard", () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.VIRTUAL_ENGINE_ADMIN_KEY = "test-admin-key-12345";
    app = await buildApp();
  });

  afterAll(() => {
    delete process.env.VIRTUAL_ENGINE_ADMIN_KEY;
  });

  it("POST /vx/admin/recalculate-dna returns 401 with no key", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("POST /vx/admin/recalculate-dna returns 401 with wrong key", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna", {
      "x-vx-admin-key": "wrong-key",
    });
    expect(res.status).toBe(401);
  });

  it("POST /vx/admin/recalculate-matches returns 401 with no key", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-matches");
    expect(res.status).toBe(401);
  });

  it("POST /vx/admin/recalculate-matches returns 401 with wrong key", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-matches", {
      "x-vx-admin-key": "bad-key",
    });
    expect(res.status).toBe(401);
  });

  it("POST /vx/admin/recalculate-dna passes auth guard (not 401/503)", async () => {
    // The auth guard is the subject here; the handler may error internally with the stub DB.
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-dna", {
      "x-vx-admin-key": "test-admin-key-12345",
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });

  it("POST /vx/admin/recalculate-matches passes auth guard (not 401/503)", async () => {
    const res = await callEndpoint(app, "POST", "/vx/admin/recalculate-matches", {
      "x-vx-admin-key": "test-admin-key-12345",
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });

  it("GET /vx/admin/review-queue returns 401 with no key", async () => {
    const res = await callEndpoint(app, "GET", "/vx/admin/review-queue");
    expect(res.status).toBe(401);
  });

  it("GET /vx/admin/review-queue returns 200 with correct key", async () => {
    const res = await callEndpoint(app, "GET", "/vx/admin/review-queue", {
      "x-vx-admin-key": "test-admin-key-12345",
    });
    expect(res.status).toBe(200);
  });
});
