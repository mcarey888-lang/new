export interface TrainingActivityRecord {
  id: string;
  expeditionStageKey?: string;
  trainingImportedAt?: string;
  elevationGain: number;
  distance: number;
}

export interface ExpeditionMigrationSource {
  id: string;
  challengeName: string;
  completedRoutes: string[];
}

export interface ExpeditionAscentMigrationSummary {
  expeditionId: string;
  expeditionName: string;
  ascentCount: number;
  totalElevationM: number;
  totalDistanceKm: number;
}

export interface ExpeditionAscentMigrationSelection
  extends ExpeditionAscentMigrationSummary {
  sessionIds: string[];
  hikeIds: string[];
}

export function isTrainingActivity(
  activity: Pick<TrainingActivityRecord, "expeditionStageKey" | "trainingImportedAt">,
): boolean {
  return !activity.expeditionStageKey || !!activity.trainingImportedAt;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Select one canonical Training record per completed expedition stage.
 * GPS hikes win over their companion Session so the same outing is not counted
 * twice; manual completions fall back to their Session record.
 */
export function selectExpeditionAscentsForTraining(
  expedition: ExpeditionMigrationSource,
  sessions: TrainingActivityRecord[],
  hikes: TrainingActivityRecord[],
): ExpeditionAscentMigrationSelection | null {
  const sessionIds: string[] = [];
  const hikeIds: string[] = [];
  let totalElevationM = 0;
  let totalDistanceKm = 0;
  let ascentCount = 0;

  for (const stageName of new Set(expedition.completedRoutes)) {
    const stageKey = `${expedition.id}::${stageName}`;
    const stageSessions = sessions.filter(item => item.expeditionStageKey === stageKey);
    const stageHikes = hikes.filter(item => item.expeditionStageKey === stageKey);
    const allStageActivity = [...stageSessions, ...stageHikes];

    if (
      allStageActivity.length === 0
      || allStageActivity.some(item => !!item.trainingImportedAt)
    ) {
      continue;
    }

    const canonical = stageHikes[0] ?? stageSessions[0];
    if (!canonical) continue;

    if (stageHikes[0]) {
      hikeIds.push(canonical.id);
    } else {
      sessionIds.push(canonical.id);
    }
    ascentCount += 1;
    totalElevationM += finiteNonNegative(canonical.elevationGain);
    totalDistanceKm += finiteNonNegative(canonical.distance);
  }

  if (ascentCount === 0) return null;

  return {
    expeditionId: expedition.id,
    expeditionName: expedition.challengeName,
    ascentCount,
    totalElevationM,
    totalDistanceKm,
    sessionIds,
    hikeIds,
  };
}