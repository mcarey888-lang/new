import { Session } from "@/context/AppContext";

export type AchievementTier = "bronze" | "silver" | "gold";
export type AchievementCategory = "sessions" | "elevation" | "hills" | "bigday" | "readiness" | "consistency";

export interface Achievement {
  id: string;
  title: string;
  emoji: string;
  description: string;
  tier: AchievementTier;
  category: AchievementCategory;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Sessions
  { id: "first_session",  title: "First Steps",       emoji: "👟", description: "Logged your very first training session",               tier: "bronze", category: "sessions" },
  { id: "sessions_5",     title: "Five and Counting",  emoji: "🔥", description: "5 training sessions in the books",                     tier: "bronze", category: "sessions" },
  { id: "sessions_10",    title: "Finding Your Legs",  emoji: "💪", description: "10 training sessions completed",                       tier: "silver", category: "sessions" },
  { id: "sessions_25",    title: "Committed",          emoji: "⛰️", description: "25 sessions — you're serious about this",              tier: "silver", category: "sessions" },
  { id: "sessions_50",    title: "Summit Veteran",     emoji: "🏔️", description: "50 sessions logged — remarkable dedication",           tier: "gold",   category: "sessions" },

  // Elevation
  { id: "elev_1000",  title: "First Thousand",      emoji: "📈", description: "1,000m of total elevation gained",                       tier: "bronze", category: "elevation" },
  { id: "elev_5000",  title: "High Achiever",        emoji: "🌄", description: "5,000m of total elevation gained",                       tier: "silver", category: "elevation" },
  { id: "elev_10000", title: "Ten Peaks",            emoji: "🗻", description: "10,000m of total elevation — a serious mountaineer",    tier: "silver", category: "elevation" },
  { id: "elev_29029", title: "Everest Equivalent",   emoji: "🏔️", description: "29,029m gained — the height of Everest, in training",  tier: "gold",   category: "elevation" },

  // Hill repeats
  { id: "first_hill", title: "Hill Bagger",   emoji: "🏃", description: "Completed your first hill repeat session",            tier: "bronze", category: "hills" },
  { id: "hills_10",   title: "Hill Warrior",  emoji: "⚡", description: "10 hill repeat sessions — your legs know the drill", tier: "silver", category: "hills" },

  // Big days
  { id: "first_bigday", title: "Summit Push",     emoji: "🌅", description: "Completed your first big day session",                         tier: "bronze", category: "bigday" },
  { id: "bigdays_3",    title: "Mountain Ready",   emoji: "🧗", description: "3 big days completed — summit shape is building",             tier: "silver", category: "bigday" },
  { id: "bigdays_5",    title: "Peak Hunter",      emoji: "🏔️", description: "5 big days — you're built for the mountains",               tier: "gold",   category: "bigday" },

  // Readiness score
  { id: "readiness_50", title: "Halfway There",   emoji: "🎯", description: "Reached 50% summit readiness",                        tier: "bronze", category: "readiness" },
  { id: "readiness_75", title: "Summit Ready",    emoji: "🌟", description: "Reached 75% summit readiness",                        tier: "silver", category: "readiness" },
  { id: "readiness_90", title: "Peak Condition",  emoji: "💎", description: "Reached 90% readiness — the summit is yours",        tier: "gold",   category: "readiness" },

  // Consistency / plan
  { id: "week_complete", title: "Perfect Week",  emoji: "📅", description: "Completed an entire training week in the plan",  tier: "bronze", category: "consistency" },
  { id: "weeks_3",       title: "On a Roll",     emoji: "🔄", description: "3 full training weeks completed in the plan",    tier: "silver", category: "consistency" },
];

export const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: "#CD7F32",
  silver: "#A8A9AD",
  gold:   "#FFD700",
};

export const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold:   "Gold",
};

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  sessions:    "Sessions",
  elevation:   "Elevation",
  hills:       "Hill Repeats",
  bigday:      "Big Days",
  readiness:   "Readiness",
  consistency: "Consistency",
};

export function computeUnlocked(
  sessions: Session[],
  readinessScore: number,
  submittedWeekCount: number,
): Set<string> {
  const completed = sessions.filter(s => s.completed);
  const totalElev  = completed.reduce((a, s) => a + s.elevationGain, 0);
  const hillSessions = completed.filter(s => s.type === "hill");
  const bigDays      = completed.filter(s => s.type === "bigDay");

  const u = new Set<string>();

  if (completed.length >= 1)  u.add("first_session");
  if (completed.length >= 5)  u.add("sessions_5");
  if (completed.length >= 10) u.add("sessions_10");
  if (completed.length >= 25) u.add("sessions_25");
  if (completed.length >= 50) u.add("sessions_50");

  if (totalElev >= 1000)  u.add("elev_1000");
  if (totalElev >= 5000)  u.add("elev_5000");
  if (totalElev >= 10000) u.add("elev_10000");
  if (totalElev >= 29029) u.add("elev_29029");

  if (hillSessions.length >= 1)  u.add("first_hill");
  if (hillSessions.length >= 10) u.add("hills_10");

  if (bigDays.length >= 1) u.add("first_bigday");
  if (bigDays.length >= 3) u.add("bigdays_3");
  if (bigDays.length >= 5) u.add("bigdays_5");

  if (readinessScore >= 50) u.add("readiness_50");
  if (readinessScore >= 75) u.add("readiness_75");
  if (readinessScore >= 90) u.add("readiness_90");

  if (submittedWeekCount >= 1) u.add("week_complete");
  if (submittedWeekCount >= 3) u.add("weeks_3");

  return u;
}
