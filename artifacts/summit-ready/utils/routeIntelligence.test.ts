import { describe, expect, it } from "vitest";
import {
  mapExpeditionStage,
  mapExploreRoute,
  mapTrainingTarget,
  parseSdeMountainId,
  parseSdeRouteId,
  selectCanonicalRoute,
  type CanonicalRouteRecord,
  type RouteFacts,
} from "./routeIntelligence";

const provenance = {
  provider: "Summit Data Engine",
  licence: "ODbL",
  attribution: "OpenStreetMap contributors",
  provenanceVersion: "1",
  rightsClassification: "reusable_geometry" as const,
  qaFlags: [],
};

const record = (overrides: Partial<CanonicalRouteRecord> = {}): CanonicalRouteRecord => ({
  source: "canonical",
  mountain: {
    id: "sde:mountain:tryfan",
    canonicalName: "Tryfan",
    aliases: [],
    verification: {
      engineStatus: "verified",
      productLifecycle: "summitready_verified",
      qaFlags: [],
    },
    provenance,
    routes: [],
  },
  route: {
    version: {
      identityKey: "tryfan:north-ridge",
      version: "1",
      routeId: "sde:route:tryfan:north-ridge@1",
      mountainId: "sde:mountain:tryfan",
    },
    canonicalName: "North Ridge",
    aliases: [],
    status: "verified",
    provenance,
  },
  definition: {
    identity: {
      version: {
        identityKey: "tryfan:north-ridge",
        version: "1",
        routeId: "sde:route:tryfan:north-ridge@1",
        mountainId: "sde:mountain:tryfan",
      },
      canonicalName: "North Ridge",
      aliases: [],
      status: "verified",
      provenance,
    },
    definitionVersion: "1",
    definitionKey: "def:tryfan:north-ridge@1",
    evidence: [],
    status: "verified",
  },
  facts: {
    distanceM: 8000,
    ascentM: 700,
    descentM: 700,
  },
  geometry: {
    geometryVersion: "1",
    coordinateReferenceSystem: "EPSG:4326",
    coordinates: [[-3.99, 53.12], [-3.98, 53.13]],
    direction: "forward",
    derivationMethod: "sde-osm",
    sourceMembers: [{
      ...provenance,
      evidenceType: "source",
    }],
    topologyStatus: "complete",
  },
  elevationProfile: {
    profileVersion: "1",
    samples: [{ distanceM: 0, elevationM: 300 }],
    calculationVersion: "copernicus-glo-30",
    nodataCount: 0,
    demSources: [],
  },
  ...overrides,
});

const lookup = (overrides: Partial<CanonicalRouteRecord> = {}) =>
  selectCanonicalRoute({
    routeId: "sde:route:tryfan:north-ridge@1",
    mountainId: "sde:mountain:tryfan",
    candidates: [record(overrides)],
  });

describe("route intelligence read boundary", () => {
  it("returns a verified route with versioned identity, provenance and attribution", () => {
    const result = lookup();
    expect(result.availability).toBe("available");
    expect(result.value?.route.version.routeId).toBe("sde:route:tryfan:north-ridge@1");
    expect(result.value?.attribution.attribution).toContain("OpenStreetMap");
  });

  it("returns degraded facts when metrics are missing without inventing them", () => {
    const result = lookup({ facts: { ascentM: 700 } });
    expect(result.availability).toBe("degraded");
    expect(result.value?.facts?.distanceM).toBeUndefined();
    expect(result.reasons).toContain("missing_metric");
  });

  it("rejects ambiguous canonical candidates instead of choosing by name", () => {
    const base = record();
    const result = selectCanonicalRoute({
      routeId: base.route.version.routeId,
      candidates: [base, record({ route: { ...base.route, canonicalName: "Another North Ridge" } })],
    });
    expect(result).toEqual({
      availability: "unavailable",
      value: null,
      reasons: ["ambiguous_lookup"],
    });
  });

  it("exposes unverified/generated states as degraded and never verified", () => {
    const result = lookup({
      route: { ...record().route, status: "needs_review" },
      mountain: {
        ...record().mountain,
        verification: { ...record().mountain.verification, engineStatus: "needs_review", productLifecycle: "generated_planned" },
      },
    });
    expect(result.availability).toBe("degraded");
    expect(result.value?.trust.productLifecycle).toBe("generated_planned");
    expect(result.reasons).toContain("needs_review");
  });

  it("rejects version mismatches and malformed identities", () => {
    expect(lookup().reasons).not.toContain("version_not_found");
    expect(selectCanonicalRoute({
      routeId: "sde:route:tryfan:north-ridge@2",
      candidates: [record()],
    })).toEqual({ availability: "unavailable", value: null, reasons: ["version_not_found"] });
    expect(selectCanonicalRoute({
      routeId: "North Ridge",
      candidates: [record()],
    })).toEqual({ availability: "unavailable", value: null, reasons: ["invalid_identity"] });
  });

  it("parses only stable SDE identities", () => {
    expect(parseSdeMountainId("sde:mountain:tryfan")).toBe("sde:mountain:tryfan");
    expect(parseSdeMountainId("Tryfan")).toBeNull();
    expect(parseSdeRouteId("sde:route:tryfan:north-ridge@1")?.version).toBe("1");
    expect(parseSdeRouteId("route:tryfan:north-ridge")).toBeNull();
  });

  it("maps canonical and compatibility references without changing consumer journey state", () => {
    const result = lookup();
    const training = mapTrainingTarget(result);
    expect(training.source).toBe("canonical");
    expect(training.demandStatus).toBe("supported");
    const expedition = mapExpeditionStage(
      { name: "Local analogue", simulatedElevationGainM: 500 },
      result,
    );
    expect(expedition.route?.routeId).toBe("sde:route:tryfan:north-ridge@1");
    const explore = mapExploreRoute(result);
    expect(explore.trackAvailability).toBe("can_track");
    expect(explore.attribution?.licence).toBe("ODbL");
    const legacy = mapTrainingTarget(
      { availability: "unavailable", value: null, reasons: ["version_not_found"] },
      { source: "compatibility", sourceId: "legacy:route:1" },
    );
    expect(legacy.source).toBe("compatibility");
    expect(legacy.facts.reasons).toEqual(["stale_compatibility_record"]);
  });

  it("keeps geometry unavailable when rights are unclear", () => {
    const unclear = lookup({
      route: { ...record().route, provenance: { ...provenance, rightsClassification: "unclear" } },
    });
    expect(unclear.availability).toBe("unavailable");
    expect(unclear.value).toBeNull();
    expect(unclear.reasons).toContain("rights_unclear");
    const facts: RouteFacts | undefined = record().facts;
    expect(facts?.distanceM).toBe(8000);
  });

  it("uses the API-published complete reusable geometry DTO without requiring an unpublished flag", () => {
    const apiRecord = record();
    expect(apiRecord).not.toHaveProperty("geometryValidationPassed");
    const result = lookup();
    expect(result.availability).toBe("available");
    expect(mapExploreRoute(result).trackAvailability).toBe("can_track");
  });

  it("rejects non-WGS84 or malformed geometry instead of treating it as a usable route", () => {
    const badCrs = lookup({
      geometry: { ...record().geometry!, coordinateReferenceSystem: "EPSG:3857" as "EPSG:4326" },
    });
    expect(badCrs.availability).toBe("degraded");
    expect(badCrs.reasons).toContain("missing_geometry");
    const malformed = lookup({
      geometry: { ...record().geometry!, coordinates: [[181, 53], [-3.9, 53.1]] },
    });
    expect(malformed.availability).toBe("degraded");
    expect(malformed.reasons).toContain("missing_geometry");
  });

});