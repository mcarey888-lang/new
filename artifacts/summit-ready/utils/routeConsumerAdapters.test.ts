import { describe, expect, it } from "vitest";
import type { NearbyHill } from "../context/AppContext";
import {
  buildExpeditionStageRouteIntelligence,
  buildTrainingRouteIntelligence,
  routeReferenceFromNearbyHill,
} from "./routeConsumerAdapters";
import { buildExpeditionStageLaunchContext } from "./trackingLaunchContext";
import { applyExpeditionStageContribution } from "./expeditionContribution";
import type { SavedExpedition } from "../context/AppContext";

const hill = (overrides: Partial<NearbyHill> = {}): NearbyHill => ({
  name: "Local ridge",
  routeIdentityKey: undefined,
  summitIdentityKey: undefined,
  elevation: 400,
  distance: 6,
  repeats: 1,
  totalElevation: 400,
  surface: "trail",
  grade: "moderate",
  emoji: "",
  ...overrides,
});

describe("route consumer adapters", () => {
  it("does not promote same-name legacy recommendations to canonical trust", () => {
    const result = routeReferenceFromNearbyHill(hill({ name: "Tryfan", routeDataStatus: "verified" }));
    expect(result.status).toBe("unavailable");
    expect(result.routeIdentityKey).toBeNull();
  });

  it("keeps same-name distinct route references separate", () => {
    const first = routeReferenceFromNearbyHill(hill({
      routeIdentityKey: "sde:route:north@1",
      summitIdentityKey: "sde:mountain:tryfan",
      routeDataStatus: "verified",
    }));
    const second = routeReferenceFromNearbyHill(hill({
      routeIdentityKey: "sde:route:south@1",
      summitIdentityKey: "sde:mountain:tryfan",
      routeDataStatus: "verified",
    }));
    expect(first.routeIdentityKey).not.toBe(second.routeIdentityKey);
    expect(first.status).toBe("verified");
  });

  it("returns honest unavailable DNA without canonical records", () => {
    const result = buildTrainingRouteIntelligence("sde:route:north@1", []);
    expect(result.matches.availability).toBe("unavailable");
    expect(result.matches.matches).toHaveLength(0);
  });

  it("does not imply geometry or GPS evidence from a degraded reference", () => {
    const result = routeReferenceFromNearbyHill(hill({
      routeIdentityKey: "route:legacy",
      routeDataStatus: "unverified",
      lat: 52,
      lng: -3,
    }));
    expect(result.status).toBe("degraded");
    expect(result.reason).toContain("verified provenance");
  });

  it("keeps tracker context stable without copying route geometry into activity data", () => {
    const context = buildExpeditionStageLaunchContext(
      hill({
        routeIdentityKey: "sde:route:north@1",
        summitIdentityKey: "sde:mountain:tryfan",
      }),
      "expedition-1",
      { simulatedElevation: 400 },
    );
    expect(context.trackingMode).toBe("expedition-route");
    expect(context.routeIdentityKey).toBe("sde:route:north@1");
    expect(context.summitIdentityKey).toBe("sde:mountain:tryfan");
    expect(JSON.parse(context.stageSnapshot)).not.toHaveProperty("geometry");
  });

  it("keeps legacy Expedition stages explicitly degraded", () => {
    const result = buildExpeditionStageRouteIntelligence(hill({ name: "Legacy ridge" }), []);
    expect(result.reference.status).toBe("unavailable");
    expect(result.stage.source).toBe("compatibility");
    expect(result.stage.route).toBeNull();
    expect(result.dna.availability).toBe("unavailable");
  });

  it("does not collapse same-name stages when canonical identities differ", () => {
    const first = buildExpeditionStageRouteIntelligence(hill({
      name: "North ridge",
      routeIdentityKey: "sde:route:north@1",
      summitIdentityKey: "sde:mountain:tryfan",
      routeDataStatus: "verified",
    }), []);
    const second = buildExpeditionStageRouteIntelligence(hill({
      name: "North ridge",
      routeIdentityKey: "sde:route:south@1",
      summitIdentityKey: "sde:mountain:tryfan",
      routeDataStatus: "verified",
    }), []);
    expect(first.reference.routeIdentityKey).not.toBe(second.reference.routeIdentityKey);
    expect(first.stage.stageSnapshot.name).toBe(second.stage.stageSnapshot.name);
  });

  it("does not invent DNA for a canonical-looking stage without verified records", () => {
    const result = buildExpeditionStageRouteIntelligence(
      hill({ routeIdentityKey: "sde:route:north@1", routeDataStatus: "verified" }),
      [],
      "sde:route:target@1",
    );
    expect(result.dna.availability).toBe("unavailable");
    expect(result.dna.matches).toHaveLength(0);
  });

  it("keeps stage contribution and completion authority independent of route presentation", () => {
    const expedition: SavedExpedition = {
      id: "expedition-1",
      challengeId: "challenge-1",
      challengeName: "Challenge",
      targetMountainName: "Tryfan",
      virtualHills: [hill({
        name: "North ridge",
        routeIdentityKey: "route:north",
        summitIdentityKey: "summit:north",
        totalElevation: 400,
      })],
      completedRoutes: [],
      expeditionStatus: "active",
      virtualHikeProgress: { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
      savedAt: "2025-01-01T00:00:00.000Z",
    };
    const before = applyExpeditionStageContribution(expedition, {
      activityId: "activity-1",
      routeIdentityKey: "route:north",
    });
    const after = applyExpeditionStageContribution(expedition, {
      activityId: "activity-1",
      routeIdentityKey: "route:north",
    });
    expect(before.virtualHikeProgress.elevationGained).toBe(400);
    expect(after.virtualHikeProgress.elevationGained).toBe(400);
    expect(before.completedRoutes).toEqual(after.completedRoutes);
  });
});