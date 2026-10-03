import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalRouteRecord } from "./routeIntelligence";
const store = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    removeItem: async (key: string) => { store.delete(key); },
  },
}));
import {
  mountainPageCacheKey, mountainRoutePackageKey, readMountainPageCache,
  readMountainRoutePackage, removeMountainRoutePackage,
  saveMountainRoutePackage, writeMountainPageCache,
} from "./mountainHubStorage";
import { presentMountainAccess } from "./mountainAccess";
import { presentMountain, presentRoutes } from "./mountainDetailPresentation";

const evidence = { provider: "Test licensed source", licence: "ODbL", provenanceVersion: "1",
  rightsClassification: "reusable_geometry" as const, qaFlags: [] };
function route(): CanonicalRouteRecord {
  const identity = {
    version: { identityKey: "test:north", version: "1", routeId: "sde:route:test:north@1" as const,
      mountainId: "sde:mountain:test" as const },
    canonicalName: "North route", aliases: [], status: "verified" as const, provenance: evidence,
  };
  return {
    source: "canonical",
    mountain: { id: "sde:mountain:test", canonicalName: "Test mountain", aliases: [], routes: [],
      verification: { engineStatus: "verified", productLifecycle: "summitready_verified", qaFlags: [] },
      provenance: evidence },
    route: identity,
    definition: { identity, definitionVersion: "1", definitionKey: "test:north@1", evidence: [], status: "verified" },
    facts: { distanceM: 3000, ascentM: 500 },
    geometry: { geometryVersion: "1", coordinateReferenceSystem: "EPSG:4326",
      coordinates: [[-4, 53], [-4.01, 53.01]], direction: "forward", topologyStatus: "complete",
      derivationMethod: "test mapped network", sourceMembers: [{ ...evidence, evidenceType: "source" }] },
    elevationProfile: { profileVersion: "1", calculationVersion: "test-dem", nodataCount: 0,
      demSources: [], samples: [{ distanceM: 0, elevationM: 300 }, { distanceM: 3000, elevationM: 800 }] },
  };
}
beforeEach(() => { store.clear(); vi.clearAllMocks(); });
describe("mountain page offline information", () => {
  it("isolates common names by region, country and catalogue identity", async () => {
    const first = { name: "Ben", region: "Scotland", country: "UK", catalogueId: "one" };
    const second = { ...first, catalogueId: "two" };
    await writeMountainPageCache(first, { mountainName: "Ben", routes: [] }, "Owned guide text");
    expect((await readMountainPageCache(first))?.description).toBe("Owned guide text");
    expect(await readMountainPageCache(second)).toBeNull();
    expect(mountainPageCacheKey(first)).not.toBe(mountainPageCacheKey({ ...first, region: "Wales" }));
  });
  it("keeps the cached narrative when route facts refresh", async () => {
    const request = { name: "Test" };
    await writeMountainPageCache(request, { mountainName: "Test" }, "Guide");
    await writeMountainPageCache(request, { mountainName: "Test", routes: [] });
    expect((await readMountainPageCache(request))?.description).toBe("Guide");
  });
  it("does not treat corrupt data as a mountain page", async () => {
    const request = { name: "Test" };
    store.set(mountainPageCacheKey(request), '{"lookup":{},"savedAt":1}');
    expect(await readMountainPageCache(request)).toBeNull();
  });
});
describe("real private route data packages (not map tiles)", () => {
  it("persists an immutable licensed route and its actual facts offline", async () => {
    const record = route();
    const pkg = await saveMountainRoutePackage("one", record);
    record.facts!.distanceM = 999999;
    const saved = await readMountainRoutePackage("one", pkg.record.route.version.routeId, pkg.record.mountain.id, "1");
    expect(saved?.record.facts?.distanceM).toBe(3000);
    expect(saved?.record.geometry?.coordinates).toEqual([[-4, 53], [-4.01, 53.01]]);
    expect(saved?.sizeBytes).toBeGreaterThan(0);
  });
  it("never lends another account a package or substitutes a mountain/version", async () => {
    const r = route(); await saveMountainRoutePackage("one", r);
    expect(await readMountainRoutePackage("two", r.route.version.routeId, r.mountain.id)).toBeNull();
    expect(await readMountainRoutePackage("one", r.route.version.routeId, "sde:mountain:other")).toBeNull();
    expect(await readMountainRoutePackage("one", r.route.version.routeId, r.mountain.id, "2")).toBeNull();
  });
  it("rejects guide-only routes, unclear geometry rights and high-risk review-required records", async () => {
    const missing = route(); delete missing.geometry;
    await expect(saveMountainRoutePackage("one", missing)).rejects.toThrow("eligible");
    const unclear = route(); unclear.geometry!.sourceMembers[0].rightsClassification = "unclear";
    await expect(saveMountainRoutePackage("one", unclear)).rejects.toThrow("eligible");
    const review = route(); review.mountain.verification.engineStatus = "needs_review";
    await expect(saveMountainRoutePackage("one", review)).rejects.toThrow("eligible");
  });
  it("serializes deletion behind pending writes, without deleting another owner's package", async () => {
    const r = route();
    const saving = saveMountainRoutePackage("one", r);
    const removal = removeMountainRoutePackage("one", r.route.version.routeId);
    await saveMountainRoutePackage("two", r);
    await Promise.all([saving, removal]);
    expect(await readMountainRoutePackage("one", r.route.version.routeId, r.mountain.id)).toBeNull();
    expect(await readMountainRoutePackage("two", r.route.version.routeId, r.mountain.id)).not.toBeNull();
  });
  it("rejects an injected foreign-owner package even under the current owner's key", async () => {
    const r = route(); const foreign = await saveMountainRoutePackage("two", r);
    store.set(mountainRoutePackageKey("one", r.route.version.routeId), JSON.stringify(foreign));
    expect(await readMountainRoutePackage("one", r.route.version.routeId, r.mountain.id)).toBeNull();
  });
});
describe("safe access-point presentation", () => {
  const parking = { name: "Visitor car park", lat: 53, lng: -4, placeId: "N123", sourceUrl: "https://www.openstreetmap.org/node/123" };
  it("offers directions only after confirmation, never for a provisional mapped result", () => {
    expect(presentMountainAccess({ ...parking, status: "internet_lookup" })?.canGetDirections).toBe(false);
    expect(presentMountainAccess({ ...parking, status: "gps_confirmed" })?.canGetDirections).toBe(true);
  });
  it("rejects missing/invalid coordinates and exact summit destinations", () => {
    expect(presentMountainAccess({ ...parking, status: "gps_confirmed", lat: null })).toBeNull();
    expect(presentMountainAccess({ ...parking, status: "gps_confirmed", lng: 200 })).toBeNull();
    expect(presentMountainAccess({ ...parking, status: "gps_confirmed" }, { latitude: 53, longitude: -4 })).toBeNull();
  });
  it("does not invent a last-checked date or accept an arbitrary source link", () => {
    const point = presentMountainAccess({ ...parking, status: "internet_lookup", sourceUrl: "javascript:bad" });
    expect(point?.lastChecked).toBeUndefined();
    expect(point?.sourceUrl).toBe("https://www.openstreetmap.org/copyright");
  });
});
it("deduplicates canonical aliases by immutable identity/version, not names of different routes", () => {
  const row = { name: "North route", identityKey: "test:north", version: "1" };
  const lookup = { mountainName: "Test", source: "canonical" as const,
    canonicalIdentity: { id: "test" }, routes: [row, { ...row, name: "Alternative alias" }, { ...row, identityKey: "test:south" }] };
  expect(presentRoutes(lookup, presentMountain(lookup))).toHaveLength(2);
});