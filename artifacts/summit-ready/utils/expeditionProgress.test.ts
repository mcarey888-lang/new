import { describe, expect, it } from "vitest";
import { selectExpeditionPresentation } from "./expeditionProgress";

const hill = (name: string, totalElevation: number, routeIdentityKey?: string) => ({
  name,
  routeIdentityKey,
  summitIdentityKey: routeIdentityKey ? `summit:${routeIdentityKey}` : undefined,
  elevation: totalElevation,
  totalElevation,
  distance: 1,
  repeats: 1,
  surface: "trail",
  grade: "moderate",
  emoji: "⛰️",
});

const expedition = (overrides: Record<string, unknown> = {}) => ({
  id: "exp-1",
  challengeName: "Test expedition",
  targetMountainName: "Test mountain",
  virtualHills: [hill("First", 100, "route:first"), hill("Second", 200, "route:second")],
  completedRoutes: [],
  expeditionStatus: "active" as const,
  virtualHikeProgress: { elevationGained: 150, distanceCovered: 1, hikesLogged: 1 },
  ...overrides,
});

describe("selectExpeditionPresentation", () => {
  it("clamps progress bounds and preserves simulated-only semantics", () => {
    const state = selectExpeditionPresentation(expedition({
      virtualHikeProgress: { elevationGained: 999, distanceCovered: 20, hikesLogged: 2 },
    }));
    expect(state.progress.targetSimulatedElevationM).toBe(300);
    expect(state.progress.currentSimulatedElevationM).toBe(999);
    expect(state.progress.simulatedPercent).toBe(1);
    expect(state.progress.isComplete).toBe(false);
  });

  it("derives deterministic current and upcoming markers", () => {
    const state = selectExpeditionPresentation(expedition({ completedRoutes: ["route:first"] }));
    expect(state.stages.map(stage => stage.status)).toEqual(["completed", "current"]);
    expect(state.progress.currentStageIndex).toBe(1);
    expect(state.nextStage?.routeIdentityKey).toBe("route:second");
  });

  it("accepts legacy name completion and stable manual summit identity", () => {
    const legacy = selectExpeditionPresentation(expedition({ completedRoutes: ["First"] }));
    expect(legacy.stages[0].status).toBe("completed");
    const manualHill = { ...hill("Manual", 100), objectiveType: "manual_summit" as const, summitIdentityKey: "summit:manual" };
    const manual = selectExpeditionPresentation(expedition({
      virtualHills: [manualHill],
      completedRoutes: ["summit:manual"],
      virtualHikeProgress: { elevationGained: 100, distanceCovered: 1, hikesLogged: 1 },
    }));
    expect(manual.stages[0].routeIdentityKey).toBe("summit:manual");
    expect(manual.progress.isComplete).toBe(true);
  });

  it("tracks duplicate stage names by stable identity", () => {
    const state = selectExpeditionPresentation(expedition({
      virtualHills: [hill("Twin", 100, "route:twin-a"), hill("Twin", 200, "route:twin-b")],
      completedRoutes: ["route:twin-b"],
      virtualHikeProgress: { elevationGained: 300, distanceCovered: 2, hikesLogged: 2 },
    }));
    expect(state.stages.map(stage => stage.status)).toEqual(["current", "completed"]);
    expect(state.nextStage?.routeIdentityKey).toBe("route:twin-a");
  });

  it("is deterministic across reloads and handles missing or invalid data", () => {
    const first = selectExpeditionPresentation(expedition());
    const second = selectExpeditionPresentation(JSON.parse(JSON.stringify(expedition())));
    expect(second).toEqual(first);
    expect(selectExpeditionPresentation(undefined).status).toBe("no_expedition");
    const invalid = selectExpeditionPresentation(expedition({
      virtualHills: [null, { name: "", totalElevation: "bad" }],
      virtualHikeProgress: { elevationGained: -20, distanceCovered: 0, hikesLogged: 0 },
    }) as never);
    expect(invalid.availability).toBe("unavailable");
    expect(invalid.progress).toEqual({
      targetSimulatedElevationM: 0,
      currentSimulatedElevationM: 0,
      simulatedPercent: 0,
      completedStageCount: 0,
      totalStageCount: 0,
      currentStageIndex: null,
      nextStageIndex: null,
      isComplete: false,
    });
  });

  it("reports 100% only when all stable stages and simulated elevation are complete", () => {
    const state = selectExpeditionPresentation(expedition({
      completedRoutes: ["route:first", "route:second"],
      virtualHikeProgress: { elevationGained: 300, distanceCovered: 2, hikesLogged: 2 },
    }));
    expect(state.progress.simulatedPercent).toBe(1);
    expect(state.progress.isComplete).toBe(true);
    expect(state.summit.eligible).toBe(true);
    expect(state.summit.completionAwarded).toBe(false);
  });
});