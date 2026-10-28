import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { rateLimit } from "express-rate-limit";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createExpeditionCatalogueLimiter, isExpeditionCatalogueRead } from "../middlewares/expeditionCatalogueRateLimit";

describe("expedition catalogue traffic isolation", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    const general = rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false });
    const catalogue = createExpeditionCatalogueLimiter();
    app.use("/api", (req, res, next) =>
      isExpeditionCatalogueRead(req.method, req.path) ? catalogue(req, res, next) : general(req, res, next));
    app.get("/api/sx/challenges/:id", (req, res) => res.json({ challenge: { challengeId: req.params.id } }));
    app.get("/api/background", (_req, res) => res.json({ ok: true }));
    app.post("/api/virtual-expedition", (_req, res) => res.json({ ok: true }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  it("does not block opening an expedition when background traffic used the general budget", async () => {
    expect((await fetch(`${base}/api/background`)).status).toBe(200);
    expect((await fetch(`${base}/api/background`)).status).toBe(200);
    expect((await fetch(`${base}/api/background`)).status).toBe(429);
    const detail = await fetch(`${base}/api/sx/challenges/test-expedition`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual({ challenge: { challengeId: "test-expedition" } });
    expect((await fetch(`${base}/api/virtual-expedition`, { method: "POST" })).status).toBe(429);
  });
  it("still rate limits excessive catalogue reads and supplies the real retry wait", async () => {
    for (let i = 0; i < 89; i++)
      expect((await fetch(`${base}/api/sx/challenges/test-expedition`)).status).toBe(200);
    const limited = await fetch(`${base}/api/sx/challenges/test-expedition`);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ error: expect.stringContaining("Expedition browsing") });
  });
  it("never treats generation or writes as public catalogue reads", () => {
    expect(isExpeditionCatalogueRead("GET", "/sx/featured")).toBe(true);
    expect(isExpeditionCatalogueRead("GET", "/sx/challenges/for-mountain/scafell-pike")).toBe(true);
    expect(isExpeditionCatalogueRead("POST", "/sx/challenges/test")).toBe(false);
    expect(isExpeditionCatalogueRead("POST", "/virtual-expedition")).toBe(false);
    expect(isExpeditionCatalogueRead("GET", "/sx/challenges-other")).toBe(false);
    expect(isExpeditionCatalogueRead("GET", "/artwork/image/test/hero")).toBe(false);
  });
});
