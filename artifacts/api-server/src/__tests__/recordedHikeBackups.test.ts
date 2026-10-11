import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
const store = vi.hoisted(() => new Map<string, any>());
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-user"] ?? null }),
  requireAuth: () => (_req: any, res: any) => res.redirect("/"),
}));
vi.mock("@workspace/db", () => ({
  db: {
    insert: () => ({ values: (value: any) => ({ onConflictDoUpdate: () => ({
      returning: async () => {
        const key = `${value.ownerUserId}:${value.hikeId}`;
        const existing = store.get(key);
        if (existing && existing.revision > value.revision) return [];
        store.set(key, { ...value, updatedAt: new Date() });
        return [{ revision: value.revision }];
      },
    }) }) }),
    select: () => ({ from: () => ({ where: (clause: any) => {
      const { params } = new PgDialect().sqlToQuery(clause);
      return { orderBy: () => ({ limit: async () => [...store.values()].filter(row => row.ownerUserId === params[0]) }) };
    } }) }),
    delete: () => ({ where: async (clause: any) => {
      const { params } = new PgDialect().sqlToQuery(clause);
      store.delete(`${params[0]}:${params[1]}`);
    } }),
  },
}));
import router from "../routes/recorded-hikes";

const recording = {
  hikeId: "one", revision: "2026-10-11T20:00:00.000Z",
  snapshot: { id: "one", name: "Test hike", date: "2026-10-11T18:00:00.000Z",
    distance: 2.2, elevationGain: 1670, timeTaken: 66, notes: "Original",
    trackPoints: [{ lat: 53, lon: -2, alt: 200, ts: 1000, altAcc: null }] },
};
async function request(method: string, path: string, owner?: string, body?: unknown, selectedRouter = router) {
  const app = express();
  app.use(express.json()); app.use(selectedRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address() as { port: number };
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, redirect: "manual",
      headers: { "Content-Type": "application/json", ...(owner ? { "x-test-user": owner } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

describe("private recorded hike backups", () => {
  beforeEach(() => { store.clear(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CLERK_SECRET_KEY", "test-present-key"); });
  it("returns JSON 401, not a sign-in redirect, and never writes anonymously", async () => {
    const response = await request("PUT", "/recorded-hikes", undefined, recording);
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(store.size).toBe(0);
  });
  it("preserves the raw trace and gives an exact private backup acknowledgement", async () => {
    const response = await request("PUT", "/recorded-hikes", "user-a", recording);
    expect(await response.json()).toEqual({ ok: true, hikeId: "one", revision: recording.revision });
    expect(store.get("user-a:one").snapshot.trackPoints).toEqual(recording.snapshot.trackPoints);
  });
  it("isolates list, save and deletion even when two users use the same hike ID", async () => {
    await request("PUT", "/recorded-hikes", "user-a", recording);
    await request("PUT", "/recorded-hikes", "user-b", { ...recording, snapshot: { ...recording.snapshot, name: "Other" } });
    const list = await (await request("GET", "/recorded-hikes", "user-b")).json();
    expect(list.backups).toHaveLength(1);
    expect(list.backups[0].snapshot.name).toBe("Other");
    await request("DELETE", "/recorded-hikes/one", "user-b");
    expect(store.has("user-a:one")).toBe(true);
    expect(store.has("user-b:one")).toBe(false);
  });
  it("refuses stale revisions rather than overwriting a reviewed recording", async () => {
    await request("PUT", "/recorded-hikes", "user-a", recording);
    const response = await request("PUT", "/recorded-hikes", "user-a", { ...recording, revision: "2026-10-11T19:00:00.000Z" });
    expect(response.status).toBe(409);
    expect(store.get("user-a:one").revision).toBe(recording.revision);
  });
  it("rejects identity mismatches and invalid coordinates", async () => {
    expect((await request("PUT", "/recorded-hikes", "user-a", { ...recording, hikeId: "other" })).status).toBe(400);
    expect((await request("PUT", "/recorded-hikes", "user-a", { ...recording, snapshot: { ...recording.snapshot, trackPoints: [{ lat: 99, lon: 0 }] } })).status).toBe(400);
    expect(store.size).toBe(0);
  });
  it("fails closed when production authentication is not configured", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.resetModules();
    const freshRouter = (await import("../routes/recorded-hikes")).default;
    expect((await request("PUT", "/recorded-hikes", "user-a", recording, freshRouter)).status).toBe(503);
    expect(store.size).toBe(0);
  });
});
