import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db, signatureChallenges } from "@workspace/db";
import { inArray } from "drizzle-orm";

// Ephemeral test server only: exercise real development persistence without
// reading real admin credentials or weakening the running application's guard.
vi.mock("../middlewares/requireAdminKey.js", () => ({
  requireAdminKey: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.headers["x-test-admin"] === "authorized" ? next() : res.status(401).json({ error: "Unauthorized" }),
}));
import { expeditionAdminRouter } from "../routes/expedition-admin";
import { signatureChallengesRouter } from "../routes/signature-challenges";

const prefix = `QA-${randomUUID().slice(0, 8).toUpperCase()}`;
const ids = [`${prefix}-A`, `${prefix}-B`];
const make = (id: string) => ({
  challengeId: id, challengeName: "QA temporary draft", targetMountainName: "Matterhorn",
  stages: [{ routeName: "Blencathra via Sharp Edge", distanceKm: 12, ascentM: 850 },
    { routeName: "Helvellyn via Striding Edge", distanceKm: 13, ascentM: 950 }],
  limitations: ["QA fixture only; not a public expedition."],
});
let server: Server;
let base: string;
async function call(path: string, method = "GET", body?: unknown, authorized = true) {
  const res = await fetch(base + path, { method, headers: {
    "Content-Type": "application/json", ...(authorized ? { "x-test-admin": "authorized" } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() as any };
}
describe("expedition admin persisted lifecycle", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as any).log = { error: vi.fn() }; next(); });
    app.use("/api", expeditionAdminRouter);
    app.use("/api", signatureChallengesRouter);
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
    const address = server.address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    // Delete only test-owned IDs, never any existing expedition.
    await db.delete(signatureChallenges).where(inArray(signatureChallenges.challengeId, ids));
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  it("protects list, preview and mutations with the admin guard", async () => {
    for (const [path, method] of [["", "GET"], ["/preview", "POST"], ["/import", "POST"],
      [`/${ids[0]}`, "PUT"], [`/${ids[0]}`, "DELETE"]]) {
      expect((await call(`/api/admin/expeditions${path}`, method, method === "GET" ? undefined : {}, false)).status).toBe(401);
    }
  });
  it("previews without writing, imports only drafts, and never exposes drafts publicly", async () => {
    const payload = { expeditions: [{ ...make(ids[0]), status: "active", reviewed: true }] };
    const catalogue = await call("/api/admin/expeditions/catalogue?q=Helvellyn");
    expect(catalogue.status).toBe(200);
    const summit = catalogue.data.items.find((item: any) => item.name === "Helvellyn");
    expect(summit?.id).toBeTruthy();
    Object.assign(payload.expeditions[0].stages[1], { mountainId: summit.id });
    const preview = await call("/api/admin/expeditions/preview", "POST", payload);
    expect(preview.status).toBe(200);
    expect(preview.data.valid).toBe(true);
    expect((await call(`/api/admin/expeditions/${ids[0]}`)).status).toBe(404);
    expect((await call("/api/admin/expeditions/import", "POST", payload)).status).toBe(201);
    const stored = (await call(`/api/admin/expeditions/${ids[0]}`)).data.expedition;
    expect(stored.status).toBe("draft");
    expect(stored.totalDistanceKm).toBe(25);
    expect(stored.totalAscentM).toBe(1800);
    expect(stored.stages[1].catalogueMountain).toMatchObject({
      id: summit.id, name: "Helvellyn", latitude: summit.latitude, longitude: summit.longitude,
    });
    expect(stored.stages[1].ascentM).toBe(950);
    expect(stored.stages.map((s: any) => s.routeKey)).toHaveLength(2);
    expect(new Set(stored.stages.map((s: any) => s.routeKey)).size).toBe(2);
    expect((await call(`/api/sx/challenges/${ids[0]}`)).status).toBe(404);
  });
  it("rejects an invalid batch as a whole and does not overwrite an existing expedition", async () => {
    const res = await call("/api/admin/expeditions/import", "POST",
      { expeditions: [make(ids[1]), make(ids[0])] });
    expect(res.status).toBe(400);
    expect((await call(`/api/admin/expeditions/${ids[1]}`)).status).toBe(404);
    const existing = (await call(`/api/admin/expeditions/${ids[0]}`)).data.expedition;
    expect(existing.challengeName).toBe("QA temporary draft");
  });
  it("edits with concurrency protection, requires review to activate and preserves artwork", async () => {
    const stored = (await call(`/api/admin/expeditions/${ids[0]}`)).data.expedition;
    const edited = { ...make(ids[0]), challengeName: "QA edited draft", status: "active" };
    expect((await call(`/api/admin/expeditions/${ids[0]}`, "PUT",
      { expedition: edited, expectedUpdatedAt: stored.updatedAt })).status).toBe(400);
    const body = { expedition: { ...edited, reviewed: true }, expectedUpdatedAt: stored.updatedAt };
    const update = await call(`/api/admin/expeditions/${ids[0]}`, "PUT", body);
    expect(update.status).toBe(200);
    expect(update.data.expedition.status).toBe("active");
    expect(update.data.expedition.heroImage).toBe(stored.heroImage);
    expect((await call(`/api/admin/expeditions/${ids[0]}`, "PUT", body)).status).toBe(409);
    expect((await call(`/api/sx/challenges/${ids[0]}`)).status).toBe(200);
    expect((await call(`/api/admin/expeditions/${ids[0]}`, "DELETE",
      { expectedUpdatedAt: update.data.expedition.updatedAt })).status).toBe(409);
    const hidden = await call(`/api/admin/expeditions/${ids[0]}`, "PUT", {
      expedition: { ...make(ids[0]), status: "hidden" }, expectedUpdatedAt: update.data.expedition.updatedAt,
    });
    expect(hidden.status).toBe(200);
    expect((await call(`/api/sx/challenges/${ids[0]}`)).status).toBe(404);
  });
  it("deletes only an unchanged draft", async () => {
    expect((await call("/api/admin/expeditions/import", "POST", { expeditions: [make(ids[1])] })).status).toBe(201);
    const stored = (await call(`/api/admin/expeditions/${ids[1]}`)).data.expedition;
    expect((await call(`/api/admin/expeditions/${ids[1]}`, "DELETE", { expectedUpdatedAt: "stale" })).status).toBe(409);
    expect((await call(`/api/admin/expeditions/${ids[1]}`, "DELETE", { expectedUpdatedAt: stored.updatedAt })).status).toBe(200);
    expect((await call(`/api/admin/expeditions/${ids[1]}`)).status).toBe(404);
  });
});
