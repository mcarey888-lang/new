import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CompletedGoal, SummitGoal, TrainingWeek, Session, ExploreHike } from "@/context/AppContext";
import type { EvidenceReference } from "./challengeDomain";
import { RANK_EVIDENCE_CONTRACT } from "./rankEvaluator";

const ALL_KEYS = [
  "summitready_dev_profile_id",
  "summitready_dev_profile_owner_id",
  "summitready_goal",
  "summitready_training_goal",
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
  "summitready_challenges",
  "summitready_questionnaire_data",
  "summitready_shell_mode",
  "summitready_expedition_goal",
  "summitready_expeditions",
  "summitready_active_expedition_id",
  "baseline_popup_seen",
];

export const DEV_FIXTURE_CLOCK = "2026-09-20T12:00:00.000Z";

function daysFromNow(n: number): string {
  const d = new Date(DEV_FIXTURE_CLOCK);
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

function makeExploreHikes(
  prefix: string,
  count: number,
  activeWeeks: number,
  mountainNames: readonly string[],
  elevationGain: number,
): ExploreHike[] {
  return Array.from({ length: count }, (_, index) => {
    const week = index % activeWeeks;
    const outing = Math.floor(index / activeWeeks);
    const name = mountainNames[index % mountainNames.length];
    return {
      id: `${prefix}-hike-${index + 1}`,
      name,
      date: daysFromNow(-(week * 7 + outing + 1)),
      distance: 7.5 + (index % 6) * 1.1,
      elevationGain,
      timeTaken: 105 + (index % 5) * 22,
      notes: "Deterministic verified outdoor fixture",
    };
  });
}

function makeCompletedGoals(
  prefix: string,
  count: number,
  mountainNames: readonly string[],
): CompletedGoal[] {
  return Array.from({ length: count }, (_, index) => ({
    mountainName: mountainNames[index % mountainNames.length],
    elevationGain: 650 + index * 35,
    highestAltitude: 900 + index * 80,
    difficulty: index > 7 ? "Alpine" : index > 2 ? "Hard" : "Moderate",
    completedAt: daysFromNow(-(index + 2) * 14),
    sessionsLogged: 8 + index,
    totalElevationTrained: 3000 + index * 500,
    trainingWeeks: 6 + index,
  }));
}

export interface DevProfile {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string;
  storageData: Array<[string, string]>;
}

/** The fixture clock is deliberately independent of the host clock. */
// ── Profile 1: New User ───────────────────────────────────────────────────────

const beginnerProfile: DevProfile = {
  id: "beginner",
  label: "Beginner",
  emoji: "👋",
  description: "Starting mountain training with a structured first goal",
  color: "#9CA3AF",
  storageData: [
    ["summitready_app_mode", "summit"],
    ["summitready_goal", JSON.stringify({
      mountainName: "Mam Tor", summitDate: daysFromNow(140), distance: 10,
      elevationGain: 420, highestAltitude: 517, difficulty: "Moderate",
      fitnessLevel: "Beginner", location: "Sheffield", maxRadius: 25,
      equipment: ["none"], trainingDaysPerWeek: 2, hillDaysPerWeek: 1,
    } satisfies SummitGoal)],
    ["summitready_plan", JSON.stringify([])],
    ["summitready_sessions", JSON.stringify([])],
    ["summitready_explore_hikes", JSON.stringify([])],
    ["summitready_achievements", JSON.stringify([])],
    ["summitready_challenges", JSON.stringify([])],
    ["summitready_expeditions", JSON.stringify([])],
    ["summitready_has_viewed_plan", "true"],
  ],
};

// ── Profile 2: Beginner — Ben Nevis ──────────────────────────────────────────

const activeHillwalkerProfile: DevProfile = {
  id: "active_hillwalker",
  label: "Active Hillwalker",
  emoji: "🥾",
  description: "Building consistent hill experience · Sheffield",
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
      ["summitready_sessions",       JSON.stringify([
        makeSession("hillwalker-1", 19, "cardio", 1),
        makeSession("hillwalker-2", 16, "hill", 1, "Rivington Pike"),
        makeSession("hillwalker-3", 12, "bigDay", 2),
        makeSession("hillwalker-4", 9, "cardio", 2),
        makeSession("hillwalker-5", 5, "hill", 3, "Winter Hill"),
        makeSession("hillwalker-6", 2, "bigDay", 3),
      ])],
      ["summitready_explore_hikes", JSON.stringify(
        makeExploreHikes("hillwalker", 6, 3, ["Rivington Pike", "Winter Hill"], 240),
      )],
      ["summitready_completed_goals", JSON.stringify(
        makeCompletedGoals("hillwalker", 2, ["Rivington Pike", "Winter Hill"]),
      )],
      ["summitready_achievements", JSON.stringify(["first_session", "first_hike", "hill_week"])],
      ["summitready_has_viewed_plan","true"],
      ["baseline_popup_seen",        "1"],
    ] as Array<[string, string]>;
  })(),
};

// ── Profile 3: Intermediate — Kilimanjaro ────────────────────────────────────

const experiencedSummiteerProfile: DevProfile = {
  id: "experienced_summiteer",
  label: "Experienced Summiteer",
  emoji: "⛰️",
  description: "Repeated summit preparation · Sheffield",
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
      ["summitready_explore_hikes",  JSON.stringify(
        makeExploreHikes("summiteer", 15, 6, ["Kinder Scout", "Mam Tor", "Pen-y-ghent", "Whernside"], 300),
      )],
      ["summitready_completed_goals", JSON.stringify(
        makeCompletedGoals("summiteer", 4, ["Kinder Scout", "Mam Tor", "Pen-y-ghent", "Whernside"]),
      )],
      ["summitready_has_viewed_plan","true"],
      ["summitready_achievements",   JSON.stringify(["first_session", "5_sessions", "hill_week"])],
      ["baseline_popup_seen",        "1"],
    ] as Array<[string, string]>;
  })(),
};

// ── Profile 4: Advanced — Mont Blanc ─────────────────────────────────────────

const expeditionFocusedProfile: DevProfile = {
  id: "expedition_focused",
  label: "Expedition-focused",
  emoji: "🏔️",
  description: "Active alpine expedition preparation · Leeds",
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

    const completedChallenge = [{
      challengeId: "everest-basecamp",
      startedAt: daysFromNow(-30),
      activities: [{
        id: "vq-complete-activity",
        activityId: "vq-complete-activity",
        challengeId: "everest-basecamp",
        title: "Mont Blanc training block",
        date: daysFromNow(-1),
        elevationGain: 3485,
        distance: 42.4,
        duration: 620,
        notes: "Deterministic visual QA fixture",
        createdAt: daysFromNow(-1),
      }],
      completed: true,
      completedAt: daysFromNow(-1),
    }];

    const activeExpedition = {
      id: "vq-mont-blanc-expedition",
      challengeName: "Mont Blanc Preparation Expedition",
      targetMountainName: "Mont Blanc",
      targetMountain: {
        name: "Mont Blanc",
        country: "France / Italy",
        summitElevation: 4808,
        totalElevationGain: 2800,
        totalDistance: 19,
        estimatedDays: 2,
        difficulty: "Alpine",
        altitudeExposure: "Extreme",
        notes: "A sustained alpine ascent requiring endurance and careful preparation.",
        routeDna: {
          endurance: 9,
          elevation: 9,
          altitude: 9,
          terrain: 8,
          technicality: 7,
          exposure: 8,
        },
      },
      virtualHills: [
        {
          name: "Rombald's Moor", elevation: 402, distance: 4.8, repeats: 1,
          totalElevation: 402, surface: "Mixed trail", grade: "Hard", emoji: "⛰️",
        },
        {
          name: "Ilkley Moor", elevation: 402, distance: 5.2, repeats: 1,
          totalElevation: 402, surface: "Rocky trail", grade: "Moderate", emoji: "🥾",
        },
      ],
      expeditionPlan: {
        title: "Alpine endurance progression",
        concept: "Build sustained climbing capacity before the summit push.",
        days: [
          { label: "Stage 1", title: "Base endurance", focus: "Long steady climbing", routes: [{ name: "Rombald's Moor", why: "Builds repeatable ascent volume close to home." }] },
          { label: "Stage 2", title: "Summit simulation", focus: "Back-to-back elevation", routes: [{ name: "Ilkley Moor", why: "Tests sustained effort before the final expedition stage." }] },
        ],
        alternatives: {},
        adventureScore: 84,
        dnaMatchScore: 78,
        dnaMatchNotes: "Local routes emphasize sustained climbing and repeatable elevation.",
      },
      simulationScore: 78,
      completedRoutes: ["stage-base-endurance", "stage-summit-simulation"],
      expeditionStatus: "active",
      virtualHikeProgress: { elevationGained: 220, distanceCovered: 8.4, hikesLogged: 2, creditedHikeIds: [] },
      location: "Leeds",
      maxRadius: 40,
      fitnessLevel: "Strong",
      savedAt: daysFromNow(-21),
      startedAt: daysFromNow(-14),
      summitTransitionState: "not_ready",
    };

    return [
      ["summitready_app_mode",      "summit"],
      ["summitready_goal",           JSON.stringify(goal)],
      ["summitready_plan",           JSON.stringify(plan)],
      ["summitready_sessions",       JSON.stringify(sessions)],
      ["summitready_explore_hikes",  JSON.stringify(
        makeExploreHikes("expedition", 35, 10, ["Ilkley Moor", "Rombald's Moor", "Pen-y-ghent", "Whernside", "Ingleborough", "Skiddaw", "Blencathra", "Helvellyn"], 300),
      )],
      ["summitready_completed_goals", JSON.stringify(
        makeCompletedGoals("expedition", 8, ["Pen-y-ghent", "Whernside", "Ingleborough", "Skiddaw", "Blencathra", "Helvellyn", "Snowdon", "Ben Nevis"]),
      )],
      ["summitready_has_viewed_plan","true"],
      ["summitready_achievements",   JSON.stringify(["first_session", "5_sessions", "10_sessions", "hill_week", "elevation_1000", "big_day", "consistent_month"])],
      ["summitready_challenges",     JSON.stringify(completedChallenge)],
      ["summitready_shell_mode",     "training"],
      ["summitready_expeditions",    JSON.stringify([activeExpedition])],
      ["summitready_active_expedition_id", activeExpedition.id],
      ["baseline_popup_seen",        "1"],
    ] as Array<[string, string]>;
  })(),
};

// ── Profile 5: Explore Mode ───────────────────────────────────────────────────

const advancedAllRoundProfile: DevProfile = {
  id: "advanced_all_round",
  label: "Advanced all-round",
  emoji: "🗺️",
  description: "Broad training, recent hikes, challenges and routes",
  color: "#A78BFA",
  storageData: (() => {
    const advancedMountains = [
      "Stanage Edge", "Kinder Scout", "Rivington Pike", "Mam Tor",
      "Pen y Fan", "Whernside", "Ingleborough", "Skiddaw",
      "Cairn Gorm", "Blencathra", "Helvellyn", "Snowdon",
      "Ben Nevis", "Scafell Pike", "Tryfan", "Cadair Idris",
    ];
    const hikes = makeExploreHikes("advanced", 85, 18, advancedMountains, 360);

    const savedTrails = [
      "kinder-scout-circular_peak-district-derbyshire",
      "stanage-edge-walk_peak-district-derbyshire",
    ];
    const completedTrails = ["rivington-pike-loop_lancashire"];

    const goal: SummitGoal = {
      mountainName: "Snowdon", summitDate: daysFromNow(56), distance: 14,
      elevationGain: 950, highestAltitude: 1085, difficulty: "Hard",
      fitnessLevel: "Strong", location: "Manchester", maxRadius: 35,
      equipment: ["gym", "weights"], trainingDaysPerWeek: 4, hillDaysPerWeek: 2,
    };
    const plan: TrainingWeek[] = [
      makeWeek(1, "Build", "Maintain all-round mountain conditioning", 900, 0, true, "Kinder Scout", 636),
    ];
    const sessions: Session[] = [
      makeSession("all-round-1", 5, "cardio", 1),
      makeSession("all-round-2", 3, "hill", 1, "Kinder Scout"),
    ];
    const completedChallenge = [{
      challengeId: "everest-basecamp",
      startedAt: daysFromNow(-28),
      activities: [{
        id: "advanced-challenge-activity",
        activityId: "advanced-challenge-activity",
        challengeId: "everest-basecamp",
        title: "Advanced elevation block",
        date: daysFromNow(-2),
        elevationGain: 3485,
        distance: 38.6,
        duration: 540,
        createdAt: daysFromNow(-2),
      }],
      completed: true,
      completedAt: daysFromNow(-2),
    }];
    const completedExpedition = {
      id: "advanced-completed-expedition",
      challengeName: "Six-stage alpine preparation",
      targetMountainName: "Gran Paradiso",
      virtualHills: [],
      completedRoutes: Array.from({ length: 6 }, (_, index) => `advanced-stage-${index + 1}`),
      expeditionStatus: "complete",
      virtualHikeProgress: { elevationGained: 7200, distanceCovered: 92, hikesLogged: 18 },
      location: "Manchester",
      maxRadius: 35,
      fitnessLevel: "Strong",
      savedAt: daysFromNow(-180),
      startedAt: daysFromNow(-160),
      completedAt: daysFromNow(-35),
      summitTransitionState: "completed",
    };
    return [
      ["summitready_app_mode",       "summit"],
      ["summitready_goal",           JSON.stringify(goal)],
      ["summitready_plan",           JSON.stringify(plan)],
      ["summitready_sessions",       JSON.stringify(sessions)],
      ["summitready_explore_hikes",   JSON.stringify(hikes)],
      ["summitready_completed_goals", JSON.stringify(
        makeCompletedGoals("advanced", 16, advancedMountains),
      )],
      ["summitready_saved_trails",    JSON.stringify(savedTrails)],
      ["summitready_completed_trails",JSON.stringify(completedTrails)],
      ["summitready_achievements",    JSON.stringify(["first_hike", "trail_explorer", "hill_week"])],
      ["summitready_challenges",      JSON.stringify(completedChallenge)],
      ["summitready_expeditions",     JSON.stringify([completedExpedition])],
      ["summitready_has_viewed_plan", "true"],
      ["baseline_popup_seen",         "1"],
    ] as Array<[string, string]>;
  })(),
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const DEV_PROFILES: DevProfile[] = [
  beginnerProfile,
  activeHillwalkerProfile,
  experiencedSummiteerProfile,
  expeditionFocusedProfile,
  advancedAllRoundProfile,
];

export async function loadDevProfile(profile: DevProfile): Promise<void> {
  if (!__DEV__) {
    throw new Error("Development profiles are unavailable outside development builds");
  }
  const previousOwner = await AsyncStorage.getItem("summitready_dev_profile_owner_id");
  const previousOwnerKeys = previousOwner
    ? ALL_KEYS.map((key) => `${key}_${previousOwner}`)
    : [];
  await AsyncStorage.multiRemove([...ALL_KEYS, ...previousOwnerKeys]);
  const present = new Set(profile.storageData.map(([key]) => key));
  const contractDefaults: Array<[string, string]> = [
    ["summitready_goal", "null"],
    ["summitready_training_goal", "null"],
    ["summitready_plan", "[]"],
    ["summitready_sessions", "[]"],
    ["summitready_explore_hikes", "[]"],
    ["summitready_challenges", "[]"],
    ["summitready_achievements", "[]"],
  ];
  await AsyncStorage.multiSet([
    ...profile.storageData,
    ...contractDefaults.filter(([key]) => !present.has(key)),
    ["summitready_dev_profile_id", profile.id],
  ]);
}

export async function markDevProfileMigrationOwner(ownerUserId: string): Promise<boolean> {
  if (!__DEV__ || !ownerUserId) return false;
  const [profileId, existingOwner] = await Promise.all([
    AsyncStorage.getItem("summitready_dev_profile_id"),
    AsyncStorage.getItem("summitready_dev_profile_owner_id"),
  ]);
  if (!profileId) return false;
  if (existingOwner) return existingOwner === ownerUserId;
  await AsyncStorage.setItem("summitready_dev_profile_owner_id", ownerUserId);
  return true;
}

export async function purgePersistedDevProfileForProduction(): Promise<boolean> {
  if (__DEV__) return false;
  const [profileId, ownerUserId] = await Promise.all([
    AsyncStorage.getItem("summitready_dev_profile_id"),
    AsyncStorage.getItem("summitready_dev_profile_owner_id"),
  ]);
  if (!profileId) return false;
  const ownerKeys = ownerUserId
    ? ALL_KEYS.map((key) => `${key}_${ownerUserId}`)
    : [];
  await AsyncStorage.multiRemove([...ALL_KEYS, ...ownerKeys]);
  return true;
}

/**
 * Rank evidence is intentionally a developer-only projection of the same
 * stored outdoor, summit, and Expedition history used by the persona UI.
 */
export function readDevRankEvidence(profileId: string, ownerUserId = "dev-fixture-owner"): readonly EvidenceReference[] {
  if (!__DEV__) return [];
  const profile = DEV_PROFILES.find((item) => item.id === profileId);
  if (!profile) return [];
  const stored = new Map(profile.storageData);
  const hikes = JSON.parse(stored.get("summitready_explore_hikes") ?? "[]") as ExploreHike[];
  const completedGoals = JSON.parse(stored.get("summitready_completed_goals") ?? "[]") as CompletedGoal[];
  const expeditions = JSON.parse(stored.get("summitready_expeditions") ?? "[]") as Array<{
    completedRoutes?: string[];
  }>;
  const base = (id: string, occurredAt: string) => ({
    evidenceId: `dev-${profileId}-${id}`,
    lineageId: `dev-${profileId}-${id}`,
    ownerUserId,
    sourceId: `dev-${profileId}-${id}`,
    occurredAt,
    qualificationStatus: "eligible" as const,
  });
  const outdoor: EvidenceReference[] = hikes.map((hike, index) => ({
    ...base(`activity-${index + 1}`, hike.date),
    sourceType: "canonical_activity",
    activityId: hike.id,
    evidenceClass: "trusted_gps_outdoor",
    qualificationPurpose: RANK_EVIDENCE_CONTRACT.outdoor.purpose,
    qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.outdoor.ruleVersion,
  }));
  const elevationTotal = hikes.reduce((sum, hike) => sum + Math.max(0, hike.elevationGain), 0);
  const elevation: EvidenceReference[] = elevationTotal > 0 ? [{
    ...base("eligible-elevation", hikes[0]?.date ?? DEV_FIXTURE_CLOCK),
    sourceType: "canonical_activity",
    activityId: `dev-${profileId}-elevation`,
    evidenceClass: "trusted_gps_outdoor",
    qualificationPurpose: RANK_EVIDENCE_CONTRACT.elevation.purpose,
    qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.elevation.ruleVersion,
    value: elevationTotal,
  }] : [];
  const summits: EvidenceReference[] = completedGoals.map((goal, index) => ({
    ...base(`summit-${index + 1}`, goal.completedAt),
    sourceType: "canonical_route_evidence",
    evidenceClass: "canonical_summit",
    qualificationPurpose: RANK_EVIDENCE_CONTRACT.summit.purpose,
    qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.summit.ruleVersion,
    provenanceHash: `dev-provenance-${profileId}-${index + 1}`,
    sdeTargetId: `sde:mountain:dev-${index + 1}`,
    mountainId: `dev-mountain-${goal.mountainName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    summitCompleted: true,
  }));
  const milestoneIds = expeditions.flatMap((expedition, expeditionIndex) =>
    (expedition.completedRoutes ?? []).map((routeId) => ({ routeId, expeditionIndex })),
  );
  const expeditionEvidence: EvidenceReference[] = milestoneIds.map(
    ({ routeId, expeditionIndex }, index) => ({
      ...base(`expedition-${expeditionIndex + 1}-${routeId}`, daysFromNow(-(index + 1) * 7)),
      sourceType: "expedition_consequence",
      evidenceClass: "trusted_gps_outdoor",
      qualificationPurpose: RANK_EVIDENCE_CONTRACT.expedition.purpose,
      qualificationRuleVersion: RANK_EVIDENCE_CONTRACT.expedition.ruleVersion,
      expeditionStageCompleted: true,
    }),
  );
  return [...outdoor, ...elevation, ...summits, ...expeditionEvidence];
}
