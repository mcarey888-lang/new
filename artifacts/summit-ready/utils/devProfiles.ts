import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SummitGoal, TrainingWeek, Session, ExploreHike } from "@/context/AppContext";

const ALL_KEYS = [
  "summitready_goal",
  "summitready_sessions",
  "summitready_plan",
  "summitready_nearby_hills",
  "summitready_completed_plan_sessions",
  "summitready_assigned_hills",
  "summitready_adjust_note",
  "summitready_submitted_plan_sessions",
  "summitready_hills_in_plan",
  "summitready_session_reps",
  "summitready_session_efforts",
  "summitready_has_viewed_plan",
  "summitready_achievements",
  "summitready_completed_goals",
  "summitready_app_mode",
  "summitready_explore_hikes",
  "summitready_saved_trails",
  "summitready_completed_trails",
  "summitready_custom_routes",
  "summitready_last_trail_location",
  "summitready_live_trails_cache",
];

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function makeWeek(
  weekNumber: number,
  phase: TrainingWeek["phase"],
  purpose: string,
  targetElevation: number,
  weekOffset: number,
  isCurrentWeek: boolean,
  hillName: string,
  hillElevation: number,
): TrainingWeek {
  const reps = Math.max(1, Math.ceil(targetElevation / hillElevation));
  return {
    weekNumber,
    phase,
    purpose,
    targetElevation,
    sessions: [
      {
        type: "cardio",
        label: "Easy Run",
        description: "Zone 2 aerobic run. Conversational pace. Focus on time on feet.",
        targetElevation: 0,
        duration: "45 min",
      },
      {
        type: "hill",
        label: `${hillName} Reps`,
        description: `${reps} repeats on ${hillName}. Walk down, run up. Steady breathing.`,
        targetElevation: reps * hillElevation,
        duration: "90 min",
      },
      {
        type: "bigDay",
        label: "Long Hike",
        description: "Extended hill session with pack. Simulate summit day load and duration.",
        targetElevation: Math.round(targetElevation * 1.3),
        duration: "3–4 hrs",
      },
    ],
    isPeakWeek: phase === "Peak",
    isTaperWeek: phase === "Taper",
    isCurrentWeek,
    startDate: daysFromNow(weekOffset * 7),
    endDate: daysFromNow(weekOffset * 7 + 6),
    hills: [{
      name: hillName,
      elevation: hillElevation,
      distance: 2.8,
      repeats: reps,
      totalElevation: reps * hillElevation,
    }],
  };
}

function makeSession(
  id: string,
  daysAgo: number,
  type: Session["type"],
  weekNumber: number,
  hillName?: string,
): Session {
  const templates: Record<Session["type"], Partial<Session>> = {
    cardio:  { distance: 7.2,  elevationGain: 120, duration: 48,  effort: 3, notes: "Steady Zone 2, felt comfortable throughout" },
    hill:    { distance: 4.8,  elevationGain: 460, duration: 80,  effort: 4, notes: "4 reps, legs burning by the end", hillName },
    bigDay:  { distance: 14.2, elevationGain: 720, duration: 210, effort: 4, notes: "Long day with 8kg pack — great simulation" },
  };
  return {
    id,
    date: daysFromNow(-daysAgo),
    type,
    completed: true,
    weekNumber,
    effort: 3,
    notes: "",
    distance: 5,
    elevationGain: 300,
    duration: 60,
    ...templates[type],
  } as Session;
}

export interface DevProfile {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string;
  storageData: Array<[string, string]>;
}

// ── Profile 1: New User ───────────────────────────────────────────────────────

const newUserProfile: DevProfile = {
  id: "new_user",
  label: "New User",
  emoji: "👋",
  description: "Fresh install — goes through onboarding",
  color: "#9CA3AF",
  storageData: [],
};

// ── Profile 2: Beginner — Ben Nevis ──────────────────────────────────────────

const beginnerBenNevis: DevProfile = {
  id: "beginner_ben_nevis",
  label: "Beginner — Ben Nevis",
  emoji: "🥾",
  description: "Week 1 of 16 · Readiness ~18 · Manchester",
  color: "#60A5FA",
  storageData: (() => {
    const goal: SummitGoal = {
      mountainName: "Ben Nevis",
      summitDate: daysFromNow(112),
      distance: 17,
      elevationGain: 1345,
      highestAltitude: 1345,
      difficulty: "Hard",
      fitnessLevel: "Beginner",
      location: "Manchester",
      maxRadius: 25,
      equipment: ["none"],
      trainingDaysPerWeek: 3,
      hillDaysPerWeek: 1,
    };

    const plan: TrainingWeek[] = [
      makeWeek(1,  "Base",  "Establish aerobic base and introduce hill work",           300,  0,  true,  "Rivington Pike", 373),
      makeWeek(2,  "Base",  "Build consistency on hills",                               400,  1,  false, "Rivington Pike", 373),
      makeWeek(3,  "Build", "First build week — increase rep count",                    550,  2,  false, "Winter Hill",    456),
      makeWeek(4,  "Build", "Pack weight introduction",                                 650,  3,  false, "Winter Hill",    456),
      makeWeek(5,  "Build", "Push weekly elevation total",                              750,  4,  false, "Rivington Pike", 373),
      makeWeek(6,  "Build", "Longest week yet — back-to-back sessions",                850,  5,  false, "Winter Hill",    456),
      makeWeek(7,  "Peak",  "Peak week — highest elevation total of the plan",         950,  6,  false, "Winter Hill",    456),
      makeWeek(8,  "Taper", "Begin taper — maintain sharpness, reduce volume",        500,  7,  false, "Rivington Pike", 373),
    ];

    return [
      ["summitready_app_mode",      "summit"],
      ["summitready_goal",           JSON.stringify(goal)],
      ["summitready_plan",           JSON.stringify(plan)],
      ["summitready_sessions",       JSON.stringify([])],
      ["summitready_has_viewed_plan","true"],
    ] as Array<[string, string]>;
  })(),
};

// ── Profile 3: Intermediate — Kilimanjaro ────────────────────────────────────

const intermediateKili: DevProfile = {
  id: "intermediate_kilimanjaro",
  label: "Intermediate — Kilimanjaro",
  emoji: "⛰️",
  description: "Week 8 of 20 · Readiness ~45 · Sheffield",
  color: "#F59E0B",
  storageData: (() => {
    const goal: SummitGoal = {
      mountainName: "Kilimanjaro (Marangu Route)",
      summitDate: daysFromNow(84),
      distance: 90,
      elevationGain: 3700,
      highestAltitude: 5895,
      difficulty: "Alpine",
      fitnessLevel: "Average",
      location: "Sheffield",
      maxRadius: 30,
      equipment: ["gym", "weights"],
      trainingDaysPerWeek: 4,
      hillDaysPerWeek: 2,
    };

    const hillA = "Carl Wark";
    const hillB = "Stanage Edge";

    const plan: TrainingWeek[] = [
      makeWeek(1,  "Base",  "Establish aerobic base",                    400,  -7,  false, hillA, 390),
      makeWeek(2,  "Base",  "Build hill tolerance",                      500,  -6,  false, hillA, 390),
      makeWeek(3,  "Base",  "Introduce weighted pack",                   600,  -5,  false, hillB, 458),
      makeWeek(4,  "Build", "First build phase — push elevation",        750,  -4,  false, hillB, 458),
      makeWeek(5,  "Build", "Increase session intensity",                850,  -3,  false, hillA, 390),
      makeWeek(6,  "Build", "Back-to-back hill days",                    950,  -2,  false, hillB, 458),
      makeWeek(7,  "Build", "Long day simulation with heavy pack",      1050,  -1,  false, hillB, 458),
      makeWeek(8,  "Peak",  "Peak load — highest training week",        1200,   0,  true,  hillA, 390),
      makeWeek(9,  "Peak",  "Sustain peak load",                        1200,   1,  false, hillB, 458),
      makeWeek(10, "Taper", "Begin taper — reduce volume, keep quality", 700,  2,  false, hillA, 390),
      makeWeek(11, "Taper", "Final taper",                               400,  3,  false, hillA, 390),
      makeWeek(12, "Taper", "Summit week — arrive fresh",                200,  4,  false, hillA, 390),
    ];

    const sessions: Session[] = [
      makeSession("s1",  49, "cardio", 1),
      makeSession("s2",  46, "hill",   1, hillA),
      makeSession("s3",  42, "bigDay", 2),
      makeSession("s4",  38, "cardio", 3),
      makeSession("s5",  35, "hill",   3, hillB),
      makeSession("s6",  32, "bigDay", 4),
      makeSession("s7",  28, "cardio", 5),
      makeSession("s8",  24, "hill",   5, hillA),
      makeSession("s9",  21, "bigDay", 6),
      makeSession("s10", 17, "cardio", 7),
      makeSession("s11", 14, "hill",   7, hillB),
      makeSession("s12", 10, "bigDay", 7),
    ];

    return [
      ["summitready_app_mode",      "summit"],
      ["summitready_goal",           JSON.stringify(goal)],
      ["summitready_plan",           JSON.stringify(plan)],
      ["summitready_sessions",       JSON.stringify(sessions)],
      ["summitready_has_viewed_plan","true"],
      ["summitready_achievements",   JSON.stringify(["first_session", "5_sessions", "hill_week"])],
    ] as Array<[string, string]>;
  })(),
};

// ── Profile 4: Advanced — Mont Blanc ─────────────────────────────────────────

const advancedMontBlanc: DevProfile = {
  id: "advanced_mont_blanc",
  label: "Advanced — Mont Blanc",
  emoji: "🏔️",
  description: "Week 18 of 22 · Readiness ~78 · Leeds",
  color: "#3ECF75",
  storageData: (() => {
    const goal: SummitGoal = {
      mountainName: "Mont Blanc (Goûter Route)",
      summitDate: daysFromNow(28),
      distance: 19,
      elevationGain: 2800,
      highestAltitude: 4808,
      difficulty: "Alpine",
      fitnessLevel: "Strong",
      location: "Leeds",
      maxRadius: 40,
      equipment: ["gym", "weights", "bands"],
      trainingDaysPerWeek: 5,
      hillDaysPerWeek: 3,
    };

    const hillA = "Ilkley Moor";
    const hillB = "Rombald's Moor";

    const plan: TrainingWeek[] = Array.from({ length: 22 }, (_, i) => {
      const wk = i + 1;
      const phase: TrainingWeek["phase"] =
        wk <= 4 ? "Base" : wk <= 14 ? "Build" : wk <= 18 ? "Peak" : "Taper";
      const elev =
        wk <= 4 ? 600 + wk * 80 :
        wk <= 14 ? 920 + (wk - 4) * 100 :
        wk <= 18 ? 1820 - (wk - 14) * 80 : 500;
      const purposes: Record<TrainingWeek["phase"], string> = {
        Accelerated: "Rapid base building",
        Base:  "Aerobic foundation",
        Build: "Progressive overload — push elevation",
        Peak:  "Summit simulation — peak conditioning",
        Taper: "Taper and recover for summit",
      };
      return makeWeek(
        wk,
        phase,
        purposes[phase],
        Math.round(elev),
        wk - 18,
        wk === 18,
        wk % 2 === 0 ? hillA : hillB,
        402,
      );
    });

    const sessions: Session[] = [];
    let sId = 1;
    for (let w = 1; w <= 17; w++) {
      const base = (18 - w) * 7;
      sessions.push(makeSession(`s${sId++}`, base + 5, "cardio", w));
      sessions.push(makeSession(`s${sId++}`, base + 3, "hill",   w, w % 2 === 0 ? hillA : hillB));
      if (w % 2 === 0 || w > 10) {
        sessions.push(makeSession(`s${sId++}`, base + 1, "bigDay", w));
      }
    }

    return [
      ["summitready_app_mode",      "summit"],
      ["summitready_goal",           JSON.stringify(goal)],
      ["summitready_plan",           JSON.stringify(plan)],
      ["summitready_sessions",       JSON.stringify(sessions)],
      ["summitready_has_viewed_plan","true"],
      ["summitready_achievements",   JSON.stringify(["first_session", "5_sessions", "10_sessions", "hill_week", "elevation_1000", "big_day", "consistent_month"])],
    ] as Array<[string, string]>;
  })(),
};

// ── Profile 5: Explore Mode ───────────────────────────────────────────────────

const exploreModeUser: DevProfile = {
  id: "explore_mode",
  label: "Explorer",
  emoji: "🗺️",
  description: "Explore mode · 3 hikes logged · Trails saved",
  color: "#A78BFA",
  storageData: (() => {
    const hikes: ExploreHike[] = [
      {
        id: "h1",
        name: "Stanage Edge Loop",
        date: daysFromNow(-12),
        distance: 11.4,
        elevationGain: 380,
        timeTaken: 195,
        notes: "Beautiful day, views were incredible",
      },
      {
        id: "h2",
        name: "Kinder Scout Circuit",
        date: daysFromNow(-7),
        distance: 14.2,
        elevationGain: 490,
        timeTaken: 265,
        notes: "Tough in the wind but absolutely worth it",
      },
      {
        id: "h3",
        name: "Rivington Pike Out & Back",
        date: daysFromNow(-2),
        distance: 8.6,
        elevationGain: 310,
        timeTaken: 140,
        notes: "Quick one after work",
      },
    ];

    const savedTrails = [
      "kinder-scout-circular_peak-district-derbyshire",
      "stanage-edge-walk_peak-district-derbyshire",
    ];
    const completedTrails = ["rivington-pike-loop_lancashire"];

    return [
      ["summitready_app_mode",       "explore"],
      ["summitready_explore_hikes",   JSON.stringify(hikes)],
      ["summitready_saved_trails",    JSON.stringify(savedTrails)],
      ["summitready_completed_trails",JSON.stringify(completedTrails)],
      ["summitready_achievements",    JSON.stringify(["first_hike", "trail_explorer"])],
    ] as Array<[string, string]>;
  })(),
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const DEV_PROFILES: DevProfile[] = [
  newUserProfile,
  beginnerBenNevis,
  intermediateKili,
  advancedMontBlanc,
  exploreModeUser,
];

export async function loadDevProfile(profile: DevProfile): Promise<void> {
  await AsyncStorage.multiRemove(ALL_KEYS);
  if (profile.storageData.length > 0) {
    await AsyncStorage.multiSet(profile.storageData);
  }
}
