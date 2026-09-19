import { describe, expect, it } from "vitest";
import {
  evaluateMountainDna,
  MOUNTAIN_DNA_MODEL_VERSION,
  type MountainDnaInput,
} from "./mountainDna";

const provenance = {
  provider: "SDE",
  provenanceVersion: "1",
  rightsClassification: "reusable_geometry" as const,
  qaFlags: [],
};

const verified = {
  engineStatus: "verified" as const,
  productLifecycle: "summitready_verified" as const,
  qaFlags: [],
};

function input(overrides: Partial<MountainDnaInput["target"]["facts"]> = {}): MountainDnaInput {
  const targetRoute = {
    identityKey: "route:target",
    version: "1",
    routeId: "sde:route:route:target@1" as const,
    mountainId: "sde:mountain:1" as const,
  };
  const candidateRoute = {
    identityKey: "route:candidate",
    version: "1",
    routeId: "sde:route:route:candidate@1" as const,
    mountainId: "sde:mountain:2" as const,
  };
  const facts = {
    ascentM: 1000,
    distanceM: 10000,
    summitElevationM: 1200,
    gradient: { meanPercent: 10, profileVersion: "1" },
    terrain: { value: "rock", source: { ...provenance, evidenceId: "terrain-target", evidenceType: "source" as const } },
    technicalCharacter: { value: "scramble", source: { ...provenance, evidenceId: "technical-target", evidenceType: "source" as const } },
    ...overrides,
  };
  return {
    target: { route: targetRoute, facts, trust: verified, provenance },
    candidate: {
      route: candidateRoute,
      facts: {
        ...facts,
        terrain: facts.terrain ? { ...facts.terrain, source: { ...facts.terrain.source, evidenceId: "terrain-candidate" } } : undefined,
        technicalCharacter: facts.technicalCharacter ? { ...facts.technicalCharacter, source: { ...facts.technicalCharacter.source, evidenceId: "technical-candidate" } } : undefined,
      },
      trust: verified,
      provenance,
    },
    evaluatorVersion: MOUNTAIN_DNA_MODEL_VERSION,
  } as MountainDnaInput;
}

describe("evaluateMountainDna", () => {
  it("returns a deterministic exact match with bounded 100 score", () => {
    const result = evaluateMountainDna(input());
    expect(result.overallScore).toBe(100);
    expect(result.state).toBe("ready");
    expect(result.confidence).toBe("high");
    expect(result.modelVersion).toBe(MOUNTAIN_DNA_MODEL_VERSION);
  });

  it("scores partial facts and explicitly reports missing dimensions", () => {
    const result = evaluateMountainDna(input({ terrain: undefined, technicalCharacter: undefined, summitElevationM: undefined }));
    expect(result.state).toBe("degraded");
    expect(result.overallScore).not.toBeNull();
    expect(result.missingDimensions).toEqual(expect.arrayContaining(["terrain", "technical", "altitude", "exposure", "profileShape"]));
  });

  it("derives steepness from an audited elevation profile when grade facts are absent", () => {
    const value = input({ gradient: undefined, ascentM: undefined, distanceM: undefined });
    const profile = {
      profileVersion: "1",
      calculationVersion: "1",
      nodataCount: 0,
      demSources: [],
      samples: [
        { distanceM: 0, elevationM: 100 },
        { distanceM: 1000, elevationM: 200 },
      ],
    };
    value.target.profile = profile;
    value.candidate.profile = profile;
    const result = evaluateMountainDna(value);
    expect(result.dimensions.find(dimension => dimension.name === "steepness")?.status).toBe("scored");
  });

  it("returns unavailable rather than scoring unverified routes", () => {
    const value = input();
    value.candidate.trust = { ...verified, engineStatus: "needs_review", provenance };
    const result = evaluateMountainDna(value);
    expect(result.overallScore).toBeNull();
    expect(result.state).toBe("unavailable");
    expect(result.dimensions.every(dimension => dimension.status === "excluded" || dimension.status === "unknown")).toBe(true);
  });

  it("rejects rights-unclear route facts from scoring", () => {
    const value = input();
    value.target.provenance = { ...provenance, rightsClassification: "unclear" };
    const result = evaluateMountainDna(value);
    expect(result.state).toBe("unavailable");
  });

  it("bounds extreme and invalid values without NaN or out-of-range scores", () => {
    const result = evaluateMountainDna(input({ ascentM: Number.MAX_VALUE, distanceM: 1, summitElevationM: Number.POSITIVE_INFINITY }));
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.overallScore).not.toBeNaN();
    expect(result.missingDimensions).toContain("altitude");
  });

  it("is repeatable without clock, network, randomness, or mutation", () => {
    const value = input();
    const before = JSON.stringify(value);
    expect(evaluateMountainDna(value)).toEqual(evaluateMountainDna(value));
    expect(JSON.stringify(value)).toBe(before);
  });
});