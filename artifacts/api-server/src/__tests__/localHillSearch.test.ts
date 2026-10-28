import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ai, select, canonical } = vi.hoisted(() => ({ ai: vi.fn(), select: vi.fn(), canonical: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: ai } } },
}));
vi.mock("@workspace/db", () => ({
  cachedHills: { slug: "slug" },
  db: {
    select,
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }),
  },
}));
vi.mock("../services/mountain/canonicalTrainingHills", () => ({
  canonicalTrainingHills: canonical,
}));

import router, { fetchOSMPeaks, normalizedHillSearchName, osmPeaksToHills } from "../routes/hills-unified.js";

const handler = (router as any).stack.find((r: any) => r.route?.path === "/hills-unified").route.stack[0].handle;
const peak = { id: 123, lat: 53.71, lon: -2.33, tags: { name: "Nearby Fell", ele: "400" } };
let peaks: typeof peak[];
let geocodeAvailable: boolean;
let peaksAvailable: boolean;

async function search(body: Record<string, unknown>) {
  const res = {
    statusCode: 200, body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
  await handler({ body, log: { info: vi.fn(), error: vi.fn() } }, res);
  return res;
}

beforeEach(() => {
  ai.mockReset();
  select.mockReset();
  canonical.mockReset().mockResolvedValue(null);
  peaks = [peak];
  geocodeAvailable = true;
  peaksAvailable = true;
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = String(input);
    if (url.includes("postcodes.io")) return { ok: true, json: async () => geocodeAvailable
      ? { status: 200, result: { latitude: 53.7, longitude: -2.33 } }
      : { status: 404 } };
    if (url.includes("nominatim")) return { ok: true, json: async () => [] };
    if (url.includes("overpass")) return {
      ok: peaksAvailable, status: peaksAvailable ? 200 : 504,
      json: async () => ({ elements: peaks }),
    };
    if (url.includes("opentopodata")) {
      const locations = new URL(url).searchParams.get("locations")!.split("|");
      return { ok: true, json: async () => ({
        results: locations.map((_, index) => ({ elevation: index % 5 === 0 ? 400 : 200 })),
      }) };
    }
    throw new Error(`Unexpected provider: ${url}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("mapped local training hill searches", () => {
  it("returns catalogue-backed hills without calling Overpass or AI", async () => {
    canonical.mockResolvedValue([{
      name: "Real Catalogue Fell", elevation: 170, distance: 2,
      dataSource: "canonical_verified", routeDataStatus: "terrain_calculated",
      summitElevationASL: 450, summitIdentityKey: "canonical:reviewed-id",
    }]);
    const res = await search({ location: "BB4 4BH", radius: 24.8 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      source: "canonical_verified",
      hills: [{ name: "Real Catalogue Fell", elevation: 170, summitElevationASL: 450 }],
    });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("overpass"))).toBe(false);
    expect(ai).not.toHaveBeenCalled();
  });

  it("retains independent mapped discovery during a catalogue outage", async () => {
    canonical.mockRejectedValue(new Error("catalogue unavailable"));
    const res = await search({ location: "BB4 4BH", radius: 24.7 });
    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe("overpass");
    expect(res.body.hills).toHaveLength(1);
    expect(ai).not.toHaveBeenCalled();
  });

  it("does not silently return no hills when required terrain data is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("terrain unavailable")));
    await expect(osmPeaksToHills(
      [{ id: 1, name: "Real Fell", lat: 53.7, lng: -2.33, ele: 400 }],
      53.7, -2.33, 25, 0, true, true,
    )).rejects.toThrow("terrain data is temporarily unavailable");
  });

  it.each(["http", "timeout", "incomplete"])("uses a second mapped mirror after a primary %s failure", async failure => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => {
        if (failure === "timeout") throw new Error("Timed out");
        return { ok: failure !== "http", status: 502, json: async () => ({ elements: [], remark: "runtime error: timed out" }) };
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [peak] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOSMPeaks(53.7, -2.33, 25, true)).toMatchObject([{ name: "Nearby Fell", id: 123 }]);
    expect(fetchMock.mock.calls[0][0]).toContain("overpass-api.de");
    expect(fetchMock.mock.calls[1][0]).toContain("overpass.private.coffee");
    expect(ai).not.toHaveBeenCalled();
  });

  it("does not retry a valid empty mapped search", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOSMPeaks(53.7, -2.33, 25, true)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("keeps even a single nearby peak instead of replacing it with AI results", async () => {
    const res = await search({ location: "BB4 4BH", radius: 49.1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.hills).toHaveLength(1);
    expect(res.body.hills[0]).toMatchObject({ name: "Nearby Fell", elevation: 200, surface: "Hill terrain" });
    expect(ai).not.toHaveBeenCalled();
  });
  it("does not invent a named hill or reuse a plausible-looking old cache row", async () => {
    const res = await search({ location: "BB4 4BH", hillName: "Brook's Hill" });
    expect(res.statusCode).toBe(404);
    expect(select).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });
  it("uses source coordinates for an actual name match", async () => {
    peaks = [{ ...peak, tags: { name: "Brook’s Hill", ele: "400" } }];
    const res = await search({ location: "BB4 4BH", hillName: "Brooks Hill" });
    expect(res.statusCode).toBe(200);
    expect(res.body.hill).toMatchObject({ lat: 53.71, lng: -2.33, elevation: 200 });
    expect(res.body.hill.routeIdentityKey).toBe("route:v1:osm_overpass:node:123");
    expect(ai).not.toHaveBeenCalled();
  });
  it("fails explicitly if the postcode cannot be located", async () => {
    geocodeAvailable = false;
    const res = await search({ location: "BB4 4BH", radius: 49.2 });
    expect(res.statusCode).toBe(502);
    expect(ai).not.toHaveBeenCalled();
  });
  it("returns no hills rather than AI replacements when map discovery is empty", async () => {
    peaks = [];
    const res = await search({ location: "BB4 4BH", radius: 49.3 });
    expect(res.body.hills).toEqual([]);
    expect(ai).not.toHaveBeenCalled();
  });
  it("reports upstream failure rather than pretending an area has no hills", async () => {
    peaksAvailable = false;
    const res = await search({ location: "BB4 4BH", radius: 49.4 });
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain("temporarily unavailable");
    expect(res.body.hills).toBeUndefined();
    expect(ai).not.toHaveBeenCalled();
  });
  it("prioritises the nearest peaks for training without changing expedition ordering by default", async () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1, lat: 53.71 + i * 0.005, lng: -2.33, name: `Fell ${i}`, ele: 400 + i * 10,
    }));
    const nearby = await osmPeaksToHills(candidates, 53.7, -2.33, 50, 0, true);
    const expedition = await osmPeaksToHills(candidates, 53.7, -2.33, 50, 0);
    expect(nearby.map(h => h.name)).toContain("Fell 0");
    expect(nearby.map(h => h.name)).not.toContain("Fell 24");
    expect(expedition.map(h => h.name)).toContain("Fell 24");
  });
  it("normalises punctuation without turning different hill names into matches", () => {
    expect(normalizedHillSearchName("Brook’s Hill")).toBe(normalizedHillSearchName("Brooks Hill"));
    expect(normalizedHillSearchName("Brook Street")).not.toBe(normalizedHillSearchName("Brooks Hill"));
  });
});
