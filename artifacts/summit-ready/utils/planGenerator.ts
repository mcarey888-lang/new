import { SummitGoal, TrainingWeek, PlanSession } from "@/context/AppContext";
import { getTimeRequirement, type Difficulty, type FitnessLevel } from "@/utils/timeValidator";

function getStartElevationMultiplier(fitnessLevel: string): number {
  switch (fitnessLevel) {
    case "Strong": return 0.45;
    case "Average": return 0.30;
    default: return 0.20;
  }
}

function getDifficultyMultiplier(difficulty: string): number {
  switch (difficulty) {
    case "Alpine": return 1.2;
    case "Hard": return 1.0;
    case "Moderate": return 0.85;
    default: return 0.7;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function hasGym(goal: SummitGoal) { return (goal.equipment ?? []).includes("gym"); }
function hasWeights(goal: SummitGoal) { return (goal.equipment ?? []).includes("weights") || (goal.equipment ?? []).includes("bands"); }
function noEquipment(goal: SummitGoal) {
  const eq = goal.equipment ?? ["none"];
  return eq.includes("none") || eq.every(e => e === "none");
}

function createEquipmentCardioSession(targetElev: number, weekNum: number, goal: SummitGoal, variant = 0): PlanSession {
  const elevTarget = Math.round(targetElev * 0.3);
  const isEasy = goal.difficulty === "Easy";
  const dur = isEasy
    ? (weekNum < 4 ? "25–35 min" : "35–45 min")
    : (weekNum < 4 ? "30–40 min" : "40–55 min");

  if (hasGym(goal)) {
    const opts = [
      {
        label: "Incline Treadmill",
        description: `Set the treadmill to 8–12% incline and walk or jog at a pace where you can hold a conversation. Keep your heart rate in zone 2–3 for the full duration. Focus on steady foot strike and upright posture — the same mechanics you'll use on the mountain.`,
      },
      {
        label: "StairMaster / Step Machine",
        description: `Set the StairMaster or step machine to a moderate resistance and maintain a consistent stepping rhythm for the full session. Do not lean on the handrails — engage your legs and core as you would on a real ascent. This is one of the most specific gym exercises for summit fitness.`,
      },
      {
        label: "Incline Treadmill + Leg Strength",
        description: `25 min on the incline treadmill (10–12%), then move straight to: goblet squats 3×12, reverse lunges 3×10 each leg, single-leg calf raises 3×15. Rest 60s between sets. Builds the leg drive and endurance needed on steep terrain.`,
      },
    ];
    const o = opts[variant % opts.length];
    return { type: "cardio", label: o.label, description: o.description, targetElevation: elevTarget, duration: dur };
  }

  if (hasWeights(goal)) {
    const opts = [
      {
        label: "Uphill Walk / Run + Resistance",
        description: `20–30 min brisk walk or jog on any incline you can find — a hill, road with gradient, or stairs. Then: resistance band squats 3×15, weighted step-ups onto a chair or box 3×12 each leg, calf raises 3×20. These movements directly target the muscles that take the most strain on summit day.`,
      },
      {
        label: "Uphill Walk + Core",
        description: `Walk briskly for the full session on any incline — a hill, ramp, or stairs. Aim to keep your breathing elevated throughout. Finish with: plank hold 3×45s, glute bridges 3×15, and side-lying leg raises 3×12 each. A strong core stabilises every step on uneven terrain.`,
      },
    ];
    const o = opts[variant % opts.length];
    return { type: "cardio", label: o.label, description: o.description, targetElevation: elevTarget, duration: dur };
  }

  // No equipment — walks, runs, stairs
  const metresPerRep = 15;
  const stairReps = Math.max(5, Math.round(elevTarget / metresPerRep));
  const floorsPerRep = Math.round(metresPerRep / 3);
  const totalElev = stairReps * metresPerRep;
  const opts = [
    {
      label: "Stair Repeats",
      description: `Find a staircase with at least ${floorsPerRep} floors — a car park, block of flats, or office building works well. Walk up at a controlled pace, descend for recovery, and repeat ${stairReps} times to accumulate ${totalElev}m of elevation gain. Keep your weight slightly forward and drive through the heel on each step, just as you would on a mountain path.`,
    },
    {
      label: "Uphill Walk / Run",
      description: `Walk or jog any route that gains height — roads with gradient, park paths, or embankments all count. Aim to accumulate ${elevTarget}m of uphill over the session. Time on incline matters more than pace; stay aerobic and breathe steadily throughout.`,
    },
    {
      label: "Sustained Brisk Walk",
      description: `A longer steady walk at a pace where you're breathing noticeably but can still speak in short sentences. Include as much uphill as you can find. Focus on keeping a consistent pace for the full duration — building time on feet is key at this stage of training.`,
    },
  ];
  const o = opts[variant % opts.length];
  return { type: "cardio", label: o.label, description: o.description, targetElevation: elevTarget, duration: dur };
}

function createHillSession(targetElev: number, hills: TrainingWeek["hills"], goal: SummitGoal, weekNum: number): PlanSession {
  const hill = hills[0];
  const isEasy = goal.difficulty === "Easy";
  const hillDur = isEasy ? "45–60 min" : "60–90 min";

  if (!hill) {
    const noHillRaw = Math.max(1, Math.ceil((targetElev * 0.5) / 150));
    const noHillReps = weekNum <= 1 ? 1 : weekNum <= 2 ? Math.min(noHillRaw, 2) : noHillRaw;
    return {
      type: "hill",
      label: "Hill Repeats",
      description: `Find your nearest hill and repeat climbs. Target ${Math.round(targetElev * 0.5)}m total elevation gain — ${Math.round((targetElev * 0.5 / goal.elevationGain) * 100)}% of your summit's ${goal.elevationGain}m. Aim for ${noHillReps} ${noHillReps === 1 ? "rep" : "reps"} today.`,
      targetElevation: Math.round(targetElev * 0.5),
      duration: hillDur,
    };
  }

  const rawReps = Math.max(1, Math.ceil((targetElev * 0.5) / hill.elevation));
  // Start slow and build: week 1 = 1 rep always, week 2 = max 2 reps, week 3+ = calculated
  const targetReps = weekNum <= 1 ? 1 : weekNum <= 2 ? Math.min(rawReps, 2) : rawReps;
  const totalGain = targetReps * hill.elevation;
  const pctOfSummit = Math.round((totalGain / goal.elevationGain) * 100);
  const repWord = targetReps === 1 ? "rep" : "reps";
  const introNote = weekNum <= 1
    ? " First session — keep it easy, focus on form and getting comfortable on the hill."
    : weekNum <= 2
    ? " Early training — settle into your pace and build confidence."
    : "";

  return {
    type: "hill",
    label: `Hill Repeats — ${hill.name}`,
    description: `${hill.name} (${hill.elevation}m per climb × ${targetReps} ${repWord} = ${totalGain}m) — ${pctOfSummit}% of your summit's ${goal.elevationGain}m elevation gain. ${hill.distance}km away. Walk or run up, walk down for recovery.${introNote}`,
    targetElevation: totalGain,
    duration: hillDur,
  };
}

function createBigDaySession(targetElev: number, goal: SummitGoal, hills: TrainingWeek["hills"], weekNum: number): PlanSession {
  const isEasy = goal.difficulty === "Easy";
  const bigTarget = Math.round(targetElev * 0.75);
  const hill = hills[0];

  let hillDetail: string;
  let actualTarget = bigTarget;
  if (hill) {
    const rawReps = Math.ceil(bigTarget / hill.elevation);
    // Cap reps in early weeks — build confidence before volume
    const cappedReps = weekNum <= 1 ? 1 : weekNum <= 2 ? Math.min(rawReps, 2) : rawReps;
    actualTarget = cappedReps * hill.elevation;
    const repWord = cappedReps === 1 ? "repeat" : "repeats";
    hillDetail = `${hill.name}: ${cappedReps} ${repWord} of ${hill.elevation}m = ${actualTarget}m`;
  } else {
    hillDetail = "a long hike or multi-hill route";
  }

  const pctOfSummit = Math.round((actualTarget / goal.elevationGain) * 100);
  const introNote = weekNum <= 1
    ? " This is your first big day — keep the pace easy and treat it as an exploration."
    : weekNum <= 2
    ? " Still early in training — go at a comfortable, sustainable effort."
    : " Go at a steady, sustainable pace.";

  return {
    type: "bigDay",
    label: "Big Day Out",
    description: `Full effort long session. Target: ${hillDetail} — ${pctOfSummit}% of your summit's ${goal.elevationGain}m elevation gain.${introNote}`,
    targetElevation: actualTarget,
    duration: isEasy ? "1–3 hours" : "2–5 hours",
  };
}

function getMaxSessionsForDifficulty(difficulty: string, requestedDays: number): number {
  switch (difficulty) {
    case "Easy":     return Math.min(requestedDays, 3);
    case "Moderate": return Math.min(requestedDays, 4);
    default:         return requestedDays;
  }
}

function createTaperEasyWalkSession(targetElev: number): PlanSession {
  return {
    type: "cardio",
    label: "Easy Recovery Walk",
    description: `A gentle, easy-paced walk — flat or very light incline only. Target around ${targetElev}m of elevation gain but stop whenever your legs feel tired. The goal is blood flow and loose legs, not fitness gains. No pushing, no hills. Think of this as active rest before summit day.`,
    targetElevation: targetElev,
    duration: "30–45 min",
  };
}

function createTaperLightHillSession(targetElev: number, hills: TrainingWeek["hills"], goal: SummitGoal): PlanSession {
  const hill = hills[0];
  if (!hill) {
    return {
      type: "hill",
      label: "Light Hill Jog",
      description: `One or two easy climbs on your training hill — no hammering, just enough to keep the legs sharp. Walk the descent fully. Target ${targetElev}m total gain. This is the last hill session before summit day; leave the tank full.`,
      targetElevation: targetElev,
      duration: "40–55 min",
    };
  }
  const reps = Math.max(1, Math.round(targetElev / hill.elevation));
  const totalGain = reps * hill.elevation;
  return {
    type: "hill",
    label: `Light Hill Session — ${hill.name}`,
    description: `${reps} easy ${reps === 1 ? "rep" : "reps"} of ${hill.name} (${hill.elevation}m each = ${totalGain}m total). Walk the whole thing — up and down. No effort, just movement. Your last real hill session before the summit; the goal is staying sharp, not getting fitter.`,
    targetElevation: totalGain,
    duration: "40–55 min",
  };
}

function createSessions(weekElev: number, weekNum: number, goal: SummitGoal, hills: TrainingWeek["hills"], taperPos = 0): PlanSession[] {
  // Taper week 2 (final week before summit): 2 easy walks only — legs must arrive fresh
  if (taperPos >= 2) {
    return [
      createTaperEasyWalkSession(Math.round(weekElev * 0.5)),
      createTaperEasyWalkSession(Math.round(weekElev * 0.5)),
    ];
  }

  // Taper week 1: 1 light hill + 1–2 easy walks, no big day
  if (taperPos === 1) {
    const out: PlanSession[] = [
      createTaperLightHillSession(weekElev, hills, goal),
      createTaperEasyWalkSession(Math.round(weekElev * 0.4)),
    ];
    const requestedDays = Math.max(2, goal.trainingDaysPerWeek ?? 4);
    if (requestedDays >= 4) {
      out.push(createTaperEasyWalkSession(Math.round(weekElev * 0.3)));
    }
    return out;
  }

  const requestedDays = Math.max(2, goal.trainingDaysPerWeek ?? 4);
  const totalDays = getMaxSessionsForDifficulty(goal.difficulty, requestedDays);
  const hillDays = Math.min(Math.max(1, goal.hillDaysPerWeek ?? 1), totalDays - 1);
  const bigDayCount = totalDays >= 3 ? 1 : 0;
  const cardioDays = Math.max(0, totalDays - hillDays - bigDayCount);

  const out: PlanSession[] = [];
  for (let i = 0; i < hillDays; i++) out.push(createHillSession(weekElev, hills, goal, weekNum));
  for (let i = 0; i < cardioDays; i++) out.push(createEquipmentCardioSession(weekElev, weekNum, goal, i));
  if (bigDayCount > 0) out.push(createBigDaySession(weekElev, goal, hills, weekNum));
  return out;
}

function getMockHills(location: string, radius: number): TrainingWeek["hills"] {
  const hillNames = [
    "Ridge Peak", "Beacon Hill", "Crow Tor", "Stony Edge", "Indian's Head",
    "Carn Mor", "Grey Crag", "High Knott", "Whernside Scar", "Pen y Fan",
  ];
  const seed = location.length + radius;
  return Array.from({ length: 3 }, (_, i) => {
    const idx = (seed + i * 3) % hillNames.length;
    const elevation = 120 + ((seed * (i + 1) * 37) % 280);
    const distance = 2 + ((seed * (i + 1) * 13) % Math.max(3, radius - 2));
    const repeats = Math.max(2, Math.ceil(400 / elevation));
    return {
      name: hillNames[idx],
      elevation,
      distance: Math.round(distance * 10) / 10,
      repeats,
      totalElevation: elevation * repeats,
    };
  });
}

export function generatePlan(goal: SummitGoal): TrainingWeek[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const summitDate = new Date(goal.summitDate);
  summitDate.setHours(0, 0, 0, 0);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksToSummit = Math.max(1, Math.ceil((summitDate.getTime() - today.getTime()) / msPerWeek));

  // Determine the actual plan start date.
  // If the user has significantly more time than the recommended training period,
  // default to starting the plan at the optimal point (recommendedWeeks before summit).
  // The user can override this by setting planStartMode = "full" to start from today.
  const { recommendedWeeks } = getTimeRequirement(
    goal.difficulty as Difficulty,
    goal.fitnessLevel as FitnessLevel,
    goal.trainingDaysPerWeek ?? 4
  );

  let planStart = today;
  const hasSurplus = weeksToSummit > recommendedWeeks + 2;

  if (hasSurplus && goal.planStartMode !== "full") {
    // Start recommendedWeeks before the summit, but never before today
    const optimalStart = new Date(summitDate.getTime() - recommendedWeeks * msPerWeek);
    planStart = optimalStart > today ? optimalStart : today;
  }

  const totalWeeks = Math.max(1, Math.ceil((summitDate.getTime() - planStart.getTime()) / msPerWeek));

  const targetElevation = goal.elevationGain;
  const startMultiplier = getStartElevationMultiplier(goal.fitnessLevel);
  const diffMultiplier = getDifficultyMultiplier(goal.difficulty);
  const startElev = Math.round(targetElevation * startMultiplier * diffMultiplier);
  const hills = (goal.preferredHills && goal.preferredHills.length > 0)
    ? goal.preferredHills.map(h => ({
        name: h.name,
        elevation: h.elevation,
        distance: h.distance,
        repeats: h.repeats,
        totalElevation: h.totalElevation,
      }))
    : getMockHills(goal.location, goal.maxRadius);

  // For the "is current week" check, we need to know if a week contains today
  function isCurrentWeek(weekStart: Date, weekEnd: Date): boolean {
    const end = new Date(weekEnd);
    end.setHours(23, 59, 59);
    return today >= weekStart && today <= end;
  }

  const weeks: TrainingWeek[] = [];

  if (totalWeeks < 4) {
    for (let w = 1; w <= totalWeeks; w++) {
      const progress = w / totalWeeks;
      const weekElev = Math.round(startElev + (targetElevation * 0.9 - startElev) * progress);
      const weekStart = addDays(planStart, (w - 1) * 7);
      const weekEnd = addDays(weekStart, 6);
      const isTaper = w === totalWeeks;
      const isPeak = w === totalWeeks - 1 && totalWeeks > 1;
      const elevTarget = isTaper ? Math.round(weekElev * 0.5) : isPeak ? Math.round(targetElevation * 0.9) : weekElev;
      weeks.push({
        weekNumber: w,
        phase: "Accelerated",
        purpose: isTaper
          ? "Final taper — rest and recover before summit day"
          : isPeak
          ? "Peak intensity — push close to summit demands"
          : "Urgent build — maximise elevation gains fast",
        targetElevation: elevTarget,
        sessions: createSessions(elevTarget, w, goal, hills, isTaper ? 2 : 0),
        isPeakWeek: isPeak,
        isTaperWeek: isTaper,
        isCurrentWeek: isCurrentWeek(weekStart, weekEnd),
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        hills,
      });
    }
  } else if (totalWeeks <= 12) {
    const peakWeek = totalWeeks - 1;
    const taperWeek = totalWeeks;

    for (let w = 1; w <= totalWeeks; w++) {
      const isPeak = w === peakWeek;
      const isTaper = w === taperWeek;
      const weekStart = addDays(planStart, (w - 1) * 7);
      const weekEnd = addDays(weekStart, 6);

      let elevTarget: number;
      let purpose: string;

      if (isTaper) {
        elevTarget = Math.round(targetElevation * 0.5);
        purpose = "Taper — reduce volume, stay sharp for summit day";
      } else if (isPeak) {
        elevTarget = Math.round(targetElevation * 0.9);
        purpose = "Peak week — push hardest, match summit demands";
      } else {
        const buildProgress = (w - 1) / (peakWeek - 1);
        elevTarget = Math.round(startElev + (targetElevation * 0.8 - startElev) * buildProgress);
        purpose =
          w <= 2
            ? "Foundation — build base fitness and movement patterns"
            : w <= Math.floor(totalWeeks * 0.5)
            ? "Progressive build — increasing elevation targets"
            : "High intensity — prepare body for peak week";
      }

      weeks.push({
        weekNumber: w,
        phase: isTaper ? "Taper" : isPeak ? "Peak" : w <= 2 ? "Base" : "Build",
        purpose,
        targetElevation: elevTarget,
        sessions: createSessions(elevTarget, w, goal, hills, isTaper ? 2 : 0),
        isPeakWeek: isPeak,
        isTaperWeek: isTaper,
        isCurrentWeek: isCurrentWeek(weekStart, weekEnd),
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        hills,
      });
    }
  } else {
    const taperWeeks = 2;
    const peakWeeks = Math.max(2, Math.round(totalWeeks * 0.15));
    const buildWeeks = Math.round(totalWeeks * 0.35);
    const baseWeeks = totalWeeks - buildWeeks - peakWeeks - taperWeeks;

    for (let w = 1; w <= totalWeeks; w++) {
      const weekStart = addDays(planStart, (w - 1) * 7);
      const weekEnd = addDays(weekStart, 6);

      let phase: TrainingWeek["phase"];
      let purpose: string;
      let elevTarget: number;
      let isPeakWeek = false;
      let isTaperWeek = false;

      if (w <= baseWeeks) {
        phase = "Base";
        const p = (w - 1) / Math.max(1, baseWeeks - 1);
        elevTarget = Math.round(startElev + (startElev * 0.6) * p);
        purpose = "Base phase — build aerobic foundation and movement consistency";
      } else if (w <= baseWeeks + buildWeeks) {
        phase = "Build";
        const buildPos = w - baseWeeks;
        const p = (buildPos - 1) / Math.max(1, buildWeeks - 1);
        elevTarget = Math.round(startElev * 1.4 + (targetElevation * 0.65 - startElev * 1.4) * p);
        purpose = "Build phase — progressively increase elevation and intensity";
      } else if (w <= baseWeeks + buildWeeks + peakWeeks) {
        phase = "Peak";
        const peakPos = w - baseWeeks - buildWeeks;
        const p = (peakPos - 1) / Math.max(1, peakWeeks - 1);
        elevTarget = Math.round(targetElevation * 0.75 + (targetElevation * 0.95 - targetElevation * 0.75) * p);
        isPeakWeek = true;
        purpose = "Peak phase — match or exceed summit demands";
      } else {
        phase = "Taper";
        const taperPos = w - baseWeeks - buildWeeks - peakWeeks;
        const p = taperPos / taperWeeks;
        elevTarget = Math.round(targetElevation * 0.6 * (1 - p * 0.5));
        isTaperWeek = true;
        purpose = taperPos === taperWeeks
          ? "Final taper — rest, recover, and arrive fresh"
          : "Taper phase — reduce volume while staying sharp";
      }

      weeks.push({
        weekNumber: w,
        phase,
        purpose,
        targetElevation: Math.max(100, elevTarget),
        sessions: createSessions(Math.max(100, elevTarget), w, goal, hills, isTaperWeek ? w - baseWeeks - buildWeeks - peakWeeks : 0),
        isPeakWeek,
        isTaperWeek,
        isCurrentWeek: isCurrentWeek(weekStart, weekEnd),
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        hills,
      });
    }
  }

  return weeks;
}

export function getCurrentWeek(plan: TrainingWeek[]): TrainingWeek | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const week of plan) {
    const start = new Date(week.startDate);
    const end = new Date(week.endDate);
    end.setHours(23, 59, 59);
    if (today >= start && today <= end) return week;
  }
  return plan[0] || null;
}
