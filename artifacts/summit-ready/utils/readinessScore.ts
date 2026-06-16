import { SummitGoal, TrainingWeek, Session, NearbyHill, AlpineRequirement, CompletedGoal, ExploreHike } from "@/context/AppContext";

const DIFFICULTY_RANK: Record<string, number> = {
  Easy: 1, Moderate: 2, Hard: 3, Alpine: 4,
};

export function getPeakExperienceState(
  goal: SummitGoal,
  completedGoals: CompletedGoal[],
): { superseded: boolean; floor: boolean; mountain: string } {
  if (!completedGoals.length) return { superseded: false, floor: false, mountain: "" };
  const goalRank = DIFFICULTY_RANK[goal.difficulty] ?? 2;

  for (const cg of completedGoals) {
    const cgRank = DIFFICULTY_RANK[cg.difficulty] ?? 2;
    if (cgRank >= goalRank && cg.elevationGain >= goal.elevationGain) {
      return { superseded: true, floor: false, mountain: cg.mountainName };
    }
  }
  for (const cg of completedGoals) {
    const cgRank = DIFFICULTY_RANK[cg.difficulty] ?? 2;
    if (cgRank >= goalRank || cg.elevationGain >= goal.elevationGain) {
      return { superseded: false, floor: true, mountain: cg.mountainName };
    }
  }
  return { superseded: false, floor: false, mountain: "" };
}

// Smooth cap: linearly interpolates between anchor points so every additional
// session produces a visible score increase rather than waiting for a band jump.
// Anchor pairs are [sessionCount, maxCap]. Values between anchors are lerped.
function sessionCap(realSessions: number, difficulty: string): number {
  const anchors: Record<string, Array<[number, number]>> = {
    Easy:     [[0, 5], [3, 55], [7, 80], [15, 93], [29, 100]],
    Moderate: [[0, 5], [3, 48], [7, 72], [15, 88], [29, 96], [50, 100]],
    Hard:     [[0, 5], [3, 35], [7, 56], [15, 74], [29, 88], [50, 96]],
    Alpine:   [[0, 5], [3, 22], [7, 38], [15, 56], [29, 72], [50, 86]],
  };
  const row = anchors[difficulty] ?? anchors.Moderate;
  if (realSessions <= 0) return row[0][1];
  for (let i = 0; i < row.length - 1; i++) {
    const [x0, y0] = row[i];
    const [x1, y1] = row[i + 1];
    if (realSessions <= x1) {
      const t = (realSessions - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return row[row.length - 1][1];
}

export function calcTargetReps(summitElev: number, elevPerRep: number): number {
  return Math.max(1, Math.ceil(summitElev / Math.max(1, elevPerRep)));
}

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
    completedGoals?: CompletedGoal[];
    exploreHikes?: ExploreHike[];
  }
): number {
  if (!goal || plan.length === 0) return 0;

  const sessionsPerWeek = goal.trainingDaysPerWeek || 4;
  const planCompleted = sessions.filter(s => s.completed);
  const virtual = opts?.virtualSessionCount ?? 0;
  const baseline = goal.fitnessBaseline ?? 0;

  // Convert GPS-tracked hikes into session-shaped objects so they feed
  // every scoring component that should reward real outdoor activity.
  const hikeCompleted: Session[] = (opts?.exploreHikes ?? []).map(h => ({
    id: h.id,
    date: h.date,
    type: "cardio" as const,
    distance: h.distance,
    elevationGain: h.elevationGain,
    duration: h.timeTaken,
    effort: 3 as const,
    notes: h.notes,
    completed: true,
    weekNumber: 0,
  }));

  // allCompleted includes plan sessions + explore hikes, sorted oldest-first
  // so that effort-trend slices are chronologically meaningful.
  const allCompleted = [...planCompleted, ...hikeCompleted].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const totalCompleted = allCompleted.length + virtual;

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
  const maxElev = Math.max(
    ...allCompleted.map(s => s.elevationGain),
    virtual > 0 ? trainingTarget * 0.4 : 0,
  );
  const elevRatio = Math.min(1, maxElev / trainingTarget);
  const elevScore = Math.min(25, Math.round(elevRatio * 25));

  // ── 3. Big day (20 pts) ───────────────────────────────────────────────────
  // Grades smoothly from 0→20 based on how close the best session elevation
  // is to the big-day threshold, so any quality outing moves the needle.
  const bigDayPct: Record<string, number> = { Easy: 0.55, Moderate: 0.62, Hard: 0.72, Alpine: 0.82 };
  const threshold = (bigDayPct[goal.difficulty] ?? 0.62) * goal.elevationGain;
  const bigDays = allCompleted.filter(s => s.type === "bigDay");
  const bestElev = allCompleted.length > 0 ? Math.max(...allCompleted.map(s => s.elevationGain)) : 0;
  const bigDayRatio = threshold > 0 ? Math.min(1, bestElev / threshold) : 0;
  const bigDayScore = bigDays.length === 0 && virtual > 0
    ? Math.max(2, Math.round(bigDayRatio * 20))
    : Math.round(bigDayRatio * 20);

  // ── 4. Hill rep progress (15 pts) ─────────────────────────────────────────
  let repScore = 0;
  if (opts?.sessionReps && Object.keys(opts.sessionReps).length > 0) {
    const repEntries: number[] = [];
    for (const [key, loggedReps] of Object.entries(opts.sessionReps)) {
      if (loggedReps <= 0) continue;
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
      } else if (session.type === "cardio" && !session.gymExercise) {
        if (session.targetFlights !== undefined && session.targetFlights > 0) {
          repEntries.push(Math.min(1, loggedReps / session.targetFlights));
        } else {
          const target = session.targetElevation ?? 0;
          if (target > 0) repEntries.push(Math.min(1, loggedReps / target));
        }
      }
    }
    if (repEntries.length > 0) {
      const avgRatio = repEntries.reduce((a, b) => a + b, 0) / repEntries.length;
      repScore = Math.round(avgRatio * 15);
    }
  }

  // ── 5. Effort trend (8 pts) ───────────────────────────────────────────────
  // Smooth: scales continuously between 4 and 8 based on how much average
  // effort has changed across the last 6 sessions (improving = lower effort).
  let effortScore = 4;
  if (allCompleted.length >= 3) {
    const recent = allCompleted.slice(-3).map(s => s.effort);
    const older  = allCompleted.slice(-6, -3).map(s => s.effort);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder  = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent;
    const delta = avgOlder - avgRecent; // positive = getting easier (improving)
    const normalized = Math.max(-1, Math.min(1, delta / 2));
    effortScore = Math.round(6 + normalized * 2); // 4 (regressing) → 8 (improving)
  }

  // ── 6. Recent activity (7 pts) ────────────────────────────────────────────
  // Smooth: each session in the last 7 days adds points rather than snapping
  // at thresholds. 1 session→4, 2→6, 3+→7 (explore hikes count too).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = allCompleted.filter(s => new Date(s.date) >= sevenDaysAgo);
  const recentScore = recentSessions.length === 0
    ? (virtual > 0 ? 2 : 0)
    : Math.min(7, 2 + recentSessions.length * 2);

  // ── Alpine requirements progress (0–10 pts, Alpine only) ─────────────────
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
  if (allCompleted.length > 0) {
    const avgEffort = allCompleted.reduce((a, s) => a + s.effort, 0) / allCompleted.length;
    if (avgEffort > 4.5) penalty += 5;
    const sortedDates = allCompleted
      .map(s => new Date(s.date))
      .sort((a, b) => b.getTime() - a.getTime());
    const daysSinceLast = Math.floor(
      (today.getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLast > 10) penalty += 10;
    else if (daysSinceLast > 7) penalty += 5;
  }

  const raw = Math.max(0,
    consistencyScore + elevScore + bigDayScore + repScore +
    effortScore + recentScore + alpineReqScore - penalty + baseline
  );

  // Cap uses all real completed sessions (plan + hikes) for a fair ceiling.
  const capBonus: Record<string, number> = {
    Easy: 22, Moderate: 16, Hard: 10, Alpine: 6,
  };
  const bonus = capBonus[goal.difficulty] ?? 14;
  const baseCap = sessionCap(allCompleted.length, goal.difficulty);
  const cap = baseline > 0 ? Math.max(baseCap, Math.min(baseline + bonus, 95)) : baseCap;
  const capped = Math.min(cap, raw);

  if (opts?.completedGoals?.length) {
    const peak = getPeakExperienceState(goal, opts.completedGoals);
    if (peak.superseded) return Math.max(capped, 95);
    if (peak.floor)      return Math.max(capped, 85);
  }
  return capped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Score stagnation diagnosis
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreInsight {
  title: string;
  body: string;
  tip: string;
}

/**
 * Returns a human-readable explanation of why the readiness score didn't
 * improve after logging a session.  Returns null if no clear cause is found
 * (e.g. score is already capped for the current training phase and every
 * metric looks healthy — which is fine, just not explainable in one line).
 */
export function diagnoseScoreStagnation(
  goal: SummitGoal,
  sessions: Session[],
  exploreHikes: ExploreHike[],
  oldScore: number,
  newScore: number,
): ScoreInsight | null {
  if (newScore > oldScore) return null;

  const planCompleted = sessions.filter(s => s.completed);
  const hikeCompleted: Session[] = exploreHikes.map(h => ({
    id: h.id, date: h.date, type: "cardio" as const,
    distance: h.distance, elevationGain: h.elevationGain,
    duration: h.timeTaken, effort: 3 as const,
    notes: h.notes, completed: true, weekNumber: 0,
  }));
  const allCompleted = [...planCompleted, ...hikeCompleted].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  if (allCompleted.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byRecent = [...allCompleted].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const daysSincePrev = allCompleted.length >= 2
    ? Math.floor(
        (new Date(byRecent[0].date).getTime() - new Date(byRecent[1].date).getTime())
        / (1000 * 60 * 60 * 24)
      )
    : 0;

  // 1. Long inactivity gap before this session (penalty was already applied)
  if (daysSincePrev > 10) {
    return {
      title: "Long gap before this session",
      body: `There was a ${daysSincePrev}-day gap since your last session. The score applies a fitness penalty after 10 days of inactivity — this session helped, but the penalty offset it.`,
      tip: "Regular short sessions maintain fitness far better than occasional big efforts. Try to log something at least every 5–6 days.",
    };
  }
  if (daysSincePrev > 7) {
    return {
      title: "Losing momentum",
      body: `It was ${daysSincePrev} days since your previous session. A small penalty applies after 7 days away — this session helped, but not quite enough to overcome it.`,
      tip: "Even a short walk or easy cardio day every 5–6 days keeps your score moving forward.",
    };
  }

  // 2. Overexertion (high average effort)
  const avgEffort = allCompleted.reduce((a, s) => a + s.effort, 0) / allCompleted.length;
  if (avgEffort > 4.5) {
    return {
      title: "Going too hard",
      body: "Your sessions are consistently at maximum effort. When every outing is at the limit, recovery is compromised and the score applies an overexertion penalty.",
      tip: "Mix in at least one easier session per week (effort 2–3). Recovery is where fitness is built.",
    };
  }

  // 3. Cumulative fatigue (recent sessions feel harder than earlier ones)
  if (allCompleted.length >= 4) {
    const recent = allCompleted.slice(-3).map(s => s.effort);
    const older  = allCompleted.slice(-6, -3).map(s => s.effort);
    if (older.length > 0) {
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const avgOlder  = older.reduce((a, b) => a + b, 0) / older.length;
      if (avgRecent > avgOlder + 0.8) {
        return {
          title: "Fatigue building up",
          body: "Your recent sessions are feeling notably harder than your earlier ones — a classic sign of accumulated fatigue without enough recovery.",
          tip: "Take a rest or easy day before your next hard effort. Alternating hard and easy days keeps your score trending up.",
        };
      }
    }
  }

  // 4. Session cap is the ceiling (early in training)
  if (allCompleted.length <= 3) {
    const remaining = 4 - allCompleted.length;
    return {
      title: "Score ceiling is still low",
      body: "Early in training your score has a ceiling based on sessions logged so far — this prevents overconfidence when fitness hasn't been established yet.",
      tip: `Log ${remaining} more session${remaining !== 1 ? "s" : ""} to start raising the ceiling. It lifts quickly once you build a consistent base.`,
    };
  }

  // 5. Elevation too low to move the needle
  const trainingTarget = goal.elevationGain * 0.60;
  const maxElev = Math.max(...allCompleted.map(s => s.elevationGain));
  if (maxElev < trainingTarget * 0.25) {
    return {
      title: "Elevation gains are low",
      body: `Your best session so far reached ${maxElev}m. To move the elevation component of your score, you'll need sessions pushing closer to ${Math.round(trainingTarget)}m.`,
      tip: "Try chaining extra laps on your local hill, or seek out a longer route with more continuous climbing.",
    };
  }

  // 6. Score held steady — generic cap explanation
  if (newScore === oldScore) {
    return {
      title: "Score holding steady",
      body: "Your score didn't change — you're maintaining current fitness well, but not yet breaking through to the next level. The biggest unlocks come from bigger elevation sessions.",
      tip: `Aim for a session with at least ${Math.round(trainingTarget * 0.5)}m elevation gain to move the 'Big Day' component, which is worth up to 20 points.`,
    };
  }

  // 7. Score dropped
  return {
    title: "Score dipped slightly",
    body: "Your score dropped even with a new session logged — a gap or effort penalty is outweighing this session's contribution.",
    tip: "Check how long it's been since your last session, and whether your effort levels have been very high recently.",
  };
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
