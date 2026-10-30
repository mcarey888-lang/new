import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
const relay = vi.hoisted(() => vi.fn(async (_event: unknown) => {}));
vi.mock("../services/redditConversions", () => ({
  REDDIT_EVENT_NAMES: ["first_open", "readiness_test_completed", "readiness_score_viewed", "subscription_started", "purchase"],
  sendRedditConversion: relay,
}));
import router from "../routes/reddit-conversions";

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json(), router);
  server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No synthetic HTTP port");
  url = `http://127.0.0.1:${address.port}/reddit-conversions`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => relay.mockReset().mockResolvedValue(undefined));
const event = () => ({
  eventName: "purchase", eventAt: Date.now(),
  conversionId: "00000000-0000-4000-8000-000000000001",
  installId: "00000000-0000-4000-8000-000000000002",
  plan: "synthetic-expeditions", value: 4.99, currency: "GBP",
});
const post = (body: unknown) => fetch(url, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
describe("Reddit opt-in HTTP boundary (synthetic requests, no external relay)", () => {
  it("rejects old installed clients that have no explicit advertising choice", async () => {
    expect((await post(event())).status).toBe(403);
    expect(relay).not.toHaveBeenCalled();
  });
  it("rejects declined and string-valued consent", async () => {
    for (const advertisingConsent of [false, "true"]) {
      expect((await post({ ...event(), advertisingConsent })).status).toBe(403);
    }
    expect(relay).not.toHaveBeenCalled();
  });
  it("forwards valid consented purchase metadata, not extra account or fitness fields", async () => {
    expect((await post({ ...event(), advertisingConsent: true, email: "synthetic", readiness_score: 90 })).status).toBe(202);
    expect(relay).toHaveBeenCalledOnce();
    const payload = relay.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.currency).toBe("GBP");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("readiness_score");
    expect(payload).toHaveProperty("ipAddress");
  });
  it("does not forward stale events", async () => {
    expect((await post({ ...event(), advertisingConsent: true, eventAt: 1 })).status).toBe(400);
    expect(relay).not.toHaveBeenCalled();
  });
  it("reports provider failure without claiming acceptance", async () => {
    relay.mockRejectedValueOnce(new Error("Synthetic provider outage"));
    expect((await post({ ...event(), advertisingConsent: true })).status).toBe(503);
  });
});
