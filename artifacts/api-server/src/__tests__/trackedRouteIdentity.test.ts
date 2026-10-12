import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";

const state = vi.hoisted(() => ({ created: false, existingOwner: null as string | null }));
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-user"] ?? null }),
  requireAuth: () => (_req: any, res: any) => res.redirect("/"),
}));
vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<typeof import("@workspace/db/schema")>("@workspace/db/schema");
  return { ...schema, db: {
    insert: () => ({ values: () => ({ onConflictDoNothing: () => ({
      returning: async () => state.created ? [{ id: "test-recording" }] : [],
    }) }) }),
    select: () => ({ from: () => ({ where: () => ({
      limit: async () => [{ createdBy: state.existingOwner }],
    }) }) }),
  } };
});
import router from "../routes/tracked-routes";

async function upload() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { info: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(router);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    return await fetch(`http://127.0.0.1:${port}/tracked-routes`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-test-user": "test-owner" },
      body: JSON.stringify({ id: "test-recording", name: "Synthetic private recording",
        distanceKm: 1, elevationGain: 10, elevationLoss: 10, durationSecs: 600 }),
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe("tracked recording identity acknowledgements", () => {
  beforeEach(() => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_synthetic_fixture");
    state.created = false;
    state.existingOwner = null;
  });
  afterEach(() => vi.unstubAllEnvs());
  it("refuses to acknowledge another owner's existing identity", async () => {
    state.existingOwner = "other-test-owner";
    expect((await upload()).status).toBe(409);
  });
  it("does not claim an ownerless legacy identity", async () => {
    expect((await upload()).status).toBe(409);
  });
  it("acknowledges a same-owner replay without modifying original GPS", async () => {
    state.existingOwner = "test-owner";
    expect((await upload()).status).toBe(201);
  });
  it("acknowledges an actual new insert", async () => {
    state.created = true;
    expect((await upload()).status).toBe(201);
  });
});
