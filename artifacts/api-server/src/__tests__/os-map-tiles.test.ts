import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { get } from "node:http";
import type { Server } from "node:http";
import router, { validOsTile } from "../routes/map-tiles";

let server: Server, base: string;
beforeAll(async () => {
  const app = express(); app.use("/api", router);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test listener.");
  base = `http://127.0.0.1:${address.port}/api/map-tiles/os-outdoor/`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function request(path: string) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve, reject) => {
    get(base + path, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}
const fixture = () => new Uint8Array(Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from("fixture"),
]));
describe("OS tile proxy without real credentials or paid upstream calls", () => {
  it("validates Mercator addresses and caps the offline layer at 17", () => {
    expect(validOsTile(17, 0, 0)).toBe(true);
    expect(validOsTile(18, 0, 0)).toBe(false);
    expect(validOsTile(11, 2048, 0)).toBe(false);
    expect(validOsTile(11, -1, 0)).toBe(false);
    expect(validOsTile(11.5, 1, 1)).toBe(false);
  });
  it("rejects invalid grids without touching the upstream", async () => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await request("17/131072/1.png")).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("reports an unconfigured server without exposing a key", async () => {
    vi.stubEnv("OS_MAPS_KEY", "");
    expect((await request("11/995/630.png")).status).toBe(503);
  });
  it("returns a no-store PNG and retains the key only upstream", async () => {
    vi.stubEnv("OS_MAPS_KEY", "unit-test-only-not-a-credential");
    const png = fixture();
    const upstream = vi.fn().mockResolvedValue(new Response(png, { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", upstream);
    const result = await request("11/995/630.png");
    expect(result.status).toBe(200);
    expect(result.body.equals(Buffer.from(png))).toBe(true);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body.toString()).not.toContain("unit-test-only");
    expect(upstream.mock.calls[0][0]).toContain("Outdoor_3857/11/995/630.png");
  });
  it("does not cache OS bytes in the timeless satellite store", async () => {
    vi.stubEnv("OS_MAPS_KEY", "unit-test-only");
    const upstream = vi.fn().mockResolvedValue(new Response(fixture()));
    vi.stubGlobal("fetch", upstream);
    await request("11/994/630.png"); await request("11/994/630.png");
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it("rejects HTML/JSON errors disguised as a successful image", async () => {
    vi.stubEnv("OS_MAPS_KEY", "unit-test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>not a map</html>")));
    expect((await request("11/993/630.png")).status).toBe(502);
  });
  it("reports rejection and transport errors without leaking their body", async () => {
    vi.stubEnv("OS_MAPS_KEY", "unit-test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private upstream detail", { status: 403 })));
    const denied = await request("11/992/630.png");
    expect(denied.status).toBe(403); expect(denied.body.length).toBe(0);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private upstream URL")));
    const failed = await request("11/992/630.png");
    expect(failed.status).toBe(502); expect(failed.body.length).toBe(0);
  });
});