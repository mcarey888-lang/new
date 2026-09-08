import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { Hill } from "../routes/hills-unified.js";
import type { TargetMountainProfile } from "../routes/virtual-expedition.js";
import type { TrustedCanonicalRoute, VerifiedCanonicalMountain } from "../services/mountain/canonicalMountainLookup.js";
import { matchDeterministicExpedition } from "../services/virtualExpedition/deterministicMatcher.js";
import { createVirtualExpeditionHandler, type VirtualExpeditionHandlerDependencies } from "../services/virtualExpedition/virtualExpeditionHandler.js";

const profile = (overrides: Partial<TargetMountainProfile> = {}): TargetMountainProfile => ({
  name: "Target", country: "Test", summitElevation: 3_000, totalElevationGain: 2_000,
  totalDistance: 28, estimatedDays: 2, day1ElevationGain: 1_000, day2ElevationGain: 1_000,
  maxDailyElevation: 1_000, difficulty: "Hard", technicalGrade: null,
  altitudeExposure: "Moderate", notes: "", routeDna: {
    scrambling: 3, exposure: 3, ridgeTravel: 4, endurance: 7, technicalMovement: 3,
    navigationRequired: 4, steepness: 6, scenicQuality: 8, descentDifficulty: 5, sustainedClimbing: 8,
  }, ...overrides,
});

const hill = (name: string, summit: number, overrides: Partial<Hill> = {}): Hill => ({
  name, elevation: 600, distance: 5, repeats: 1, totalElevation: 600,
  surface: "rocky mountain path", grade: "Hard", emoji: "mountain",
  routeType: "hill", routeDistance: 8, estimatedTime: "3 h (terrain estimate)",
  routeName: "Terrain-estimated summit circuit",
  summitElevationASL: summit, summitIdentityKey: `osm:${name}`,
  routeIdentityKey: `route:v1:osm:${name}`, dataSource: "osm_overpass",
  routeDataStatus: "terrain_calculated", ...overrides,
});
const summits = [hill("High Peak", 1_200), hill("Middle Peak", 1_000), hill("Lower Peak", 800)];

const route = (): TrustedCanonicalRoute => ({
  identityKey: "verified-ridge", name: "Verified Ridge", aliases: [],
  description: "Rocky sustained ridge scrambling", startName: "Verified start",
  startElevationM: 900, summitElevationM: 4_200, distanceKm: 24,
  totalAscentM: 1_650, totalDescentM: 1_650, typicalDurationHours: 11,
  evidence: { publisher: "Authority", title: "Route", url: "https://example.test/route" },
});
const mountain = (): VerifiedCanonicalMountain => ({
  id: "mountain-1", sourceFeatureId: "feature-1", canonicalSourceKey: "canonical:one",
  name: "Canonical Target", matchedBy: "canonical_name", country: "Test",
  elevationM: 4_200, prominenceM: 900, latitude: 45, longitude: 6,
  provenanceVersion: "test", routes: [route()],
});

function deps(overrides: Partial<VirtualExpeditionHandlerDependencies> = {}): VirtualExpeditionHandlerDependencies {
  return {
    canonicalLookup: vi.fn(async () => ({ kind: "none" as const })),
    canonicalAreaLookup: vi.fn(async () => []),
    resolveFallbackProfile: vi.fn(async () => ({
      profile: profile(), source: "legacy_profile_cache", cached: true, usedAi: false,
    })),
    loadLocalCandidates: vi.fn(async () => ({
      hills: [], sources: [], queriedRows: { cachedHills: 0, seededTrails: 0 },
    })),
    geocode: vi.fn(async () => ({ lat: 54.5, lng: -3.1, displayName: "Test" })),
    fetchPeaks: vi.fn(async () => [{ id: 1 } as any]),
    peaksToHills: vi.fn(async () => summits),
    fetchElevations: vi.fn(async () => []),
    prepareCandidateHills: hills => hills,
    matchCandidates: matchDeterministicExpedition,
    computePhysicalScore: () => ({ overall: 80, elevation: 80, duration: 80, altitude: 80, consecutiveDays: 100 }),
    now: () => 1_000,
    ...overrides,
  };
}

async function invoke(dependencies: VirtualExpeditionHandlerDependencies, body: Record<string, unknown> = {}) {
  const res = {
    statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
  } as unknown as Response & { statusCode: number; body: any };
  await createVirtualExpeditionHandler(dependencies)({
    body: { targetMountain: "Target", userLocation: `Test ${Math.random()}`, radius: 30, ...body },
  } as Request, res);
  return res;
}

describe("virtual expedition summit-first data engine", () => {
  it("returns canonical ambiguity before profile or local discovery", async () => {
    const resolveFallbackProfile = vi.fn();
    const fetchPeaks = vi.fn();
    const response = await invoke(deps({
      canonicalLookup: vi.fn(async () => ({
        kind: "ambiguous" as const,
        matches: [
          { id: "a", sourceFeatureId: "a", canonicalSourceKey: "a", name: "Twin", country: "A" },
          { id: "b", sourceFeatureId: "b", canonicalSourceKey: "b", name: "Twin", country: "B" },
        ],
      })),
      resolveFallbackProfile,
      fetchPeaks,
    }));
    expect(response.statusCode).toBe(409);
    expect(response.body.code).toBe("AMBIGUOUS_MOUNTAIN");
    expect(resolveFallbackProfile).not.toHaveBeenCalled();
    expect(fetchPeaks).not.toHaveBeenCalled();
  });

  it("requires selection among multiple verified target routes and returns evidence", async () => {
    const other = { ...route(), identityKey: "other-route", name: "Other route" };
    const response = await invoke(deps({
      canonicalLookup: vi.fn(async () => ({
        kind: "match" as const, mountain: { ...mountain(), routes: [route(), other] },
      })),
    }));
    expect(response.statusCode).toBe(409);
    expect(response.body.code).toBe("TARGET_ROUTE_SELECTION_REQUIRED");
    expect(response.body.routes).toHaveLength(2);
    expect(response.body.routes[0].evidence.publisher).toBe("Authority");
  });

  it("rejects a selected target route belonging to another mountain", async () => {
    const response = await invoke(deps({
      canonicalLookup: vi.fn(async () => ({ kind: "match" as const, mountain: mountain() })),
    }), { targetRouteIdentityKey: "not-this-mountain" });
    expect(response.statusCode).toBe(422);
    expect(response.body.code).toBe("TARGET_ROUTE_NOT_FOUND");
  });

  it("uses verified target route ascent separately from summit elevation", async () => {
    const response = await invoke(deps({
      canonicalLookup: vi.fn(async () => ({ kind: "match" as const, mountain: mountain() })),
    }), { targetRouteIdentityKey: "verified-ridge" });
    expect(response.statusCode).toBe(200);
    expect(response.body.targetProfile.totalElevationGain).toBe(1_650);
    expect(response.body.targetProfile.summitElevation).toBe(4_200);
    expect(response.body.provenance.metricSources.totalElevationGain)
      .toBe("summit_data_engine.route_facts.verified");
  });

  it("keeps canonical target provenance while local summit discovery is independent", async () => {
    const response = await invoke(deps({
      canonicalLookup: vi.fn(async () => ({ kind: "match" as const, mountain: mountain() })),
    }), { targetMountain: "Canonical Target", targetRouteIdentityKey: "verified-ridge" });
    expect(response.statusCode).toBe(200);
    expect(response.body.provenance).toMatchObject({
      targetMountainSource: "summit_data_engine_verified",
      targetRouteSource: "summit_data_engine_verified_route",
      expeditionStyle: "quickest_high_summits",
    });
  });

  it("preserves canonical target identity while route profile uses labelled fallback", async () => {
    const canonical = { ...mountain(), name: "Canonical Name", elevationM: 7_123, routes: [] };
    const response = await invoke(deps({
      canonicalLookup: vi.fn(async () => ({ kind: "match" as const, mountain: canonical })),
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.targetProfile.name).toBe("Canonical Name");
    expect(response.body.targetProfile.summitElevation).toBe(7_123);
    expect(response.body.provenance.targetMountainSource).toBe("summit_data_engine_verified");
    expect(response.body.provenance.targetRouteSource).toBe("legacy_profile_cache");
  });

  it("keeps canonical misses strictly on fallback provenance", async () => {
    const response = await invoke(deps({
      resolveFallbackProfile: vi.fn(async () => ({
        profile: profile(), source: "ai_estimated_profile", cached: false, usedAi: true,
      })),
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.provenance).toMatchObject({
      targetMountainSource: "ai_estimated_profile",
      targetRouteSource: "ai_estimated_profile",
      usedAi: true,
    });
  });

  it("does not let a feasible catalogue of generic Ways suppress named OSM summits", async () => {
    const ways = Array.from({ length: 4 }, (_, index) => hill(`Valley Way ${index}`, 150, {
      elevation: 900, surface: "gravel trail", routeType: "circular", routeDistance: 20,
    }));
    const fetchPeaks = vi.fn(async () => [{ id: 1 } as any]);
    const response = await invoke(deps({
      loadLocalCandidates: vi.fn(async () => ({
        hills: ways, sources: ["seeded_osm"], queriedRows: { cachedHills: 0, seededTrails: ways.length },
      })),
      fetchPeaks,
    }));
    expect(response.statusCode).toBe(200);
    expect(fetchPeaks).toHaveBeenCalledOnce();
    expect(response.body.recommendedHills).toHaveLength(2);
    expect(response.body.recommendedHills.map((candidate: Hill) => candidate.name))
      .toEqual(["High Peak", "Middle Peak"]);
    expect(response.body.recommendedHills.every((candidate: Hill) => candidate.repeats === 1)).toBe(true);
  });

  it("fails honestly and does not fall back to local Ways when summit evidence is depleted", async () => {
    const ways = [hill("Long Valley Way", 100, { surface: "gravel trail", routeDistance: 25 })];
    const response = await invoke(deps({
      fetchPeaks: vi.fn(async () => []),
      loadLocalCandidates: vi.fn(async () => ({
        hills: ways, sources: ["seeded_osm"], queriedRows: { cachedHills: 0, seededTrails: 1 },
      })),
    }));
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toContain("Insufficient verified or named summit evidence");
    expect(response.body.warnings.join(" ")).toContain("excluded");
  });

  it("caps a three-day request at three ordered distinct summits", async () => {
    const response = await invoke(deps(), { daysOverride: 3 });
    expect(response.statusCode).toBe(200);
    expect(response.body.recommendedHills).toHaveLength(3);
    expect(response.body.recommendedHills.map((candidate: Hill) => candidate.name))
      .toEqual(["High Peak", "Middle Peak", "Lower Peak"]);
    expect(response.body.provenance.principalSummitCount).toBe(3);
  });

  it("uses verified canonical area summit routes before OSM fallback", async () => {
    const localSummit = {
      ...mountain(),
      id: "local-one",
      canonicalSourceKey: "canonical:local-one",
      name: "Canonical Local Summit",
      elevationM: 1_250,
      routes: [{ ...route(), identityKey: "canonical-local-route", summitElevationM: 1_250 }],
    };
    const fetchPeaks = vi.fn();
    const response = await invoke(deps({
      canonicalAreaLookup: vi.fn(async () => [localSummit]),
      fetchPeaks,
    }), { daysOverride: 1 });
    expect(response.statusCode).toBe(200);
    expect(fetchPeaks).not.toHaveBeenCalled();
    expect(response.body.recommendedHills[0]).toMatchObject({
      name: "Canonical Local Summit",
      routeName: "Verified Ridge",
      summitIdentityKey: "canonical:local-one",
      dataSource: "canonical_verified",
      routeDataStatus: "external_route",
    });
  });

  it("deduplicates a canonical multi-route summit in the eligible shortlist", async () => {
    const local = {
      ...mountain(),
      routes: [route(), { ...route(), identityKey: "second-ridge", name: "Second Ridge" }],
    };
    const response = await invoke(deps({
      canonicalAreaLookup: vi.fn(async () => [local]),
    }), { daysOverride: 1 });
    expect(response.statusCode).toBe(200);
    expect(response.body.provenance.eligibleSummitShortlist).toHaveLength(1);
    expect(response.body.provenance.eligibleSummitShortlist[0]).toMatchObject({
      summitIdentityKey: "canonical:one",
      routeAvailable: true,
      source: "canonical_verified",
    });
  });

  it("reports a canonical summit without complete route facts as skipped", async () => {
    const routeLess = { ...mountain(), routes: [], name: "Route-less Canonical" };
    const response = await invoke(deps({
      canonicalAreaLookup: vi.fn(async () => [routeLess]),
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.provenance.skippedHigherSummits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "Route-less Canonical",
        reasons: ["No complete verified route facts are available for this canonical summit."],
      }),
    ]));
  });

  it("reports excluded generic local Ways after successful OSM discovery", async () => {
    const response = await invoke(deps({
      loadLocalCandidates: vi.fn(async () => ({
        hills: [hill("Coast Way sightseeing trail", 100, { routeDistance: 28 })],
        sources: ["seeded_osm"],
        queriedRows: { cachedHills: 0, seededTrails: 1 },
      })),
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.provenance.excludedLongTrails[0]).toMatchObject({
      name: "Coast Way sightseeing trail",
    });
    expect(response.body.provenance.excludedLongTrails[0].reason).toContain("generic local route");
  });

  it("caches canonical summit evidence despite advisory ascent mismatch", async () => {
    const lowAscent = {
      ...mountain(),
      routes: [{ ...route(), totalAscentM: 100, identityKey: "short-canonical-route" }],
    };
    const canonicalAreaLookup = vi.fn(async () => [lowAscent]);
    const fetchPeaks = vi.fn();
    const dependencies = deps({ canonicalAreaLookup, fetchPeaks });
    const request = { userLocation: "Canonical advisory cache" };
    const first = await invoke(dependencies, request);
    const second = await invoke(dependencies, request);
    expect(first.statusCode).toBe(200);
    expect(first.body.provenance.advisoryRatios.ascent).toBeLessThan(.9);
    expect(second.body._meta.areaCacheHit).toBe(true);
    expect(canonicalAreaLookup).toHaveBeenCalledOnce();
    expect(fetchPeaks).not.toHaveBeenCalled();
  });

  it("preserves distinct same-name summit identities deterministically", async () => {
    const twins = [
      hill("Twin Peak", 1_000, {
        summitIdentityKey: "osm:twin-west", routeIdentityKey: "route:twin-west", lat: 51, lng: -3,
      }),
      hill("Twin Peak", 950, {
        summitIdentityKey: "osm:twin-east", routeIdentityKey: "route:twin-east", lat: 51.05, lng: -3,
      }),
    ];
    const response = await invoke(deps({ peaksToHills: vi.fn(async () => [...twins].reverse()) }));
    expect(response.statusCode).toBe(200);
    expect(response.body.recommendedHills.map((candidate: Hill) => candidate.routeIdentityKey))
      .toEqual(["route:twin-west", "route:twin-east"]);
  });

  it("retries depleted canonical and OSM discovery rather than caching failure", async () => {
    const fetchPeaks = vi.fn(async () => []);
    const loadLocalCandidates = vi.fn(async () => ({
      hills: [], sources: [], queriedRows: { cachedHills: 0, seededTrails: 0 },
    }));
    const dependencies = deps({ fetchPeaks, loadLocalCandidates });
    const request = { userLocation: "Depleted retry" };
    const first = await invoke(dependencies, request);
    const second = await invoke(dependencies, request);
    expect(first.statusCode).toBe(404);
    expect(second.statusCode).toBe(404);
    expect(fetchPeaks).toHaveBeenCalledTimes(2);
    expect(loadLocalCandidates).toHaveBeenCalledTimes(2);
  });

  it("marks all-null selected summit topo enrichment partial and retries", async () => {
    const noAltitude = hill("Topo Missing Peak", 800, {
      summitElevationASL: undefined, lat: 54.5, lng: -3.1,
    });
    const fetchElevations = vi.fn(async () => [null]);
    const dependencies = deps({
      peaksToHills: vi.fn(async () => [noAltitude]),
      fetchElevations,
    });
    const request = { userLocation: "Topo retry" };
    const first = await invoke(dependencies, request);
    const second = await invoke(dependencies, request);
    expect(first.statusCode).toBe(200);
    expect(first.body.provenance.localDiscovery.summitElevationEnrichmentStatus).toBe("partial");
    expect(fetchElevations).toHaveBeenCalledTimes(2);
    expect(second.body._meta.areaCacheHit).toBe(false);
  });

  it("records complete selected summit topo enrichment", async () => {
    const noAltitude = hill("Topo Peak", 800, {
      summitElevationASL: undefined, lat: 54.5, lng: -3.1,
    });
    const response = await invoke(deps({
      peaksToHills: vi.fn(async () => [noAltitude]),
      fetchElevations: vi.fn(async () => [812]),
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.provenance.localDiscovery.summitElevationEnrichmentStatus).toBe("complete");
  });

  it("provides stable deterministic reasons without AI narration", async () => {
    const first = await invoke(deps(), { userLocation: "Stable narration A" });
    const second = await invoke(deps(), { userLocation: "Stable narration B" });
    expect(first.statusCode).toBe(200);
    expect(first.body.expedition.concept).toContain("highest suitable local summit objectives");
    expect(first.body.expedition.days.flatMap((day: any) => day.routes)
      .every((planned: any) => planned.why.includes("deterministic fit"))).toBe(true);
    expect(first.body.recommendedHills).toEqual(second.body.recommendedHills);
    expect(first.body.provenance.aiUsage.narration).toBe(false);
  });

  it("reports elevation-ordered shortlist, advisory ratios, and skipped cap reasons", async () => {
    const response = await invoke(deps());
    expect(response.body.provenance.eligibleSummitShortlist.map((entry: any) => entry.summitElevationASL))
      .toEqual([1_200, 1_000, 800]);
    expect(response.body.provenance.advisoryRatios).toEqual({
      ascent: expect.any(Number), distance: expect.any(Number),
    });
    expect(response.body.provenance.skippedHigherSummits[0].reasons[0]).toContain("cap");
  });

  it("caches successful named-OSM evidence and its post-discovery exclusions", async () => {
    const loadLocalCandidates = vi.fn(async () => ({
      hills: [], sources: [], queriedRows: { cachedHills: 0, seededTrails: 0 },
    }));
    const fetchPeaks = vi.fn(async () => [{ id: 1 } as any]);
    const dependencies = deps({ loadLocalCandidates, fetchPeaks });
    const request = { userLocation: "Cached named summit evidence" };
    await invoke(dependencies, request);
    const second = await invoke(dependencies, request);
    expect(second.statusCode).toBe(200);
    expect(fetchPeaks).toHaveBeenCalledOnce();
    expect(loadLocalCandidates).toHaveBeenCalledOnce();
    expect(second.body._meta.areaCacheHit).toBe(true);
  });
});