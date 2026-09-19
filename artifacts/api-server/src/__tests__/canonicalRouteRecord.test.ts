import { describe, expect, it } from "vitest";
import { buildCanonicalRouteRecord } from "../services/mountain/canonicalRouteRecord";
import { parseCanonicalRouteRequest } from "../routes/canonical-route-records";

const row = (overrides: Record<string, unknown> = {}) => ({
  mountainId: "mountain-1",
  mountainName: "Tryfan",
  mountainStatus: "verified",
  mountainProvenanceVersion: "sde-v1",
  routeIdentityKey: "tryfan-north",
  routeVersion: "2026-01",
  routeName: "North Ridge",
  routeAliases: [],
  routeStatus: "verified",
  definitionVersion: "2026-01",
  definitionKey: "definition-1",
  definitionDescription: "Verified route.",
  definitionStatus: "verified",
  factVersion: "2026-01",
  distanceKm: 8,
  totalAscentM: 900,
  totalDescentM: 900,
  startElevationM: 300,
  summitElevationM: 918,
  typicalDurationHours: 6,
  evidenceId: "evidence-1",
  publisher: "OS",
  evidenceTitle: "Route source",
  evidenceUrl: "https://example.test/route",
  rightsClassification: "reusable_geometry",
  rightsStatement: "Open use",
  geometryReuseAllowed: true,
  geometry: { type: "LineString", coordinates: [[-3.99, 53.15], [-3.98, 53.16]] },
  geometryVersion: "2026-01",
  geometryDerivationMethod: "verified_osm",
  profileVersion: "dem-v1",
  profileSpacingM: 25,
  profileCalculationVersion: "dem-v1",
  profileNodataCount: 0,
  profileSamples: [{ distanceM: 0, elevationM: 300 }],
  ...overrides,
});

describe("canonical route record boundary", () => {
  it("accepts exact versioned IDs and rejects malformed or ambiguous IDs", () => {
    expect(parseCanonicalRouteRequest({
      routeId: "sde:route:tryfan-north@2026-01",
      mountainId: "sde:mountain:mountain-1",
    }).success).toBe(true);
    expect(parseCanonicalRouteRequest({
      routeId: "tryfan-north",
      mountainId: "sde:mountain:mountain-1",
    }).success).toBe(false);
    expect(parseCanonicalRouteRequest({
      routeId: "sde:route:tryfan-north@2026-01",
      mountainId: "mountain-1",
    }).success).toBe(false);
  });

  it("returns a fully versioned verified record", () => {
    const result = buildCanonicalRouteRecord([row()]);
    expect(result.status).toBe("available");
    expect(result.record).toMatchObject({
      mountain: { id: "sde:mountain:mountain-1" },
      route: { version: { routeId: "sde:route:tryfan-north@2026-01" } },
    });
  });

  it("degrades when geometry or profile is absent without synthesizing them", () => {
    const result = buildCanonicalRouteRecord([row({
      geometry: null,
      profileVersion: null,
      profileSamples: null,
    })]);
    expect(result.status).toBe("degraded");
    expect(result.reasons).toEqual(expect.arrayContaining(["missing_geometry", "missing_elevation_profile"]));
    expect((result.record as any).geometry).toBeUndefined();
    expect((result.record as any).elevationProfile).toBeUndefined();
  });

  it("rejects unverified or mismatched versions", () => {
    expect(buildCanonicalRouteRecord([row({ mountainStatus: "needs_review" })]).status).toBe("unavailable");
    expect(buildCanonicalRouteRecord([row({ factVersion: "old" })]).status).toBe("unavailable");
  });

  it("rejects ambiguous rows and preserves attribution/rights", () => {
    expect(buildCanonicalRouteRecord([row(), row()]).status).toBe("ambiguous");
    const result = buildCanonicalRouteRecord([row({ rightsClassification: "factual_identity_only", geometryReuseAllowed: false })]);
    expect(result.status).toBe("degraded");
    expect((result.record as any).route.provenance.provider).toBe("OS");
    expect(result.reasons).toContain("rights_unclear");
  });
});