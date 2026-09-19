import { describe, expect, it } from "vitest";
import {
  buildFreeHikeLaunchContext,
  buildExpeditionStageLaunchContext,
  buildTrainingSessionLaunchContext,
  resolveTrainingSessionLocation,
} from "./trackingLaunchContext";

describe("tracking launch context", () => {
  it("preserves canonical Expedition route identity and stage progress", () => {
    const params = buildExpeditionStageLaunchContext({
      name: "Ben Nevis via Mountain Track",
      distanceKm: 16.8,
      elevationGain: 1_345,
      routeIdentityKey: "route:ben-nevis:mountain-track",
      summitIdentityKey: "summit:ben-nevis",
      objectiveType: "local_equivalent",
    }, "expedition-123", { completedElevation: 420 });

    expect(params).toMatchObject({
      trackingMode: "expedition-route",
      expeditionId: "expedition-123",
      hillName: "Ben Nevis via Mountain Track",
      routeIdentityKey: "route:ben-nevis:mountain-track",
      summitIdentityKey: "summit:ben-nevis",
      objectiveType: "local_equivalent",
    });
    expect(JSON.parse(params.stageSnapshot)).toMatchObject({
      name: "Ben Nevis via Mountain Track",
      expeditionProgress: { completedElevation: 420 },
    });
  });

  it("preserves stable Training session identity and elevation targets", () => {
    expect(buildTrainingSessionLaunchContext({
      id: "week-3-hills",
      label: "Hill repetitions",
      type: "hill",
      duration: 75,
      targetElevation: 640,
      description: "Controlled uphill repetitions",
    }, 2, 3, 4)).toEqual({
      hillSessionKey: "week-3-hills",
      hillName: "Hill repetitions",
      targetReps: "4",
      estimatedGainPerRep: "160",
      estimatedTotalGain: "640",
    });
  });

  it("uses the deterministic week/session fallback identity", () => {
    expect(buildTrainingSessionLaunchContext({
      label: "Steady climb",
      type: "hill",
      duration: 45,
      targetElevation: 301,
      description: "Sustained ascent",
    }, 1, 5)).toMatchObject({
      hillSessionKey: "5-1",
      targetReps: "2",
      estimatedGainPerRep: "151",
      estimatedTotalGain: "301",
    });
  });

  it("never attaches a preserved Expedition to a Training Free Hike", () => {
    expect(buildFreeHikeLaunchContext("training", "expedition-123")).toEqual({
      trackingMode: "freehike",
    });
    expect(buildFreeHikeLaunchContext("expedition", "expedition-123")).toEqual({
      trackingMode: "freehike",
      expeditionId: "expedition-123",
    });
  });

  it("resolves stable and legacy session identities to the plan location", () => {
    const plan = [{
      weekNumber: 5,
      targetElevation: 800,
      sessions: [{
        id: "ps_5_0_stable",
        label: "Hill repetitions",
        type: "hill" as const,
        duration: 60,
        targetElevation: 400,
        description: "Controlled uphill repetitions",
      }],
      hills: [],
    }];
    expect(resolveTrainingSessionLocation(plan, "ps_5_0_stable")).toEqual({
      weekNumber: 5,
      sessionIndex: 0,
    });
    expect(resolveTrainingSessionLocation(plan, "5-0")).toEqual({
      weekNumber: 5,
      sessionIndex: 0,
    });
    expect(resolveTrainingSessionLocation(plan, "missing")).toBeNull();
  });
});