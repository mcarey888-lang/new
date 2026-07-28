import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { generatePlan, parseDurationMidpoint } from "@/utils/planGenerator";
import { calculateReadiness, diagnoseScoreStagnation, ScoreInsight } from "@/utils/readinessScore";
import { computeUnlocked } from "@/utils/achievements";
import { logTrainingPlanGenerated, logReadinessScoreImproved } from "@/lib/analytics";
import type { Trail } from "@/constants/trailData";

export interface AlpineRequirement {
  id: string;
  category: "endurance" | "altitude" | "technical" | "strength" | "recovery";
  label: string;
  detail: string;
  benchmark?: "sessions_count" | "max_elevation_m" | "big_day_count" | "weeks_training";
  benchmarkValue?: number;
}

export interface AlpineProfile {
  altitudeBand: "high" | "very-high" | "extreme";
  technicalLevel: "walking" | "scrambling" | "basic-crampons" | "technical" | "advanced-technical";
  minimumWeeks: number;
  requirements: AlpineRequirement[];
  keyRisks: string[];
  acclimatizationNote: string;
}

export interface CompletedGoal {
  mountainName: string;
  elevationGain: number;
  highestAltitude: number;
  difficulty: "Easy" | "Moderate" | "Hard" | "Alpine";
  completedAt: string;
  sessionsLogged: number;
  totalElevationTrained: number;
  trainingWeeks: number;
}

export interface SimulationScoreBreakdown {
  overall: number;
  elevation: number;
  gradient: number;
  duration: number;
  altitude: number;
  consecutiveDays: number;
}

export interface TargetMountain {
  name: string;
  country: string;
  summitElevation: number;
  totalElevationGain: number;
  totalDistance: number;
  estimatedDays: 1 | 2;
  day1ElevationGain?: number;
  day2ElevationGain?: number;
  difficulty: "Easy" | "Moderate" | "Hard" | "Alpine";
  altitudeExposure: "None" | "Moderate" | "High" | "Extreme";
  /** Narrative description of the standard route, from GPT-4o mountain profile. */
  notes?: string | null;
}

export interface SummitGoal {
  mountainName: string;
  summitDate: string;
  distance: number;
  elevationGain: number;
  highestAltitude: number;
  difficulty: "Easy" | "Moderate" | "Hard" | "Alpine";
  fitnessLevel: "Beginner" | "Average" | "Strong";
  location: string;
  maxRadius: number;
  equipment: Array<"gym" | "weights" | "bands" | "none">;
  trainingDaysPerWeek: number;
  hillDaysPerWeek: number;
  /** Which specific days of the week the user trains. 0=Sunday, 1=Monday, …, 6=Saturday.
   *  Optional — existing users without this field continue to work with graceful fallback. */
  availableDays?: number[];
  preferredHills?: NearbyHill[];
  fitnessBaseline?: number;
  planStartMode?: "optimal" | "full";
  alpineProfile?: AlpineProfile;
  /** Undefined means existing users — treated as "expedition" everywhere. */
  mode?: "expedition" | "virtual";
  /** Virtual Expeditions only: the target mountain being simulated. */
  targetMountain?: TargetMountain;
  /** Cached Physical Simulation Score (0–100). Computed once at setup, refreshed on demand. */
  simulationScore?: number;
  /** Per-dimension breakdown of the Physical Simulation Score. */
  simulationScoreBreakdown?: SimulationScoreBreakdown;
  /** Virtual mode only: drives plan length instead of summitDate. */
  simulationDurationWeeks?: number;
  /** Virtual mode only: cached recommended training hills from the last /virtual-expedition call. */
  virtualHills?: NearbyHill[];
}

export interface PlanSession {
  type: "cardio" | "hill" | "bigDay";
  label: string;
  description: string;
  targetElevation: number;
  duration: string;
  gymExercise?: "treadmill" | "stepper" | "outdoor" | "box-steps" | "weighted-stairs" | "elliptical";
  targetDistanceKm?: number;
  targetFloors?: number;
  targetFlights?: number;
  inclinePct?: number;
}

export interface TrainingWeek {
  weekNumber: number;
  phase: "Accelerated" | "Base" | "Build" | "Peak" | "Taper";
  purpose: string;
  targetElevation: number;
  sessions: PlanSession[];
  isPeakWeek: boolean;
  isTaperWeek: boolean;
  isCurrentWeek: boolean;
  startDate: string;
  endDate: string;
  hills: { name: string; elevation: number; distance: number; repeats: number; totalElevation: number; lat?: number; lng?: number }[];
  adjustNote?: string;
}

export interface NearbyHill {
  name: string;
  elevation: number;
  distance: number;
  repeats: number;
  totalElevation: number;
  surface: string;
  grade: string;
  emoji: string;
  lat?: number;
  lng?: number;
  routeType?: "hill" | "circular" | "out-and-back";
  routeDistance?: number;
  estimatedTime?: string;
  /** Summit elevation in metres ASL, threaded from OSM ele tag by the hills pipeline. */
  summitElevationASL?: number;
}

export interface Session {
  id: string;
  date: string;
  type: "cardio" | "hill" | "bigDay";
  distance: number;
  elevationGain: number;
  duration: number;
  effort: 1 | 2 | 3 | 4 | 5;
  notes: string;
  completed: boolean;
  weekNumber: number;
  hillName?: string;
  reps?: number;
  gymSubtype?: "treadmill" | "stepper" | "outdoor";
  treadmillKm?: number;
  treadmillInclinePct?: number;
  stepperFloors?: number;
}

export const PENDING_PAST_HIKES_KEY = "summitready_pending_past_hikes";

export interface PastHike {
  trailId?: string;
  name: string;
  elevationGain: number;
  distance: number;
  monthsAgo: number;
  emoji?: string;
}

export interface ExploreHike {
  id: string;
  name: string;
  date: string;
  distance: number;
  elevationGain: number;
  timeTaken: number;
  notes: string;
  trackPoints?: Array<{ lat: number; lon: number }>;
}

interface AppState {
  summitGoal: SummitGoal | null;
  trainingPlan: TrainingWeek[];
  sessions: Session[];
  readinessScore: number;
  isLoading: boolean;
  nearbyHills: NearbyHill[];
  hillsLoading: boolean;
  hillsError: string | null;
  alpineProfileLoading: boolean;
  completedPlanSessions: Record<string, boolean>;
  assignedHills: Record<string, NearbyHill>;
  planAdjusting: boolean;
  planAdjustNote: string | null;
  submittedPlanSessions: Record<string, boolean>;
  sessionReps: Record<string, number>;
  sessionEfforts: Record<string, 1 | 2 | 3 | 4 | 5>;
  sessionDayOverrides: Record<string, number>;
  hasViewedPlan: boolean;
  setSummitGoal: (goal: SummitGoal) => Promise<void>;
  changeSummit: (goal: SummitGoal) => Promise<void>;
  addSession: (session: Omit<Session, "id">) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearPlan: () => Promise<void>;
  seedPastActivity: (hikes: PastHike[]) => Promise<void>;
  fetchNearbyHills: (radiusOverride?: number, minElevation?: number, locationOverride?: string) => Promise<void>;
  togglePlanSession: (weekNum: number, sessionIdx: number) => Promise<void>;
  assignHillToSession: (weekNum: number, sessionIdx: number, hill: NearbyHill) => Promise<void>;
  adjustPlanWithAI: () => Promise<void>;
  submitWeekSessions: (weekNum: number) => Promise<number>;
  hillsInPlan: string[];
  addHillToPlan: (hill: NearbyHill) => Promise<void>;
  myHills: NearbyHill[];
  addToMyHills: (hill: NearbyHill) => Promise<void>;
  removeFromMyHills: (hillName: string) => Promise<void>;
  addToNearbyHills: (hill: NearbyHill) => Promise<void>;
  updateGoalLocation: (location: string) => Promise<void>;
  setSessionReps: (key: string, reps: number) => Promise<void>;
  setSessionEffort: (key: string, effort: 1 | 2 | 3 | 4 | 5) => Promise<void>;
  setSessionDayOverride: (weekNum: number, sessionIdx: number, dow: number) => Promise<void>;
  clearSessionDayOverride: (weekNum: number, sessionIdx: number) => Promise<void>;
  updatePlanSession: (weekNum: number, sessionIdx: number, updates: Partial<Pick<PlanSession, "type" | "label" | "description" | "duration" | "targetElevation" | "gymExercise" | "targetDistanceKm" | "targetFloors" | "inclinePct">>) => Promise<void>;
  markPlanViewed: () => Promise<void>;
  unlockedAchievements: string[];
  newlyUnlocked: string[];
  clearNewlyUnlocked: () => void;
  completedGoals: CompletedGoal[];
  appMode: "summit" | "explore" | null;
  exploreHikes: ExploreHike[];
  setAppMode: (mode: "summit" | "explore") => Promise<void>;
  logExploreHike: (hike: Omit<ExploreHike, "id">) => Promise<void>;
  deleteExploreHike: (id: string) => Promise<void>;
  savedTrailIds: string[];
  completedTrailIds: string[];
  customRoutes: Trail[];
  saveTrail: (id: string) => Promise<void>;
  unsaveTrail: (id: string) => Promise<void>;
  completeTrail: (id: string) => Promise<void>;
  uncompleteTrail: (id: string) => Promise<void>;
  addCustomRoute: (route: Omit<Trail, "id" | "isCustom" | "createdAt">) => Promise<void>;
  deleteCustomRoute: (id: string) => Promise<void>;
  reloadApp: () => Promise<void>;
  scoreStagnation: ScoreInsight | null;
  clearScoreStagnation: () => void;
  /** Update individual SummitGoal fields in-place without regenerating the plan or resetting sessions. */
  patchGoal: (updates: Partial<SummitGoal>) => Promise<void>;
}

const AppContext = createContext<AppState>({
  summitGoal: null,
  trainingPlan: [],
  sessions: [],
  readinessScore: 0,
  isLoading: true,
  nearbyHills: [],
  hillsLoading: false,
  hillsError: null,
  alpineProfileLoading: false,
  completedPlanSessions: {},
  assignedHills: {},
  planAdjusting: false,
  planAdjustNote: null,
  submittedPlanSessions: {},
  sessionReps: {},
  sessionEfforts: {},
  sessionDayOverrides: {},
  hasViewedPlan: false,
  setSummitGoal: async () => {},
  changeSummit: async () => {},
  addSession: async () => {},
  updateSession: async () => {},
  deleteSession: async () => {},
  clearPlan: async () => {},
  seedPastActivity: async () => {},
  fetchNearbyHills: async () => {},
  togglePlanSession: async () => {},
  assignHillToSession: async () => {},
  adjustPlanWithAI: async () => {},
  submitWeekSessions: async () => 0,
  hillsInPlan: [],
  addHillToPlan: async () => {},
  myHills: [],
  addToMyHills: async () => {},
  removeFromMyHills: async () => {},
  addToNearbyHills: async () => {},
  updateGoalLocation: async () => {},
  setSessionReps: async () => {},
  setSessionEffort: async () => {},
  setSessionDayOverride: async () => {},
  clearSessionDayOverride: async () => {},
  updatePlanSession: async () => {},
  markPlanViewed: async () => {},
  unlockedAchievements: [],
  newlyUnlocked: [],
  clearNewlyUnlocked: () => {},
  completedGoals: [],
  appMode: null,
  exploreHikes: [],
  setAppMode: async () => {},
  logExploreHike: async () => {},
  deleteExploreHike: async () => {},
  savedTrailIds: [],
  completedTrailIds: [],
  customRoutes: [],
  saveTrail: async () => {},
  unsaveTrail: async () => {},
  completeTrail: async () => {},
  uncompleteTrail: async () => {},
  addCustomRoute: async () => {},
  deleteCustomRoute: async () => {},
  reloadApp: async () => {},
  scoreStagnation: null,
  clearScoreStagnation: () => {},
  patchGoal: async () => {},
});

const _FLAT_GOAL_KEY             = "summitready_goal";
const _FLAT_SESSIONS_KEY         = "summitready_sessions";
const _FLAT_PLAN_KEY             = "summitready_plan";
const _FLAT_HILLS_KEY            = "summitready_nearby_hills";
const _FLAT_COMPLETED_KEY        = "summitready_completed_plan_sessions";
const _FLAT_ASSIGNED_KEY         = "summitready_assigned_hills";
const _FLAT_ADJUST_NOTE_KEY      = "summitready_adjust_note";
const _FLAT_SUBMITTED_KEY        = "summitready_submitted_plan_sessions";
const _FLAT_HILLS_IN_PLAN_KEY    = "summitready_hills_in_plan";
const _FLAT_REPS_KEY             = "summitready_session_reps";
const _FLAT_EFFORTS_KEY          = "summitready_session_efforts";
const _FLAT_HAS_VIEWED_PLAN_KEY  = "summitready_has_viewed_plan";
const _FLAT_ACHIEVEMENTS_KEY     = "summitready_achievements";
const _FLAT_COMPLETED_GOALS_KEY  = "summitready_completed_goals";
const _FLAT_APP_MODE_KEY         = "summitready_app_mode";
const _FLAT_EXPLORE_HIKES_KEY    = "summitready_explore_hikes";
const _FLAT_SAVED_TRAILS_KEY     = "summitready_saved_trails";
const _FLAT_COMPLETED_TRAILS_KEY = "summitready_completed_trails";
const _FLAT_CUSTOM_ROUTES_KEY    = "summitready_custom_routes";
const _FLAT_MY_HILLS_KEY         = "summitready_my_hills";
const _FLAT_EXCLUDED_HILLS_KEY   = "summitready_excluded_my_hills";
const _FLAT_DAY_OVERRIDES_KEY    = "summitready_session_day_overrides";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function fetchAlpineAssessment(
  mountainName: string,
  highestAltitude: number,
): Promise<AlpineProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/alpine-assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mountainName, highestAltitude, difficulty: "Alpine" }),
    });
    if (!res.ok) return null;
    return await res.json() as AlpineProfile;
  } catch {
    return null;
  }
}

const DEMO_GOAL: SummitGoal = {
  mountainName: "Hörnlihütte from Schwarzsee",
  summitDate: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 56);
    return d.toISOString().split("T")[0];
  })(),
  distance: 14,
  elevationGain: 1220,
  highestAltitude: 3260,
  difficulty: "Hard",
  fitnessLevel: "Average",
  location: "Schwarzsee, Switzerland",
  maxRadius: 30,
  equipment: ["none"],
  trainingDaysPerWeek: 4,
  hillDaysPerWeek: 2,
};

const DEMO_SESSIONS: Session[] = [
  {
    id: "demo1",
    date: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0]; })(),
    type: "cardio",
    distance: 6.2,
    elevationGain: 180,
    duration: 48,
    effort: 3,
    notes: "Felt good, steady pace",
    completed: true,
    weekNumber: 1,
  },
  {
    id: "demo2",
    date: (() => { const d = new Date(); d.setDate(d.getDate() - 4); return d.toISOString().split("T")[0]; })(),
    type: "hill",
    distance: 4.1,
    elevationGain: 380,
    duration: 75,
    effort: 4,
    notes: "3 repeats up Beacon Hill",
    completed: true,
    weekNumber: 1,
  },
  {
    id: "demo3",
    date: (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().split("T")[0]; })(),
    type: "bigDay",
    distance: 12.5,
    elevationGain: 640,
    duration: 195,
    effort: 4,
    notes: "Great long day out, pushed the final climb",
    completed: true,
    weekNumber: 1,
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const _uid = userId ?? "";
  const GOAL_KEY             = _uid ? `summitready_goal_${_uid}`                    : _FLAT_GOAL_KEY;
  const SESSIONS_KEY         = _uid ? `summitready_sessions_${_uid}`                : _FLAT_SESSIONS_KEY;
  const PLAN_KEY             = _uid ? `summitready_plan_${_uid}`                    : _FLAT_PLAN_KEY;
  const HILLS_KEY            = _uid ? `summitready_nearby_hills_${_uid}`            : _FLAT_HILLS_KEY;
  const COMPLETED_KEY        = _uid ? `summitready_completed_plan_sessions_${_uid}` : _FLAT_COMPLETED_KEY;
  const ASSIGNED_KEY         = _uid ? `summitready_assigned_hills_${_uid}`          : _FLAT_ASSIGNED_KEY;
  const ADJUST_NOTE_KEY      = _uid ? `summitready_adjust_note_${_uid}`             : _FLAT_ADJUST_NOTE_KEY;
  const SUBMITTED_KEY        = _uid ? `summitready_submitted_plan_sessions_${_uid}` : _FLAT_SUBMITTED_KEY;
  const HILLS_IN_PLAN_KEY    = _uid ? `summitready_hills_in_plan_${_uid}`           : _FLAT_HILLS_IN_PLAN_KEY;
  const REPS_KEY             = _uid ? `summitready_session_reps_${_uid}`            : _FLAT_REPS_KEY;
  const EFFORTS_KEY          = _uid ? `summitready_session_efforts_${_uid}`         : _FLAT_EFFORTS_KEY;
  const HAS_VIEWED_PLAN_KEY  = _uid ? `summitready_has_viewed_plan_${_uid}`         : _FLAT_HAS_VIEWED_PLAN_KEY;
  const ACHIEVEMENTS_KEY     = _uid ? `summitready_achievements_${_uid}`            : _FLAT_ACHIEVEMENTS_KEY;
  const COMPLETED_GOALS_KEY  = _uid ? `summitready_completed_goals_${_uid}`         : _FLAT_COMPLETED_GOALS_KEY;
  const APP_MODE_KEY         = _uid ? `summitready_app_mode_${_uid}`                : _FLAT_APP_MODE_KEY;
  const EXPLORE_HIKES_KEY    = _uid ? `summitready_explore_hikes_${_uid}`           : _FLAT_EXPLORE_HIKES_KEY;
  const SAVED_TRAILS_KEY     = _uid ? `summitready_saved_trails_${_uid}`            : _FLAT_SAVED_TRAILS_KEY;
  const COMPLETED_TRAILS_KEY = _uid ? `summitready_completed_trails_${_uid}`        : _FLAT_COMPLETED_TRAILS_KEY;
  const CUSTOM_ROUTES_KEY    = _uid ? `summitready_custom_routes_${_uid}`           : _FLAT_CUSTOM_ROUTES_KEY;
  const MY_HILLS_KEY         = _uid ? `summitready_my_hills_${_uid}`                : _FLAT_MY_HILLS_KEY;
  const EXCLUDED_HILLS_KEY      = _uid ? `summitready_excluded_my_hills_${_uid}`          : _FLAT_EXCLUDED_HILLS_KEY;
  const DAY_OVERRIDES_KEY       = _uid ? `summitready_session_day_overrides_${_uid}`      : _FLAT_DAY_OVERRIDES_KEY;
  const _PENDING_KEY         = _uid ? `${PENDING_PAST_HIKES_KEY}_${_uid}`           : PENDING_PAST_HIKES_KEY;
  const [loadKey, setLoadKey] = useState(0);
  const [summitGoal, setSummitGoalState] = useState<SummitGoal | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingWeek[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [readinessScore, setReadinessScore] = useState(0);
  const [scoreStagnation, setScoreStagnation] = useState<ScoreInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nearbyHills, setNearbyHills] = useState<NearbyHill[]>([]);
  const [hillsLoading, setHillsLoading] = useState(false);
  const [hillsError, setHillsError] = useState<string | null>(null);
  const [alpineProfileLoading, setAlpineProfileLoading] = useState(false);
  const [completedPlanSessions, setCompletedPlanSessions] = useState<Record<string, boolean>>({});
  const [assignedHills, setAssignedHills] = useState<Record<string, NearbyHill>>({});
  const [planAdjusting, setPlanAdjusting] = useState(false);
  const [planAdjustNote, setPlanAdjustNote] = useState<string | null>(null);
  const [submittedPlanSessions, setSubmittedPlanSessions] = useState<Record<string, boolean>>({});
  const [hillsInPlan, setHillsInPlan] = useState<string[]>([]);
  const [myHills, setMyHills] = useState<NearbyHill[]>([]);
  const [excludedFromMyHills, setExcludedFromMyHills] = useState<string[]>([]);
  const [sessionReps, setSessionRepsState] = useState<Record<string, number>>({});
  const [sessionEfforts, setSessionEffortsState] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>({});
  const [sessionDayOverrides, setSessionDayOverridesState] = useState<Record<string, number>>({});
  const [hasViewedPlan, setHasViewedPlan] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const [completedGoals, setCompletedGoals] = useState<CompletedGoal[]>([]);
  const [appMode, setAppModeState] = useState<"summit" | "explore" | null>(null);
  const [exploreHikes, setExploreHikes] = useState<ExploreHike[]>([]);
  const [savedTrailIds, setSavedTrailIds] = useState<string[]>([]);
  const [completedTrailIds, setCompletedTrailIds] = useState<string[]>([]);
  const [customRoutes, setCustomRoutes] = useState<Trail[]>([]);

  const reloadApp = useCallback(async () => {
    setSummitGoalState(null);
    setTrainingPlan([]);
    setSessions([]);
    setReadinessScore(0);
    setNearbyHills([]);
    setCompletedPlanSessions({});
    setAssignedHills({});
    setPlanAdjustNote(null);
    setSubmittedPlanSessions({});
    setHillsInPlan([]);
    setSessionRepsState({});
    setSessionEffortsState({});
    setSessionDayOverridesState({});
    setHasViewedPlan(false);
    setUnlockedAchievements([]);
    setNewlyUnlocked([]);
    setCompletedGoals([]);
    setAppModeState(null);
    setExploreHikes([]);
    setSavedTrailIds([]);
    setCompletedTrailIds([]);
    setCustomRoutes([]);
    setLoadKey(k => k + 1);
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // One-time migration: copy flat-key data to per-user namespaced keys
        if (_uid) {
          const namespacedGoal = await AsyncStorage.getItem(GOAL_KEY);
          if (!namespacedGoal) {
            const flatKeys = [
              _FLAT_GOAL_KEY, _FLAT_SESSIONS_KEY, _FLAT_PLAN_KEY, _FLAT_HILLS_KEY,
              _FLAT_COMPLETED_KEY, _FLAT_ASSIGNED_KEY, _FLAT_ADJUST_NOTE_KEY, _FLAT_SUBMITTED_KEY,
              _FLAT_HILLS_IN_PLAN_KEY, _FLAT_REPS_KEY, _FLAT_EFFORTS_KEY, _FLAT_HAS_VIEWED_PLAN_KEY,
              _FLAT_ACHIEVEMENTS_KEY, _FLAT_COMPLETED_GOALS_KEY, _FLAT_APP_MODE_KEY, _FLAT_EXPLORE_HIKES_KEY,
              _FLAT_SAVED_TRAILS_KEY, _FLAT_COMPLETED_TRAILS_KEY, _FLAT_CUSTOM_ROUTES_KEY,
              _FLAT_MY_HILLS_KEY, _FLAT_EXCLUDED_HILLS_KEY, PENDING_PAST_HIKES_KEY,
            ];
            const flatPairs = await AsyncStorage.multiGet(flatKeys);
            const toSet: [string, string][] = [];
            const toRemove: string[] = [];
            for (const [flatKey, value] of flatPairs) {
              if (value !== null) {
                toSet.push([`${flatKey}_${_uid}`, value]);
                toRemove.push(flatKey);
              }
            }
            if (toSet.length > 0) {
              await AsyncStorage.multiSet(toSet);
              await AsyncStorage.multiRemove(toRemove);
            }
          }
        }

        const pairs = await AsyncStorage.multiGet([
          GOAL_KEY, SESSIONS_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY, REPS_KEY, EFFORTS_KEY, HAS_VIEWED_PLAN_KEY, ACHIEVEMENTS_KEY, COMPLETED_GOALS_KEY, APP_MODE_KEY, EXPLORE_HIKES_KEY, SAVED_TRAILS_KEY, COMPLETED_TRAILS_KEY, CUSTOM_ROUTES_KEY, MY_HILLS_KEY, EXCLUDED_HILLS_KEY,
        ]);
        const [goalStr, sessionsStr, planStr, hillsStr, completedStr, assignedStr, noteStr, submittedStr, hillsInPlanStr, repsStr, effortsStr, hasViewedPlanStr, achievementsStr, completedGoalsStr, appModeStr, exploreHikesStr, savedTrailsStr, completedTrailsStr, customRoutesStr, myHillsStr, excludedHillsStr] =
          pairs.map(([, v]) => v);

        // Parse explore hikes before the goal block so they're available
        // both for readiness scoring (inside) and hike history (outside).
        const loadedHikes: ExploreHike[] = exploreHikesStr
          ? (JSON.parse(exploreHikesStr) as ExploreHike[]).map(h =>
              h.timeTaken > 300 ? { ...h, timeTaken: Math.round(h.timeTaken / 60) } : h
            )
          : [];

        if (goalStr) {
          const goal: SummitGoal = JSON.parse(goalStr);
          const rawPlan: TrainingWeek[] = planStr ? JSON.parse(planStr) : generatePlan(goal);

          // Migrate stored plans that are missing fields added in later versions.
          let planWasMigrated = false;
          let plan: TrainingWeek[];
          try {
            plan = rawPlan.map(week => {
              const hill = week.hills?.[0];
              if (!week.sessions) return week;
              let weekChanged = false;
              const sessions = week.sessions.map(s => {
                // Fix 1: hill targetElevation exceeds week target (old hill.repeats floor bug)
                if (s.type === "hill" && hill && s.targetElevation > week.targetElevation) {
                  const fixedReps = Math.max(1, Math.ceil((week.targetElevation * 0.5) / hill.elevation));
                  weekChanged = true;
                  planWasMigrated = true;
                  return { ...s, targetElevation: fixedReps * hill.elevation };
                }
                // Fix 2: gym cardio sessions missing gymExercise/target fields, or with
                // targets that are zero (e.g. from AI-adjusted sessions that lost the fields).
                // Match by label OR description so AI-rewritten text is also caught.
                // Pacing: treadmill 4.5 km/h @10% (1 km = 100 m elev); stepper 3 floors/min.
                const gymText = `${s.label ?? ""} ${s.description ?? ""}`.toLowerCase();
                const looksLikeTreadmill = gymText.includes("treadmill");
                const looksLikeStepper = gymText.includes("stepper") || gymText.includes("step machine") || gymText.includes("stairmaster");
                const treadmillNeedsUpdate = looksLikeTreadmill && (s.gymExercise !== "treadmill" || !s.targetDistanceKm || s.targetDistanceKm <= 0);
                const stepperNeedsUpdate = looksLikeStepper && (s.gymExercise !== "stepper" || !s.targetFloors || s.targetFloors <= 0);
                // Broaden the type check: accept "cardio" sessions AND sessions whose
                // type was accidentally omitted or set to something unexpected by the AI.
                // Hill/bigDay sessions will never match looksLikeTreadmill/Stepper, so
                // widening here is safe.
                const isCardioCompatible = s.type === "cardio" || (s.type !== "hill" && s.type !== "bigDay");
                if (isCardioCompatible && (treadmillNeedsUpdate || stepperNeedsUpdate)) {
                  if (treadmillNeedsUpdate) {
                    const midDur = parseDurationMidpoint(s.duration ?? "30–40 min");
                    const targetDistanceKm = Math.max(0.5, Math.round((midDur / 60) * 4.5 * 10) / 10);
                    weekChanged = true;
                    planWasMigrated = true;
                    return {
                      ...s,
                      type: "cardio" as const,
                      gymExercise: "treadmill" as const,
                      targetDistanceKm,
                      targetElevation: Math.round(targetDistanceKm * 100),
                      inclinePct: s.inclinePct ?? 10,
                    };
                  }
                  if (stepperNeedsUpdate) {
                    const midDur = parseDurationMidpoint(s.duration ?? "30–40 min");
                    const targetFloors = Math.max(10, Math.round(midDur * 3));
                    weekChanged = true;
                    planWasMigrated = true;
                    return {
                      ...s,
                      type: "cardio" as const,
                      gymExercise: "stepper" as const,
                      targetFloors,
                      targetElevation: targetFloors * 3,
                    };
                  }
                }
                return s;
              });
              return weekChanged ? { ...week, sessions } : week;
            });
            if (planWasMigrated) {
              AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan)).catch(() => {});
            }
          } catch {
            plan = rawPlan;
          }

          const storedSessions: Session[] = sessionsStr ? JSON.parse(sessionsStr) : [];
          const hills: NearbyHill[] = hillsStr ? JSON.parse(hillsStr) : [];
          const completed: Record<string, boolean> = completedStr ? JSON.parse(completedStr) : {};
          const assigned: Record<string, NearbyHill> = assignedStr ? JSON.parse(assignedStr) : {};
          const submitted: Record<string, boolean> = submittedStr ? JSON.parse(submittedStr) : {};

          setSummitGoalState(goal);
          setTrainingPlan(plan);
          setSessions(storedSessions);
          setNearbyHills(hills);
          setCompletedPlanSessions(completed);
          setAssignedHills(assigned);
          setSubmittedPlanSessions(submitted);
          const loadedReps = repsStr ? JSON.parse(repsStr) : {};
          const parsedCompletedGoals: CompletedGoal[] = completedGoalsStr ? JSON.parse(completedGoalsStr) : [];
          setReadinessScore(calculateReadiness(goal, plan, storedSessions, { sessionReps: loadedReps, assignedHills: assigned, completedGoals: parsedCompletedGoals, exploreHikes: loadedHikes }));
          if (noteStr) setPlanAdjustNote(noteStr);
          if (hillsInPlanStr) setHillsInPlan(JSON.parse(hillsInPlanStr));
          if (myHillsStr) setMyHills(JSON.parse(myHillsStr));
          if (excludedHillsStr) setExcludedFromMyHills(JSON.parse(excludedHillsStr));
          if (repsStr) setSessionRepsState(JSON.parse(repsStr));
          if (effortsStr) setSessionEffortsState(JSON.parse(effortsStr));
          // Day assignment overrides stored separately (added after initial multiGet was frozen)
          const dayOverridesStr = await AsyncStorage.getItem(DAY_OVERRIDES_KEY);
          if (dayOverridesStr) setSessionDayOverridesState(JSON.parse(dayOverridesStr));
          if (hasViewedPlanStr === "true") setHasViewedPlan(true);
          if (achievementsStr) setUnlockedAchievements(JSON.parse(achievementsStr));
          if (completedGoalsStr) setCompletedGoals(JSON.parse(completedGoalsStr));
          // Fetch Alpine profile in background if not already stored
          if (goal.difficulty === "Alpine" && !goal.alpineProfile) {
            setAlpineProfileLoading(true);
            fetchAlpineAssessment(goal.mountainName, goal.highestAltitude).then(async (profile) => {
              if (profile) {
                setSummitGoalState(prev => prev ? { ...prev, alpineProfile: profile } : prev);
                const gs = await AsyncStorage.getItem(GOAL_KEY);
                if (gs) {
                  const g = JSON.parse(gs) as SummitGoal;
                  await AsyncStorage.setItem(GOAL_KEY, JSON.stringify({ ...g, alpineProfile: profile }));
                }
              }
              setAlpineProfileLoading(false);
            });
          }
        }
        // No else — fresh users start from the landing page with no pre-loaded data

        if (appModeStr) setAppModeState(appModeStr as "summit" | "explore");
        // loadedHikes already parsed and migrated above (before readiness calculation)
        if (loadedHikes.length > 0) setExploreHikes(loadedHikes);
        if (savedTrailsStr) setSavedTrailIds(JSON.parse(savedTrailsStr) as string[]);
        if (completedTrailsStr) setCompletedTrailIds(JSON.parse(completedTrailsStr) as string[]);
        if (customRoutesStr) setCustomRoutes(JSON.parse(customRoutesStr) as Trail[]);
      } catch {}
      setIsLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, _uid]);

  const setSummitGoal = useCallback(async (goal: SummitGoal) => {
    // Archive the outgoing goal + its training stats before wiping
    if (summitGoal && sessions.length > 0) {
      const archived: CompletedGoal = {
        mountainName: summitGoal.mountainName,
        elevationGain: summitGoal.elevationGain,
        highestAltitude: summitGoal.highestAltitude,
        difficulty: summitGoal.difficulty,
        completedAt: new Date().toISOString().split("T")[0],
        sessionsLogged: sessions.length,
        totalElevationTrained: sessions.reduce((sum, s) => sum + s.elevationGain, 0),
        trainingWeeks: trainingPlan.length,
      };
      const updatedHistory = [...completedGoals, archived];
      setCompletedGoals(updatedHistory);
      await AsyncStorage.setItem(COMPLETED_GOALS_KEY, JSON.stringify(updatedHistory));
    }
    const plan = generatePlan(goal);
    void logTrainingPlanGenerated({ mountain_name: goal.mountainName, weeks: plan.length });
    // Consume any past hikes saved during the "Catch me up" onboarding step
    const _pendingStr = await AsyncStorage.getItem(_PENDING_KEY);
    const _pendingHikes: PastHike[] = _pendingStr ? (JSON.parse(_pendingStr) as PastHike[]) : [];
    const initialSessions: Session[] = _pendingHikes.map((hike, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - hike.monthsAgo);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
      return {
        id: `past_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        type: "hill" as const,
        date: dateStr,
        distance: hike.distance,
        elevationGain: hike.elevationGain,
        duration: Math.round(hike.distance * 20 + hike.elevationGain / 20),
        effort: 4 as const,
        notes: `Past summit: ${hike.name}`,
        completed: true,
        weekNumber: 0,
        hillName: hike.name,
      };
    });
    setSummitGoalState(goal);
    setTrainingPlan(plan);
    // Reset ALL session data, seeding any past-activity hikes from onboarding
    setSessions(initialSessions);
    setCompletedPlanSessions({});
    setAssignedHills({});
    setSubmittedPlanSessions({});
    setHillsInPlan([]);
    setSessionRepsState({});
    setSessionEffortsState({});
    setPlanAdjustNote(null);
    // Reset plan-viewed flag so user sees their new plan before upgrade prompts
    setHasViewedPlan(false);
    const score = calculateReadiness(goal, plan, initialSessions, { completedGoals, exploreHikes });
    setReadinessScore(score);
    setUnlockedAchievements([]);
    setNewlyUnlocked([]);
    await AsyncStorage.multiSet([
      [GOAL_KEY, JSON.stringify(goal)],
      [PLAN_KEY, JSON.stringify(plan)],
      [SESSIONS_KEY, JSON.stringify(initialSessions)],
      [COMPLETED_KEY, "{}"],
      [ASSIGNED_KEY, "{}"],
      [SUBMITTED_KEY, "{}"],
      [HILLS_IN_PLAN_KEY, "[]"],
      [ADJUST_NOTE_KEY, ""],
      [REPS_KEY, "{}"],
      [HAS_VIEWED_PLAN_KEY, "false"],
      [ACHIEVEMENTS_KEY, "[]"],
      [EXCLUDED_HILLS_KEY, "[]"],
    ]);
    setExcludedFromMyHills([]);
    // Clear pending key and mark past-hike trails completed
    if (_pendingStr) {
      await AsyncStorage.removeItem(_PENDING_KEY);
      const newTrailIds = _pendingHikes
        .filter(h => h.trailId && !completedTrailIds.includes(h.trailId))
        .map(h => h.trailId!);
      if (newTrailIds.length > 0) {
        const updatedTrails = [...completedTrailIds, ...newTrailIds];
        setCompletedTrailIds(updatedTrails);
        await AsyncStorage.setItem(COMPLETED_TRAILS_KEY, JSON.stringify(updatedTrails));
      }
    }
    // Fire-and-forget Alpine profile fetch — doesn't block the goal save
    if (goal.difficulty === "Alpine") {  
      setAlpineProfileLoading(true);
      fetchAlpineAssessment(goal.mountainName, goal.highestAltitude).then(async (profile) => {
        if (profile) {
          setSummitGoalState(prev => prev ? { ...prev, alpineProfile: profile } : prev);
          const gs = await AsyncStorage.getItem(GOAL_KEY);
          if (gs) {
            const g = JSON.parse(gs) as SummitGoal;
            await AsyncStorage.setItem(GOAL_KEY, JSON.stringify({ ...g, alpineProfile: profile }));
          }
        }
        setAlpineProfileLoading(false);
      });
    }
  }, [summitGoal, sessions, trainingPlan, completedGoals]);

  const changeSummit = useCallback(async (goal: SummitGoal) => {
    // Update the summit target WITHOUT archiving the old goal or clearing sessions.
    // Existing logged sessions are preserved — only the plan is regenerated.
    const plan = generatePlan(goal);
    void logTrainingPlanGenerated({ mountain_name: goal.mountainName, weeks: plan.length });
    setSummitGoalState(goal);
    setTrainingPlan(plan);
    // Reset plan-tracking state (old tick-marks don't map to the new plan)
    setCompletedPlanSessions({});
    setAssignedHills({});
    setSubmittedPlanSessions({});
    setHillsInPlan([]);
    setSessionRepsState({});
    setSessionEffortsState({});
    setPlanAdjustNote(null);
    setHasViewedPlan(false);
    // Recalculate readiness with existing sessions against the new goal
    const score = calculateReadiness(goal, plan, sessions, { completedGoals, exploreHikes });
    setReadinessScore(score);
    await AsyncStorage.multiSet([
      [GOAL_KEY, JSON.stringify(goal)],
      [PLAN_KEY, JSON.stringify(plan)],
      [COMPLETED_KEY, "{}"],
      [ASSIGNED_KEY, "{}"],
      [SUBMITTED_KEY, "{}"],
      [HILLS_IN_PLAN_KEY, "[]"],
      [ADJUST_NOTE_KEY, ""],
      [REPS_KEY, "{}"],
      [HAS_VIEWED_PLAN_KEY, "false"],
      [EXCLUDED_HILLS_KEY, "[]"],
    ]);
    setExcludedFromMyHills([]);
    // Fire-and-forget Alpine profile fetch
    if (goal.difficulty === "Alpine") {
      setAlpineProfileLoading(true);
      fetchAlpineAssessment(goal.mountainName, goal.highestAltitude).then(async (profile) => {
        if (profile) {
          setSummitGoalState(prev => prev ? { ...prev, alpineProfile: profile } : prev);
          const gs = await AsyncStorage.getItem(GOAL_KEY);
          if (gs) {
            const g = JSON.parse(gs) as SummitGoal;
            await AsyncStorage.setItem(GOAL_KEY, JSON.stringify({ ...g, alpineProfile: profile }));
          }
        }
        setAlpineProfileLoading(false);
      });
    }
  }, [sessions, completedGoals]);

  const clearNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked([]);
  }, []);

  const patchGoal = useCallback(async (updates: Partial<SummitGoal>) => {
    if (!summitGoal) return;
    const updated = { ...summitGoal, ...updates };
    setSummitGoalState(updated);
    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(updated));
  }, [summitGoal]);

  const checkAndNotifyAchievements = useCallback(async (
    updatedSessions: Session[],
    score: number,
    submitted: Record<string, boolean>,
    alreadyUnlocked: string[],
    hikes: ExploreHike[] = [],
  ) => {
    const weekNums = new Set(
      Object.keys(submitted).filter(k => submitted[k]).map(k => k.split("-")[0])
    );
    const computed = computeUnlocked(updatedSessions, score, weekNums.size, hikes);
    const prev = new Set(alreadyUnlocked);
    const newly: string[] = [];
    for (const id of computed) {
      if (!prev.has(id)) newly.push(id);
    }
    if (newly.length > 0) {
      const all = [...alreadyUnlocked, ...newly];
      setUnlockedAchievements(all);
      setNewlyUnlocked(newly);
      await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(all));
    }
  }, []);

  const clearScoreStagnation = useCallback(() => setScoreStagnation(null), []);

  const addSession = useCallback(async (session: Omit<Session, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const newSession: Session = { ...session, id };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    const oldScore = readinessScore;
    let score = readinessScore;
    if (summitGoal) {
      score = calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes });
      setReadinessScore(score);
      if (score > oldScore) {
        void logReadinessScoreImproved({ readiness_score: score, previous_score: oldScore });
      }
      // Show a why-didn't-my-score-improve popup for completed sessions
      if (session.completed && score <= oldScore) {
        const insight = diagnoseScoreStagnation(summitGoal, updated, exploreHikes, oldScore, score);
        if (insight) setScoreStagnation(insight);
      }
    }
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    checkAndNotifyAchievements(updated, score, submittedPlanSessions, unlockedAchievements, exploreHikes);
  }, [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, readinessScore, submittedPlanSessions, unlockedAchievements, exploreHikes, checkAndNotifyAchievements]);

  const updateSession = useCallback(async (id: string, updates: Partial<Session>) => {
    const updated = sessions.map(s => s.id === id ? { ...s, ...updates } : s);
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes }));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }, [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, exploreHikes]);

  const deleteSession = useCallback(async (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes }));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }, [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, exploreHikes]);

  const clearPlan = useCallback(async () => {
    setSummitGoalState(null);
    setTrainingPlan([]);
    setSessions([]);
    setNearbyHills([]);
    setCompletedPlanSessions({});
    setAssignedHills({});
    setSubmittedPlanSessions({});
    setHillsInPlan([]);
    setSessionRepsState({});
    setSessionEffortsState({});
    setPlanAdjustNote(null);
    setReadinessScore(0);
    setHasViewedPlan(false);
    setUnlockedAchievements([]);
    setNewlyUnlocked([]);
    setCompletedGoals([]);
    setAppModeState(null);
    setSavedTrailIds([]);
    setCompletedTrailIds([]);
    setCustomRoutes([]);
    setExploreHikes([]);
    setMyHills([]);
    setExcludedFromMyHills([]);
    await AsyncStorage.multiRemove([
      GOAL_KEY, SESSIONS_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY, REPS_KEY, EFFORTS_KEY, HAS_VIEWED_PLAN_KEY, ACHIEVEMENTS_KEY, COMPLETED_GOALS_KEY, APP_MODE_KEY, EXPLORE_HIKES_KEY, SAVED_TRAILS_KEY, COMPLETED_TRAILS_KEY, CUSTOM_ROUTES_KEY, MY_HILLS_KEY, EXCLUDED_HILLS_KEY, "summitready_questionnaire_data", "summitready_challenges",
    ]);
  }, []);

  const seedPastActivity = useCallback(async (hikes: PastHike[]) => {
    if (hikes.length === 0) return;
    const newSessions: Session[] = hikes.map((hike, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - hike.monthsAgo);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
      return {
        id: `past_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        type: "hill" as const,
        date: dateStr,
        distance: hike.distance,
        elevationGain: hike.elevationGain,
        duration: Math.round(hike.distance * 20 + hike.elevationGain / 20),
        effort: 4 as const,
        notes: `Past summit: ${hike.name}`,
        completed: true,
        weekNumber: 0,
        hillName: hike.name,
      };
    });
    const updated = [...newSessions, ...sessions];
    setSessions(updated);
    if (summitGoal) {
      setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes }));
    }
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    const newTrailIds = hikes
      .filter(h => h.trailId && !completedTrailIds.includes(h.trailId))
      .map(h => h.trailId!);
    if (newTrailIds.length > 0) {
      const updatedTrails = [...completedTrailIds, ...newTrailIds];
      setCompletedTrailIds(updatedTrails);
      await AsyncStorage.setItem(COMPLETED_TRAILS_KEY, JSON.stringify(updatedTrails));
    }
  }, [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, completedTrailIds]);

  const setAppMode = useCallback(async (mode: "summit" | "explore") => {
    setAppModeState(mode);
    await AsyncStorage.setItem(APP_MODE_KEY, mode);
  }, []);

  const logExploreHike = useCallback(async (hike: Omit<ExploreHike, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    const newHike: ExploreHike = { ...hike, id };
    const updated = [newHike, ...exploreHikes];
    setExploreHikes(updated);
    await AsyncStorage.setItem(EXPLORE_HIKES_KEY, JSON.stringify(updated));
    const oldScore = readinessScore;
    let score = readinessScore;
    if (summitGoal) {
      score = calculateReadiness(summitGoal, trainingPlan, sessions, { sessionReps, assignedHills, completedGoals, exploreHikes: updated });
      setReadinessScore(score);
      if (score > oldScore) {
        void logReadinessScoreImproved({ readiness_score: score, previous_score: oldScore });
      }
      if (score <= oldScore) {
        const insight = diagnoseScoreStagnation(summitGoal, sessions, updated, oldScore, score);
        if (insight) setScoreStagnation(insight);
      }
    }
    checkAndNotifyAchievements(sessions, score, submittedPlanSessions, unlockedAchievements, updated);
  }, [exploreHikes, sessions, readinessScore, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, submittedPlanSessions, unlockedAchievements, checkAndNotifyAchievements]);

  const deleteExploreHike = useCallback(async (id: string) => {
    const updated = exploreHikes.filter(h => h.id !== id);
    setExploreHikes(updated);
    await AsyncStorage.setItem(EXPLORE_HIKES_KEY, JSON.stringify(updated));
  }, [exploreHikes]);

  const saveTrail = useCallback(async (id: string) => {
    const updated = savedTrailIds.includes(id) ? savedTrailIds : [...savedTrailIds, id];
    setSavedTrailIds(updated);
    await AsyncStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(updated));
  }, [savedTrailIds]);

  const unsaveTrail = useCallback(async (id: string) => {
    const updated = savedTrailIds.filter(s => s !== id);
    setSavedTrailIds(updated);
    await AsyncStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(updated));
  }, [savedTrailIds]);

  const completeTrail = useCallback(async (id: string) => {
    const updated = completedTrailIds.includes(id) ? completedTrailIds : [...completedTrailIds, id];
    setCompletedTrailIds(updated);
    await AsyncStorage.setItem(COMPLETED_TRAILS_KEY, JSON.stringify(updated));
  }, [completedTrailIds]);

  const uncompleteTrail = useCallback(async (id: string) => {
    const updated = completedTrailIds.filter(c => c !== id);
    setCompletedTrailIds(updated);
    await AsyncStorage.setItem(COMPLETED_TRAILS_KEY, JSON.stringify(updated));
  }, [completedTrailIds]);

  const addCustomRoute = useCallback(async (route: Omit<Trail, "id" | "isCustom" | "createdAt">) => {
    const id = "custom_" + Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const newRoute: Trail = { ...route, id, isCustom: true, createdAt: new Date().toISOString().split("T")[0] };
    const updated = [newRoute, ...customRoutes];
    setCustomRoutes(updated);
    await AsyncStorage.setItem(CUSTOM_ROUTES_KEY, JSON.stringify(updated));
  }, [customRoutes]);

  const deleteCustomRoute = useCallback(async (id: string) => {
    const updated = customRoutes.filter(r => r.id !== id);
    setCustomRoutes(updated);
    await AsyncStorage.setItem(CUSTOM_ROUTES_KEY, JSON.stringify(updated));
  }, [customRoutes]);

  const markPlanViewed = useCallback(async () => {
    if (hasViewedPlan) return;
    setHasViewedPlan(true);
    await AsyncStorage.setItem(HAS_VIEWED_PLAN_KEY, "true");
  }, [hasViewedPlan]);

  const fetchNearbyHills = useCallback(async (radiusOverride?: number, minElevation?: number, locationOverride?: string) => {
    const location = locationOverride ?? summitGoal?.location;
    if (!location?.trim()) {
      setHillsError("Enter a location above to find hills nearby.");
      return;
    }
    setHillsLoading(true);
    setHillsError(null);
    try {
      const radius = radiusOverride ?? summitGoal?.maxRadius ?? 25;
      const body: Record<string, unknown> = { location: location.trim(), radius };
      if (minElevation && minElevation > 0) body.minElevation = minElevation;
      const res = await fetch(`${API_BASE}/hills-unified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: { hills: NearbyHill[] } = await res.json();
      if (!data.hills?.length) {
        setHillsError("No hills found in that area. Try increasing the search radius.");
        setNearbyHills([]);
      } else {
        setNearbyHills(data.hills);
        await AsyncStorage.setItem(HILLS_KEY, JSON.stringify(data.hills));
      }
    } catch (err) {
      setHillsError("Couldn't connect — check your internet and try again.");
    }
    setHillsLoading(false);
  }, [summitGoal]);

  const togglePlanSession = useCallback(async (weekNum: number, sessionIdx: number) => {
    const key = `${weekNum}-${sessionIdx}`;
    const updated = { ...completedPlanSessions, [key]: !completedPlanSessions[key] };
    setCompletedPlanSessions(updated);
    // Recalculate readiness in real-time using checked-but-not-submitted sessions as virtual progress
    if (summitGoal) {
      const virtualCount = Object.keys(updated).filter(k => updated[k] && !submittedPlanSessions[k]).length;
      setReadinessScore(calculateReadiness(summitGoal, trainingPlan, sessions, { virtualSessionCount: virtualCount, sessionReps, assignedHills, completedGoals, exploreHikes }));
    }
    await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(updated));
  }, [completedPlanSessions, submittedPlanSessions, summitGoal, trainingPlan, sessions, sessionReps, assignedHills, completedGoals, exploreHikes]);

  const assignHillToSession = useCallback(async (weekNum: number, sessionIdx: number, hill: NearbyHill) => {
    const key = `${weekNum}-${sessionIdx}`;
    const updated = { ...assignedHills, [key]: hill };
    setAssignedHills(updated);
    await AsyncStorage.setItem(ASSIGNED_KEY, JSON.stringify(updated));
  }, [assignedHills]);

  function parseDuration(dur: string): number {
    if (dur.includes("hour")) {
      const m = dur.match(/(\d+)[–\-](\d+)/);
      return m ? Math.round(((+m[1]) + (+m[2])) / 2 * 60) : 180;
    }
    const m = dur.match(/(\d+)[–\-](\d+)/);
    return m ? Math.round(((+m[1]) + (+m[2])) / 2) : 60;
  }

  const submitWeekSessions = useCallback(async (weekNum: number): Promise<number> => {
    const week = trainingPlan.find(w => w.weekNumber === weekNum);
    if (!week || !summitGoal) return 0;

    const toSubmit: Session[] = [];
    const newSubmitted = { ...submittedPlanSessions };
    const weekStart = new Date(week.startDate);

    week.sessions.forEach((s, i) => {
      const key = `${weekNum}-${i}`;
      if (completedPlanSessions[key] && !submittedPlanSessions[key]) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i * 2);

        // For hill/bigDay sessions use logged reps × elevation per rep if available,
        // otherwise fall back to the plan's target elevation.
        // For gym cardio sessions use logged km/floors to derive elevation.
        let elevationGain = s.targetElevation;
        const loggedReps = sessionReps[key];
        const hill = assignedHills[key] ?? week.hills[0] ?? null;
        if (loggedReps !== undefined && (s.type === "hill" || s.type === "bigDay")) {
          const elevPerRep = hill ? hill.elevation : Math.max(50, Math.round(s.targetElevation / 4));
          elevationGain = loggedReps * elevPerRep;
        } else if (loggedReps !== undefined && s.type === "cardio" && s.gymExercise === "treadmill") {
          const incline = s.inclinePct ?? 10;
          elevationGain = Math.round(loggedReps * (incline / 100) * 1000);
        } else if (loggedReps !== undefined && s.type === "cardio" && s.gymExercise === "stepper") {
          elevationGain = Math.round(loggedReps * 3);
        } else if (loggedReps !== undefined && s.type === "cardio" && !s.gymExercise && s.targetFlights !== undefined) {
          elevationGain = Math.round(loggedReps * 3);
        }

        const storedEffort = sessionEfforts[key];
        const distanceKm = s.type === "cardio" && s.gymExercise === "treadmill" && loggedReps !== undefined
          ? loggedReps
          : s.type === "cardio" ? 5 : s.type === "hill" ? 6 : 10;

        let notes = `Submitted from plan: ${s.label}`;
        if (loggedReps !== undefined && (s.type === "hill" || s.type === "bigDay")) {
          notes = `Submitted from plan: ${s.label} (${loggedReps} rep${loggedReps !== 1 ? "s" : ""} logged)`;
        } else if (loggedReps !== undefined && s.type === "cardio" && s.gymExercise === "treadmill") {
          notes = `Submitted from plan: ${s.label} (${loggedReps.toFixed(1)}km done)`;
        } else if (loggedReps !== undefined && s.type === "cardio" && s.gymExercise === "stepper") {
          notes = `Submitted from plan: ${s.label} (${loggedReps} floors done)`;
        } else if (loggedReps !== undefined && s.type === "cardio" && !s.gymExercise && s.targetFlights !== undefined) {
          notes = `Submitted from plan: ${s.label} (${loggedReps} flight${loggedReps !== 1 ? "s" : ""} done)`;
        }

        toSubmit.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 6) + i,
          type: s.type,
          date: d.toISOString().split("T")[0],
          distance: distanceKm,
          elevationGain,
          duration: parseDuration(s.duration),
          effort: (storedEffort ?? 3) as 1 | 2 | 3 | 4 | 5,
          notes,
          completed: true,
          weekNumber: weekNum,
          hillName: hill?.name ?? undefined,
        });
        newSubmitted[key] = true;
      }
    });

    if (toSubmit.length === 0) return 0;

    const updated = [...toSubmit, ...sessions];
    setSessions(updated);
    setSubmittedPlanSessions(newSubmitted);
    const score = calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes });
    setReadinessScore(score);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(SUBMITTED_KEY, JSON.stringify(newSubmitted));
    checkAndNotifyAchievements(updated, score, newSubmitted, unlockedAchievements, exploreHikes);
    return toSubmit.length;
  }, [trainingPlan, sessions, summitGoal, completedPlanSessions, submittedPlanSessions, sessionReps, assignedHills, completedGoals, unlockedAchievements, exploreHikes, checkAndNotifyAchievements]);

  // Auto-sync hills from the training plan into My Hills.
  // Runs whenever the plan changes (new goal, AI adjustment, plan loaded from storage).
  // Uses TrainingWeek.hills which is populated by the plan generator with name/elevation/distance/repeats/lat/lng.
  useEffect(() => {
    if (trainingPlan.length === 0) return;

    const planHills: NearbyHill[] = [];
    const seen = new Set<string>();

    for (const week of trainingPlan) {
      for (const h of (week.hills ?? [])) {
        if (h.name && !seen.has(h.name)) {
          seen.add(h.name);
          planHills.push({
            name:           h.name,
            elevation:      h.elevation,
            distance:       h.distance,
            repeats:        h.repeats,
            totalElevation: h.totalElevation,
            surface:        "mixed",
            grade:          h.elevation > 200 ? "steep" : "moderate",
            emoji:          "⛰️",
            lat:            h.lat,
            lng:            h.lng,
          });
        }
      }
    }

    if (planHills.length === 0) return;

    setMyHills(prev => {
      const existingNames = new Set(prev.map(h => h.name));
      const excluded = new Set(excludedFromMyHills);
      const newHills = planHills.filter(h => !existingNames.has(h.name) && !excluded.has(h.name));
      if (newHills.length === 0) return prev;
      const updated = [...prev, ...newHills];
      AsyncStorage.setItem(MY_HILLS_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [trainingPlan, excludedFromMyHills]);

  const addToMyHills = useCallback(async (hill: NearbyHill) => {
    const updated = myHills.some(h => h.name === hill.name)
      ? myHills
      : [...myHills, hill];
    setMyHills(updated);
    await AsyncStorage.setItem(MY_HILLS_KEY, JSON.stringify(updated));
  }, [myHills]);

  const removeFromMyHills = useCallback(async (hillName: string) => {
    const updated = myHills.filter(h => h.name !== hillName);
    setMyHills(updated);
    const updatedExcluded = excludedFromMyHills.includes(hillName)
      ? excludedFromMyHills
      : [...excludedFromMyHills, hillName];
    setExcludedFromMyHills(updatedExcluded);
    await AsyncStorage.multiSet([
      [MY_HILLS_KEY, JSON.stringify(updated)],
      [EXCLUDED_HILLS_KEY, JSON.stringify(updatedExcluded)],
    ]);
  }, [myHills, excludedFromMyHills]);

  const addHillToPlan = useCallback(async (hill: NearbyHill) => {
    if (!summitGoal) return;

    const updatedInPlan = hillsInPlan.includes(hill.name)
      ? hillsInPlan
      : [...hillsInPlan, hill.name];
    setHillsInPlan(updatedInPlan);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updatedPlan = trainingPlan.map(week => {
      if (new Date(week.endDate) < today) return week;

      const updatedSessions = week.sessions.map(s => {
        if (s.type !== "hill") return s;
        // Calculate reps based on this week's elevation target (50% for hill session),
        // not a fixed hill.repeats floor — avoids over-loading base-phase weeks.
        const weekHillTarget = Math.round(week.targetElevation * 0.5);
        const sessionRepsCount = Math.max(1, Math.ceil(weekHillTarget / hill.elevation));
        const sessionElev = sessionRepsCount * hill.elevation;
        const pct = Math.round((sessionElev / (summitGoal?.elevationGain ?? sessionElev)) * 100);
        return {
          ...s,
          targetElevation: sessionElev,
          label: `Hill Repeats — ${hill.name}`,
          description: `${hill.name} (${hill.elevation}m per climb × ${sessionRepsCount} reps = ${sessionElev}m) — ${pct}% of your summit's ${summitGoal?.elevationGain ?? sessionElev}m elevation gain. ${hill.distance}km away. Walk or run up, walk down for recovery.`,
        };
      });

      const existingHills = week.hills.filter(h => h.name !== hill.name);
      const weekHills = [...existingHills, {
        name: hill.name,
        elevation: hill.elevation,
        distance: hill.distance,
        repeats: hill.repeats,
        totalElevation: hill.totalElevation,
      }];

      const sessionTotal = updatedSessions.reduce((acc, s) => acc + s.targetElevation, 0);

      return {
        ...week,
        sessions: updatedSessions,
        hills: weekHills,
        targetElevation: sessionTotal || week.targetElevation,
        adjustNote: `Recalculated for ${hill.name} (${hill.elevation}m × reps scaled to week target)`,
      };
    });

    setTrainingPlan(updatedPlan);
    setReadinessScore(calculateReadiness(summitGoal, updatedPlan, sessions, { sessionReps, assignedHills, completedGoals, exploreHikes }));
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updatedPlan));
    await AsyncStorage.setItem(HILLS_IN_PLAN_KEY, JSON.stringify(updatedInPlan));
  }, [summitGoal, trainingPlan, sessions, hillsInPlan, sessionReps, assignedHills, completedGoals, exploreHikes]);

  const addToNearbyHills = useCallback(async (hill: NearbyHill) => {
    // Avoid duplicates by name
    const already = nearbyHills.some(h => h.name.toLowerCase() === hill.name.toLowerCase());
    const updated = already ? nearbyHills : [hill, ...nearbyHills];
    setNearbyHills(updated);
    await AsyncStorage.setItem(HILLS_KEY, JSON.stringify(updated));
  }, [nearbyHills]);

  const updateGoalLocation = useCallback(async (location: string) => {
    if (!summitGoal) return;
    const updated = { ...summitGoal, location };
    setSummitGoalState(updated);
    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(updated));
  }, [summitGoal]);

  const setSessionReps = useCallback(async (key: string, reps: number) => {
    // Allow zero to clear an entry (shows "–" again); negative values treated as zero.
    let updated: Record<string, number>;
    if (reps <= 0) {
      const { [key]: _removed, ...rest } = sessionReps;
      updated = rest;
    } else {
      updated = { ...sessionReps, [key]: reps };
    }
    setSessionRepsState(updated);
    // Recalculate readiness immediately so the score updates as exercise is logged.
    if (summitGoal) {
      const virtualCount = Object.keys(completedPlanSessions)
        .filter(k => completedPlanSessions[k] && !submittedPlanSessions[k]).length;
      setReadinessScore(
        calculateReadiness(summitGoal, trainingPlan, sessions, {
          virtualSessionCount: virtualCount,
          sessionReps: updated,
          assignedHills,
          completedGoals,
          exploreHikes,
        }),
      );
    }
    await AsyncStorage.setItem(REPS_KEY, JSON.stringify(updated));
  }, [sessionReps, summitGoal, trainingPlan, sessions, completedPlanSessions, submittedPlanSessions, assignedHills, completedGoals, exploreHikes]);

  const setSessionEffort = useCallback(async (key: string, effort: 1 | 2 | 3 | 4 | 5) => {
    const updated = { ...sessionEfforts, [key]: effort };
    setSessionEffortsState(updated);
    await AsyncStorage.setItem(EFFORTS_KEY, JSON.stringify(updated));
  }, [sessionEfforts]);

  const setSessionDayOverride = useCallback(async (weekNum: number, sessionIdx: number, dow: number) => {
    const key = `${weekNum}-${sessionIdx}`;
    const updated = { ...sessionDayOverrides, [key]: dow };
    setSessionDayOverridesState(updated);
    await AsyncStorage.setItem(DAY_OVERRIDES_KEY, JSON.stringify(updated));
  }, [sessionDayOverrides, DAY_OVERRIDES_KEY]);

  const clearSessionDayOverride = useCallback(async (weekNum: number, sessionIdx: number) => {
    const key = `${weekNum}-${sessionIdx}`;
    const { [key]: _removed, ...rest } = sessionDayOverrides;
    setSessionDayOverridesState(rest);
    await AsyncStorage.setItem(DAY_OVERRIDES_KEY, JSON.stringify(rest));
  }, [sessionDayOverrides, DAY_OVERRIDES_KEY]);

  const updatePlanSession = useCallback(async (
    weekNum: number,
    sessionIdx: number,
    updates: Partial<Pick<PlanSession, "type" | "label" | "description" | "duration" | "targetElevation" | "gymExercise" | "targetDistanceKm" | "targetFloors" | "targetFlights" | "inclinePct">>
  ) => {
    const updatedPlan = trainingPlan.map(week => {
      if (week.weekNumber !== weekNum) return week;
      const updatedSessions = week.sessions.map((s, i) =>
        i === sessionIdx ? { ...s, ...updates } : s
      );
      return { ...week, sessions: updatedSessions };
    });
    setTrainingPlan(updatedPlan);
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updatedPlan));
  }, [trainingPlan]);

  const adjustPlanWithAI = useCallback(async () => {
    if (!summitGoal || trainingPlan.length === 0) return;
    setPlanAdjusting(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentWeek = trainingPlan.find(w =>
      new Date(w.startDate) <= today && new Date(w.endDate) >= today
    ) ?? trainingPlan[0];

    const currentWeekNum = currentWeek?.weekNumber ?? 1;

    const pastAndCurrentWeeks = trainingPlan.filter(w => w.weekNumber <= currentWeekNum);
    const totalScheduled = pastAndCurrentWeeks.reduce((acc, w) => acc + w.sessions.length, 0);
    const completedCount = Object.values(completedPlanSessions).filter(Boolean).length;

    const remainingWeeks = trainingPlan
      .filter(w => new Date(w.endDate) >= today)
      .map(w => ({
        weekNumber: w.weekNumber,
        phase: w.phase,
        targetElevation: w.targetElevation,
        purpose: w.purpose,
      }));

    try {
      const res = await fetch(`${API_BASE}/adjust-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summitGoal,
          completedCount,
          totalScheduled,
          currentWeekNumber: currentWeekNum,
          remainingWeeks,
        }),
      });

      if (!res.ok) throw new Error("Adjust plan failed");

      const data: {
        overallNote: string;
        adjustedWeeks: { weekNumber: number; targetElevation: number; purpose: string; note?: string }[];
      } = await res.json();

      const adjustMap = new Map(data.adjustedWeeks.map(w => [w.weekNumber, w]));
      const updatedPlan = trainingPlan.map(week => {
        const adj = adjustMap.get(week.weekNumber);
        if (!adj) return week;
        return {
          ...week,
          targetElevation: adj.targetElevation,
          purpose: adj.purpose,
          adjustNote: adj.note,
        };
      });

      setTrainingPlan(updatedPlan);
      setPlanAdjustNote(data.overallNote);
      await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updatedPlan));
      await AsyncStorage.setItem(ADJUST_NOTE_KEY, data.overallNote);
    } catch {
      setPlanAdjustNote("AI coaching couldn't update your plan right now. Check your connection and try again later.");
    }
    setPlanAdjusting(false);
  }, [summitGoal, trainingPlan, completedPlanSessions]);

  return (
    <AppContext.Provider value={{
      summitGoal, trainingPlan, sessions, readinessScore, isLoading,
      nearbyHills, hillsLoading, hillsError, alpineProfileLoading, completedPlanSessions, assignedHills,
      planAdjusting, planAdjustNote, submittedPlanSessions, sessionReps,
      hasViewedPlan, markPlanViewed,
      setSummitGoal, changeSummit, addSession, updateSession, deleteSession, clearPlan, seedPastActivity,
      fetchNearbyHills, togglePlanSession, assignHillToSession, adjustPlanWithAI,
      submitWeekSessions, hillsInPlan, addHillToPlan, myHills, addToMyHills, removeFromMyHills, addToNearbyHills, updateGoalLocation, setSessionReps, setSessionEffort, sessionEfforts, sessionDayOverrides, setSessionDayOverride, clearSessionDayOverride, updatePlanSession,
      unlockedAchievements, newlyUnlocked, clearNewlyUnlocked,
      completedGoals,
      appMode, exploreHikes, setAppMode, logExploreHike, deleteExploreHike,
      savedTrailIds, completedTrailIds, customRoutes,
      saveTrail, unsaveTrail, completeTrail, uncompleteTrail, addCustomRoute, deleteCustomRoute,
      reloadApp,
      scoreStagnation, clearScoreStagnation,
      patchGoal,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
