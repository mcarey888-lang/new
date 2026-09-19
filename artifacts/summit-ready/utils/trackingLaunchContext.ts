import { NearbyHill, PlanSession } from "@/context/AppContext";

export interface ExpeditionStageLaunchParams {
  trackingMode: "expedition-route";
  expeditionId: string;
  hillName: string;
  routeIdentityKey: string;
  summitIdentityKey: string;
  objectiveType: string;
  stageSnapshot: string;
}

export interface TrainingSessionLaunchParams {
  hillSessionKey: string;
  hillName: string;
  targetReps: string;
  estimatedGainPerRep: string;
  estimatedTotalGain: string;
}

export interface FreeHikeLaunchParams {
  trackingMode: "freehike";
  expeditionId: string;
}

export function buildExpeditionStageLaunchContext(
  nextHill: NearbyHill,
  activeExpeditionId: string,
  expeditionProgress: any | undefined,
): ExpeditionStageLaunchParams {
  return {
    hillName: nextHill.name,
    routeIdentityKey: nextHill.routeIdentityKey ?? "",
    summitIdentityKey: nextHill.summitIdentityKey ?? "",
    objectiveType: nextHill.objectiveType ?? "",
    trackingMode: "expedition-route",
    expeditionId: activeExpeditionId,
    stageSnapshot: JSON.stringify({
      ...nextHill,
      expeditionProgress,
    }),
  };
}

export function buildTrainingSessionLaunchContext(
  nextSession: PlanSession,
  nextSessionIndex: number,
  currentWeekNumber: number,
  defaultReps: number = 2,
): TrainingSessionLaunchParams {
  return {
    hillSessionKey: nextSession.id ?? `${currentWeekNumber}-${nextSessionIndex}`,
    hillName: nextSession.label,
    targetReps: String(defaultReps),
    estimatedGainPerRep: String(
      Math.round((nextSession.targetElevation || 0) / Math.max(1, defaultReps))
    ),
    estimatedTotalGain: String(nextSession.targetElevation ?? 0),
  };
}
