export type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
export type FitnessLevel = "Beginner" | "Average" | "Strong";

// Minimum training weeks required — grounded in realistic hiking preparation.
//
// Easy    = short popular hill walks (< 400m gain, well-marked paths)
// Moderate= full-day hikes with significant elevation (Snowdon, Scafell Pike,
//           Ben Nevis tourist path, most UK/European "classic" routes)
// Hard    = strenuous mountain routes with scrambling or sustained steep ascent
//           (Crib Goch, Helvellyn via Striding Edge, technical ridge walks)
// Alpine  = high-altitude or technical routes with objective hazards
//           (Matterhorn, Mont Blanc, routes requiring crampon/ice-axe skills)
//
// Note: a fit person can summit Snowdon with 2-3 weeks of targeted preparation;
// a beginner attempting the Matterhorn needs a full season of mountaineering.
const MIN_WEEKS_BASE: Record<Difficulty, Record<FitnessLevel, number>> = {
  Easy:     { Beginner:  1, Average:  0, Strong:  0 },
  Moderate: { Beginner:  3, Average:  1, Strong:  0 },
  Hard:     { Beginner:  8, Average:  3, Strong:  1 },
  Alpine:   { Beginner: 24, Average: 12, Strong:  6 },
};

// Comfortable weeks — enough buffer for missed sessions and progressive build.
// These are the "ideal" windows, not hard requirements.
const MIN_REC_BASE: Record<Difficulty, Record<FitnessLevel, number>> = {
  Easy:     { Beginner:  2, Average:  1, Strong:  1 },
  Moderate: { Beginner:  5, Average:  3, Strong:  2 },
  Hard:     { Beginner: 12, Average:  6, Strong:  3 },
  Alpine:   { Beginner: 36, Average: 20, Strong: 12 },
};

export function getTimeRequirement(
  difficulty: Difficulty,
  fitnessLevel: FitnessLevel,
  trainingDaysPerWeek = 4
): { minWeeks: number; recommendedWeeks: number } {
  const base = MIN_WEEKS_BASE[difficulty]?.[fitnessLevel] ?? 4;
  const recBase = MIN_REC_BASE[difficulty]?.[fitnessLevel] ?? 6;
  // Dampen the days factor so training 2 days/week adds ~25% time, not 100%.
  // Formula: linear scale from 1.0 (at 4+ days) to 1.3 (at 2 days).
  const clampedDays = Math.max(2, Math.min(4, trainingDaysPerWeek));
  const daysFactor = 1 + (4 - clampedDays) * 0.15;
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

  const diffLabel: Record<Difficulty, string> = {
    Easy: "an easy route", Moderate: "a moderate route",
    Hard: "a hard route", Alpine: "an alpine route",
  };

  if (weeksAvailable === 0) {
    status = "impossible";
    message = "Date is too soon";
    detail = "Pick a future date with at least a few days to prepare.";
  } else if (minWeeks === 0) {
    // No mandatory training — already fit enough
    if (weeksAvailable >= recommendedWeeks) {
      status = "good";
      message = `Well prepared — you're ready for ${diffLabel[difficulty]}`;
      detail = `At your fitness level this route is well within reach. ${weeksAvailable} weeks of targeted hill sessions will sharpen your confidence and make summit day more enjoyable.`;
    } else {
      status = "good";
      message = `Ready to go — no minimum training required`;
      detail = `Your fitness is good enough for ${diffLabel[difficulty]} without a formal training block. ${weeksAvailable > 1 ? `${weeksAvailable} weeks of` : "A couple of sessions of"} specific hill practice will make a real difference to your comfort on the day.`;
    }
  } else if (weeksAvailable < minWeeks * 0.5) {
    status = "impossible";
    message = `Not enough time — minimum ${minWeeks} week${minWeeks !== 1 ? "s" : ""} needed`;
    detail = `For ${diffLabel[difficulty]} at your current fitness, you need at least ${minWeeks} weeks of preparation. You have ${weeksAvailable} — pick a later date or a less demanding route.`;
  } else if (weeksAvailable < minWeeks) {
    status = "insufficient";
    message = `Very tight — ${minWeeks} week${minWeeks !== 1 ? "s" : ""} minimum, you have ${weeksAvailable}`;
    detail = `Doable but demanding. You'll need to train consistently with no missed weeks. Consider a closer date or stepping up your current fitness first.`;
  } else if (weeksAvailable < recommendedWeeks) {
    status = "tight";
    message = `Enough time — ideally ${recommendedWeeks} weeks, you have ${weeksAvailable}`;
    detail = `You have the minimum you need. There's little buffer, so train consistently and treat every session as important.`;
  } else {
    status = "good";
    message = `Good — ${weeksAvailable} weeks gives solid preparation time`;
    detail = `${recommendedWeeks} weeks is all you need for this route at your fitness level. You have ${weeksAvailable - recommendedWeeks} week${weeksAvailable - recommendedWeeks !== 1 ? "s" : ""} to spare — stay consistent and you'll arrive well prepared.`;
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

/** Map a 0-100 slider to the nearest WalkDistValue zone */
export function walkDistFromSlider(val: number): WalkDistValue {
  if (val < 25) return "under3";
  if (val < 50) return "3to8";
  if (val < 75) return "8to15";
  return "over15";
}

/** Map a 0-100 slider to the nearest FreqValue zone */
export function freqFromSlider(val: number): FreqValue {
  if (val < 25) return "rarely";
  if (val < 50) return "1to2";
  if (val < 75) return "3to4";
  return "daily";
}

/** Label for a walk-dist slider value */
export function walkDistLabel(val: number): string {
  return WALK_DIST_OPTIONS.find(o => o.value === walkDistFromSlider(val))?.label ?? "";
}

/** Label for a freq slider value */
export function freqLabel(val: number): string {
  return EXERCISE_FREQ_OPTIONS.find(o => o.value === freqFromSlider(val))?.label ?? "";
}

/** Derive fitness from three 0-100 sliders */
export function deriveFitnessFromSliders(
  readiness: number,
  walkSlider: number,
  freqSlider: number,
): FitnessLevel {
  const walkScore = WALK_DIST_OPTIONS.find(o => o.value === walkDistFromSlider(walkSlider))?.score ?? 1;
  const freqScore = EXERCISE_FREQ_OPTIONS.find(o => o.value === freqFromSlider(freqSlider))?.score ?? 1;
  const readinessBonus = readiness < 34 ? 0 : readiness < 67 ? 1 : 2;
  const total = walkScore + freqScore + readinessBonus;
  // Thresholds: someone who walks 8km+ and exercises 3-4×/week is "Strong"
  // for the purposes of UK/European mountain training plans.
  if (total <= 1) return "Beginner";
  if (total <= 4) return "Average";
  return "Strong";
}

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
