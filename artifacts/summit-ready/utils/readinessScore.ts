import { SummitGoal, TrainingWeek, Session, NearbyHill, AlpineRequirement } from "@/context/AppContext";

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

// Derive target reps for a hill session given summit elevation and the hill
// being used. Mirrors the logic in plan.tsx RepStepper.
export function calcTargetReps(summitElev: number, elevPerRep: number): number {
  return Math.max(1, Math.ceil(summitElev / Math.max(1, elevPerRep)));
}

// Check whether a single Alpine requirement has been met based on logged sessions.
// Used both in the readiness score calculation and the dashboard checklist.
export function isRequirementMet(
  req: AlpineRequirement,
  sessions: Session[],
  weeksElapsed: number,
): boolean {
  if (!req.benchmark || req.benchmarkValue === undefined) return false;
  const completed = sessions.filter(s => s.completed);
  switch (req.benchmark) {
    case "sessions_count":
      return completed.length >= req.benchmarkValue;
    case "max_elevation_m": {
      const maxElev = completed.length > 0 ? Math.max(...completed.map(s => s.elevationGain)) : 0;
      return maxElev >= req.benchmarkValue;
    }
    case "big_day_count":
      return completed.filter(s => s.type === "bigDay").length >= req.benchmarkValue;
    case "weeks_training":
      return weeksElapsed >= req.benchmarkValue;
    default:
      return false;
  }
}

export function calculateReadiness(
  goal: SummitGoal,
  plan: TrainingWeek[],
  sessions: Session[],
  opts?: {
    virtualSessionCount?: number;
    sessionReps?: Record<string, number>;
    assignedHills?: Record<string, NearbyHill>;
  }
): number {
  if (!goal || plan.length === 0) return 0;

  const sessionsPerWeek = goal.trainingDaysPerWeek || 4;
  const completed = sessions.filter(s => s.completed);
  const virtual = opts?.virtualSessionCount ?? 0;
  const totalCompleted = completed.length + virtual;
  const baseline = goal.fitnessBaseline ?? 0;

  // With no sessions logged, return the baseline directly (min 5).
  // This allows fit users who answered the experience questions to start
  // meaningfully higher than the default floor.
  if (totalCompleted === 0) return Math.max(5, baseline);

  // ── 1. Consistency (25 pts) ───────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeksElapsed = plan.filter(w => new Date(w.endDate) < today).length;
  const weeksIncludingCurrent = Math.min(plan.length, weeksElapsed + 1);
  const expectedSessions = weeksIncludingCurrent * sessionsPerWeek;
  const consistencyRatio = expectedSessions > 0 ? totalCompleted / expectedSessions : 1;
  const consistencyScore = Math.min(25, Math.round(consistencyRatio * 25));

  // ── 2. Elevation achievement (25 pts) ─────────────────────────────────────
  const trainingTarget = goal.elevationGain * 0.60;
  const maxElev = Math.max(...completed.map(s => s.elevationGain), virtual > 0 ? trainingTarget * 0.4 : 0);
  const elevRatio = Math.min(1, maxElev / trainingTarget);
  const elevScore = Math.min(25, Math.round(elevRatio * 25));

  // ── 3. Big day (20 pts) ───────────────────────────────────────────────────
  const bigDayPct: Record<string, number> = { Easy: 0.55, Moderate: 0.62, Hard: 0.72, Alpine: 0.82 };
  const threshold = (bigDayPct[goal.difficulty] ?? 0.62) * goal.elevationGain;
  const bigDays = completed.filter(s => s.type === "bigDay");
  const hasQualifyingBigDay = bigDays.some(s => s.elevationGain >= threshold);
  const bigDayScore = hasQualifyingBigDay ? 20
    : bigDays.length > 0    ? 8
    : virtual > 0           ? 4
    : 0;

  // ── 4. Hill rep progress (15 pts) ─────────────────────────────────────────
  // For each hill/bigDay plan session that has a logged rep count, calculate
  // actual/target ratio. Average across all logged sessions.
  let repScore = 0;
  if (opts?.sessionReps && Object.keys(opts.sessionReps).length > 0) {
    const repEntries: number[] = [];
    for (const [key, loggedReps] of Object.entries(opts.sessionReps)) {
      if (loggedReps <= 0) continue;
      // Find the week + session index from key "weekNum-sessionIdx"
      const [wStr, iStr] = key.split("-");
      const wNum = parseInt(wStr, 10);
      const sIdx = parseInt(iStr, 10);
      const week = plan.find(w => w.weekNumber === wNum);
      if (!week) continue;
      const session = week.sessions[sIdx];
      if (!session) continue;
      if (session.type === "hill" || session.type === "bigDay") {
        const assignedHill = opts.assignedHills?.[key];
        const elevPerRep = assignedHill?.elevation ?? week.hills[0]?.elevation ?? Math.max(50, Math.round(session.targetElevation / 4));
        const target = calcTargetReps(goal.elevationGain, elevPerRep);
        repEntries.push(Math.min(1, loggedReps / target));
      } else if (session.type === "cardio" && session.gymExercise === "treadmill") {
        const targetKm = session.targetDistanceKm ?? 0;
        if (targetKm > 0) repEntries.push(Math.min(1, loggedReps / targetKm));
      } else if (session.type === "cardio" && session.gymExercise === "stepper") {
        const targetFloors = session.targetFloors ?? 0;
        if (targetFloors > 0) repEntries.push(Math.min(1, loggedReps / targetFloors));
      }
    }
    if (repEntries.length > 0) {
      const avgRatio = repEntries.reduce((a, b) => a + b, 0) / repEntries.length;
      repScore = Math.round(avgRatio * 15);
    }
  }

  // ── 5. Effort trend (8 pts) ───────────────────────────────────────────────
  let effortScore = 4;
  if (completed.length >= 3) {
    const recent = completed.slice(0, 3).map(s => s.effort);
    const older  = completed.slice(3, 6).map(s => s.effort);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder  = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent;
    effortScore = avgRecent <= avgOlder ? 8 : 5;
  }

  // ── 6. Recent activity (7 pts) ────────────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = completed.filter(s => new Date(s.date) >= sevenDaysAgo);
  const recentScore =
    recentSessions.length >= 3 ? 7 :
    recentSessions.length >= 1 ? 4 :
    virtual > 0               ? 2 : 0;

  // ── Alpine requirements progress (0–10 pts, Alpine only) ─────────────────
  // Each measurable requirement that the user has met contributes points,
  // reflecting mountain-specific preparation rather than just general fitness.
  let alpineReqScore = 0;
  if (goal.difficulty === "Alpine" && goal.alpineProfile?.requirements?.length) {
    const measurable = goal.alpineProfile.requirements.filter(
      r => r.benchmark && r.benchmarkValue !== undefined,
    );
    if (measurable.length > 0) {
      let metCount = 0;
      for (const req of measurable) {
        switch (req.benchmark) {
          case "sessions_count":  if (totalCompleted >= req.benchmarkValue!) metCount++; break;
          case "max_elevation_m": if (maxElev >= req.benchmarkValue!) metCount++; break;
          case "big_day_count":   if (bigDays.length >= req.benchmarkValue!) metCount++; break;
          case "weeks_training":  if (weeksIncludingCurrent >= req.benchmarkValue!) metCount++; break;
        }
      }
      alpineReqScore = Math.round((metCount / measurable.length) * 10);
    }
  }

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

  // ── 7. Fitness baseline from onboarding experience questions (0–43 pts) ────
  // (baseline is already declared above for the zero-session early return)

  const raw = Math.max(0, consistencyScore + elevScore + bigDayScore + repScore + effortScore + recentScore + alpineReqScore - penalty + baseline);

  // Cap is based on real logged sessions only (not virtual).
  // Experienced athletes (high baseline) get a raised cap — but how much the
  // baseline can lift the cap depends on difficulty. General fitness transfers
  // well to Easy hikes but barely to Alpine mountains, which require
  // specific training regardless of prior fitness.
  const capBonus: Record<string, number> = {
    Easy:     22,
    Moderate: 16,
    Hard:     10,
    Alpine:    6,
  };
  const bonus = capBonus[goal.difficulty] ?? 14;
  const baseCap = sessionCap(completed.length, goal.difficulty);
  const cap = baseline > 0 ? Math.max(baseCap, Math.min(baseline + bonus, 95)) : baseCap;
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
