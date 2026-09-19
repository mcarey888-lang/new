import type { NearbyHill, SavedExpedition } from "@/context/AppContext";
import { addUniqueCompletedRoute, isRouteCompleted, routeCompletionKey } from "./stateReliability";

export type ExpeditionStageContributionInput = {
  activityId: string;
  routeIdentityKey?: string | null;
  summitIdentityKey?: string | null;
  stageName?: string | null;
};

export type ExpeditionStageContribution = {
  completedRoutes: string[];
  virtualHikeProgress: SavedExpedition["virtualHikeProgress"];
  changed: boolean;
  stage: NearbyHill | null;
};

/**
 * Applies a selected-stage consequence locally and idempotently. The gain is
 * always the persisted simulated stage gain, never the recorded GPS ascent.
 */
export function applyExpeditionStageContribution(
  expedition: SavedExpedition,
  input: ExpeditionStageContributionInput,
): ExpeditionStageContribution {
  const previous = expedition.virtualHikeProgress;
  const credited = previous.creditedHikeIds ?? [];
  const alreadyCredited = credited.includes(input.activityId);
  const stages = Array.isArray(expedition.virtualHills) ? expedition.virtualHills : [];
  const stage = stages.find((candidate) =>
    (input.routeIdentityKey && candidate.routeIdentityKey === input.routeIdentityKey)
    || (input.summitIdentityKey && (candidate.summitIdentityKey === input.summitIdentityKey || candidate.summitId === input.summitIdentityKey))
    || (!input.routeIdentityKey && !input.summitIdentityKey && input.stageName && candidate.name === input.stageName),
  ) ?? null;
  const completionKey = stage ? routeCompletionKey(stage) : input.routeIdentityKey?.trim() || input.stageName?.trim() || "";
  const completedRoutes = completionKey
    ? addUniqueCompletedRoute(expedition.completedRoutes ?? [], completionKey)
    : [...(expedition.completedRoutes ?? [])];
  const stageAlreadyComplete = stage ? isRouteCompleted(expedition.completedRoutes ?? [], stage) : false;
  const shouldAdvance = !alreadyCredited && !stageAlreadyComplete && !!stage;
  const virtualHikeProgress = alreadyCredited
    ? previous
    : {
        elevationGained: previous.elevationGained + (shouldAdvance ? Math.max(0, stage?.totalElevation ?? stage?.elevation ?? 0) : 0),
        distanceCovered: previous.distanceCovered + (shouldAdvance ? Math.max(0, stage?.routeDistance ?? stage?.distance ?? 0) : 0),
        hikesLogged: previous.hikesLogged + (shouldAdvance ? 1 : 0),
        creditedHikeIds: [...credited.slice(-99), input.activityId],
      };

  return {
    completedRoutes,
    virtualHikeProgress,
    changed: !alreadyCredited,
    stage,
  };
}