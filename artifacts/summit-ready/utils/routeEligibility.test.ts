import { describe, expect, it } from "vitest";
import {
  canonicalSelection, offlineDownloadRequest, routeEligibility, startRouteHandoff,
} from "./routeEligibility";
import { CAPABILITIES } from "../constants/capabilities";
import type { ExploreRoute, MountainVerification, RouteVersion } from "./routeIntelligence";

/* Arbitrary canonical identities. Not any real mountain or route. */
const MOUNTAIN = "sde:mountain:0d2f8a61-4c55-4d0e-9b3a-7f21c6e4a118" as const;
const IDENTITY = "d41b6f0e-7c2a-4f18-9a44-8b5e3c9d71af";
const VERSION: RouteVersion = {
  identityKey: IDENTITY,
  version: "4",
  routeId: `sde:route:${IDENTITY}@4`,
  mountainId: MOUNTAIN,
};

const VERIFIED_TRUST: MountainVerification = {
  engineStatus: "verified",
  productLifecycle: "summitready_verified",
  qaFlags: [],
};

function route(overrides: Partial<ExploreRoute> = {}): ExploreRoute {
  const ok = <T,>(value: T) => ({ availability: "available" as const, value, reasons: [] });
  const provenance = {
    provider: "Summit Data Engine",
    attribution: "Source attribution",
    provenanceVersion: "1",
    rightsClassification: "reusable_geometry" as const,
    qaFlags: [],
  };
  return {
    route: VERSION,
    mountain: MOUNTAIN,
    definition: ok({} as any),
    facts: ok({} as any),
    geometry: ok({
      geometryVersion: "1",
      coordinateReferenceSystem: "EPSG:4326" as const,
      coordinates: [[-3.9, 53.1], [-3.8, 53.2]],
      direction: "forward" as const,
      derivationMethod: "sde",
      sourceMembers: [{ ...provenance, evidenceType: "source" as const }],
      topologyStatus: "complete" as const,
    }),
    trust: VERIFIED_TRUST,
    attribution: provenance,
    trackAvailability: "can_track",
    ...overrides,
  } as ExploreRoute;
}

describe("routeEligibility", () => {
  it("lets a verified canonical route do everything the design allows", () => {
    const e = routeEligibility(route());
    expect(e.state).toBe("verified");
    expect(e.isNavigable).toBe(true);
    expect(e.canAddToPlan).toBe(true);
    expect(e.canInspect).toBe(true);
  });

  it("refuses navigation when the engine says identity only", () => {
    const e = routeEligibility(route({ trackAvailability: "identity_only" }));
    expect(e.state).toBe("candidate");
    expect(e.isNavigable).toBe(false);
    /* still inspectable and still plannable */
    expect(e.canInspect).toBe(true);
    expect(e.canAddToPlan).toBe(true);
  });

  it("accepts the API's published geometry DTO and enforces reusable rights, EPSG:4326 and valid points", () => {
    expect(routeEligibility(route()).isNavigable).toBe(true);
    expect(routeEligibility(route({
      attribution: { ...route().attribution!, rightsClassification: "unclear" },
    })).isNavigable).toBe(false);
    const validGeometry = (route().geometry as any).value;
    expect(routeEligibility(route({
      geometry: { availability: "available", value: {
        ...validGeometry, coordinateReferenceSystem: "EPSG:3857",
      }, reasons: [] },
    })).isNavigable).toBe(false);
    expect(routeEligibility(route({
      geometry: { availability: "available", value: {
        ...validGeometry, coordinates: [[200, 53], [201, 54]],
      }, reasons: [] },
    })).isNavigable).toBe(false);
  });

  it("refuses navigation when the mountain is not SummitReady-verified", () => {
    const e = routeEligibility(route({
      trust: { ...VERIFIED_TRUST, productLifecycle: "community_confirmed" },
    }));
    expect(e.isNavigable).toBe(false);
  });

  it("refuses navigation when the engine has not verified the record", () => {
    const e = routeEligibility(route({
      trust: { ...VERIFIED_TRUST, engineStatus: "needs_review" },
    }));
    expect(e.isNavigable).toBe(false);
  });

  it("refuses everything but inspection without a canonical identity", () => {
    const e = routeEligibility(route({ route: null, mountain: null, trackAvailability: "unavailable" }));
    expect(e.state).toBe("unidentified");
    expect(e.isNavigable).toBe(false);
    expect(e.canAddToPlan).toBe(false);
    expect(e.canInspect).toBe(true);
  });

  it("refuses everything but inspection for a null route", () => {
    const e = routeEligibility(null);
    expect(e.state).toBe("unidentified");
    expect(e.isNavigable).toBe(false);
    expect(e.canAddToPlan).toBe(false);
  });

  it("never offers a capability production does not have", () => {
    const e = routeEligibility(route());
    expect(e.canView3D).toBe(CAPABILITIES.routeView3D);
    expect(e.canDownloadOffline).toBe(CAPABILITIES.routeOfflineDownload && e.isNavigable);
  });

  it("surfaces the engine's own reasons without editing them", () => {
    const e = routeEligibility(route({
      trackAvailability: "identity_only",
      geometry: { availability: "unavailable", value: null, reasons: ["missing_geometry"] },
      facts: { availability: "unavailable", value: null, reasons: ["missing_metric", "missing_geometry"] },
    } as Partial<ExploreRoute>));
    expect(e.reasons).toContain("missing_geometry");
    expect(e.reasons).toContain("missing_metric");
    /* de-duplicated */
    expect(e.reasons.filter(r => r === "missing_geometry")).toHaveLength(1);
  });
});

describe("canonicalSelection", () => {
  it("carries mountain, route and VERSION", () => {
    const s = canonicalSelection(route(), { routeName: " North Ridge ", mountainName: " A Peak " });
    expect(s).toMatchObject({
      mountainId: MOUNTAIN,
      routeId: `sde:route:${IDENTITY}@4`,
      routeIdentityKey: IDENTITY,
      routeVersion: "4",
      routeName: "North Ridge",
      mountainName: "A Peak",
    });
  });

  it("is null without a canonical identity", () => {
    expect(canonicalSelection(route({ route: null }), {})).toBeNull();
    expect(canonicalSelection(route({ mountain: null }), {})).toBeNull();
    expect(canonicalSelection(null, {})).toBeNull();
  });

  it("is null when the version is missing — a route without a version is not identified", () => {
    const noVersion = route({ route: { ...VERSION, version: "" } });
    expect(canonicalSelection(noVersion, {})).toBeNull();
  });

  it("rejects route IDs that do not encode the exact identity, version and mountain", () => {
    expect(canonicalSelection(route({
      route: { ...VERSION, routeId: "sde:route:other@4" as RouteVersion["routeId"] },
    }), {})).toBeNull();
    expect(canonicalSelection(route({
      route: { ...VERSION, mountainId: "sde:mountain:other" as RouteVersion["mountainId"] },
    }), {})).toBeNull();
  });

  it("falls back to the identity key rather than inventing a name", () => {
    const s = canonicalSelection(route(), {});
    expect(s?.routeName).toBe(IDENTITY);
  });
});

describe("startRouteHandoff — the guard, not the button", () => {
  it("hands a verified route into Track with its full identity", () => {
    const h = startRouteHandoff(route(), { routeName: "North Ridge", mountainName: "A Peak" });
    expect(h).toMatchObject({
      mountainId: MOUNTAIN,
      routeIdentityKey: IDENTITY,
      routeVersion: "4",
    });
  });

  it("returns null for an unverified route even when called directly", () => {
    expect(startRouteHandoff(route({ trackAvailability: "identity_only" }), {})).toBeNull();
    expect(startRouteHandoff(route({ trust: { ...VERIFIED_TRUST, engineStatus: "imported" } }), {})).toBeNull();
    expect(startRouteHandoff(route({ trackAvailability: "unavailable" }), {})).toBeNull();
  });

  it("returns null for a route with no canonical identity", () => {
    expect(startRouteHandoff(route({ route: null, mountain: null }), {})).toBeNull();
    expect(startRouteHandoff(null, {})).toBeNull();
  });

  it("cannot be bypassed by supplying a display name", () => {
    const h = startRouteHandoff(
      route({ trackAvailability: "identity_only" }),
      { routeName: "Striding Edge", mountainName: "Helvellyn" },
    );
    expect(h).toBeNull();
  });
});

describe("offlineDownloadRequest", () => {
  it("returns null while production has no offline capability", () => {
    /* This asserts today's truth. If the capability is built, this test's
       expectation flips WITH the flag, not silently. */
    expect(CAPABILITIES.routeOfflineDownload).toBe(false);
    expect(offlineDownloadRequest(route())).toBeNull();
  });

  it("returns null for an unverified route regardless of capability", () => {
    expect(offlineDownloadRequest(route({ trackAvailability: "identity_only" }))).toBeNull();
    expect(offlineDownloadRequest(null)).toBeNull();
  });
});

describe("capability flags state today's truth", () => {
  it("3D is absent", () => {
    expect(CAPABILITIES.routeView3D).toBe(false);
  });
  it("offline route download is absent", () => {
    expect(CAPABILITIES.routeOfflineDownload).toBe(false);
  });
});
