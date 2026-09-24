import { describe, expect, it } from "vitest";
import type { ReadinessEvidence, ReadinessInput } from "./readinessV2";
import { projectExpeditionReadiness } from "./expeditionReadinessProjection";

const baseEvidence: ReadinessEvidence = {
  evidenceId: "completed-outdoor-hike",
  ownerId: "owner-1",
  source: "tracked_gps",
  completedAt: "2026-05-10T10:00:00.000Z",
  distanceKm: 8,
  ascentM: 450,
  durationMinutes: 150,
  gpsQuality: "trusted",
  terrainTags: ["outdoor"],
};

const input: ReadinessInput = {
  ownerId: "owner-1",
  asOf: "2026-05-11T10:00:00.000Z",
  target: {
    mountainId: "sde:mountain:training-goal",
    distanceKm: 14,
    ascentM: 1100,
  },
  evidence: [baseEvidence],
};

const verifiedRoute = {
  routeIdentityKey: "sde:route:training-route@1",
  routeDataStatus: "verified",
  dataSource: "summit_data_engine",
  confidence: "verified",
  distanceKm: 9,
  ascentM: 650,
  durationMinutes: 180,
};

describe("projectExpeditionReadiness", () => {
  it("estimates the scenario only for a verified, complete outdoor route", () => {
    const result = projectExpeditionReadiness(input, [verifiedRoute]);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.routeCount).toBe(1);
    expect(result.before).toBeGreaterThanOrEqual(0);
    expect(result.after).toBeGreaterThanOrEqual(0);
    expect(result.delta).toBe(result.after - result.before);
    expect(result.mountainExperienceDelta).toBe(0);
    expect(result.estimated).toBe(true);
    expect(result.explanation).toContain("does not claim GPS validation");
    expect(result.explanation).toContain("count virtual/repeat elevation");
  });

  it("uses one route completion and ignores virtual aggregate/repeat totals", () => {
    const singleCompletion = projectExpeditionReadiness(input, [verifiedRoute]);
    const virtualBundleWithRepeats = projectExpeditionReadiness(input, [{
      ...verifiedRoute,
      repeats: 5,
      totalElevation: 3250,
    }]);

    expect(virtualBundleWithRepeats).toEqual(singleCompletion);
  });

  it("does not project from a route reference, unverified route or missing metrics", () => {
    const result = projectExpeditionReadiness(input, [
      { ...verifiedRoute, routeDataStatus: "candidate" },
      { ...verifiedRoute, confidence: "curated" },
      { ...verifiedRoute, routeIdentityKey: null },
      { ...verifiedRoute, ascentM: null },
    ]);

    expect(result).toMatchObject({
      available: false,
      reason: expect.stringContaining("verified route identities"),
    });
  });

  it("requires an identifiable objective with reliable distance and ascent", () => {
    const result = projectExpeditionReadiness({
      ...input,
      target: { distanceKm: 14, ascentM: 1100 },
    }, [verifiedRoute]);

    expect(result).toMatchObject({
      available: false,
      reason: expect.stringContaining("stable identity"),
    });
  });

  it("does not estimate without eligible completed baseline activity", () => {
    const result = projectExpeditionReadiness({ ...input, evidence: [] }, [verifiedRoute]);

    expect(result).toMatchObject({
      available: false,
      reason: expect.stringContaining("eligible completed activity history"),
    });
  });
});