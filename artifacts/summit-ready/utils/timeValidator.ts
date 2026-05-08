export type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
export type FitnessLevel = "Beginner" | "Average" | "Strong";

// Minimum training weeks required — grounded in reality.
// Easy = popular hill walks (Snowdon, Scafell Pike tourist route etc.)
// Moderate = strenuous full-day hikes with significant elevation
// Hard = serious multi-hour mountain routes with technical terrain
// Alpine = high-altitude routes with objective hazards (Matterhorn, Mont Blanc etc.)
const MIN_WEEKS_BASE: Record<Difficulty, Record<FitnessLevel, number>> = {
  Easy:     { Beginner:  2, Average:  0, Strong:  0 },
  Moderate: { Beginner:  4, Average:  1, Strong:  0 },
  Hard:     { Beginner: 12, Average:  5, Strong:  2 },
  Alpine:   { Beginner: 30, Average: 18, Strong: 10 },
};

// "Comfortable" weeks — 1.4× min, gives buffer for missed sessions
const REC_MULTIPLIER = 1.4;

// Minimum recommended even when minimum = 0 (so we can suggest preparation)
const MIN_REC_BASE: Record<Difficulty, Record<FitnessLevel, number>> = {
  Easy:     { Beginner:  3, Average:  2, Strong:  1 },
  Moderate: { Beginner:  9, Average:  4, Strong:  2 },
  Hard:     { Beginner: 22, Average: 14, Strong: 10 },
  Alpine:   { Beginner: 50, Average: 30, Strong: 20 },
};

export function getTimeRequirement(
  difficulty: Difficulty,
  fitnessLevel: FitnessLevel,
  trainingDaysPerWeek = 4
): { minWeeks: number; recommendedWeeks: number } {
  const base = MIN_WEEKS_BASE[difficulty]?.[fitnessLevel] ?? 8;
  const recBase = MIN_REC_BASE[difficulty]?.[fitnessLevel] ?? 12;
  const daysFactor = 4 / Math.max(2, trainingDaysPerWeek);
  const minWeeks = Math.round(base * daysFactor);
  const recommendedWeeks = Math.round(recBase * daysFactor);
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
    message = "Date is too soon";
    detail = "Pick a future date with at least a few days to prepare.";
  } else if (minWeeks === 0) {
    // No mandatory training — this person is already fit enough for this route
    if (weeksAvailable >= recommendedWeeks) {
      status = "good";
      message = `Great — ${weeksAvailable} weeks of preparation available`;
      detail = `At your fitness level you could tackle a ${difficulty} route without formal training, but ${weeksAvailable} weeks of targeted preparation will make it much safer and more enjoyable.`;
    } else {
      status = "good";
      message = `You're fit enough — a few sessions of preparation recommended`;
      detail = `At your fitness level, a ${difficulty} route requires no minimum training — though even ${weeksAvailable > 1 ? `${weeksAvailable} weeks of` : "a couple of sessions of"} specific hill practice will boost your confidence and enjoyment.`;
    }
  } else if (weeksAvailable < minWeeks * 0.5) {
    status = "impossible";
    message = `Not enough time — at least ${minWeeks} weeks needed`;
    detail = `For a ${difficulty} climb at your current fitness, you need a minimum of ${minWeeks} weeks of consistent training at ${trainingDaysPerWeek} days/week. You have ${weeksAvailable} week${weeksAvailable !== 1 ? "s" : ""}. Pick a later date.`;
  } else if (weeksAvailable < minWeeks) {
    status = "insufficient";
    message = `Very tight — ${minWeeks} weeks minimum, you have ${weeksAvailable}`;
    detail = `This is a demanding schedule with no room for setbacks. You'll need to train consistently and without missed weeks.`;
  } else if (weeksAvailable < recommendedWeeks) {
    status = "tight";
    message = `Manageable but tight — ${recommendedWeeks} weeks is comfortable`;
    detail = `You have enough time, but there's little buffer. Missing sessions will have a real impact on your readiness.`;
  } else {
    status = "good";
    message = `Good — ${weeksAvailable} weeks gives solid preparation time`;
    detail = `You have ${weeksAvailable - recommendedWeeks} weeks of buffer above the ${recommendedWeeks} week recommendation. Keep consistent and you'll be well prepared.`;
  }

  return { status, weeksAvailable, minWeeks, recommendedWeeks, message, detail };
}

// ── Fitness quiz helpers ──────────────────────────────────────────────────────

export const WALK_DIST_OPTIONS = [
  { label: "Under 3km",  value: "under3",  score: 0 },
  { label: "3 – 8km",   value: "3to8",    score: 1 },
  { label: "8 – 15km",  value: "8to15",   score: 2 },
  { label: "Over 15km", value: "over15",  score: 3 },
] as const;

export const EXERCISE_FREQ_OPTIONS = [
  { label: "Rarely",       value: "rarely",  score: 0 },
  { label: "1–2× / week", value: "1to2",    score: 1 },
  { label: "3–4× / week", value: "3to4",    score: 2 },
  { label: "Most days",   value: "daily",   score: 3 },
] as const;

export type WalkDistValue = typeof WALK_DIST_OPTIONS[number]["value"];
export type FreqValue = typeof EXERCISE_FREQ_OPTIONS[number]["value"];

export function deriveFitnessLevel(walkDist: WalkDistValue, freq: FreqValue): FitnessLevel {
  const walkScore = WALK_DIST_OPTIONS.find(o => o.value === walkDist)?.score ?? 1;
  const freqScore = EXERCISE_FREQ_OPTIONS.find(o => o.value === freq)?.score ?? 1;
  const total = walkScore + freqScore;
  if (total <= 1) return "Beginner";
  if (total <= 3) return "Average";
  return "Strong";
}

export function fitnessLevelLabel(level: FitnessLevel): string {
  return { Beginner: "Beginner", Average: "Average fitness", Strong: "Good fitness" }[level];
}
