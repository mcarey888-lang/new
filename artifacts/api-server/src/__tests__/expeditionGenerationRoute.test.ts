import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../middlewares/requireAdminKey.js", () => ({
  requireAdminKey: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.headers["x-test-admin"] === "authorized" ? next() : res.status(401).json({ error: "Unauthorized" }),
}));
vi.mock("../routes/virtual-expedition.js", () => ({
  createDataEngineVirtualExpeditionHandler: (transform: (data: unknown) => unknown) =>
    async (req: express.Request, res: express.Response) => {
      const reply = await engine.run(req.body);
      res.status(reply.status ?? 200).json(reply.status && reply.status !== 200 ? reply.body : transform(reply.body));
    },
}));
import { expeditionAdminRouter } from "../routes/expedition-admin";

const sample = () => ({
  targetProfile: { name: "Mont Blanc" },
  expedition: { title: "Test preview", concept: "Test only", days: [{ routes: [{ name: "Test Peak", routeIdentityKey: "route:test" }] }] },
  recommendedHills: [{ name: "Test Peak", routeIdentityKey: "route:test", elevation: 600, routeDistance: 9 }],
});
describe("admin generation boundary (mocked providers, no paid calls or database writes)", () => {
  let server: Server, base: string;
  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use("/api", expeditionAdminRouter);
    server = await new Promise<Server>(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin/expeditions/generate`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => engine.run.mockReset().mockResolvedValue({ body: sample() }));
  const request = (body: unknown, authorized = true) => fetch(base, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? { "x-test-admin": "authorized" } : {}) },
    body: JSON.stringify(body),
  });
  it("requires admin authority before generation", async () => {
    expect((await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside" }, false)).status).toBe(401);
    expect(engine.run).not.toHaveBeenCalled();
  });
  it.each([
    {}, { targetMountain: "  ", userLocation: "Ambleside" },
    { targetMountain: "Mont Blanc", userLocation: "  " },
    { targetMountain: "Mont Blanc", userLocation: "Ambleside", daysOverride: 1.5 },
    { targetMountain: "Mont Blanc", userLocation: "Ambleside", daysOverride: Number.MAX_SAFE_INTEGER + 1 },
    { targetMountain: "Mont Blanc", userLocation: "Ambleside", radius: -1 },
    { targetMountain: "Mont Blanc", userLocation: "Ambleside", targetCountry: 123 },
  ])("rejects malformed input before paid work: %j", async body => {
    expect((await request(body)).status).toBe(400);
    expect(engine.run).not.toHaveBeenCalled();
  });
  it("uses the same engine, keeps explicit route choices and returns an unsaved draft only", async () => {
    const response = await request({
      targetMountain: "Mont Blanc", userLocation: "Ambleside", targetCountry: "France",
      targetRouteIdentityKey: "verified:chosen", difficultyPreference: "Hard", daysOverride: 3,
      mode: "automatic", profileOnly: true, resolveOnly: true, manualBuilder: true,
    });
    expect(response.status).toBe(200);
    expect(engine.run.mock.calls[0][0]).toMatchObject({
      targetCountry: "France", targetRouteIdentityKey: "verified:chosen", daysOverride: 3,
      mode: "automatic", profileOnly: false, resolveOnly: false, manualBuilder: false,
    });
    const preview = await response.json() as { draft: unknown };
    expect(preview.draft).toMatchObject({
      status: "draft", reviewed: false, updatedAt: "", summary: "Test only",
      stages: [{ routeName: "Test Peak", distanceKm: 9, ascentM: 600 }],
    });
  });
  it("validates previews carrying exact catalogue IDs without manufacturing catalogue records", async () => {
    const data = sample();
    Object.assign(data.recommendedHills[0], { summitIdentityKey: "sde:mountain:7ca79ad2-9b3d-4c09-b79c-d6ddfa4ee122" });
    engine.run.mockResolvedValue({ body: data });
    const response = await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside" });
    expect(response.status).toBe(200);
    const result = await response.json() as { draft: { stages: unknown[] } };
    expect(result.draft.stages[0]).toMatchObject({
      mountainId: "7ca79ad2-9b3d-4c09-b79c-d6ddfa4ee122", catalogueMountain: null,
    });
  });
  it("passes explicit manual discovery and preserves the eligible pool without creating an empty draft", async () => {
    const manualBuilder = {
      eligibleSummitPool: [{
        summitName: "Test Peak", summitIdentityKey: "summit:test",
        routes: [
          { routeName: "Test Route", routeIdentityKey: "route:test", summitIdentityKey: "summit:test", routeGainM: 600, routeDistanceKm: 9 },
          { routeName: null, routeIdentityKey: null, summitIdentityKey: "summit:test", routeGainM: 550, routeDistanceKm: null },
        ],
      }],
      selectedRouteIdentityKeys: [],
      targetDna: { elevationGainM: 1800, distanceKm: 25 },
      liveDna: { overallScore: 0 },
    };
    engine.run.mockResolvedValue({ body: { ...sample(), recommendedHills: [], manualBuilder } });
    const response = await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside", mode: "manual", selectedRouteIdentityKeys: [] });
    expect(response.status).toBe(200);
    expect(engine.run.mock.calls[0][0]).toMatchObject({ mode: "manual", manualBuilder: true, selectedRouteIdentityKeys: [], resolveOnly: false });
    expect(await response.json()).toMatchObject({ draft: null, manualBuilder });
  });
  it("returns the selected draft and matching data without auto-saving a manual choice", async () => {
    const manualBuilder = { eligibleSummitPool: [], selectedRouteIdentityKeys: ["route:test"], targetDna: { elevationGainM: 600, distanceKm: 9 } };
    engine.run.mockResolvedValue({ body: { ...sample(), manualBuilder } });
    const response = await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside", mode: "manual_builder", selectedRouteIdentityKeys: ["route:test"] });
    expect(response.status).toBe(200);
    expect(engine.run.mock.calls[0][0]).toMatchObject({ mode: "manual", selectedRouteIdentityKeys: ["route:test"] });
    expect(await response.json()).toMatchObject({ draft: { status: "draft", reviewed: false, stages: [{ routeKey: "route:test" }] }, manualBuilder });
  });
  it("rejects too many manual stages before provider work", async () => {
    const response = await request({
      targetMountain: "Mont Blanc", userLocation: "Ambleside", mode: "manual",
      selectedRouteIdentityKeys: Array.from({ length: 31 }, (_, i) => `route:${i}`),
    });
    expect(response.status).toBe(400);
    expect(engine.run).not.toHaveBeenCalled();
  });
  it("passes through target disambiguation without generating or choosing a draft", async () => {
    const body = { error: "Choose a route", code: "TARGET_ROUTE_SELECTION_REQUIRED", routes: [{ identityKey: "exact", name: "Exact route" }] };
    engine.run.mockResolvedValue({ status: 409, body });
    const response = await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(body);
  });
  it("does not confuse a long walking allowance with the number of generated stages", async () => {
    const response = await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside", daysOverride: 365 });
    expect(response.status).toBe(200);
    expect(engine.run.mock.calls[0][0].daysOverride).toBe(365);
  });
  it("bounds concurrent paid work and releases its lock when generation ends", async () => {
    let release!: (reply: unknown) => void;
    let started!: () => void;
    const running = new Promise<void>(resolve => { started = resolve; });
    engine.run.mockImplementationOnce(() => { started(); return new Promise(resolve => { release = resolve; }); });
    const first = request({ targetMountain: "Mont Blanc", userLocation: "Ambleside" });
    await running;
    expect((await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside" })).status).toBe(429);
    release({ body: sample() });
    expect((await first).status).toBe(200);
    expect((await request({ targetMountain: "Mont Blanc", userLocation: "Ambleside" })).status).toBe(200);
  });
});
