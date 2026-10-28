import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class { getPrivateObjectDir() { return "/test-bucket/private"; } },
  objectStorageClient: { bucket: () => ({ file: (key: string) => ({ createReadStream: () => read(key) }) }) },
}));
import { findLocalHillPeaks, type LocalHillSnapshot } from "../services/mountain/localHillIndex";
import { localTrainingHills } from "../services/mountain/localTrainingHills";
vi.mock("../services/mountain/canonicalMountainLookup", () => ({ lookupVerifiedCanonicalSummitsInArea: vi.fn(async () => []) }));

function fixture(): LocalHillSnapshot {
  return {
    schemaVersion: 1, coverage: "United Kingdom and Ireland", builtAt: "2030-01-01T00:00:00Z",
    attribution: "© OpenStreetMap contributors", licence: "ODbL-1.0",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    sourceUrl: "https://download.geofabrik.de/europe/united-kingdom.html",
    sources: [...Array.from({ length: 40 }, (_, i) => `england/region-${i}`), "scotland", "wales", "ireland-and-northern-ireland"]
      .map(region => ({ region, url: "https://download.geofabrik.de/example.osm.pbf",
        sha256: "a".repeat(64), dataTimestamp: "2030-01-01T00:00:00Z", count: 1 })),
    peaks: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Hill ${i}`, aliases: [],
      lat: i === 0 ? 53.7 : 57, lng: i === 0 ? -2.33 : -4, ele: 100 + i })),
  };
}
beforeEach(() => { read.mockReset(); vi.resetModules(); });
afterEach(() => vi.useRealTimers());

describe("stored OSM hill index", () => {
  it("does not exclude low local peaks in favour of distant high summits", () => {
    const s = fixture();
    s.peaks[0] = { id: 1, name: "Small Tor", aliases: [], lat: 53.7, lng: -2.33, ele: 95 };
    s.peaks[1] = { id: 2, name: "High Fell", aliases: [], lat: 53.75, lng: -2.33, ele: 800 };
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25).map(p => p.name)).toEqual(["Small Tor", "High Fell"]);
  });
  it("matches source-backed aliases and keeps distant same-name hills out", () => {
    const s = fixture();
    s.peaks[0].aliases = ["Brook’s Tor"];
    s.peaks[1].name = "Brooks Tor";
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25, "Brooks Tor").map(p => p.id)).toEqual([1]);
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25, "Brook Street")).toEqual([]);
  });
  it("allows missing summit height to be sampled later, without inventing it", () => {
    const s = fixture(); s.peaks[0].ele = null;
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25)[0]).toMatchObject({ ele: null, source: "osm_extract" });
  });
  it("validates geometry and radius inputs", () => {
    expect(() => findLocalHillPeaks(fixture(), NaN, -2, 25)).toThrow();
    expect(() => findLocalHillPeaks(fixture(), 53, -2, 201)).toThrow();
  });
  it("resolves reviewed local names only for the exact recorded OSM node and position", () => {
    const s = fixture();
    s.peaks[0].name = "Tor Hill";
    s.reviewedAliases = [{ osmNodeId: 1, sourceName: "Tor Hill", lat: 53.7, lng: -2.33,
      displayName: "Musbury Tor", aliases: ["Musbury Tor"], reviewedAt: "2030-01-01",
      evidenceUrls: ["https://example.org/reviewed-source"] }];
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25, "Musbury Tor")[0]).toMatchObject({ id: 1, name: "Musbury Tor" });
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25, "Tor Hill")[0].id).toBe(1);
    s.peaks[0].lat += 0.01;
    expect(findLocalHillPeaks(s, 53.7, -2.33, 25, "Musbury Tor")).toEqual([]);
  });
  it("loads and verifies the stored snapshot once across concurrent searches", async () => {
    const bytes = Buffer.from(JSON.stringify(fixture()));
    const hash = createHash("sha256").update(bytes).digest("hex");
    read.mockImplementation((key: string) => Readable.from([key.endsWith("current.json")
      ? JSON.stringify({ objectKey: `local-hills/uk/${hash}.json`, sha256: hash, count: 1000 }) : bytes]));
    const { loadLocalHillIndex } = await import("../services/mountain/localHillIndex");
    const [one, two] = await Promise.all([loadLocalHillIndex(), loadLocalHillIndex()]);
    expect(one).toBe(two);
    expect(one.snapshot.peaks).toHaveLength(1000);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("rejects corrupt snapshots without using them as an empty result", async () => {
    read.mockImplementation((key: string) => Readable.from([key.endsWith("current.json")
      ? JSON.stringify({ objectKey: `local-hills/uk/${"a".repeat(64)}.json`, sha256: "a".repeat(64), count: 1000 }) : "{}"]));
    const { loadLocalHillIndex } = await import("../services/mountain/localHillIndex");
    await expect(loadLocalHillIndex()).rejects.toThrow("temporarily unavailable");
    await expect(loadLocalHillIndex()).rejects.toThrow("temporarily unavailable");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("retains the last validated snapshot if a later refresh is broken", async () => {
    vi.useFakeTimers();
    const bytes = Buffer.from(JSON.stringify(fixture()));
    const hash = createHash("sha256").update(bytes).digest("hex");
    read.mockImplementation((key: string) => Readable.from([key.endsWith("current.json")
      ? JSON.stringify({ objectKey: `local-hills/uk/${hash}.json`, sha256: hash, count: 1000 }) : bytes]));
    const { loadLocalHillIndex } = await import("../services/mountain/localHillIndex");
    const valid = await loadLocalHillIndex();
    vi.setSystemTime(Date.now() + 16 * 60_000);
    read.mockImplementation(() => Readable.from(["broken"]));
    expect(await loadLocalHillIndex()).toBe(valid);
  });
  it("uses the new layer without a canonical service and does not replace ascent with summit height", async () => {
    const s = fixture();
    const estimate = vi.fn(async () => [{ name: "Hill 0", summitIdentityKey: "osm:node:1",
      elevation: 60, summitElevationASL: 100, distance: 0 }]) as any;
    const data = await localTrainingHills(53.7, -2.33, 25, 0, estimate, undefined,
      async () => ({ snapshot: s } as any), async () => { throw new Error("reader down"); });
    expect(data.hills[0].elevation).toBe(60);
    expect(data.hills[0].summitElevationASL).toBe(100);
    expect(data.source).toBe("osm_extract");
    expect(estimate).toHaveBeenCalledWith(expect.any(Array), 53.7, -2.33, 25, 0, true, true);
  });
});
