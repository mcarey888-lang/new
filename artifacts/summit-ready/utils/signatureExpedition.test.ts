import { describe, expect, it } from "vitest";
import {
  signatureStageToNearbyHill,
  signatureStageTotals,
  signatureChallengeTarget,
} from "./signatureExpedition";

describe("signature expedition stage mapping", () => {
  it("uses selected catalogue identity and coordinates without treating summit altitude as route ascent", () => {
    const hill = signatureStageToNearbyHill({
      routeKey: "example-route", routeName: "Helvellyn via Striding Edge",
      distanceKm: 13, ascentM: 950,
      catalogueMountain: { id: "summit-id", name: "Helvellyn", latitude: 54.527,
        longitude: -3.0175, elevationM: 949.8 },
    });
    expect(hill).toMatchObject({ summitIdentityKey: "sde:mountain:summit-id", summitName: "Helvellyn",
      lat: 54.527, lng: -3.0175, elevation: 950, routeDistance: 13,
      summitElevationASL: 949.8, confidence: "curated", dataSource: "signature_challenge_db" });
    expect(hill.routeIdentityKey).toBe("signature-route:example-route");
  });
  it("preserves database route metrics in the fields Base Camp reads", () => {
    const hill = signatureStageToNearbyHill({
      routeKey: "fairfield",
      routeName: "Fairfield Horseshoe",
      distanceKm: 18,
      ascentM: 1100,
      estimatedHours: 7,
      difficulty: "Hard",
    });

    expect(hill.routeIdentityKey).toBe("signature-route:fairfield");
    expect(hill.routeDistance).toBe(18);
    expect(hill.distance).toBe(18);
    expect(hill.totalElevation).toBe(1100);
    expect(hill.routeDataStatus).toBe("curated_complete");
  });

  it("derives challenge totals from its persisted stages", () => {
    expect(signatureStageTotals([
      { routeName: "Fairfield Horseshoe", distanceKm: 18, ascentM: 1100 },
      { routeName: "Corridor Route", distanceKm: 15, ascentM: 1000 },
    ])).toEqual({ distanceKm: 33, ascentM: 2100 });
  });

  it("uses UK stage totals even when the mountain-route metadata is different", () => {
    const stages = [
      { routeName: "Tryfan North Ridge", distanceKm: 6, ascentM: 700 },
      { routeName: "Crib Goch Traverse", distanceKm: 10, ascentM: 900 },
    ];
    expect(signatureChallengeTarget(stages)).toEqual({ ascentM: 1600, distanceKm: 16 });
    expect(signatureChallengeTarget([{ routeName: "Unknown", distanceKm: 10, ascentM: null }])).toBeNull();
  });
});