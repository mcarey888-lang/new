import { describe, expect, it } from "vitest";
import {
  DNA_NO_TARGET, NOT_RECORDED, firstSentence, formatDistanceM, formatHours,
  formatKilometres, formatMetres, formatSeconds, presentMountain, presentMountainDna,
  presentRoutes, presentSelectedRoute, profileFrom, sortRoutes,
  type MountainLookupResponse,
} from "./mountainDetailPresentation";
import type { ExploreRoute, MountainVerification, RouteVersion } from "./routeIntelligence";
import type { MountainDnaResult } from "./mountainDna";

/* Arbitrary identities. Not any real mountain or route. */
const MOUNTAIN_UUID = "0d2f8a61-4c55-4d0e-9b3a-7f21c6e4a118";
const MOUNTAIN_ID = `sde:mountain:${MOUNTAIN_UUID}` as const;
const KEY_A = "a3c19f52-6b77-4c30-8d11-4e9a2f6b8c01";
const KEY_B = "b7e44d18-2f90-4a63-b5c8-19d7e3a0f426";

function canonicalLookup(overrides: Partial<MountainLookupResponse> = {}): MountainLookupResponse {
  return {
    mountainName: "Test Fell",
    country: "Testland",
    region: "Test Region",
    source: "canonical",
    routeSource: "canonical",
    canonicalIdentity: { id: MOUNTAIN_UUID, canonicalName: "Test Fell" },
    trustedFacts: {
      verificationStatus: "verified",
      elevationM: 733,
      prominenceM: 212,
      area: "Test Area",
      county: "Test County",
      provenanceVersion: "p-7",
    },
    routes: [
      {
        identityKey: KEY_A, version: "3", mountainId: MOUNTAIN_UUID,
        routeId: `sde:route:${KEY_A}@3`,
        name: "North Ridge", aliases: ["North Arete"],
        description: "A steady ridge line. It stays broad throughout.",
        startName: "Lower car park",
        startElevationM: 180, summitElevationM: 733,
        distanceKm: 8.35, totalAscentM: 553, totalDescentM: 553,
        typicalDurationHours: 3.75,
        evidence: { publisher: "Test Publisher", title: "T", url: "https://example.invalid" },
      },
      {
        identityKey: KEY_B, version: "1", mountainId: MOUNTAIN_UUID,
        routeId: `sde:route:${KEY_B}@1`,
        name: "West Gully", aliases: [],
        description: "A short, steep approach.",
        distanceKm: 5.1, totalAscentM: 601,
        evidence: { publisher: "Test Publisher", title: "T", url: "https://example.invalid" },
      },
    ],
    ...overrides,
  };
}

describe("formatting never invents a value", () => {
  it("returns null rather than a zero for an absent number", () => {
    for (const fn of [formatMetres, formatKilometres, formatDistanceM, formatHours, formatSeconds]) {
      expect(fn(undefined)).toBeNull();
      expect(fn(null)).toBeNull();
      expect(fn(Number.NaN)).toBeNull();
    }
  });

  it("formats metres and kilometres the way the design reads them", () => {
    expect(formatMetres(553)).toBe("553 m");
    expect(formatMetres(1284.6)).toBe(`${(1285).toLocaleString()} m`);
    expect(formatKilometres(8.36)).toBe("8.4 km");
    expect(formatDistanceM(8360)).toBe("8.4 km");
    /* One decimal, rounded by the platform. 8.35 is not exactly representable
       and lands on 8.3 — a 50 m difference on a multi-kilometre figure, and
       the same answer every time, which is what matters for a displayed fact. */
    expect(formatKilometres(8.35)).toBe("8.3 km");
  });

  it("rounds duration to whole minutes before carrying the hour", () => {
    expect(formatHours(3.75)).toBe("3h 45m");
    expect(formatHours(0.75)).toBe("45 min");
    expect(formatHours(2)).toBe("2h");
    /* 59.6 minutes is an hour once rounded — it must not print "60 min". */
    expect(formatHours(59.6 / 60)).toBe("1h");
    expect(formatSeconds(13_500)).toBe("3h 45m");
    expect(formatHours(0)).toBeNull();
  });

  it("takes a whole first sentence, never a character cut", () => {
    expect(firstSentence("A steady ridge line. It stays broad.")).toBe("A steady ridge line.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
    expect(firstSentence("   ")).toBeNull();
    expect(firstSentence(undefined)).toBeNull();
  });
});

describe("presentMountain", () => {
  it("carries canonical identity and keeps summit elevation as an altitude", () => {
    const m = presentMountain(canonicalLookup());
    expect(m.id).toBe(MOUNTAIN_ID);
    expect(m.verified).toBe(true);
    expect(m.fallback).toBe(false);
    expect(m.summitElevation).toMatchObject({ label: "Summit", value: "733 m", state: "verified" });
    expect(m.place).toBe("Test Region, Testland");
  });

  it("marks a fact it does not hold as missing rather than filling it", () => {
    const m = presentMountain(canonicalLookup({
      trustedFacts: { verificationStatus: "verified", elevationM: 733 },
    }));
    const grid = m.practical.find(f => f.key === "grid");
    expect(grid).toMatchObject({ state: "missing", value: null });
    const prominence = m.overview.find(f => f.key === "prominence");
    expect(prominence).toMatchObject({ state: "missing", value: null });
  });

  it("refuses identity when the lookup fell back to cache or AI", () => {
    for (const source of ["cache", "ai"] as const) {
      const m = presentMountain(canonicalLookup({ source, canonicalIdentity: undefined, trustedFacts: undefined }));
      expect(m.id).toBeNull();
      expect(m.fallback).toBe(true);
      expect(m.verified).toBe(false);
    }
  });
});

describe("presentRoutes", () => {
  it("builds a versioned canonical selection for each identified route", () => {
    const lookup = canonicalLookup();
    const routes = presentRoutes(lookup, presentMountain(lookup));
    expect(routes).toHaveLength(2);
    expect(routes[0].selection).toMatchObject({
      mountainId: MOUNTAIN_ID,
      routeId: `sde:route:${KEY_A}@3`,
      routeIdentityKey: KEY_A,
      routeVersion: "3",
    });
    expect(routes[0].verification).toBe("candidate");
  });

  it("keeps route ascent and summit altitude as separate facts", () => {
    const lookup = canonicalLookup();
    const [north] = presentRoutes(lookup, presentMountain(lookup));
    expect(north.ascent).toMatchObject({ label: "Total ascent", value: "553 m" });
    expect(north.routeSummitElevation).toMatchObject({ label: "Summit altitude", value: "733 m" });
    /* Different labels, different keys — they are never one number. */
    expect(north.ascent.key).not.toBe(north.routeSummitElevation.key);
  });

  it("refuses identity for a route row with no version", () => {
    const lookup = canonicalLookup({
      routes: [{ identityKey: KEY_A, mountainId: MOUNTAIN_UUID, name: "Unversioned", distanceKm: 4 }],
    });
    const [route] = presentRoutes(lookup, presentMountain(lookup));
    expect(route.selection).toBeNull();
    expect(route.verification).toBe("unidentified");
  });

  it("refuses identity for every route when the mountain has none", () => {
    const lookup = canonicalLookup({ source: "cache", canonicalIdentity: undefined });
    const routes = presentRoutes(lookup, presentMountain(lookup));
    expect(routes.every(r => r.selection === null)).toBe(true);
  });

  it("presents a legacy row as unidentified with candidate figures", () => {
    const lookup = canonicalLookup({
      source: "ai", canonicalIdentity: undefined, trustedFacts: undefined,
      routes: [{
        name: "Tourist Path", distance: 9, elevationGain: 700,
        highestAltitude: 733, difficulty: "Moderate", description: "A path.",
      }],
    });
    const [route] = presentRoutes(lookup, presentMountain(lookup));
    expect(route.selection).toBeNull();
    expect(route.verification).toBe("unidentified");
    expect(route.facts.find(f => f.key === "ascent")).toMatchObject({ state: "candidate" });
  });

  it("drops a missing fact from the headline rather than showing a blank", () => {
    const lookup = canonicalLookup();
    const routes = presentRoutes(lookup, presentMountain(lookup));
    /* West Gully has no duration. */
    expect(routes[1].headline.map(f => f.key)).toEqual(["distance", "ascent"]);
    expect(routes[1].headline.every(f => f.value !== null)).toBe(true);
  });
});

describe("sortRoutes", () => {
  it("sorts by a real number, largest first", () => {
    const lookup = canonicalLookup();
    const routes = presentRoutes(lookup, presentMountain(lookup));
    expect(sortRoutes(routes, "Ascent").map(r => r.name)).toEqual(["West Gully", "North Ridge"]);
    expect(sortRoutes(routes, "Distance").map(r => r.name)).toEqual(["North Ridge", "West Gully"]);
    expect(sortRoutes(routes, "Name").map(r => r.name)).toEqual(["North Ridge", "West Gully"]);
  });

  it("puts a route with no recorded figure last, never first as a zero", () => {
    const lookup = canonicalLookup({
      routes: [
        { identityKey: KEY_A, version: "1", mountainId: MOUNTAIN_UUID, routeId: `sde:route:${KEY_A}@1`, name: "No ascent recorded", distanceKm: 3 },
        { identityKey: KEY_B, version: "1", mountainId: MOUNTAIN_UUID, routeId: `sde:route:${KEY_B}@1`, name: "Has ascent", distanceKm: 3, totalAscentM: 400 },
      ],
    });
    const routes = presentRoutes(lookup, presentMountain(lookup));
    expect(sortRoutes(routes, "Ascent").map(r => r.name)).toEqual(["Has ascent", "No ascent recorded"]);
  });
});

/* ── The selected route ─────────────────────────────────────────────────── */

const VERIFIED_TRUST: MountainVerification = {
  engineStatus: "verified", productLifecycle: "summitready_verified", qaFlags: [],
};

function exploreRoute(overrides: Partial<ExploreRoute> = {}): ExploreRoute {
  const version: RouteVersion = {
    identityKey: KEY_A, version: "3",
    routeId: `sde:route:${KEY_A}@3`, mountainId: MOUNTAIN_ID,
  };
  const ok = <T,>(value: T) => ({ availability: "available" as const, value, reasons: [] });
  return {
    route: version,
    mountain: MOUNTAIN_ID,
    definition: ok({} as any),
    facts: ok({ distanceM: 8600, ascentM: 560, typicalDurationS: 14_400 } as any),
    geometry: ok({} as any),
    trust: VERIFIED_TRUST,
    attribution: null,
    trackAvailability: "can_track",
    ...overrides,
  } as ExploreRoute;
}

describe("presentSelectedRoute", () => {
  it("lets the engine's figures replace the lookup's", () => {
    const lookup = canonicalLookup();
    const [north] = presentRoutes(lookup, presentMountain(lookup));
    const selected = presentSelectedRoute(north, exploreRoute());
    expect(selected.facts.find(f => f.key === "distance")?.value).toBe("8.6 km");
    expect(selected.facts.find(f => f.key === "ascent")?.value).toBe("560 m");
    expect(selected.facts.find(f => f.key === "time")?.value).toBe("4h");
  });

  it("keeps a lookup fact the engine does not hold", () => {
    const lookup = canonicalLookup();
    const [north] = presentRoutes(lookup, presentMountain(lookup));
    const selected = presentSelectedRoute(north, exploreRoute({
      facts: { availability: "available", value: { distanceM: 8600 } as any, reasons: [] },
    }));
    expect(selected.facts.find(f => f.key === "ascent")?.value).toBe("553 m");
    expect(selected.facts.find(f => f.key === "start")?.value).toBe("Lower car park");
  });

  it("is navigable only when the engine says so", () => {
    const lookup = canonicalLookup();
    const [north] = presentRoutes(lookup, presentMountain(lookup));
    expect(presentSelectedRoute(north, exploreRoute()).eligibility.isNavigable).toBe(true);
    expect(presentSelectedRoute(north, exploreRoute({ trackAvailability: "identity_only" }))
      .eligibility.isNavigable).toBe(false);
  });

  it("is never navigable before the engine record loads", () => {
    const lookup = canonicalLookup();
    const [north] = presentRoutes(lookup, presentMountain(lookup));
    const selected = presentSelectedRoute(north, null);
    expect(selected.eligibility.isNavigable).toBe(false);
    /* Still readable and still plannable — the identity came from the lookup. */
    expect(selected.route.selection).not.toBeNull();
    expect(selected.route.verification).toBe("candidate");
  });

  it("draws no profile from fewer than two real samples", () => {
    expect(profileFrom(null)).toBeNull();
    expect(profileFrom({ samples: [] })).toBeNull();
    expect(profileFrom({ samples: [{ distanceM: 0, elevationM: 180 }] })).toBeNull();
  });

  it("drops a DEM gap instead of drawing through it", () => {
    const points = profileFrom({
      samples: [
        { distanceM: 0, elevationM: 180 },
        { distanceM: 100, elevationM: null },
        { distanceM: 200, elevationM: 260 },
      ],
    });
    expect(points).toEqual([
      { distanceM: 0, elevationM: 180 },
      { distanceM: 200, elevationM: 260 },
    ]);
  });

  it("reports the profile's high point as an altitude, not an ascent", () => {
    const lookup = canonicalLookup();
    const [north] = presentRoutes(lookup, presentMountain(lookup));
    const selected = presentSelectedRoute(north, exploreRoute(), {
      samples: [
        { distanceM: 0, elevationM: 180 },
        { distanceM: 4000, elevationM: 733 },
        { distanceM: 8000, elevationM: 200 },
      ],
    });
    expect(selected.profileHighPointM).toBe(733);
    /* The route's ascent is a different number and stays a different number. */
    expect(selected.facts.find(f => f.key === "ascent")?.value).toBe("560 m");
  });
});

describe("presentMountainDna", () => {
  it("says it has nothing to compare when there is no target", () => {
    const dna = presentMountainDna(null);
    expect(dna.state).toBe("unavailable");
    expect(dna.dimensions).toEqual([]);
    expect(dna.unavailableReason).toBe(DNA_NO_TARGET);
  });

  it("labels an unscored dimension rather than drawing an empty bar", () => {
    const result: MountainDnaResult = {
      modelVersion: "mountain-dna-v1",
      targetRouteId: `sde:route:${KEY_A}@3`,
      candidateRouteId: `sde:route:${KEY_B}@1`,
      overallScore: 71.5,
      confidence: "moderate",
      state: "degraded",
      dimensions: [
        { name: "ascent", score: 88, weight: 0.35, status: "scored", evidence: [], explanation: "e" },
        { name: "terrain", score: null, weight: 0.1, status: "unknown", evidence: [], explanation: "terrain is unknown" },
        { name: "altitude", score: null, weight: 0, status: "excluded", evidence: [], explanation: "not weighted" },
      ],
      missingDimensions: ["terrain"],
      explanations: [],
    };
    const dna = presentMountainDna(result);
    expect(dna.overallScore).toBe(71.5);
    /* The weightless, excluded dimension is not part of the verdict. */
    expect(dna.dimensions.map(d => d.name)).toEqual(["ascent", "terrain"]);
    expect(dna.dimensions[0].valueLabel).toBe("88");
    expect(dna.dimensions[1]).toMatchObject({ score: null, valueLabel: "Not comparable" });
  });
});

describe("no fabricated values reach the screen", () => {
  it("shows a missing fact as null so the view can say it is not recorded", () => {
    const lookup = canonicalLookup({ trustedFacts: { verificationStatus: "verified" } });
    const m = presentMountain(lookup);
    expect(m.summitElevation.value).toBeNull();
    expect(m.summitElevation.state).toBe("missing");
    expect(NOT_RECORDED).toBe("Not recorded");
  });
});
