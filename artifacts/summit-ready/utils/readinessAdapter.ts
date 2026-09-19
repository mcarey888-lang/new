import { ReadinessInput, ReadinessEvidence, ReadinessSource } from "./readinessV2";
import { resolveReadinessTargetDemand, releasedGoalMetadataFromSummitGoal } from "./readinessTargetDemand";
import { Session, ExploreHike, SummitGoal, TrainingWeek } from "@/context/AppContext";

export function createReadinessInput(
  ownerId: string,
  asOf: string,
  summitGoal: SummitGoal,
  sessions: Session[],
  exploreHikes: ExploreHike[],
  trainingPlan: TrainingWeek[]
): ReadinessInput {
  const targetDemand = resolveReadinessTargetDemand({
    goal: releasedGoalMetadataFromSummitGoal(summitGoal),
  });

  const evidence: ReadinessEvidence[] = [];

  sessions.forEach(s => {
    if (!s.completed) return;
    evidence.push({
      evidenceId: s.id,
      ownerId,
      source: (s.type === "cardio" && s.gymSubtype === "treadmill") || (s.type === "cardio" && s.gymSubtype === "stepper") ? "indoor" : "manual",
      completedAt: s.date,
      distanceKm: s.distance,
      ascentM: s.elevationGain,
      durationMinutes: s.duration,
      completed: s.completed,
    });
  });

  exploreHikes.forEach(h => {
    evidence.push({
      evidenceId: h.id,
      ownerId,
      source: "tracked_gps",
      completedAt: h.date,
      distanceKm: h.distance,
      ascentM: h.elevationGain,
      durationMinutes: h.timeTaken,
      completed: true,
      gpsQuality: "trusted",
      syncState: h.syncState,
    });
  });

  return {
    ownerId,
    asOf,
    target: targetDemand.target,
    evidence,
    plan: {
      plannedSessionCount: trainingPlan.flatMap(w => w.sessions).length,
    }
  };
}
