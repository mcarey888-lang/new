import type { SummitGoal, TrainingWeek } from "@/context/AppContext";

/** Restore a missing plan from the Training goal, never from an Expedition goal. */
export function restoreTrainingPlan(
  storedPlan: TrainingWeek[] | null,
  trainingGoal: SummitGoal | null,
  generate: (goal: SummitGoal) => TrainingWeek[],
): TrainingWeek[] {
  if (storedPlan?.length) return storedPlan;
  return trainingGoal ? generate(trainingGoal) : [];
}