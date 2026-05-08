import { SummitGoal, TrainingWeek, PlanSession } from "@/context/AppContext";

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
  const dur = weekNum < 4 ? "30–40 min" : "40–55 min";

  if (hasGym(goal)) {
    const opts = [
      {
        label: "Incline Treadmill",
        description: `Set treadmill to 8–12% incline. Walk or run at a sustainable pace for the full session. Focus on steady breathing and keeping your heart rate in zone 2–3.`,
      },
      {
        label: "Step Machine",
        description: `Step machine or Stairmaster at moderate resistance. Keep a consistent rhythm — don't hold the rails. Builds the exact muscle groups needed for summit day.`,
      },
      {
        label: "Cardio + Leg Strength",
        description: `25 min incline treadmill then: weighted squats 3×12, lunges 3×10 each leg, calf raises 3×20. Builds climbing power.`,
      },
    ];
    const o = opts[variant % opts.length];
    return { type: "cardio", label: o.label, description: o.description, targetElevation: elevTarget, duration: dur };
  }

  if (hasWeights(goal)) {
    const opts = [
      {
        label: "Run + Resistance",
        description: `20–30 min brisk walk or run (uphill wherever possible), then: resistance band squats 3×15, step-ups 3×12, calf raises 3×20. Targets summit-specific muscles.`,
      },
      {
        label: "Uphill Walk + Core",
        description: `Find any incline — hill, ramp, or stairs — and walk briskly for the session. Follow with plank 3×45s and glute bridges 3×15.`,
      },
    ];
    const o = opts[variant % opts.length];
    return { type: "cardio", label: o.label, description: o.description, targetElevation: elevTarget, duration: dur };
  }

  // No equipment — walks, runs, stairs
  // Assume ~3m per floor; each rep targets ~15m (≈5 floors)
  const metresPerRep = 15;
  const stairReps = Math.max(5, Math.round(elevTarget / metresPerRep));
  const floorsPerRep = Math.round(metresPerRep / 3); // ≈5 floors
  const totalElev = stairReps * metresPerRep;
  const opts = [
    {
      label: "Stair Repeats",
      description: `Find a staircase of at least ${floorsPerRep} floors (≈${metresPerRep}m per climb) — a car park, block of flats, or office building works perfectly. Walk up, walk down, repeat ${stairReps}× for ${totalElev}m total elevation. Each floor is roughly 3m, so ${floorsPerRep} floors = ${metresPerRep}m per climb. This directly mimics the sustained uphill effort of summit day.`,
    },
    {
      label: "Uphill Walk / Run",
      description: `Walk or run any route with as much uphill as possible. Aim for ${elevTarget}m accumulated elevation gain. Seek out roads, parks, or paths that gain height.`,
    },
    {
      label: "Brisk Walk — Long",
      description: `Extended brisk walk at a pace where you can talk but feel the effort. Include as many slopes or hills as possible. Focus on time on feet and staying aerobic.`,
    },
  ];
  const o = opts[variant % opts.length];
  return { type: "cardio", label: o.label, description: o.description, targetElevation: elevTarget, duration: dur };
}

function createHillSession(targetElev: number, hills: TrainingWeek["hills"], goal: SummitGoal): PlanSession {
  const hill = hills[0];
  if (!hill) {
    return {
      type: "hill",
      label: "Hill Repeats",
      description: `Find your nearest hill and repeat climbs. Target ${Math.round(targetElev * 0.5)}m total elevation gain — ${Math.round((targetElev * 0.5 / goal.elevationGain) * 100)}% of your summit's ${goal.elevationGain}m.`,
      targetElevation: Math.round(targetElev * 0.5),
      duration: "60–90 min",
    };
  }

  const targetReps = Math.max(hill.repeats, Math.ceil((targetElev * 0.5) / hill.elevation));
  const totalGain = targetReps * hill.elevation;
  const pctOfSummit = Math.round((totalGain / goal.elevationGain) * 100);

  return {
    type: "hill",
    label: `Hill Repeats — ${hill.name}`,
    description: `${hill.name} (${hill.elevation}m per climb × ${targetReps} reps = ${totalGain}m) — ${pctOfSummit}% of your summit's ${goal.elevationGain}m elevation gain. ${hill.distance}km away. Walk or run up, walk down for recovery.`,
    targetElevation: totalGain,
    duration: "60–90 min",
  };
}

function createBigDaySession(targetElev: number, goal: SummitGoal, hills: TrainingWeek["hills"]): PlanSession {
  const bigTarget = Math.round(targetElev * 0.75);
  const pctOfSummit = Math.round((bigTarget / goal.elevationGain) * 100);
  const hill = hills[0];
  const hillDetail = hill
    ? `${hill.name}: ${Math.ceil(bigTarget / hill.elevation)} repeats of ${hill.elevation}m = ${bigTarget}m`
    : `a long hike or multi-hill route`;

  return {
    type: "bigDay",
    label: "Big Day Out",
    description: `Full effort long session. Target: ${hillDetail} — ${pctOfSummit}% of your summit's ${goal.elevationGain}m elevation gain. This session directly prepares your body for the demands of summit day. Go at a steady, sustainable pace.`,
    targetElevation: bigTarget,
    duration: "2–5 hours",
  };
}

function createSessions(weekElev: number, weekNum: number, goal: SummitGoal, hills: TrainingWeek["hills"]): PlanSession[] {
  const totalDays = Math.max(2, goal.trainingDaysPerWeek ?? 4);
  const hillDays = Math.min(Math.max(1, goal.hillDaysPerWeek ?? 1), totalDays - 1);
  const bigDayCount = totalDays >= 3 ? 1 : 0;
  const cardioDays = Math.max(0, totalDays - hillDays - bigDayCount);

  const out: PlanSession[] = [];
  for (let i = 0; i < hillDays; i++) out.push(createHillSession(weekElev, hills, goal));
  for (let i = 0; i < cardioDays; i++) out.push(createEquipmentCardioSession(weekElev, weekNum, goal, i));
  if (bigDayCount > 0) out.push(createBigDaySession(weekElev, goal, hills));
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
  const totalWeeks = Math.max(1, Math.ceil((summitDate.getTime() - today.getTime()) / msPerWeek));

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

  const weeks: TrainingWeek[] = [];

  if (totalWeeks < 4) {
    for (let w = 1; w <= totalWeeks; w++) {
      const progress = w / totalWeeks;
      const weekElev = Math.round(startElev + (targetElevation * 0.9 - startElev) * progress);
      const weekStart = addDays(today, (w - 1) * 7);
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
        sessions: createSessions(elevTarget, w, goal, hills),
        isPeakWeek: isPeak,
        isTaperWeek: isTaper,
        isCurrentWeek: w === 1,
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
      const weekStart = addDays(today, (w - 1) * 7);
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
        sessions: createSessions(elevTarget, w, goal, hills),
        isPeakWeek: isPeak,
        isTaperWeek: isTaper,
        isCurrentWeek: w === 1,
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
      const weekStart = addDays(today, (w - 1) * 7);
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
        sessions: createSessions(Math.max(100, elevTarget), w, goal, hills),
        isPeakWeek,
        isTaperWeek,
        isCurrentWeek: w === 1,
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
