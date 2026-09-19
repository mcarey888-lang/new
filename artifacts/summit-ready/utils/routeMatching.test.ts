import { describe, expect, it } from "vitest";
import {
  matchRoutes,
  type RouteMatchRequest,
} from "./routeMatching";
import type {
  RouteIntelligence,
  RouteVersion,
} from "./routeIntelligence";

const provenance = {
  provider: "Summit Data Engine",
  licence: "ODbL",
  attribution: "OpenStreetMap contributors",
  provenanceVersion: "1",
  rightsClassification: "reusable_geometry" as const,
  qaFlags: [],
};

const trust = {
  engineStatus: "verified" as const,
  productLifecycle: "summitready_verified" as const,
  qaFlags: [],
};

function routeVersion(
  mountain: string,
  identity: string,
  version = "1",
): RouteVersion {
  return {
    identityKey: identity,
    version,
    routeId: `sde:route:${identity}@${version}`,
    mountainId: `sde:mountain:${mountain}`,
  } as RouteVersion;
}

function route(
  mountain: string,
  identity: string,
  overrides: Partial<RouteIntelligence> = {},
): RouteIntelligence {
  const version = routeVersion(mountain, identity);
  return {
    mountain: {
      id: version.mountainId,
      canonicalName: mountain,
      aliases: [],
      verification: trust,
      provenance,
      routes: [],
    },
    route: {
      version,
      canonicalName: "North Ridge",
      aliases: [],
      status: "verified",
      provenance,
    },
    definition: null,
    facts: {
      ascentM: 700,
      distanceM: 8000,
      gradient: { meanPercent: 8, profileVersion: "1" },
    },
    geometry: {
      geometryVersion: "1",
      coordinateReferenceSystem: "EPSG:4326",
      coordinates: [[-3.99, 53.12]],
      direction: "forward",
      derivationMethod: "sde-osm",
      sourceMembers: [],
      topologyStatus: "complete",
    },
    elevationProfile: null,
    trust,
    attribution: provenance,
    ...overrides,
  };
}

function request(
  candidates: readonly RouteIntelligence[],
  target = route("Tryfan", "tryfan:north-ridge"),
): RouteMatchRequest {
  return {
    targetRouteId: target.route.version.routeId,
    target,
    candidates,
  };
}

describe("route matching service", () => {
  it("requires a stable versioned target route identity", () => {
    const result = matchRoutes({
      ...request([]),
      targetRouteId: "Tryfan North Ridge",
    });
    expect(result).toMatchObject({
      availability: "unavailable",
      error: "invalid_target_identity",
    });
  });

  it("rejects a target whose requested ID does not match its route record", () => {
    const target = route("Tryfan", "tryfan:north-ridge");
    const result = matchRoutes({
      ...request([], target),
      targetRouteId: "sde:route:tryfan:south-ridge@1",
    });
    expect(result).toMatchObject({
      availability: "unavailable",
      error: "target_identity_mismatch",
    });
  });

  it("filters self, untrusted, rights-unclear, geometry-missing and incomplete candidates", () => {
    const untrusted = route("Tryfan", "tryfan:untrusted", {
      trust: { ...trust, engineStatus: "needs_review" },
    });
    const rights = route("Tryfan", "tryfan:rights", {
      route: { ...route("Tryfan", "tryfan:rights").route, provenance: { ...provenance, rightsClassification: "unclear" } },
    });
    const noGeometry = route("Tryfan", "tryfan:no-geometry", { geometry: null });
    const noFacts = route("Tryfan", "tryfan:no-facts", { facts: { distanceM: 8000 } });
    const result = matchRoutes(request([
      route("Tryfan", "tryfan:north-ridge"),
      untrusted,
      rights,
      noGeometry,
      noFacts,
    ]));
    expect(result.availability).toBe("available");
    expect(result.matches).toHaveLength(0);
    expect(result.filtered.map((item) => item.reason)).toEqual([
      "self",
      "untrusted",
      "rights_unclear",
      "missing_geometry",
      "insufficient_facts",
    ]);
  });

  it("keeps same-name routes distinct and allows multiple routes on one mountain", () => {
    const sameNameOtherIdentity = route("Tryfan", "tryfan:west-ridge");
    const otherMountain = route("Glyder Fach", "glyder:main-route");
    const result = matchRoutes(request([sameNameOtherIdentity, otherMountain]));
    expect(result.matches.map((item) => item.route.route.version.routeId)).toEqual([
      "sde:route:glyder:main-route@1",
      "sde:route:tryfan:west-ridge@1",
    ]);
    expect(result.matches.every((item) => item.route.route.canonicalName === "North Ridge")).toBe(true);
  });

  it("orders equal scores by confidence and then stable route ID", () => {
    const first = route("A", "a:route");
    const second = route("B", "b:route");
    const result = matchRoutes(request([second, first]));
    expect(result.matches.map((item) => item.route.route.version.routeId)).toEqual([
      "sde:route:a:route@1",
      "sde:route:b:route@1",
    ]);
  });

  it("keeps geographic filtering independent from DNA scoring", () => {
    const candidate = route("Tryfan", "tryfan:nearby");
    const result = matchRoutes({
      ...request([candidate]),
      candidatePredicate: (value) => value.route.version.identityKey.endsWith("nearby"),
    });
    expect(result.matches).toHaveLength(1);
    const filtered = matchRoutes({
      ...request([candidate]),
      candidatePredicate: () => false,
    });
    expect(filtered.filtered).toEqual([
      { routeId: candidate.route.version.routeId, reason: "candidate_predicate" },
    ]);
  });

  it("reports degraded confidence for missing optional data without inventing it", () => {
    const candidate = route("Tryfan", "tryfan:partial", {
      facts: { ascentM: 700, distanceM: 8000 },
    });
    const result = matchRoutes(request([candidate]));
    expect(result.availability).toBe("degraded");
    expect(result.matches[0].dna.state).toBe("degraded");
    expect(result.matches[0].dna.missingDimensions).toEqual(
      expect.arrayContaining(["terrain", "technical", "altitude", "exposure", "profileShape"]),
    );
    expect(result.matches[0].whyMatched.join(" ")).toContain("Unknown data");
  });

  it("applies a bounded result limit and is repeatable", () => {
    const candidates = [
      route("A", "a:route"),
      route("B", "b:route"),
      route("C", "c:route"),
    ];
    const first = matchRoutes({ ...request(candidates), limit: 2 });
    const second = matchRoutes({ ...request(candidates), limit: 2 });
    expect(first.matches).toHaveLength(2);
    expect(first).toEqual(second);
  });
});