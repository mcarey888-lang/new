import { SummitGoal, TrainingWeek, Session } from "@/context/AppContext";

// Maximum achievable score based on actual logged sessions and difficulty.
// The cap prevents zero-session gaming but must not punish genuine plan completion.
function sessionCap(realSessions: number, difficulty: string): number {
  const bands: Record<string, number[]> = {
    //          0   1-3  4-7  8-15  16-29  30+
    Easy:      [5,  55,  80,  93,   100,   100],
    Moderate:  [5,  48,  72,  88,    96,   100],
    Hard:      [5,  35,  56,  74,    88,    96],
    Alpine:    [5,  22,  38,  56,    72,    86],
  };
  const row = bands[difficulty] ?? bands.Moderate;
  if (realSessions === 0) return row[0];
  if (realSessions <= 3)  return row[1];
  if (realSessions <= 7)  return row[2];
  if (realSessions <= 15) return row[3];
  if (realSessions <= 29) return row[4];
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
  const consistencyRatio = expectedSessions > 0 ? totalCompleted / expectedSessions : 1;
  const consistencyScore = Math.min(30, Math.round(consistencyRatio * 30));

  // ── 2. Elevation achievement (30 pts) ─────────────────────────────────────
  // Compare the best single session to a realistic TRAINING target (60% of summit),
  // not the summit elevation itself. Reaching 60% of summit elevation in training
  // is excellent preparation; you don't need to replicate the summit in training.
  const trainingTarget = goal.elevationGain * 0.60;
  const maxElev = Math.max(...completed.map(s => s.elevationGain), virtual > 0 ? trainingTarget * 0.4 : 0);
  const elevRatio = Math.min(1, maxElev / trainingTarget);
  const elevScore = Math.min(30, Math.round(elevRatio * 30));

  // ── 3. Big day (20 pts) ───────────────────────────────────────────────────
  // Threshold: 55-70% of summit elevation depending on difficulty.
  // This reflects what a well-structured plan's big day should target.
  const bigDayPct: Record<string, number> = { Easy: 0.55, Moderate: 0.62, Hard: 0.72, Alpine: 0.82 };
  const threshold = (bigDayPct[goal.difficulty] ?? 0.62) * goal.elevationGain;
  const bigDays = completed.filter(s => s.type === "bigDay");
  const hasQualifyingBigDay = bigDays.some(s => s.elevationGain >= threshold);
  const bigDayScore = hasQualifyingBigDay ? 20
    : bigDays.length > 0    ? 8
    : virtual > 0           ? 4
    : 0;

  // ── 4. Effort trend (10 pts) ──────────────────────────────────────────────
  let effortScore = 5;
  if (completed.length >= 3) {
    const recent = completed.slice(0, 3).map(s => s.effort);
    const older  = completed.slice(3, 6).map(s => s.effort);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder  = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent;
    effortScore = avgRecent <= avgOlder ? 10 : 6;
  }

  // ── 5. Recent activity (10 pts) ───────────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = completed.filter(s => new Date(s.date) >= sevenDaysAgo);
  const recentScore =
    recentSessions.length >= 3 ? 10 :
    recentSessions.length >= 1 ? 6  :
    virtual > 0               ? 4  : 0;

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

  // Cap is based on real logged sessions only (not virtual)
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
