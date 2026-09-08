import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { Hill } from "../routes/hills-unified.js";
import type { TargetMountainProfile } from "../routes/virtual-expedition.js";
import type { SourcedHill } from "../services/virtualExpedition/localCandidates.js";
import type {
  TrustedCanonicalRoute,
  VerifiedCanonicalMountain,
} from "../services/mountain/canonicalMountainLookup.js";
import { canonicalRouteToTargetProfile } from "../services/virtualExpedition/canonicalTargetProfile.js";
import { matchDeterministicExpedition } from "../services/virtualExpedition/deterministicMatcher.js";
import {
  createVirtualExpeditionHandler,
  type FallbackProfileResult,
  type VirtualExpeditionHandlerDependencies,
} from "../services/virtualExpedition/virtualExpeditionHandler.js";

function targetProfile(overrides: Partial<TargetMountainProfile> = {}): TargetMountainProfile {
  return {
    name: "Fallback target",
    country: "Unknown",
    summitElevation: 3_000,
    totalElevationGain: 2_000,
    totalDistance: 28,
    estimatedDays: 1,
    day1ElevationGain: 2_000,
    day2ElevationGain: null,
    maxDailyElevation: 2_000,
    difficulty: "Hard",
    technicalGrade: null,
    altitudeExposure: "Moderate",
    notes: "",
    routeDna: {
      scrambling: 3,
      exposure: 3,
      ridgeTravel: 4,
      endurance: 8,
      technicalMovement: 3,
      navigationRequired: 4,
      steepness: 6,
      scenicQuality: 8,
      descentDifficulty: 5,
      sustainedClimbing: 8,
    },
    ...overrides,
  };
}

function route(
  identityKey: string,
  overrides: Partial<TrustedCanonicalRoute> = {},
): TrustedCanonicalRoute {
  return {
    identityKey,
    name: `Route ${identityKey}`,
    aliases: [],
    description: "A sustained ridge ascent.",
    startName: "Valley trailhead",
    startElevationM: 900,
    summitElevationM: 4_200,
    distanceKm: 24,
    totalAscentM: 1_650,
    totalDescentM: 1_650,
    typicalDurationHours: 11,
    evidence: {
      publisher: "National Mountain Authority",
      title: `Official route ${identityKey}`,
      url: `https://example.test/routes/${identityKey}`,
    },
    ...overrides,
  };
}

function mountain(overrides: Partial<VerifiedCanonicalMountain> = {}): VerifiedCanonicalMountain {
  return {
    id: "mountain-1",
    sourceFeatureId: "feature-1",
    canonicalSourceKey: "summit-engine:feature-1",
    name: "Test Mountain",
    matchedBy: "canonical_name",
    country: "France",
    region: "Alps",
    area: "Test Massif",
    county: "Haute-Savoie",
    elevationM: 4_500,
    prominenceM: 1_200,
    colHeightM: 3_300,
    gridReference: "TEST123",
    summitFeature: "summit",
    latitude: 45.8,
    longitude: 6.8,
    provenanceVersion: "2026-01",
    routes: [route("normal-route")],
    ...overrides,
  };
}

function hill(
  name: string,
  elevation: number,
  overrides: Partial<SourcedHill> = {},
): SourcedHill {
  return {
    name,
    elevation,
    distance: 5,
    repeats: 1,
    totalElevation: elevation,
    surface: "Rocky path",
    grade: "Hard",
    emoji: "mountain",
    lat: 54.5,
    lng: -3.1,
    routeType: "out-and-back",
    routeDistance: 10,
    estimatedTime: "4 h",
    summitElevationASL: 900,
    dataSource: "seeded_osm",
    routeDataStatus: "seeded_estimate",
    ...overrides,
  };
}

const standardHills = [
  hill("Alpha Ridge", 620),
  hill("Bravo Fell", 540),
  hill("Charlie Pike", 460),
  hill("Delta Tor", 380),
];

type MockResponse = Response & {
  statusCode: number;
  body: unknown;
};

function response(): MockResponse {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as unknown as MockResponse;
}

function fallback(
  overrides: Partial<FallbackProfileResult> = {},
): FallbackProfileResult {
  return {
    profile: targetProfile(),
    source: "legacy_profile_cache",
    cached: true,
    usedAi: false,
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<VirtualExpeditionHandlerDependencies> = {},
): VirtualExpeditionHandlerDependencies {
  return {
    canonicalLookup: vi.fn(async () => ({ kind: "none" as const })),
    resolveFallbackProfile: vi.fn(async () => fallback()),
    loadLocalCandidates: vi.fn(async () => ({
      hills: standardHills,
      sources: ["seeded_osm" as const],
      queriedRows: { cachedHills: 0, seededTrails: standardHills.length },
    })),
    geocode: vi.fn(async () => ({ lat: 54.5, lng: -3.1, displayName: "Test location" })),
    fetchPeaks: vi.fn(async () => []),
    peaksToHills: vi.fn(async () => []),
    fetchElevations: vi.fn(async () => []),
    prepareCandidateHills: hills => hills,
    matchCandidates: matchDeterministicExpedition,
    computePhysicalScore: () => ({
      overall: 81,
      elevation: 90,
      duration: 80,
      altitude: 60,
      consecutiveDays: 75,
    }),
    now: () => 1_000,
    ...overrides,
  };
}

async function invoke(
  deps: VirtualExpeditionHandlerDependencies,
  body: Record<string, unknown> = {},
): Promise<MockResponse> {
  const req = {
    body: {
      targetMountain: "Test Mountain",
      userLocation: `Test location ${Math.random()}`,
      radius: 30,
      ...body,
    },
  } as unknown as Request;
  const res = response();
  await createVirtualExpeditionHandler(deps)(req, res);
  return res;
}

describe("virtual expedition data engine regressions", () => {
  it("returns canonical ambiguity before fallback profile or local lookup", async () => {
    const order: string[] = [];
    const resolveFallbackProfile = vi.fn(async () => {
      order.push("fallback");
      return fallback();
    });
    const loadLocalCandidates = vi.fn(async () => {
      order.push("local");
      return {
        hills: standardHills,
        sources: ["seeded_osm" as const],
        queriedRows: { cachedHills: 0, seededTrails: 4 },
      };
    });
    const canonicalLookup = vi.fn(async () => {
      order.push("canonical");
      return {
        kind: "ambiguous" as const,
        matches: [
          {
            id: "m1",
            sourceFeatureId: "f1",
            canonicalSourceKey: "key-1",
            name: "Twin Peak",
            country: "US",
            region: "Colorado",
          },
          {
            id: "m2",
            sourceFeatureId: "f2",
            canonicalSourceKey: "key-2",
            name: "Twin Peak",
            country: "US",
            region: "California",
          },
        ],
      };
    });

    const res = await invoke(dependencies({
      canonicalLookup,
      resolveFallbackProfile,
      loadLocalCandidates,
    }));

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({
      code: "AMBIGUOUS_MOUNTAIN",
      candidates: expect.arrayContaining([
        expect.objectContaining({ canonicalSourceKey: "key-1" }),
      ]),
    }));
    expect(order).toEqual(["canonical"]);
    expect(resolveFallbackProfile).not.toHaveBeenCalled();
    expect(loadLocalCandidates).not.toHaveBeenCalled();
  });

  it("requires explicit selection among multiple verified routes and returns evidence", async () => {
    const order: string[] = [];
    const routes = [
      route("north-ridge"),
      route("south-face", {
        evidence: {
          publisher: "Alpine Club",
          title: "South face route card",
          url: "https://example.test/south",
        },
      }),
    ];
    const resolveFallbackProfile = vi.fn(async () => {
      order.push("fallback");
      return fallback();
    });
    const loadLocalCandidates = vi.fn(async () => {
      order.push("local");
      throw new Error("local lookup must not run");
    });
    const deps = dependencies({
      canonicalLookup: vi.fn(async () => {
        order.push("canonical");
        return { kind: "match" as const, mountain: mountain({ routes }) };
      }),
      resolveFallbackProfile,
      loadLocalCandidates,
    });

    const res = await invoke(deps, { requireVerifiedRouteSelection: true });
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(409);
    expect(body.code).toBe("TARGET_ROUTE_SELECTION_REQUIRED");
    expect(body.routes).toHaveLength(2);
    expect(body.routes[0]).toEqual(expect.objectContaining({
      identityKey: "north-ridge",
      evidence: expect.objectContaining({
        publisher: "National Mountain Authority",
        url: "https://example.test/routes/north-ridge",
      }),
    }));
    expect(body.routes[1].evidence.title).toBe("South face route card");
    expect(body.targetMountain).toEqual(expect.objectContaining({
      canonicalName: "Test Mountain",
      matchedBy: "canonical_name",
    }));
    expect(order).toEqual(["canonical"]);
  });

  it("uses only complete selected verified route facts and keeps ascent separate from summit", async () => {
    const verifiedRoute = route("selected", {
      summitElevationM: 4_810,
      totalAscentM: 1_730,
      distanceKm: 27.4,
      typicalDurationHours: 12.5,
    });
    const canonical = mountain({ name: "Verified Peak", elevationM: 4_799, routes: [verifiedRoute] });
    const adapted = canonicalRouteToTargetProfile(canonical, verifiedRoute);

    expect(adapted?.profile).toEqual(expect.objectContaining({
      name: "Verified Peak",
      summitElevation: 4_810,
      totalElevationGain: 1_730,
      totalDistance: 27.4,
    }));
    expect(adapted?.profile.summitElevation).not.toBe(adapted?.profile.totalElevationGain);
    expect(adapted?.metricSources.totalElevationGain)
      .toBe("summit_data_engine.route_facts.verified");

    const order: string[] = [];
    const resolveFallbackProfile = vi.fn(async () => {
      order.push("fallback");
      return fallback();
    });
    const res = await invoke(dependencies({
      canonicalLookup: vi.fn(async () => {
        order.push("canonical");
        return { kind: "match" as const, mountain: canonical };
      }),
      resolveFallbackProfile,
      loadLocalCandidates: vi.fn(async () => {
        order.push("local");
        return {
          hills: standardHills,
          sources: ["seeded_osm" as const],
          queriedRows: { cachedHills: 0, seededTrails: 4 },
        };
      }),
    }), { targetRouteIdentityKey: "selected" });
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(200);
    expect(order).toEqual(["canonical", "local"]);
    expect(resolveFallbackProfile).not.toHaveBeenCalled();
    expect(body.targetProfile).toEqual(expect.objectContaining({
      summitElevation: 4_810,
      totalElevationGain: 1_730,
      totalDistance: 27.4,
    }));
    expect(body.provenance).toEqual(expect.objectContaining({
      targetMountainSource: "summit_data_engine_verified",
      targetRouteSource: "summit_data_engine_verified_route",
      routeDataStatus: "verified",
      selectedTargetRouteIdentityKey: "selected",
      usedAi: false,
    }));
  });

  it("preserves canonical summit identity while using an unverified legacy route cache", async () => {
    const order: string[] = [];
    const canonical = mountain({
      name: "Canonical Summit",
      country: "Nepal",
      elevationM: 7_123,
      routes: [],
    });
    const res = await invoke(dependencies({
      canonicalLookup: vi.fn(async () => {
        order.push("canonical");
        return { kind: "match" as const, mountain: canonical };
      }),
      resolveFallbackProfile: vi.fn(async () => {
        order.push("fallback");
        return fallback({
          profile: targetProfile({
            name: "Old cache spelling",
            country: "Cached country",
            summitElevation: 6_999,
            totalElevationGain: 2_100,
          }),
        });
      }),
      loadLocalCandidates: vi.fn(async () => {
        order.push("local");
        return {
          hills: standardHills,
          sources: ["seeded_osm" as const],
          queriedRows: { cachedHills: 0, seededTrails: 4 },
        };
      }),
    }));
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(200);
    expect(order).toEqual(["canonical", "fallback", "local"]);
    expect(body.targetProfile).toEqual(expect.objectContaining({
      name: "Canonical Summit",
      country: "Nepal",
      summitElevation: 7_123,
      totalElevationGain: 2_100,
    }));
    expect(body.provenance).toEqual(expect.objectContaining({
      targetMountainSource: "summit_data_engine_verified",
      targetRouteSource: "legacy_profile_cache",
      routeDataStatus: "unverified",
      usedAi: false,
    }));
    expect(body.provenance.metricSources.totalElevationGain).toBe("legacy_profile_cache");
    expect(body.provenance.metricSources.summitElevation)
      .toBe("summit_data_engine.mountains.verified");
  });

  it("treats a canonical miss or review-only record strictly as fallback provenance", async () => {
    const order: string[] = [];
    const res = await invoke(dependencies({
      canonicalLookup: vi.fn(async () => {
        order.push("canonical");
        return { kind: "none" as const };
      }),
      resolveFallbackProfile: vi.fn(async () => {
        order.push("fallback");
        return fallback({
          source: "ai_estimated_profile",
          cached: false,
          usedAi: true,
        });
      }),
      loadLocalCandidates: vi.fn(async () => {
        order.push("local");
        return {
          hills: standardHills,
          sources: ["seeded_osm" as const],
          queriedRows: { cachedHills: 0, seededTrails: 4 },
        };
      }),
    }), { targetMountain: "Review-only Mountain" });
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(200);
    expect(order).toEqual(["canonical", "fallback", "local"]);
    expect(body.provenance).toEqual(expect.objectContaining({
      targetMountainSource: "ai_estimated_profile",
      targetRouteSource: "ai_estimated_profile",
      routeDataStatus: "unverified",
      selectedTargetRouteIdentityKey: null,
      usedAi: true,
    }));
    expect(JSON.stringify(body.provenance.metricSources)).not.toContain("summit_data_engine");
  });

  it("uses three or more real local candidates without Overpass and matches deterministically", async () => {
    const fetchPeaks = vi.fn(async () => {
      throw new Error("Overpass must not run");
    });
    const peaksToHills = vi.fn(async () => {
      throw new Error("peak conversion must not run");
    });
    const candidateNames = new Set(standardHills.map(candidate => candidate.name));
    const deps = dependencies({ fetchPeaks, peaksToHills });

    const first = await invoke(deps, { userLocation: "Deterministic area one" });
    const second = await invoke(deps, { userLocation: "Deterministic area two" });
    const firstBody = first.body as Record<string, any>;
    const secondBody = second.body as Record<string, any>;

    expect(first.statusCode).toBe(200);
    expect(fetchPeaks).not.toHaveBeenCalled();
    expect(peaksToHills).not.toHaveBeenCalled();
    expect(firstBody.recommendedHills.every((selected: Hill) =>
      candidateNames.has(selected.name))).toBe(true);
    expect(firstBody.recommendedHills).toEqual(secondBody.recommendedHills);
    expect(firstBody.provenance.rankedCandidateScores)
      .toEqual(secondBody.provenance.rankedCandidateScores);
    const ratio = firstBody.recommendedHills.reduce(
      (sum: number, selected: Hill) => sum + selected.elevation * selected.repeats,
      0,
    ) / firstBody.targetProfile.totalElevationGain;
    expect(ratio).toBeGreaterThanOrEqual(0.9);
    expect(ratio).toBeLessThanOrEqual(1.1);
  });

  it("preserves two distant same-name route identities in recommendations and days", async () => {
    const westKey = "route:v1:seeded_osm:twin-peak:51.00000,-3.00000";
    const eastKey = "route:v1:seeded_osm:twin-peak:51.05000,-3.00000";
    const sameNameHills = [
      hill("Twin Peak", 450, { routeIdentityKey: westKey, lat: 51, lng: -3 }),
      hill("Twin Peak", 450, { routeIdentityKey: eastKey, lat: 51.05, lng: -3 }),
      hill("Small Tor", 80, {
        routeIdentityKey: "route:v1:seeded_osm:small-tor:51.02000,-3.10000",
        lat: 51.02,
        lng: -3.1,
      }),
    ];
    const res = await invoke(dependencies({
      resolveFallbackProfile: vi.fn(async () => fallback({
        profile: targetProfile({
          totalElevationGain: 900,
          day1ElevationGain: 900,
          maxDailyElevation: 900,
        }),
      })),
      loadLocalCandidates: vi.fn(async () => ({
        hills: sameNameHills,
        sources: ["seeded_osm" as const],
        queriedRows: { cachedHills: 0, seededTrails: sameNameHills.length },
      })),
    }), { userLocation: "Same-name identity regression" });
    const body = res.body as Record<string, any>;
    const recommendedKeys = body.recommendedHills.map((candidate: Hill) =>
      candidate.routeIdentityKey);
    const plannedKeys = body.expedition.days.flatMap((day: any) =>
      day.routes.map((route: any) => route.routeIdentityKey));

    expect(res.statusCode).toBe(200);
    expect(recommendedKeys).toEqual(expect.arrayContaining([westKey, eastKey]));
    expect(plannedKeys).toEqual(expect.arrayContaining([westKey, eastKey]));
    expect(new Set(recommendedKeys).size).toBe(body.recommendedHills.length);
  });

  it("enriches when three database records are target-incompatible", async () => {
    const unsafe = [
      hill("Unsafe One", 900, { hazardLevel: "severe" }),
      hill("Unsafe Two", 800, { hazardLevel: "severe" }),
      hill("Unsafe Three", 700, { hazardLevel: "severe" }),
    ];
    const enriched = [
      hill("Safe Enriched One", 700, { dataSource: "osm_overpass", routeDataStatus: "terrain_calculated" } as any),
      hill("Safe Enriched Two", 650, { dataSource: "osm_overpass", routeDataStatus: "terrain_calculated" } as any),
      hill("Safe Enriched Three", 600, { dataSource: "osm_overpass", routeDataStatus: "terrain_calculated" } as any),
    ];
    const fetchPeaks = vi.fn(async () => [{} as any]);
    const res = await invoke(dependencies({
      resolveFallbackProfile: vi.fn(async () => fallback({
        profile: targetProfile({ totalElevationGain: 1_000 }),
      })),
      loadLocalCandidates: vi.fn(async () => ({
        hills: unsafe,
        sources: ["seeded_osm" as const],
        queriedRows: { cachedHills: 0, seededTrails: 3 },
      })),
      fetchPeaks,
      peaksToHills: vi.fn(async () => enriched),
    }), { userLocation: "Unsafe three enrichment regression" });
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(200);
    expect(fetchPeaks).toHaveBeenCalledOnce();
    expect(body.provenance.localDiscovery).toEqual(expect.objectContaining({
      preparedDatabaseCandidates: 0,
      externalEnrichmentAttempted: true,
      externalEnrichmentStatus: "complete",
      externalRoutesAdded: 3,
    }));
  });

  it("enriches when three safe database records cannot attain the target ascent", async () => {
    const tooSmall = [
      hill("Infeasible One", 700),
      hill("Infeasible Two", 700),
      hill("Infeasible Three", 700),
    ];
    const fetchPeaks = vi.fn(async () => [{} as any]);
    const res = await invoke(dependencies({
      resolveFallbackProfile: vi.fn(async () => fallback({
        profile: targetProfile({ totalElevationGain: 1_000 }),
      })),
      loadLocalCandidates: vi.fn(async () => ({
        hills: tooSmall,
        sources: ["seeded_osm" as const],
        queriedRows: { cachedHills: 0, seededTrails: 3 },
      })),
      fetchPeaks,
      peaksToHills: vi.fn(async () => [
        hill("Large Enriched", 950, {
          dataSource: "osm_overpass",
          routeDataStatus: "terrain_calculated",
        } as any),
      ]),
    }), { userLocation: "Insufficient ascent enrichment regression" });
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(200);
    expect(fetchPeaks).toHaveBeenCalledOnce();
    expect(body.provenance.localDiscovery.databaseCandidatesFeasible).toBe(false);
    expect(body.provenance.localDiscovery.targetAscentThreshold).toBe(900);
    expect(body.recommendedHills.some((candidate: Hill) =>
      candidate.name === "Large Enriched")).toBe(true);
  });

  it("does not enrich when one prepared candidate can reach the target band", async () => {
    const fetchPeaks = vi.fn(async () => {
      throw new Error("feasible one-route catalogue must not enrich");
    });
    const res = await invoke(dependencies({
      loadLocalCandidates: vi.fn(async () => ({
        hills: [hill("Single feasible route", 1_900)],
        sources: ["seeded_osm" as const],
        queriedRows: { cachedHills: 0, seededTrails: 1 },
      })),
      fetchPeaks,
    }), { userLocation: "Single feasible route regression" });
    const body = res.body as Record<string, any>;

    expect(res.statusCode).toBe(200);
    expect(fetchPeaks).not.toHaveBeenCalled();
    expect(body.provenance.localDiscovery.databaseCandidatesFeasible).toBe(true);
  });

  it("retries depleted empty Overpass evidence instead of caching it as complete", async () => {
    const infeasible = [
      hill("Empty Retry One", 700),
      hill("Empty Retry Two", 700),
      hill("Empty Retry Three", 700),
    ];
    const loadLocalCandidates = vi.fn(async () => ({
      hills: infeasible,
      sources: ["seeded_osm" as const],
      queriedRows: { cachedHills: 0, seededTrails: 3 },
    }));
    const fetchPeaks = vi.fn(async () => []);
    const deps = dependencies({
      resolveFallbackProfile: vi.fn(async () => fallback({
        profile: targetProfile({ totalElevationGain: 1_000 }),
      })),
      loadLocalCandidates,
      fetchPeaks,
    });
    const request = { userLocation: "Empty Overpass retry regression", targetMountain: "Empty target" };
    const first = await invoke(deps, request);
    const second = await invoke(deps, request);
    const firstBody = first.body as Record<string, any>;
    const secondBody = second.body as Record<string, any>;

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(fetchPeaks).toHaveBeenCalledTimes(2);
    expect(loadLocalCandidates).toHaveBeenCalledTimes(2);
    expect(firstBody.provenance.localDiscovery.externalEnrichmentStatus).toBe("depleted");
    expect(firstBody.provenance.warnings.some((warning: string) =>
      warning.includes("returned no peaks"))).toBe(true);
    expect(secondBody._meta.areaCacheHit).toBe(false);
  });

  it("labels all-null summit topo enrichment partial and retries the uncached area", async () => {
    const routeWithoutAltitude = hill("No topo altitude", 1_900, {
      summitElevationASL: undefined,
    });
    const loadLocalCandidates = vi.fn(async () => ({
      hills: [routeWithoutAltitude],
      sources: ["seeded_osm" as const],
      queriedRows: { cachedHills: 0, seededTrails: 1 },
    }));
    const fetchElevations = vi.fn(async () => [null]);
    const deps = dependencies({ loadLocalCandidates, fetchElevations });
    const request = { userLocation: "All null topo retry regression" };
    const first = await invoke(deps, request);
    const second = await invoke(deps, request);
    const firstBody = first.body as Record<string, any>;
    const secondBody = second.body as Record<string, any>;

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(fetchElevations).toHaveBeenCalledTimes(2);
    expect(loadLocalCandidates).toHaveBeenCalledTimes(2);
    expect(firstBody.provenance.localDiscovery.summitElevationEnrichmentStatus).toBe("partial");
    expect(firstBody.provenance.warnings.some((warning: string) =>
      warning.includes("returned no usable elevations"))).toBe(true);
    expect(secondBody._meta.areaCacheHit).toBe(false);
  });

  it("reuses complete enriched evidence with diagnostics and truthful cache-hit timings", async () => {
    const tooSmall = [
      hill("Cached Small One", 100),
      hill("Cached Small Two", 100),
      hill("Cached Small Three", 100),
    ];
    const loadLocalCandidates = vi.fn(async () => ({
      hills: tooSmall,
      sources: ["seeded_osm" as const],
      queriedRows: { cachedHills: 0, seededTrails: 3 },
    }));
    const fetchPeaks = vi.fn(async () => [{} as any]);
    const deps = dependencies({
      loadLocalCandidates,
      fetchPeaks,
      peaksToHills: vi.fn(async () => [
        hill("Cached Large Enriched", 1_900, {
          dataSource: "osm_overpass",
          routeDataStatus: "terrain_calculated",
        } as any),
      ]),
    });
    const request = { userLocation: "Complete enriched cache regression" };
    const first = await invoke(deps, request);
    const second = await invoke(deps, request);
    const firstBody = first.body as Record<string, any>;
    const secondBody = second.body as Record<string, any>;

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(loadLocalCandidates).toHaveBeenCalledOnce();
    expect(fetchPeaks).toHaveBeenCalledOnce();
    expect(secondBody._meta.areaCacheHit).toBe(true);
    expect(secondBody.provenance.localQueriedRows).toEqual({ cachedHills: 0, seededTrails: 3 });
    expect(secondBody.provenance.localDiscovery).toEqual(firstBody.provenance.localDiscovery);
    expect(secondBody.provenance.warnings).toEqual(firstBody.provenance.warnings);
    expect(secondBody._meta.timingsMs.localDatabaseLookup).toBe(0);
    expect(secondBody._meta.timingsMs.externalGeographicEnrichment).toBe(0);
    expect(secondBody._meta.timingsMs.elevationEnrichment).toBe(0);
  });

  it("builds the Mont Blanc Lake District regression entirely from cache and seeded routes", async () => {
    const order: string[] = [];
    const lakeRoutes = [
      hill("Helvellyn via Swirls", 760, { routeDistance: 13, estimatedTime: "5 h" }),
      hill("Great Gable from Wasdale", 824, { routeDistance: 11, estimatedTime: "6 h" }),
      hill("Scafell Pike from Wasdale", 903, { routeDistance: 14, estimatedTime: "6 h" }),
    ];
    const fetchPeaks = vi.fn(async () => []);
    const fetchElevations = vi.fn(async () => []);
    const res = await invoke(dependencies({
      canonicalLookup: vi.fn(async () => {
        order.push("canonical");
        return {
          kind: "match" as const,
          mountain: mountain({
            id: "mont-blanc",
            sourceFeatureId: "mont-blanc-feature",
            canonicalSourceKey: "summit-engine:mont-blanc",
            name: "Mont Blanc",
            elevationM: 4_806,
            routes: [],
          }),
        };
      }),
      resolveFallbackProfile: vi.fn(async () => {
        order.push("fallback");
        return fallback({
          profile: targetProfile({
            name: "Mont Blanc cached",
            country: "France",
            summitElevation: 4_800,
            totalElevationGain: 2_400,
            totalDistance: 30,
            day1ElevationGain: 2_400,
            maxDailyElevation: 2_400,
          }),
        });
      }),
      geocode: vi.fn(async () => ({ lat: 54.46, lng: -3.09, displayName: "Lake District" })),
      loadLocalCandidates: vi.fn(async () => {
        order.push("local");
        return {
          hills: lakeRoutes,
          sources: ["seeded_osm" as const],
          queriedRows: { cachedHills: 0, seededTrails: 3 },
        };
      }),
      fetchPeaks,
      fetchElevations,
    }), {
      targetMountain: "Mont Blanc",
      userLocation: "Lake District regression",
    });
    const body = res.body as Record<string, any>;
    const names = new Set(lakeRoutes.map(candidate => candidate.name));
    const achieved = body.recommendedHills.reduce(
      (sum: number, selected: Hill) => sum + selected.elevation * selected.repeats,
      0,
    );

    expect(res.statusCode).toBe(200);
    expect(order).toEqual(["canonical", "fallback", "local"]);
    expect(fetchPeaks).not.toHaveBeenCalled();
    expect(fetchElevations).not.toHaveBeenCalled();
    expect(body.targetProfile).toEqual(expect.objectContaining({
      name: "Mont Blanc",
      summitElevation: 4_806,
      totalElevationGain: 2_400,
    }));
    expect(body.recommendedHills.every((selected: Hill) => names.has(selected.name))).toBe(true);
    expect(achieved / 2_400).toBeGreaterThanOrEqual(0.9);
    expect(achieved / 2_400).toBeLessThanOrEqual(1.1);
    expect(body.provenance).toEqual(expect.objectContaining({
      routeDataStatus: "unverified",
      localCandidateSources: ["seeded_osm"],
      usedAi: false,
      aiUsage: {
        targetProfile: false,
        localCandidateDiscovery: false,
        routeSelection: false,
        narration: false,
      },
    }));
    expect(body.provenance.localQueriedRows).toEqual({ cachedHills: 0, seededTrails: 3 });
    expect(body.provenance.selectedCandidateRouteDataStatuses).toContain("seeded_estimate");
    expect(body.provenance.warnings).toContain(
      "Selected routes include synthetic OSM-derived seeded estimates; these are not verified route facts.",
    );
    expect(body._meta.timingsMs).toEqual(expect.objectContaining({
      canonicalTargetLookup: expect.any(Number),
      localDatabaseLookup: expect.any(Number),
      deterministicMatching: expect.any(Number),
      aiNarration: 0,
      total: expect.any(Number),
    }));
  });

  it("selected-route generation needs no narration concept and still supplies stable reasons", async () => {
    const selectedRoute = route("no-narration", {
      description: "",
      summitElevationM: 3_600,
      totalAscentM: 2_000,
      distanceKm: 28,
      typicalDurationHours: 9,
    });
    const deps = dependencies({
      canonicalLookup: vi.fn(async () => ({
        kind: "match" as const,
        mountain: mountain({ routes: [selectedRoute] }),
      })),
      resolveFallbackProfile: vi.fn(async () => {
        throw new Error("verified route must not use fallback narration/profile");
      }),
    });

    const first = await invoke(deps, {
      targetRouteIdentityKey: "no-narration",
      userLocation: "No narration area one",
    });
    const second = await invoke(deps, {
      targetRouteIdentityKey: "no-narration",
      userLocation: "No narration area two",
    });
    const firstBody = first.body as Record<string, any>;
    const secondBody = second.body as Record<string, any>;

    expect(first.statusCode).toBe(200);
    expect(firstBody.expedition.concept).toContain("deterministic local route combination");
    expect(firstBody.expedition.days.flatMap((day: any) => day.routes)
      .every((planned: any) => planned.why.includes("deterministic fit"))).toBe(true);
    expect(firstBody.expedition).toEqual(secondBody.expedition);
    expect(firstBody.provenance.aiUsage.narration).toBe(false);
    expect(firstBody._meta.usingAiExpedition).toBe(false);
  });
});