import type { NearbyHill, PlanSession, TrainingWeek } from "@/context/AppContext";
import type { ShellMode } from "./stateReliability";

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
  expeditionId?: string;
}

export interface TrainingSessionLocation {
  weekNumber: number;
  sessionIndex: number;
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

export function buildFreeHikeLaunchContext(
  shellMode: ShellMode,
  activeExpeditionId?: string | null,
): FreeHikeLaunchParams {
  return shellMode === "expedition" && activeExpeditionId
    ? { trackingMode: "freehike", expeditionId: activeExpeditionId }
    : { trackingMode: "freehike" };
}

export function resolveTrainingSessionLocation(
  trainingPlan: TrainingWeek[],
  sessionKey: string,
): TrainingSessionLocation | null {
  for (const week of trainingPlan) {
    const sessionIndex = week.sessions.findIndex(session => session.id === sessionKey);
    if (sessionIndex >= 0) return { weekNumber: week.weekNumber, sessionIndex };
  }

  const legacyMatch = sessionKey.match(/^(\d+)-(\d+)$/);
  if (!legacyMatch) return null;
  const weekNumber = Number(legacyMatch[1]);
  const sessionIndex = Number(legacyMatch[2]);
  const week = trainingPlan.find(item => item.weekNumber === weekNumber);
  return week?.sessions[sessionIndex] ? { weekNumber, sessionIndex } : null;
}
