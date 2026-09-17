import { describe, expect, it } from "vitest";
import {
  signatureStageToNearbyHill,
  signatureStageTotals,
} from "./signatureExpedition";

describe("signature expedition stage mapping", () => {
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
});