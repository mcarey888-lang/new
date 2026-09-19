import type { NearbyHill, SavedExpedition } from "@/context/AppContext";
import { isRouteCompleted, routeCompletionKey } from "./stateReliability";

export type ExpeditionPresentationAvailability = "ready" | "offline" | "degraded" | "unavailable";
export type ExpeditionStagePresentationStatus = "completed" | "current" | "locked" | "upcoming";

export type ExpeditionPresentationStage = {
  index: number;
  routeIdentityKey: string;
  summitIdentityKey: string;
  name: string;
  simulatedElevationGainM: number;
  status: ExpeditionStagePresentationStatus;
};

export type ExpeditionPresentationState = {
  mode: "expedition";
  status: "no_expedition" | "active" | "completed";
  expeditionId: string | null;
  challengeId: string | null;
  challengeName: string | null;
  targetMountainName: string | null;
  progress: {
    targetSimulatedElevationM: number;
    currentSimulatedElevationM: number;
    simulatedPercent: number;
    completedStageCount: number;
    totalStageCount: number;
    currentStageIndex: number | null;
    nextStageIndex: number | null;
    isComplete: boolean;
  };
  stages: ExpeditionPresentationStage[];
  nextStage: (ExpeditionPresentationStage & { index: number }) | null;
  summit: {
    eligible: boolean;
    transitionState: "not_ready" | "ready" | "started" | "completed";
    completionAwarded: boolean;
  };
  availability: ExpeditionPresentationAvailability;
};

const EMPTY_PROGRESS: ExpeditionPresentationState["progress"] = {
  targetSimulatedElevationM: 0,
  currentSimulatedElevationM: 0,
  simulatedPercent: 0,
  completedStageCount: 0,
  totalStageCount: 0,
  currentStageIndex: null,
  nextStageIndex: null,
  isComplete: false,
};

function finiteNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function emptyState(availability: ExpeditionPresentationAvailability): ExpeditionPresentationState {
  return {
    mode: "expedition",
    status: "no_expedition",
    expeditionId: null,
    challengeId: null,
    challengeName: null,
    targetMountainName: null,
    progress: EMPTY_PROGRESS,
    stages: [],
    nextStage: null,
    summit: { eligible: false, transitionState: "not_ready", completionAwarded: false },
    availability,
  };
}

/**
 * Derives the single persisted Expedition presentation state consumed by both
 * compact Basecamp and expanded Progress. Real activity facts deliberately do
 * not enter this selector: this is simulated Expedition progress only.
 */
export function selectExpeditionPresentation(
  expedition: SavedExpedition | null | undefined,
  availability: ExpeditionPresentationAvailability = "ready",
): ExpeditionPresentationState {
  if (!expedition || typeof expedition !== "object" || typeof expedition.id !== "string") {
    return emptyState("unavailable");
  }

  const rawStages = Array.isArray(expedition.virtualHills) ? expedition.virtualHills : [];
  const completedRoutes = Array.isArray(expedition.completedRoutes) ? expedition.completedRoutes : [];
  const stages: ExpeditionPresentationStage[] = [];
  const completedByIndex: boolean[] = [];
  let target = 0;

  rawStages.forEach((hill: NearbyHill) => {
    if (!hill || typeof hill.name !== "string" || hill.name.trim().length === 0) return;
    const completionKey = routeCompletionKey(hill);
    const simulatedGain = finiteNonNegative(hill.totalElevation ?? hill.elevation);
    target += simulatedGain;
    completedByIndex.push(isRouteCompleted(completedRoutes, hill));
    stages.push({
      index: stages.length,
      routeIdentityKey: completionKey,
      summitIdentityKey: hill.summitIdentityKey ?? hill.summitId ?? completionKey,
      name: hill.name,
      simulatedElevationGainM: simulatedGain,
      status: "upcoming",
    });
  });

  const current = finiteNonNegative(expedition.virtualHikeProgress?.elevationGained);
  const completedStageCount = stages.reduce(
    (count, _stage, index) => count + (completedByIndex[index] ? 1 : 0),
    0,
  );
  const currentStageIndex = stages.findIndex((_stage, index) => !completedByIndex[index]);
  const firstIncomplete = currentStageIndex < 0 ? null : currentStageIndex;
  const percent = target > 0 ? Math.min(1, current / target) : 0;
  const allStagesComplete = stages.length > 0 && completedStageCount === stages.length;
  const isComplete = allStagesComplete && percent >= 1;

  const presentedStages = stages.map((stage, index) => ({
    ...stage,
    status: completedByIndex[index]
      ? "completed" as const
      : index === firstIncomplete
        ? "current" as const
        : "upcoming" as const,
  }));
  const nextStageIndex = firstIncomplete;
  const nextStage = nextStageIndex === null ? null : presentedStages[nextStageIndex];

  return {
    mode: "expedition",
    status: isComplete || expedition.expeditionStatus === "complete" ? "completed" : "active",
    expeditionId: expedition.id,
    challengeId: expedition.challengeId ?? null,
    challengeName: typeof expedition.challengeName === "string" ? expedition.challengeName : null,
    targetMountainName: typeof expedition.targetMountainName === "string" ? expedition.targetMountainName : null,
    progress: {
      targetSimulatedElevationM: target,
      currentSimulatedElevationM: current,
      simulatedPercent: percent,
      completedStageCount,
      totalStageCount: presentedStages.length,
      currentStageIndex: firstIncomplete,
      nextStageIndex,
      isComplete,
    },
    stages: presentedStages,
    nextStage,
    summit: {
      eligible: isComplete,
      transitionState: expedition.expeditionStatus === "complete"
        ? "completed"
        : expedition.summitTransitionState ?? (isComplete ? "ready" : "not_ready"),
      completionAwarded: expedition.expeditionStatus === "complete" || expedition.summitTransitionState === "completed",
    },
    availability: availability === "ready" && stages.length === 0 ? "unavailable" : availability,
  };
}