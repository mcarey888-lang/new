import { SummitGoal, TrainingWeek, Session } from "@/context/AppContext";

export function calculateReadiness(
  goal: SummitGoal,
  plan: TrainingWeek[],
  sessions: Session[]
): number {
  if (!goal || plan.length === 0) return 0;

  const completed = sessions.filter(s => s.completed);
  if (completed.length === 0) return 5;

  // 1. Consistency (30 pts): ratio of completed sessions vs expected by now
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeksElapsed = plan.filter(w => new Date(w.endDate) < today).length;
  const expectedSessions = weeksElapsed * 4;
  const consistencyScore = expectedSessions > 0
    ? Math.min(30, Math.round((completed.length / expectedSessions) * 30))
    : completed.length > 0 ? 15 : 0;

  // 2. Elevation achievement (30 pts): highest elevation achieved vs target
  const maxElev = Math.max(...completed.map(s => s.elevationGain), 0);
  const elevScore = Math.min(30, Math.round((maxElev / goal.elevationGain) * 30));

  // 3. Big day completion (20 pts): completed a big day at 80%+ target
  const bigDays = completed.filter(s => s.type === "bigDay");
  const hasGoodBigDay = bigDays.some(s => s.elevationGain >= goal.elevationGain * 0.8);
  const bigDayScore = hasGoodBigDay ? 20 : bigDays.length > 0 ? 10 : 0;

  // 4. Effort trend (10 pts): improving effort scores
  if (completed.length >= 3) {
    const recent = completed.slice(0, 3).map(s => s.effort);
    const older = completed.slice(3, 6).map(s => s.effort);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent;
    // Lower effort = getting fitter (same session feels easier)
    var effortScore = avgRecent <= avgOlder ? 10 : 5;
  } else {
    var effortScore = 5;
  }

  // 5. Recent activity (10 pts)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = completed.filter(s => new Date(s.date) >= sevenDaysAgo);
  const recentScore = recentSessions.length >= 3 ? 10 : recentSessions.length >= 1 ? 5 : 0;

  // Penalties
  let penalty = 0;
  // Overtraining: avg effort > 4.5
  const avgEffort = completed.reduce((a, s) => a + s.effort, 0) / completed.length;
  if (avgEffort > 4.5) penalty += 5;
  // Big gaps: no activity in 10+ days
  const sortedDates = completed.map(s => new Date(s.date)).sort((a, b) => b.getTime() - a.getTime());
  if (sortedDates.length > 0) {
    const daysSinceLast = Math.floor((today.getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLast > 10) penalty += 10;
    else if (daysSinceLast > 7) penalty += 5;
  }

  const total = Math.max(0, Math.min(100, consistencyScore + elevScore + bigDayScore + effortScore + recentScore - penalty));
  return total;
}

export function getReadinessStatus(score: number): {
  label: string;
  color: string;
  emoji: string;
} {
  if (score >= 70) return { label: "Ready", color: "#4CAF74", emoji: "check" };
  if (score >= 40) return { label: "Close", color: "#F2994A", emoji: "clock" };
  return { label: "Not Ready", color: "#E53E3E", emoji: "alert-circle" };
}

export function getDaysRemaining(summitDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(summitDate);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getWeeklyCompletion(sessions: Session[], weekNumber: number): number {
  const weekSessions = sessions.filter(s => s.weekNumber === weekNumber && s.completed);
  return Math.min(100, Math.round((weekSessions.length / 4) * 100));
}
