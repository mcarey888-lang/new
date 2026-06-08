import {
  QUESTIONS,
  CATEGORY_WEIGHTS,
  READINESS_MOUNTAINS,
  type Category,
} from "@/data/readiness";

export type Verdict = "ready" | "almost" | "training" | "notyet";

export interface ReadinessResult {
  scores: Record<Category, number>;
  overall: number;
  verdict: Verdict;
  trainingWeeks: [number, number];
  strengths: Category[];
  gaps: Category[];
  priorityActions: string[];
  timingWarning?: string;
}

const CATEGORY_ACTIONS: Record<Category, string> = {
  fitness:
    "Build your aerobic base — commit to 3–4 sessions per week, including long hikes with a loaded pack",
  experience:
    "Gain mountain time — plan alpine day hikes and ideally a guided skills course this season",
  strength:
    "Add pack-load training — practise hiking with a weighted rucksack on consecutive days",
  mindset:
    "Study summit-or-turn-back decision making — read accounts from professional guides on judgement calls",
  health:
    "Speak to your GP about altitude and sustained exertion, and consider a pre-trip health assessment",
};

const CATEGORIES: Category[] = [
  "fitness",
  "experience",
  "strength",
  "mindset",
  "health",
];

function calcTrainingWeeks(gap: number): [number, number] {
  if (gap <= 0) return [8, 12];
  if (gap <= 10) return [12, 16];
  if (gap <= 20) return [16, 26];
  if (gap <= 30) return [26, 42];
  return [42, 60];
}

export function computeReadiness(
  answers: Record<string, number>,
  mountainId: string
): ReadinessResult {
  const mountain = READINESS_MOUNTAINS.find((m) => m.id === mountainId);
  const thresholds = mountain?.thresholds ?? { overall: 65, fitness: 55, experience: 50 };

  const scores = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    const qs = QUESTIONS.filter((q) => q.category === cat);
    const max = qs.length * 3;
    const sum = qs.reduce((acc, q) => acc + (answers[q.id] ?? 0), 0);
    scores[cat] = max > 0 ? Math.round((sum / max) * 100) : 0;
  }

  const overall = Math.round(
    CATEGORIES.reduce((acc, cat) => acc + scores[cat] * CATEGORY_WEIGHTS[cat], 0)
  );

  const isMatterhornHardFail =
    mountainId === "matterhorn" && (answers["q_technical"] ?? 0) === 0;

  const gap = thresholds.overall - overall;
  const meetsOverall = overall >= thresholds.overall;
  const meetsFitness = scores.fitness >= thresholds.fitness;
  const meetsExperience = scores.experience >= thresholds.experience;

  let verdict: Verdict;
  if (isMatterhornHardFail || !meetsOverall || !meetsFitness || !meetsExperience) {
    if (isMatterhornHardFail || gap > 25 || scores.experience < 30) {
      verdict = "notyet";
    } else if (gap > 10) {
      verdict = "training";
    } else {
      verdict = "almost";
    }
  } else {
    verdict = "ready";
  }

  const trainingWeeks = calcTrainingWeeks(gap);

  const strengths = CATEGORIES.filter((c) => scores[c] >= 75);
  const sorted = [...CATEGORIES].sort((a, b) => scores[a] - scores[b]);
  const gaps = sorted.filter((c) => scores[c] < 50);

  const actionCats = gaps.length > 0 ? gaps.slice(0, 3) : sorted.slice(0, 2);
  const priorityActions = actionCats.map((c) => CATEGORY_ACTIONS[c]);

  if (isMatterhornHardFail) {
    priorityActions.unshift(
      "Complete a certified alpine skills course (IFMGA-guided) before attempting the Matterhorn"
    );
  }

  let timingWarning: string | undefined;
  const timeline = answers["q_timeline"] ?? 2;
  if (timeline === 0 && gap > 0) {
    timingWarning =
      "Your preparation window may be shorter than recommended. Consider deferring your attempt to allow proper training time.";
  } else if (timeline === 1 && gap > 10) {
    timingWarning =
      "6–12 weeks may not be enough time to close the gap for this mountain. A 3–6 month preparation window would be significantly safer.";
  }

  return {
    scores,
    overall,
    verdict,
    trainingWeeks,
    strengths,
    gaps,
    priorityActions,
    timingWarning,
  };
}
