import { SummitGoal, TrainingWeek, Session } from "@/context/AppContext";

// Maximum achievable score based on actual logged sessions and difficulty.
// Harder routes require far more logged evidence before a high score is possible.
function sessionCap(realSessions: number, difficulty: string): number {
  const bands: Record<string, number[]> = {
    //            0-4  5-9  10-19  20-29  30-39  40+
    Easy:        [38,  62,  82,    96,    100,   100],
    Moderate:    [32,  54,  72,    88,    96,    100],
    Hard:        [25,  44,  62,    76,    88,     96],
    Alpine:      [14,  28,  42,    56,    68,     80],
  };
  const row = bands[difficulty] ?? bands.Moderate;
  if (realSessions < 5)  return row[0];
  if (realSessions < 10) return row[1];
  if (realSessions < 20) return row[2];
  if (realSessions < 30) return row[3];
  if (realSessions < 40) return row[4];
  return row[5];
}

export function calculateReadiness(
  goal: SummitGoal,
  plan: TrainingWeek[],
  sessions: Session[],
  opts?: { virtualSessionCount?: number }
): number {
  if (!goal || plan.length === 0) return 0;

  const sessionsPerWeek = goal.trainingDaysPerWeek || 4;
  const completed = sessions.filter(s => s.completed);
  const virtual = opts?.virtualSessionCount ?? 0;
  const totalCompleted = completed.length + virtual;

  if (totalCompleted === 0) return 5;

  // ── 1. Consistency (30 pts) ───────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeksElapsed = plan.filter(w => new Date(w.endDate) < today).length;
  const weeksIncludingCurrent = Math.min(plan.length, weeksElapsed + 1);
  const expectedSessions = weeksIncludingCurrent * sessionsPerWeek;
  const consistencyScore = Math.min(30, Math.round((totalCompleted / expectedSessions) * 30));

  // ── 2. Elevation achievement (30 pts) ────────────────────────────────────
  const maxElev = Math.max(...completed.map(s => s.elevationGain), 0);
  const elevScore = Math.min(30, Math.round((maxElev / goal.elevationGain) * 30));

  // ── 3. Big day (20 pts) ───────────────────────────────────────────────────
  // Harder routes need a proportionally bigger qualifying big day
  const bigDayPct: Record<string, number> = { Easy: 0.75, Moderate: 0.80, Hard: 0.87, Alpine: 0.93 };
  const threshold = (bigDayPct[goal.difficulty] ?? 0.80) * goal.elevationGain;
  const bigDays = completed.filter(s => s.type === "bigDay");
  const hasQualifyingBigDay = bigDays.some(s => s.elevationGain >= threshold);
  const bigDayScore = hasQualifyingBigDay ? 20 : bigDays.length > 0 ? 4 : 0;

  // ── 4. Effort trend (10 pts) ──────────────────────────────────────────────
  let effortScore = 4;
  if (completed.length >= 3) {
    const recent = completed.slice(0, 3).map(s => s.effort);
    const older  = completed.slice(3, 6).map(s => s.effort);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder  = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent;
    effortScore = avgRecent <= avgOlder ? 10 : 5;
  }

  // ── 5. Recent activity (10 pts) ───────────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = completed.filter(s => new Date(s.date) >= sevenDaysAgo);
  const recentScore =
    recentSessions.length >= 3 ? 10 :
    recentSessions.length >= 1 ? 5 :
    virtual > 0               ? 3 : 0;

  // ── Penalties ─────────────────────────────────────────────────────────────
  let penalty = 0;
  if (completed.length > 0) {
    const avgEffort = completed.reduce((a, s) => a + s.effort, 0) / completed.length;
    if (avgEffort > 4.5) penalty += 5;
    const sortedDates = completed
      .map(s => new Date(s.date))
      .sort((a, b) => b.getTime() - a.getTime());
    const daysSinceLast = Math.floor(
      (today.getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLast > 10) penalty += 10;
    else if (daysSinceLast > 7) penalty += 5;
  }

  const raw = Math.max(0, consistencyScore + elevScore + bigDayScore + effortScore + recentScore - penalty);

  // Cap the final score based on how many real sessions have been logged
  // and the difficulty of the goal. Harder routes require more evidence.
  const cap = sessionCap(completed.length, goal.difficulty);
  return Math.min(cap, raw);
}

export function getReadinessStatus(score: number): {
  label: string; color: string; emoji: string;
} {
  if (score >= 70) return { label: "Ready",     color: "#4CAF74", emoji: "check" };
  if (score >= 40) return { label: "Close",     color: "#F2994A", emoji: "clock" };
  return              { label: "Not Ready",  color: "#E53E3E", emoji: "alert-circle" };
}

export function getDaysRemaining(summitDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(summitDate);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getWeeklyCompletion(
  sessions: Session[],
  weekNumber: number,
  sessionsPerWeek = 4
): number {
  const weekSessions = sessions.filter(s => s.weekNumber === weekNumber && s.completed);
  return Math.min(100, Math.round((weekSessions.length / sessionsPerWeek) * 100));
}
