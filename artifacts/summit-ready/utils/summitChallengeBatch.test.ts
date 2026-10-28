import { describe, expect, it } from "vitest";
import { signatureChallengeTarget, signatureStageToNearbyHill } from "./signatureExpedition";
import { applyExpeditionStageContribution } from "./expeditionContribution";
import { selectExpeditionPresentation } from "./expeditionProgress";
import { chooseNextExpeditionStage } from "./expeditionStageOrder";
import { completedStageSessionDistance } from "./manualStageDistance";
import type { SavedExpedition, Session } from "../context/AppContext";

const hills = [600, 560].map((ascentM, index) => signatureStageToNearbyHill({
  routeKey: `batch:${index}`, routeName: `Approach ${index}`, ascentM,
  distanceKm: null, approachDistanceKm: index === 0 ? 2 : 2.6,
  completionPolicy: "selected_stages", distanceBasis: "one_way_approach",
  catalogueMountain: { id: `summit-${index}`, name: `Summit ${index}`, latitude: 53, longitude: -4 },
}));
function expedition(): SavedExpedition {
  return {
    id: "batch", challengeId: "SIG024-SUMMITS-1", challengeName: "The Welsh Matterhorn",
    targetMountainName: "Matterhorn", virtualHills: hills, completedRoutes: [],
    virtualHikeProgress: { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
    expeditionStatus: "active", location: "Eryri", maxRadius: 30, fitnessLevel: "Average", savedAt: "2026-10-28",
  };
}
describe("approximate self-paced stage challenges", () => {
  it("accepts approach estimates without full outing or exact uphill measurements", () => {
    expect(signatureChallengeTarget(hills.map(hill => ({
      routeName: hill.name, ascentM: hill.elevation, distanceKm: null,
      approachDistanceKm: hill.approachDistanceKm,
    })))).toEqual({ ascentM: 1160, distanceKm: 4.6 });
    expect(hills[0].routeDistance).toBeUndefined();
    expect(hills[0].routeDataStatus).toBe("approximate_approach");
  });
  it("allows the second stage first without mutating the saved selection", () => {
    const before = JSON.stringify(hills);
    expect(chooseNextExpeditionStage(hills, [], hills[1].routeIdentityKey!)?.[0].summitId).toBe("summit-1");
    expect(JSON.stringify(hills)).toBe(before);
  });
  it("credits an explicitly linked activity only once", () => {
    const first = applyExpeditionStageContribution(expedition(), { activityId: "gps-1", routeIdentityKey: hills[1].routeIdentityKey });
    const updated = { ...expedition(), ...first };
    const repeat = applyExpeditionStageContribution(updated, { activityId: "gps-1", routeIdentityKey: hills[1].routeIdentityKey });
    expect(repeat.virtualHikeProgress).toEqual(first.virtualHikeProgress);
    expect(repeat.changed).toBe(false);
    const secondActivitySameStage = applyExpeditionStageContribution(updated, { activityId: "manual-2", routeIdentityKey: hills[1].routeIdentityKey });
    expect(secondActivitySameStage.virtualHikeProgress?.elevationGained).toBe(560);
  });
  it("completes selected stages without an additional mountain ascent threshold", () => {
    const saved = expedition();
    saved.completedRoutes = hills.map(hill => hill.routeIdentityKey!);
    // Deliberately lower measured/simulated counter; selected stage evidence is authority.
    saved.virtualHikeProgress.elevationGained = 25;
    expect(selectExpeditionPresentation(saved).progress).toMatchObject({ isComplete: true, simulatedPercent: 1 });
    const legacy = { ...saved, virtualHills: hills.map(({ completionPolicy, ...hill }) => hill) };
    expect(selectExpeditionPresentation(legacy).progress.isComplete).toBe(false);
  });
  it("never replaces manually reported actual outing distance with approach estimates", () => {
    const session = { type: "hill", completed: true, expeditionId: "batch", hillName: hills[0].name,
      reps: 1, distance: 9.7, notes: `${hills[0].name} — 1 rep` } as Session;
    expect(completedStageSessionDistance(session, hills)).toBe(9.7);
  });
});
