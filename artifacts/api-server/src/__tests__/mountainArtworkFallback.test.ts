import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

const state = vi.hoisted(() => ({
  stored: [] as Array<{ data: string }>,
}));
vi.mock("@workspace/db", () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => state.stored }) }),
    }),
  },
}));
vi.mock("../services/mountain/canonicalMountainIdentity.js", () => ({
  getCanonicalMountainById: vi.fn(async () => null),
  resolveCanonicalMountainIdentity: vi.fn(async () => null),
}));
// Exercise the no-artwork path, independently of the growing approved library.
// Kilimanjaro now has approved artwork, which must win in the real endpoint.
vi.mock("../services/artwork/approvedMountainBatch.js", () => ({
  approvedBatchHero: vi.fn(async () => null),
}));

import router, { clearMountainImageMemoryCache } from "../routes/mountain-image.js";
const realFetch = globalThis.fetch;

beforeEach(() => {
  state.stored = [];
  clearMountainImageMemoryCache();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("expedition artwork's explicit non-map fallback", () => {
  it.each([[false, true], [true, true], [false, false]])("returns an uncached illustration when a photo is unavailable (cached photo: %s; explicit fallback: %s)", async (cachedPhoto, explicitFallback) => {
    if (cachedPhoto) state.stored = [{
      data: JSON.stringify({
        thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/old-kilimanjaro.jpg",
        coord: { lat: -4, lng: 38 },
      }),
    }];
    const remoteFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).startsWith("https://upload.wikimedia.org/")) return new Response("", { status: 404 });
      return Response.json({ query: { pages: {} } });
    });
    vi.stubGlobal("fetch", remoteFetch);
    const app = express();
    app.use((req, _res, next) => { Object.assign(req, { log: { warn: vi.fn() } }); next(); });
    app.use("/api", router);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const res = await realFetch(`http://127.0.0.1:${port}/api/mountain-image?name=Kilimanjaro&width=800&height=340${explicitFallback ? "&fallback=illustration" : ""}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/png");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-mountain-artwork")).toBe("illustrative-placeholder");
      expect(new Uint8Array(await res.arrayBuffer()).slice(0, 4)).toEqual(new Uint8Array([137, 80, 78, 71]));
      expect(remoteFetch.mock.calls.some(([url]) => /mapbox|nominatim/.test(String(url)))).toBe(false);
    } finally {
      server.close();
    }
  });
});
