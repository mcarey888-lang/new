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

// Parse the midpoint of a duration string like "30–40 min" → 35
export function parseDurationMidpoint(dur: string): number {
  const m = dur.match(/(\d+)[–\-](\d+)/);
  return m ? (parseInt(m[1]) + parseInt(m[2])) / 2 : 40;
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
    // Base targets on session duration × real-world pacing, not on an elevation ratio.
    // Stepper: 3 floors/min (150–180 floors/hr) at a steady rhythm without leaning on rails.
    // Treadmill: 4.5 km/h at 10% incline (zone 2 walking pace); 1 km @10% = 100 m elevation.
    const midDur = parseDurationMidpoint(dur);
    const stepperFloors = Math.round(midDur * 3);
    const stepperElev = stepperFloors * 3; // 1 floor ≈ 3 m
    const treadmillKm = Math.round((midDur / 60) * 4.5 * 10) / 10;
    const treadmillElev = Math.round(treadmillKm * 100); // 1 km @10% = 100 m
    const treadmillKmStr = treadmillKm.toFixed(1);
    const opts = [
      {
        label: "Incline Treadmill",
        description: `Set treadmill to 10% incline. Target: ${treadmillKmStr}km at a steady zone 2 walking pace (~4.5 km/h) — that's ${treadmillElev}m of simulated elevation gain for the session (1 km at 10% = 100 m). Walk or jog at a conversational pace. Upright posture, heel-drive on every step — the same mechanics you'll need on the mountain.`,
        gymExercise: "treadmill" as const,
        targetDistanceKm: treadmillKm,
        targetElevation: treadmillElev,
        inclinePct: 10,
      },
      {
        label: "Stepper Machine",
        description: `Target: ${stepperFloors} floors at a steady 3 floors per minute — do not lean on the handrails; keep your weight through your legs and core, just as you would on a real ascent. Each floor is approximately 3 m of elevation gain (${stepperElev} m total). Zone 2–3 effort: able to speak in short sentences. At 150–180 floors per hour, this fills the session with purposeful climbing.`,
        gymExercise: "stepper" as const,
        targetFloors: stepperFloors,
        targetElevation: stepperElev,
      },
      {
        label: "Incline Treadmill + Leg Strength",
        description: `Treadmill: ${treadmillKmStr}km at 10% incline (~4.5 km/h zone 2 pace = ${treadmillElev}m elevation gain). Then: goblet squats 3×12, reverse lunges 3×10 each leg, single-leg calf raises 3×15. Rest 60s between sets. Builds the leg drive and endurance needed on steep terrain.`,
        gymExercise: "treadmill" as const,
        targetDistanceKm: treadmillKm,
        targetElevation: treadmillElev,
        inclinePct: 10,
      },
    ];
    const o = opts[variant % opts.length];
    return {
      type: "cardio" as const,
      label: o.label,
      description: o.description,
      targetElevation: o.targetElevation,
      duration: dur,
      gymExercise: o.gymExercise,
      ...(o.targetDistanceKm !== undefined ? { targetDistanceKm: o.targetDistanceKm } : {}),
      ...("targetFloors" in o && o.targetFloors !== undefined ? { targetFloors: o.targetFloors } : {}),
      ...(o.inclinePct !== undefined ? { inclinePct: o.inclinePct } : {}),
    };
  }

  if (hasWeights(goal)) {
    // Use duration-based minimum targets so early weeks are never underloaded.
    // "Uphill Walk / Run + Resistance": only ~25 min is cardio (the rest is strength work).
    //   Mixed walk/jog pace: ~300 m/hr vertical gain → 25 min × 300/60 = 125 m minimum.
    // "Uphill Walk + Core": the full session is the walk.
    //   Sustained uphill walking pace: ~250 m/hr vertical gain.
    const midDur = parseDurationMidpoint(dur);
    // max() preserves progressive overload in later high-elevation weeks
    const walkRunElev = Math.max(elevTarget, Math.round((25 / 60) * 300));   // 25 min cardio × 300 m/hr
    const walkCoreElev = Math.max(elevTarget, Math.round((midDur / 60) * 250)); // full session × 250 m/hr
    const opts = [
      {
        label: "Uphill Walk / Run + Resistance",
        description: `20–30 min brisk walk or jog on any incline you can find — a hill, road with gradient, or stairs. Target ${walkRunElev}m elevation gain for the cardio portion (~300 m/hr on uphill). Then: resistance band squats 3×15, weighted step-ups onto a chair or box 3×12 each leg, calf raises 3×20. These movements directly target the muscles that take the most strain on summit day.`,
        targetElevation: walkRunElev,
      },
      {
        label: "Uphill Walk + Core",
        description: `Walk briskly for the full session on any incline — a hill, ramp, or stairs. Target ${walkCoreElev}m elevation gain (~250 m/hr at a sustained uphill walking pace). Aim to keep your breathing elevated throughout. Finish with: plank hold 3×45s, glute bridges 3×15, and side-lying leg raises 3×12 each. A strong core stabilises every step on uneven terrain.`,
        targetElevation: walkCoreElev,
      },
    ];
    const o = opts[variant % opts.length];
    return { type: "cardio", label: o.label, description: o.description, targetElevation: o.targetElevation, gymExercise: "outdoor" as const, duration: dur };
  }

  // No equipment — walks, runs, stairs.
  // Stair repeats: ~3 min per round trip on a 5-flight staircase (15 m per ascent).
  //   At 3 min/rep: 35-min session → 12 reps × 5 flights = 60 flights total.
  // Outdoor uphill walk/run: ~300 m/hr vertical gain (mixed walk/jog on incline).
  // Sustained Brisk Walk: ~200 m/hr (less elevation-focused, time-on-feet session).
  const midDur = parseDurationMidpoint(dur);
  const metresPerFlight = 3; // 1 flight = 1 floor ≈ 3 m
  const flightsPerRep = 5; // minimum staircase size
  const metresPerRep = flightsPerRep * metresPerFlight; // 15 m per ascent
  const minPerRep = 3; // ~1.5 min up + 1 min down
  const stairReps = Math.max(3, Math.round(midDur / minPerRep));
  const totalFlights = stairReps * flightsPerRep;
  const totalElev = totalFlights * metresPerFlight;
  // max() preserves progressive overload — duration-based floor only applies when
  // the elevation-ratio target would be unrealistically small (early weeks).
  const uphillElev = Math.max(elevTarget, Math.round((midDur / 60) * 300)); // walk/run mixed
  const walkElev = Math.max(elevTarget, Math.round((midDur / 60) * 200));   // steadier flat walk
  const opts = [
    {
      label: "Stair Repeats",
      description: `Find a staircase with at least 5 flights — a car park, block of flats, or office building works well. The more flights per staircase, the better. Walk up one full ascent at a controlled pace, descend for recovery, and keep going until you've completed ${totalFlights} flights total (≈${totalElev}m elevation gain). Keep your weight slightly forward and drive through the heel on each step, just as you would on a mountain path.`,
      targetElevation: totalElev,
      targetFlights: totalFlights,
    },
    {
      label: "Uphill Walk / Run",
      description: `Walk or jog any route that gains height — roads with gradient, park paths, or embankments all count. Target ${uphillElev}m of elevation gain (~300 m/hr mixed walk/jog pace on uphill). Time on incline matters more than pace; stay aerobic and breathe steadily throughout.`,
      targetElevation: uphillElev,
    },
    {
      label: "Sustained Brisk Walk",
      description: `A longer steady walk at a pace where you're breathing noticeably but can still speak in short sentences. Include as much uphill as you can find. Aim for ${walkElev}m of elevation gain over the session (~200 m/hr on mixed terrain). Focus on keeping a consistent pace for the full duration — building time on feet is key at this stage of training.`,
      targetElevation: walkElev,
    },
  ];
  const o = opts[variant % opts.length];
  return { type: "cardio", label: o.label, description: o.description, targetElevation: o.targetElevation, gymExercise: "outdoor" as const, ...(o.targetFlights !== undefined ? { targetFlights: o.targetFlights } : {}), duration: dur };
}

function createHillSession(targetElev: number, hills: TrainingWeek["hills"], goal: SummitGoal, weekNum: number): PlanSession {
  const hill = hills.length > 0 ? hills[weekNum % hills.length] : undefined;
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
  const hill = hills.length > 0 ? hills[(weekNum + 1) % hills.length] : undefined;

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

function createTaperLightHillSession(targetElev: number, hills: TrainingWeek["hills"], goal: SummitGoal, weekNum: number): PlanSession {
  const hill = hills.length > 0 ? hills[weekNum % hills.length] : undefined;
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
      createTaperLightHillSession(weekElev, hills, goal, weekNum),
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
