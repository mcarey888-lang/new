import { describe, expect, it } from "vitest";
import type { SavedExpedition } from "@/context/AppContext";
import { applyExpeditionStageContribution } from "./expeditionContribution";

const expedition = (overrides: Partial<SavedExpedition> = {}): SavedExpedition => ({
  id: "exp-1",
  challengeName: "Test",
  targetMountainName: "Test",
  virtualHills: [
    { name: "North", routeIdentityKey: "route:north", summitIdentityKey: "summit:north", elevation: 100, totalElevation: 120, distance: 2 },
    { name: "North", routeIdentityKey: "route:north-2", summitIdentityKey: "summit:north-2", elevation: 200, totalElevation: 240, distance: 3 },
  ],
  completedRoutes: [],
  expeditionStatus: "active",
  virtualHikeProgress: { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
  location: "Test",
  maxRadius: 10,
  fitnessLevel: "Average",
  savedAt: new Date(0).toISOString(),
  ...overrides,
});

describe("applyExpeditionStageContribution", () => {
  it("adds the simulated stage gain and stable identity, not recorded GPS ascent", () => {
    const result = applyExpeditionStageContribution(expedition(), {
      activityId: "activity-1",
      routeIdentityKey: "route:north-2",
    });
    expect(result.virtualHikeProgress).toMatchObject({ elevationGained: 240, distanceCovered: 3, hikesLogged: 1 });
    expect(result.completedRoutes).toEqual(["route:north-2"]);
  });

  it("is exactly once on retry", () => {
    const first = applyExpeditionStageContribution(expedition(), { activityId: "a", routeIdentityKey: "route:north" });
    const second = applyExpeditionStageContribution(expedition({
      completedRoutes: first.completedRoutes,
      virtualHikeProgress: first.virtualHikeProgress,
    }), { activityId: "a", routeIdentityKey: "route:north" });
    expect(second.virtualHikeProgress).toEqual(first.virtualHikeProgress);
    expect(second.completedRoutes).toEqual(first.completedRoutes);
    expect(second.changed).toBe(false);
  });
});