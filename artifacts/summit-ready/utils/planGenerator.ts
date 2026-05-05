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

function createCardioSession(targetElev: number, week: number): PlanSession {
  return {
    type: "cardio",
    label: "Cardio",
    description: `Sustained effort cardio – incline treadmill, stairs, or bike. Focus on breathing rhythm.`,
    targetElevation: Math.round(targetElev * 0.3),
    duration: week < 4 ? "30-40 min" : "40-60 min",
  };
}

function createHillSession(targetElev: number, hills: TrainingWeek["hills"]): PlanSession {
  const hill = hills[0];
  const hillDesc = hill
    ? `${hill.name} – ${hill.elevation}m ascent × ${hill.repeats} repeats (~${hill.totalElevation}m)`
    : "Nearest hill – repeat climbs for elevation gain";
  return {
    type: "hill",
    label: "Hill Repeats",
    description: hillDesc,
    targetElevation: Math.round(targetElev * 0.5),
    duration: "60-90 min",
  };
}

function createBigDaySession(targetElev: number, goal: SummitGoal): PlanSession {
  return {
    type: "bigDay",
    label: "Big Day",
    description: `Long hike or extended hill session. Target ${goal.distance > 15 ? "8-12 km" : "5-8 km"} with maximum elevation gain.`,
    targetElevation: Math.round(targetElev * 0.7),
    duration: "2-4 hours",
  };
}

function getMockHills(location: string, radius: number): TrainingWeek["hills"] {
  const hillNames = [
    "Ridge Peak", "Beacon Hill", "Crow Tor", "Stony Edge", "Indian's Head",
    "Carn Mor", "Black Mountain", "Grey Crag", "High Knott", "Whernside Scar",
  ];
  const seed = location.length + radius;
  return Array.from({ length: 3 }, (_, i) => {
    const idx = (seed + i * 3) % hillNames.length;
    const elevation = 120 + ((seed * (i + 1) * 37) % 280);
    const distance = 2 + ((seed * (i + 1) * 13) % (radius - 2));
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
  const hills = getMockHills(goal.location, goal.maxRadius);

  const weeks: TrainingWeek[] = [];

  if (totalWeeks < 4) {
    // Accelerated plan
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
          ? "Final taper – rest and recover before summit day"
          : isPeak
          ? "Peak intensity – push close to summit demands"
          : `Urgent build – maximise elevation gains fast`,
        targetElevation: elevTarget,
        sessions: [
          createCardioSession(elevTarget, w),
          createCardioSession(elevTarget, w),
          createHillSession(elevTarget, hills),
          createBigDaySession(elevTarget, goal),
        ],
        isPeakWeek: isPeak,
        isTaperWeek: isTaper,
        isCurrentWeek: w === 1,
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        hills,
      });
    }
  } else if (totalWeeks <= 12) {
    // Progressive structured plan
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
        purpose = "Taper – reduce volume, maintain sharpness for summit day";
      } else if (isPeak) {
        elevTarget = Math.round(targetElevation * 0.9);
        purpose = "Peak week – push hardest, match summit demands";
      } else {
        const buildProgress = (w - 1) / (peakWeek - 1);
        elevTarget = Math.round(startElev + (targetElevation * 0.8 - startElev) * buildProgress);
        purpose =
          w <= 2
            ? "Foundation – build base fitness and movement patterns"
            : w <= Math.floor(totalWeeks * 0.5)
            ? "Progressive build – increasing elevation targets"
            : "High intensity – prepare body for peak week";
      }

      const currentWeekNum = Math.ceil((today.getTime() - addDays(today, 0).getTime()) / msPerWeek) + 1;
      const isCurrentWeek = w === 1;

      weeks.push({
        weekNumber: w,
        phase: isTaper ? "Taper" : isPeak ? "Peak" : w <= 2 ? "Base" : "Build",
        purpose,
        targetElevation: elevTarget,
        sessions: [
          createCardioSession(elevTarget, w),
          createCardioSession(elevTarget, w),
          createHillSession(elevTarget, hills),
          createBigDaySession(elevTarget, goal),
        ],
        isPeakWeek: isPeak,
        isTaperWeek: isTaper,
        isCurrentWeek,
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        hills,
      });
    }
  } else {
    // Phased plan: Base / Build / Peak / Taper
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
        purpose = "Base phase – build aerobic foundation and movement consistency";
      } else if (w <= baseWeeks + buildWeeks) {
        phase = "Build";
        const buildPos = w - baseWeeks;
        const p = (buildPos - 1) / Math.max(1, buildWeeks - 1);
        elevTarget = Math.round(startElev * 1.4 + (targetElevation * 0.65 - startElev * 1.4) * p);
        purpose = "Build phase – progressively increase elevation and intensity";
      } else if (w <= baseWeeks + buildWeeks + peakWeeks) {
        phase = "Peak";
        const peakPos = w - baseWeeks - buildWeeks;
        const p = (peakPos - 1) / Math.max(1, peakWeeks - 1);
        elevTarget = Math.round(targetElevation * 0.75 + (targetElevation * 0.95 - targetElevation * 0.75) * p);
        isPeakWeek = true;
        purpose = "Peak phase – match or exceed summit demands";
      } else {
        phase = "Taper";
        const taperPos = w - baseWeeks - buildWeeks - peakWeeks;
        const p = taperPos / taperWeeks;
        elevTarget = Math.round(targetElevation * 0.6 * (1 - p * 0.5));
        isTaperWeek = true;
        purpose = taperPos === taperWeeks
          ? "Final taper – rest, recover, and arrive fresh"
          : "Taper phase – reduce volume while staying sharp";
      }

      weeks.push({
        weekNumber: w,
        phase,
        purpose,
        targetElevation: Math.max(100, elevTarget),
        sessions: [
          createCardioSession(elevTarget, w),
          createCardioSession(elevTarget, w),
          createHillSession(elevTarget, hills),
          createBigDaySession(elevTarget, goal),
        ],
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
