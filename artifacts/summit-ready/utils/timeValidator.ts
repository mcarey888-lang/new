export type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
export type FitnessLevel = "Beginner" | "Average" | "Strong";

// Minimum weeks needed at 4 training days/week — base table
const MIN_WEEKS_BASE: Record<Difficulty, Record<FitnessLevel, number>> = {
  Easy:     { Beginner:  6, Average:  3, Strong:  2 },
  Moderate: { Beginner: 14, Average:  8, Strong:  6 },
  Hard:     { Beginner: 24, Average: 16, Strong: 10 },
  Alpine:   { Beginner: 52, Average: 36, Strong: 24 },
};

// Recommended weeks (comfortable margin) — 1.4× minimum
const REC_FACTOR = 1.4;

/**
 * Returns minimum and recommended weeks required for a given goal,
 * adjusted for training frequency.
 */
export function getTimeRequirement(
  difficulty: Difficulty,
  fitnessLevel: FitnessLevel,
  trainingDaysPerWeek = 4
): { minWeeks: number; recommendedWeeks: number } {
  const base = MIN_WEEKS_BASE[difficulty]?.[fitnessLevel] ?? 16;
  // Fewer training days per week means more calendar time needed
  const daysFactor = 4 / Math.max(2, trainingDaysPerWeek);
  const minWeeks = Math.round(base * daysFactor);
  const recommendedWeeks = Math.round(minWeeks * REC_FACTOR);
  return { minWeeks, recommendedWeeks };
}

export type TimeStatus = "good" | "tight" | "insufficient" | "impossible";

export interface TimeAssessment {
  status: TimeStatus;
  weeksAvailable: number;
  minWeeks: number;
  recommendedWeeks: number;
  message: string;
  detail: string;
}

export function assessTime(
  summitDate: string,
  difficulty: Difficulty,
  fitnessLevel: FitnessLevel,
  trainingDaysPerWeek = 4
): TimeAssessment | null {
  if (!summitDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(summitDate);
  target.setHours(0, 0, 0, 0);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksAvailable = Math.max(0, Math.floor((target.getTime() - today.getTime()) / msPerWeek));

  const { minWeeks, recommendedWeeks } = getTimeRequirement(difficulty, fitnessLevel, trainingDaysPerWeek);

  let status: TimeStatus;
  let message: string;
  let detail: string;

  if (weeksAvailable === 0) {
    status = "impossible";
    message = "Date is in the past or too soon";
    detail = "Pick a future date with enough time to train.";
  } else if (weeksAvailable < minWeeks * 0.5) {
    status = "impossible";
    message = `Not enough time — minimum ${minWeeks} weeks needed`;
    detail = `At ${trainingDaysPerWeek} days/week, you need at least ${minWeeks} weeks for a ${difficulty} climb from your current fitness. You have ${weeksAvailable} week${weeksAvailable !== 1 ? "s" : ""}.`;
  } else if (weeksAvailable < minWeeks) {
    status = "insufficient";
    message = `Tight — ${minWeeks} weeks recommended, you have ${weeksAvailable}`;
    detail = `This is a very demanding schedule. You'll need to train consistently and without any missed weeks to have a realistic chance.`;
  } else if (weeksAvailable < recommendedWeeks) {
    status = "tight";
    message = `Manageable but tight — ${recommendedWeeks} weeks is ideal`;
    detail = `You have enough time, but there's little room for setbacks. Consistency will be essential.`;
  } else {
    status = "good";
    message = `Good — ${weeksAvailable} weeks gives you solid preparation time`;
    detail = `${recommendedWeeks} weeks is the recommended minimum for a ${difficulty} climb. You have ${weeksAvailable - recommendedWeeks} weeks of buffer.`;
  }

  return { status, weeksAvailable, minWeeks, recommendedWeeks, message, detail };
}
