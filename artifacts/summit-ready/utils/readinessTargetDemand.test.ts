import { describe, expect, it } from "vitest";
import { resolveReadinessTargetDemand } from "./readinessTargetDemand";

describe("resolveReadinessTargetDemand", () => {
  it("prefers verified SDE facts field-by-field", () => {
    const result = resolveReadinessTargetDemand({
      sde: { mountainId: "sde:m1", routeId: "sde:r1", distanceKm: 18, ascentM: 1500 },
      approvedRoute: { mountainId: "route:m1", routeId: "route:r1", distanceKm: 20, ascentM: 1700 },
      goal: { mountainId: "goal:m1", distanceKm: 22, ascentM: 1900 },
    });
    expect(result.target.distanceKm).toBe(18);
    expect(result.target.ascentM).toBe(1500);
    expect(result.target.provenance?.distanceKm?.source).toBe("sde_verified");
  });

  it("uses approved route facts when SDE facts are missing", () => {
    const result = resolveReadinessTargetDemand({
      sde: { mountainId: "sde:m1" },
      approvedRoute: { mountainId: "route:m1", routeId: "route:r1", distanceKm: 12, ascentM: 900 },
      goal: { distanceKm: 20, ascentM: 1600 },
    });
    expect(result.target.mountainId).toBe("sde:m1");
    expect(result.target.routeId).toBe("route:r1");
    expect(result.target.distanceKm).toBe(12);
    expect(result.target.provenance?.distanceKm?.source).toBe("approved_route");
  });

  it("falls back to released goal metadata and preserves explicit unknowns", () => {
    const result = resolveReadinessTargetDemand({
      goal: { mountainName: "Target Hill", distanceKm: 8, ascentM: 500, summitDate: "2026-10-01" },
    });
    expect(result.target.distanceKm).toBe(8);
    expect(result.target.ascentM).toBe(500);
    expect(result.target.provenance?.distanceKm?.source).toBe("goal_metadata");
    expect(result.unknownFacts).toContain("mountainId");
    expect(result.unknownFacts).toContain("routeId");
  });

  it("rejects invalid metrics instead of inventing demand", () => {
    const result = resolveReadinessTargetDemand({
      sde: { mountainId: "sde:m1", distanceKm: -1, ascentM: Number.NaN },
      approvedRoute: { routeId: "route:r1", distanceKm: 0, ascentM: Number.POSITIVE_INFINITY },
    });
    expect(result.target.distanceKm).toBeUndefined();
    expect(result.target.ascentM).toBeUndefined();
    expect(result.unknownFacts).toEqual(expect.arrayContaining(["distanceKm", "ascentM"]));
  });

  it("requires stable identities and never fuzzy-matches names", () => {
    const result = resolveReadinessTargetDemand({
      goal: { mountainName: "Ben Nevis", distanceKm: 17, ascentM: 1350 },
    });
    expect(result.target.mountainId).toBeUndefined();
    expect(result.target.routeId).toBeUndefined();
    expect(result.source).toBe("goal_metadata");
    expect(result.warnings[0]).toMatch(/stable mountain or route identity/i);
  });
});