export type ChallengeDifficulty = "Beginner" | "Intermediate" | "Advanced" | "Expedition";
export type ChallengeMetric = "elevation" | "hikes";

export interface Milestone {
  pct: number;
  label: string;
  emoji: string;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  tagline: string;
  metric: ChallengeMetric;
  targetValue: number;
  difficulty: ChallengeDifficulty;
  durationDays: number | null;
  mountain: string;
  emoji: string;
  isPremium: boolean;
  recommendedFor: string[];
  milestones: Milestone[];
  color: string;
}

export const CHALLENGES: ChallengeTemplate[] = [
  {
    id: "everest-elevation",
    title: "Everest Elevation Challenge",
    description:
      "Gain 8,848m of elevation — the height of Everest — using your local hills. Every climb counts. Track progress one repeat at a time.",
    tagline: "Turn every local climb into summit preparation.",
    metric: "elevation",
    targetValue: 8848,
    difficulty: "Advanced",
    durationDays: null,
    mountain: "Everest",
    emoji: "🏔️",
    isPremium: false,
    recommendedFor: ["Everest Base Camp", "Kilimanjaro", "Mont Blanc"],
    milestones: [
      { pct: 25, label: "Base Camp reached", emoji: "⛺" },
      { pct: 50, label: "Into the high mountains", emoji: "🧗" },
      { pct: 75, label: "Death Zone effort", emoji: "💪" },
      { pct: 100, label: "Summit achieved", emoji: "🏔️" },
    ],
    color: "#3ECF75",
  },
  {
    id: "1000m-7days",
    title: "1,000m in 7 Days",
    description:
      "One week. One thousand metres. A short, sharp challenge that builds the habit of getting out consistently.",
    tagline: "Small hills. Big goals.",
    metric: "elevation",
    targetValue: 1000,
    difficulty: "Beginner",
    durationDays: 7,
    mountain: "Local Hills",
    emoji: "⛰️",
    isPremium: false,
    recommendedFor: ["Beginners", "Base fitness"],
    milestones: [
      { pct: 25, label: "First quarter done", emoji: "🌱" },
      { pct: 50, label: "Halfway there", emoji: "💚" },
      { pct: 75, label: "Almost there", emoji: "🔥" },
      { pct: 100, label: "Challenge complete", emoji: "✅" },
    ],
    color: "#3ECF75",
  },
  {
    id: "5-hikes-30days",
    title: "5 Hikes in 30 Days",
    description:
      "Five sessions in thirty days. Consistency over intensity — the foundation of every mountain athlete.",
    tagline: "Progress toward your summit one climb at a time.",
    metric: "hikes",
    targetValue: 5,
    difficulty: "Beginner",
    durationDays: 30,
    mountain: "Local Hills",
    emoji: "🥾",
    isPremium: false,
    recommendedFor: ["Beginners", "Explore mode users"],
    milestones: [
      { pct: 20, label: "First hike logged", emoji: "🌱" },
      { pct: 60, label: "Building momentum", emoji: "💪" },
      { pct: 80, label: "Final push", emoji: "🔥" },
      { pct: 100, label: "Consistent climber", emoji: "✅" },
    ],
    color: "#4A9FF5",
  },
  {
    id: "2500m-14days",
    title: "2,500m in 14 Days",
    description:
      "Two weeks of focused elevation training. This is where real base fitness starts to take shape.",
    tagline: "Stop guessing. Build mountain-specific fitness.",
    metric: "elevation",
    targetValue: 2500,
    difficulty: "Intermediate",
    durationDays: 14,
    mountain: "Local Hills",
    emoji: "📈",
    isPremium: false,
    recommendedFor: ["Intermediate", "Kilimanjaro prep"],
    milestones: [
      { pct: 25, label: "Momentum building", emoji: "🌱" },
      { pct: 50, label: "Halfway mark", emoji: "💚" },
      { pct: 75, label: "Strong finish ahead", emoji: "🔥" },
      { pct: 100, label: "Elevation target hit", emoji: "✅" },
    ],
    color: "#F59E0B",
  },
  {
    id: "mont-blanc-elevation",
    title: "Mont Blanc Elevation Challenge",
    description:
      "4,809m of total elevation gain — the height of Mont Blanc. Train for the real thing by climbing it in sections on your local hills.",
    tagline: "Train for big mountains using your local hills.",
    metric: "elevation",
    targetValue: 4809,
    difficulty: "Intermediate",
    durationDays: 30,
    mountain: "Mont Blanc",
    emoji: "🗻",
    isPremium: true,
    recommendedFor: ["Mont Blanc", "Alpine routes"],
    milestones: [
      { pct: 25, label: "Valley start", emoji: "🌿" },
      { pct: 50, label: "High hut ready", emoji: "🏠" },
      { pct: 75, label: "Summit ridge", emoji: "🧗" },
      { pct: 100, label: "Mont Blanc complete", emoji: "🗻" },
    ],
    color: "#A78BFA",
  },
  {
    id: "kilimanjaro-elevation",
    title: "Kilimanjaro Elevation Challenge",
    description:
      "5,895m — the roof of Africa. Use your local hills to simulate the relentless elevation of a Kilimanjaro ascent.",
    tagline: "Climb Africa's highest peak, one local hill at a time.",
    metric: "elevation",
    targetValue: 5895,
    difficulty: "Advanced",
    durationDays: 30,
    mountain: "Kilimanjaro",
    emoji: "🌍",
    isPremium: true,
    recommendedFor: ["Kilimanjaro", "High altitude trekking"],
    milestones: [
      { pct: 25, label: "Rainforest zone", emoji: "🌿" },
      { pct: 50, label: "Moorland zone", emoji: "🌾" },
      { pct: 75, label: "Alpine desert", emoji: "🏜️" },
      { pct: 100, label: "Uhuru Peak", emoji: "🌍" },
    ],
    color: "#F59E0B",
  },
  {
    id: "alpine-legs",
    title: "Alpine Legs Challenge",
    description:
      "6,000m of elevation in 30 days. This is the kind of volume that builds genuine alpine fitness — legs that won't quit on descent.",
    tagline: "Build the legs every alpine route demands.",
    metric: "elevation",
    targetValue: 6000,
    difficulty: "Advanced",
    durationDays: 30,
    mountain: "Alps",
    emoji: "⛷️",
    isPremium: true,
    recommendedFor: ["Mont Blanc", "Matterhorn", "Alpine routes"],
    milestones: [
      { pct: 25, label: "Legs warming up", emoji: "🦵" },
      { pct: 50, label: "Alpine conditioning", emoji: "💪" },
      { pct: 75, label: "Summit-ready strength", emoji: "🔥" },
      { pct: 100, label: "Alpine legs earned", emoji: "⛷️" },
    ],
    color: "#EF4444",
  },
  {
    id: "aconcagua-prep",
    title: "Aconcagua Expedition Prep",
    description:
      "10,000m over 60 days — the volume you need before attempting the highest peak in the Americas. This is expedition-level preparation.",
    tagline: "Expedition fitness starts at your local hill.",
    metric: "elevation",
    targetValue: 10000,
    difficulty: "Expedition",
    durationDays: 60,
    mountain: "Aconcagua",
    emoji: "🏔️",
    isPremium: true,
    recommendedFor: ["Aconcagua", "High altitude expeditions"],
    milestones: [
      { pct: 25, label: "Expedition base", emoji: "⛺" },
      { pct: 50, label: "High camp ready", emoji: "🏕️" },
      { pct: 75, label: "Summit push", emoji: "🧗" },
      { pct: 100, label: "Aconcagua prep complete", emoji: "🏔️" },
    ],
    color: "#EF4444",
  },
];

export const DIFF_COLOR: Record<ChallengeDifficulty, string> = {
  Beginner: "#3ECF75",
  Intermediate: "#F59E0B",
  Advanced: "#EF4444",
  Expedition: "#A78BFA",
};

export function getChallenge(id: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(c => c.id === id);
}
