export type Category = "fitness" | "experience" | "strength" | "mindset" | "health";

export interface QuestionOption {
  label: string;
  score: number;
}

export interface Question {
  id: string;
  category: Category;
  text: string;
  options: QuestionOption[];
}

export interface ReadinessMountain {
  id: string;
  name: string;
  elevation: string;
  emoji: string;
  difficulty: string;
  diffColor: string;
  thresholds: {
    overall: number;
    fitness: number;
    experience: number;
  };
  cic?: string;
  training?: string;
}

export const READINESS_MOUNTAINS: ReadinessMountain[] = [
  {
    id: "gran-paradiso",
    name: "Gran Paradiso",
    elevation: "4,061m",
    emoji: "🏔️",
    difficulty: "Moderate",
    diffColor: "text-blue-400",
    thresholds: { overall: 55, fitness: 50, experience: 40 },
    cic: "/can-i-climb/gran-paradiso",
    training: "/training-guides/gran-paradiso-training-plan",
  },
  {
    id: "kilimanjaro",
    name: "Kilimanjaro",
    elevation: "5,895m",
    emoji: "🌋",
    difficulty: "Moderate",
    diffColor: "text-blue-400",
    thresholds: { overall: 60, fitness: 55, experience: 40 },
    cic: "/can-i-climb/kilimanjaro",
    training: "/training-guides/kilimanjaro-training-plan",
  },
  {
    id: "everest-base-camp",
    name: "Everest Base Camp",
    elevation: "5,364m",
    emoji: "🗻",
    difficulty: "Challenging",
    diffColor: "text-purple-400",
    thresholds: { overall: 65, fitness: 55, experience: 50 },
    cic: "/can-i-climb/everest-base-camp",
    training: "/training-guides/everest-base-camp-training-plan",
  },
  {
    id: "mont-blanc",
    name: "Mont Blanc",
    elevation: "4,808m",
    emoji: "🏔️",
    difficulty: "Hard",
    diffColor: "text-orange-400",
    thresholds: { overall: 72, fitness: 62, experience: 55 },
    cic: "/can-i-climb/mont-blanc",
    training: "/training-guides/mont-blanc-training-plan",
  },
  {
    id: "matterhorn",
    name: "Matterhorn",
    elevation: "4,478m",
    emoji: "⛰️",
    difficulty: "Expert",
    diffColor: "text-red-400",
    thresholds: { overall: 82, fitness: 72, experience: 70 },
    cic: "/can-i-climb/matterhorn",
    training: "/training-guides/matterhorn-preparation-guide",
  },
];

export const QUESTIONS: Question[] = [
  {
    id: "q_hike_duration",
    category: "fitness",
    text: "How long can you hike continuously on steep terrain, carrying a full pack?",
    options: [
      { label: "Less than 1 hour", score: 0 },
      { label: "1–2 hours", score: 1 },
      { label: "3–5 hours", score: 2 },
      { label: "6+ hours", score: 3 },
    ],
  },
  {
    id: "q_weekly_exercise",
    category: "fitness",
    text: "How many days per week do you currently exercise?",
    options: [
      { label: "Rarely / not at all", score: 0 },
      { label: "1–2 days", score: 1 },
      { label: "3–4 days", score: 2 },
      { label: "5+ days", score: 3 },
    ],
  },
  {
    id: "q_altitude_exposure",
    category: "fitness",
    text: "Have you spent time hiking or trekking above 2,500m?",
    options: [
      { label: "Never", score: 0 },
      { label: "Once briefly", score: 1 },
      { label: "A few times", score: 2 },
      { label: "Regularly", score: 3 },
    ],
  },
  {
    id: "q_uphill_comfort",
    category: "fitness",
    text: "How comfortable are you on sustained uphill — several hours of continuous climbing?",
    options: [
      { label: "I struggle on hills", score: 0 },
      { label: "Hard but I manage", score: 1 },
      { label: "Fairly comfortable", score: 2 },
      { label: "Very comfortable", score: 3 },
    ],
  },
  {
    id: "q_crampon",
    category: "experience",
    text: "Have you used crampons or walked on snow and ice?",
    options: [
      { label: "Never", score: 0 },
      { label: "Tried once", score: 1 },
      { label: "Used a few times", score: 2 },
      { label: "Use regularly", score: 3 },
    ],
  },
  {
    id: "q_multiday",
    category: "experience",
    text: "What is the longest multi-day mountain trip you have completed?",
    options: [
      { label: "Never done one", score: 0 },
      { label: "1–2 days", score: 1 },
      { label: "3–5 days", score: 2 },
      { label: "6+ days / expedition", score: 3 },
    ],
  },
  {
    id: "q_heights",
    category: "experience",
    text: "How comfortable are you on exposed ridges or steep drop-offs?",
    options: [
      { label: "Very uncomfortable", score: 0 },
      { label: "Nervous but manage", score: 1 },
      { label: "OK with heights", score: 2 },
      { label: "Comfortable", score: 3 },
    ],
  },
  {
    id: "q_technical",
    category: "experience",
    text: "Have you used technical alpine gear — ice axe, ropes, or harness?",
    options: [
      { label: "Never", score: 0 },
      { label: "Brief course / once", score: 1 },
      { label: "A few trips", score: 2 },
      { label: "Experienced", score: 3 },
    ],
  },
  {
    id: "q_pack_weight",
    category: "strength",
    text: "Can you carry a 12–15kg pack for a full mountain day?",
    options: [
      { label: "No — that's too heavy", score: 0 },
      { label: "Struggles after a few hours", score: 1 },
      { label: "Yes, with rest breaks", score: 2 },
      { label: "Yes, comfortably", score: 3 },
    ],
  },
  {
    id: "q_descent",
    category: "strength",
    text: "How do your legs and knees feel on long, steep descents?",
    options: [
      { label: "Very painful / give out", score: 0 },
      { label: "Ache significantly", score: 1 },
      { label: "Manageable", score: 2 },
      { label: "Strong and comfortable", score: 3 },
    ],
  },
  {
    id: "q_consecutive",
    category: "strength",
    text: "How many consecutive active days have you sustained?",
    options: [
      { label: "1 day max", score: 0 },
      { label: "2–3 days", score: 1 },
      { label: "4–5 days", score: 2 },
      { label: "6+ days", score: 3 },
    ],
  },
  {
    id: "q_adversity",
    category: "mindset",
    text: "When physical effort becomes very hard, you:",
    options: [
      { label: "Usually stop or slow significantly", score: 0 },
      { label: "Push through with real difficulty", score: 1 },
      { label: "Push through most of the time", score: 2 },
      { label: "Thrive under pressure", score: 3 },
    ],
  },
  {
    id: "q_turnaround",
    category: "mindset",
    text: "If conditions forced a turnaround 2 hours from the summit, you would:",
    options: [
      { label: "Consider pushing on regardless", score: 0 },
      { label: "Accept it reluctantly after pressure from others", score: 1 },
      { label: "Accept it, though very disappointed", score: 2 },
      { label: "Accept it calmly — safety always wins", score: 3 },
    ],
  },
  {
    id: "q_commitment",
    category: "mindset",
    text: "How committed are you to the training required?",
    options: [
      { label: "Just testing the waters", score: 0 },
      { label: "Fairly committed", score: 1 },
      { label: "Very committed", score: 2 },
      { label: "Completely committed — adjusting my lifestyle for this", score: 3 },
    ],
  },
  {
    id: "q_health",
    category: "health",
    text: "Do you have any cardiovascular, respiratory, or joint conditions?",
    options: [
      { label: "Yes, significant / ongoing", score: 0 },
      { label: "Yes, managed but potentially relevant", score: 1 },
      { label: "Minor / unrelated conditions", score: 2 },
      { label: "None", score: 3 },
    ],
  },
  {
    id: "q_altitude_sickness",
    category: "health",
    text: "Have you experienced altitude sickness?",
    options: [
      { label: "Yes, severely (AMS / HACE / HAPE)", score: 0 },
      { label: "Yes, mild headache or nausea", score: 1 },
      { label: "No — but limited altitude exposure so far", score: 2 },
      { label: "Been above 3,500m and felt fine", score: 3 },
    ],
  },
  {
    id: "q_timeline",
    category: "health",
    text: "How long do you have before your planned attempt?",
    options: [
      { label: "Less than 6 weeks", score: 0 },
      { label: "6–12 weeks", score: 1 },
      { label: "3–6 months", score: 2 },
      { label: "6+ months", score: 3 },
    ],
  },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  fitness: "Aerobic Fitness",
  experience: "Mountain Experience",
  strength: "Strength & Endurance",
  mindset: "Mindset & Commitment",
  health: "Health & Timing",
};

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  fitness: 0.30,
  experience: 0.25,
  strength: 0.20,
  mindset: 0.15,
  health: 0.10,
};

export const STEPS: { label: string; category: Category }[] = [
  { label: "Aerobic Fitness", category: "fitness" },
  { label: "Mountain Experience", category: "experience" },
  { label: "Strength & Endurance", category: "strength" },
  { label: "Mindset", category: "mindset" },
  { label: "Health & Timing", category: "health" },
];
