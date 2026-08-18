import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { generatePlan, parseDurationMidpoint } from "@/utils/planGenerator";
import { calculateReadiness, diagnoseScoreStagnation, ScoreInsight } from "@/utils/readinessScore";
import { computeUnlocked } from "@/utils/achievements";
import { logTrainingPlanGenerated, logReadinessScoreImproved } from "@/lib/analytics";
import type { Trail } from "@/constants/trailData";
import {
  isTrainingActivity,
  selectExpeditionAscentsForTraining,
  type ExpeditionAscentMigrationSummary,
} from "@/utils/expeditionTrainingMigration";

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

export interface RouteDna {
  scrambling:         number; // 0-10
  exposure:           number;
  ridgeTravel:        number;
  endurance:          number;
  technicalMovement:  number;
  navigationRequired: number;
  steepness:          number;
  scenicQuality:      number;
  descentDifficulty:  number;
  sustainedClimbing:  number;
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
  /** Route DNA profile — character dimensions (0-10 each). Added in v2 of the expedition builder. */
  routeDna?: RouteDna;
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
  /**
   * Virtual / Expedition mode: the AI-designed mini expedition plan returned
   * by the Mountain Guide expedition builder. Stored for display and editing.
   * null when the legacy elevation calculator was used as fallback.
   */
  expeditionPlan?: {
    title:         string;
    concept:       string;
    days: Array<{
      label:  string;
      title:  string;
      focus:  string;
      routes: Array<{ name: string; why: string }>;
    }>;
    alternatives:  Record<string, string[]>;
    adventureScore: number;
    dnaMatchScore:  number;
    dnaMatchNotes:  string;
  } | null;
  /**
   * Virtual mode only: real outdoor hike progress logged by the user toward
   * their goal mountain's combined elevation and distance demands.
   */
  virtualHikeProgress?: {
    elevationGained: number;  // metres accumulated across logged hikes
    distanceCovered: number;  // km accumulated across logged hikes
    hikesLogged: number;      // total count of logged hikes
  };
  /** Expedition mode: routes the user has explicitly confirmed completing. */
  completedRoutes?: string[];
}

/**
 * A saved expedition in the user's Adventure Library.
 * Expedition-specific data extracted from SummitGoal and stored independently
 * so users can maintain many adventures simultaneously.
 * Every field answers: "Will this still be meaningful five years from now?"
 */
export interface SavedExpedition {
  id: string;
  /** Signature Challenge ID if sourced from the catalogue. */
  challengeId?: string;
  /** Display name of this expedition ("The Matterhorn Ridge Challenge"). */
  challengeName: string;
  /** Actual mountain name used for image API calls ("Matterhorn"). */
  targetMountainName: string;
  targetMountain?: TargetMountain;
  virtualHills: NearbyHill[];
  expeditionPlan?: SummitGoal["expeditionPlan"];
  simulationScore?: number;
  simulationScoreBreakdown?: SimulationScoreBreakdown;
  /** Routes the user has explicitly confirmed completing. */
  completedRoutes: string[];
  expeditionStatus: "saved" | "active" | "complete";
  virtualHikeProgress: {
    elevationGained: number;
    distanceCovered: number;
    hikesLogged: number;
  };
  /** User context needed when switching back to this expedition. */
  location: string;
  maxRadius: number;
  fitnessLevel: "Beginner" | "Average" | "Strong";
  /** When the user first saved this expedition to their library. */
  savedAt: string;
  /** When the user first began actively working on this expedition. */
  startedAt?: string;
  /** When the user completed this expedition. */
  completedAt?: string;
  /** Frozen snapshot recorded at the moment of completion. */
  completionStats?: {
    totalElevationM: number;
    totalDistanceKm: number;
    totalSessions: number;
    daysToComplete: number;
  };
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
  /** Stable key used to keep expedition stage completion retries idempotent. */
  expeditionStageKey?: string;
  /** Explicit opt-in marker allowing an expedition activity to count in Training. */
  trainingImportedAt?: string;
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
  /** Stable key used to keep expedition stage completion retries idempotent. */
  expeditionStageKey?: string;
  /** Explicit opt-in marker allowing an expedition activity to count in Training. */
  trainingImportedAt?: string;
}

export interface ExpeditionStageCompletionInput {
  expeditionId: string;
  stageName: string;
  session?: Omit<Session, "id">;
  hike?: Omit<ExploreHike, "id">;
}

export interface ExpeditionStageCompletionResult {
  status: "completed" | "already-completed" | "invalid-expedition" | "invalid-stage";
  isFinished: boolean;
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
  shellMode: "training" | "expedition";
  setShellMode: (mode: "training" | "expedition") => Promise<void>;
  /** The user's Adventure Library — all saved expeditions with their individual progress. */
  expeditions: SavedExpedition[];
  /** ID of the expedition currently in focus. Only one can be active at a time. */
  activeExpeditionId: string | null;
  /** Derived: the currently active SavedExpedition, or null if none. */
  activeExpedition: SavedExpedition | null;
  /**
   * Add an expedition to the library and make it active.
   * Does NOT reset sessions — the user's activity log is preserved across expedition switches.
   * Returns the new expedition's ID.
   */
  startExpedition: (data: Omit<SavedExpedition, "id" | "savedAt" | "completedRoutes" | "expeditionStatus" | "virtualHikeProgress">) => Promise<string>;
  /** Switch the active expedition to a different one in the library. Progress on all others is preserved. */
  setActiveExpedition: (id: string) => Promise<void>;
  /** Update fields on a saved expedition, syncing to summitGoal if it's the active one. */
  patchExpedition: (id: string, updates: Partial<SavedExpedition>) => Promise<void>;
  /** Idempotently complete one exact stage and persist its optional activity records together. */
  completeExpeditionStage: (
    input: ExpeditionStageCompletionInput,
  ) => Promise<ExpeditionStageCompletionResult>;
  /** Mark an expedition as complete and record its final stats. */
  completeExpedition: (id: string, stats?: SavedExpedition["completionStats"]) => Promise<void>;
  /** Find the most relevant expedition with completed ascent activity available to import. */
  getExpeditionAscentMigrationSummary: () => ExpeditionAscentMigrationSummary | null;
  /** Idempotently include an expedition's completed ascents in Training history/readiness. */
  importExpeditionAscents: (expeditionId: string) => Promise<ExpeditionAscentMigrationSummary>;
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
  shellMode: "training",
  setShellMode: async () => {},
  expeditions: [],
  activeExpeditionId: null,
  activeExpedition: null,
  startExpedition: async () => "",
  setActiveExpedition: async () => {},
  patchExpedition: async () => {},
  completeExpeditionStage: async () => ({ status: "invalid-expedition", isFinished: false }),
  completeExpedition: async () => {},
  getExpeditionAscentMigrationSummary: () => null,
  importExpeditionAscents: async expeditionId => ({
    expeditionId,
    expeditionName: "",
    ascentCount: 0,
    totalElevationM: 0,
    totalDistanceKm: 0,
  }),
});

const _FLAT_GOAL_KEY             = "summitready_goal";
const _FLAT_TRAINING_GOAL_KEY    = "summitready_training_goal";
const _FLAT_EXPEDITION_GOAL_KEY  = "summitready_expedition_goal";
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
const _FLAT_SHELL_MODE_KEY       = "summitready_shell_mode";
const _FLAT_EXPLORE_HIKES_KEY    = "summitready_explore_hikes";
const _FLAT_SAVED_TRAILS_KEY     = "summitready_saved_trails";
const _FLAT_COMPLETED_TRAILS_KEY = "summitready_completed_trails";
const _FLAT_CUSTOM_ROUTES_KEY    = "summitready_custom_routes";
const _FLAT_MY_HILLS_KEY         = "summitready_my_hills";
const _FLAT_EXCLUDED_HILLS_KEY   = "summitready_excluded_my_hills";
const _FLAT_DAY_OVERRIDES_KEY        = "summitready_session_day_overrides";
const _FLAT_EXPEDITIONS_KEY          = "summitready_expeditions";
const _FLAT_ACTIVE_EXPEDITION_KEY    = "summitready_active_expedition_id";

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

function isSameGoal(a: SummitGoal | null, b: SummitGoal): boolean {
  return !!a &&
    a.mountainName === b.mountainName &&
    a.summitDate === b.summitDate;
}

function parseStoredArray<T>(value: string | null, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
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
  const TRAINING_GOAL_KEY    = _uid ? `summitready_training_goal_${_uid}`           : _FLAT_TRAINING_GOAL_KEY;
  const EXPEDITION_GOAL_KEY  = _uid ? `summitready_expedition_goal_${_uid}`         : _FLAT_EXPEDITION_GOAL_KEY;
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
  const SHELL_MODE_KEY       = _uid ? `summitready_shell_mode_${_uid}`              : _FLAT_SHELL_MODE_KEY;
  const EXPLORE_HIKES_KEY    = _uid ? `summitready_explore_hikes_${_uid}`           : _FLAT_EXPLORE_HIKES_KEY;
  const SAVED_TRAILS_KEY     = _uid ? `summitready_saved_trails_${_uid}`            : _FLAT_SAVED_TRAILS_KEY;
  const COMPLETED_TRAILS_KEY = _uid ? `summitready_completed_trails_${_uid}`        : _FLAT_COMPLETED_TRAILS_KEY;
  const CUSTOM_ROUTES_KEY    = _uid ? `summitready_custom_routes_${_uid}`           : _FLAT_CUSTOM_ROUTES_KEY;
  const MY_HILLS_KEY         = _uid ? `summitready_my_hills_${_uid}`                : _FLAT_MY_HILLS_KEY;
  const EXCLUDED_HILLS_KEY      = _uid ? `summitready_excluded_my_hills_${_uid}`          : _FLAT_EXCLUDED_HILLS_KEY;
  const DAY_OVERRIDES_KEY       = _uid ? `summitready_session_day_overrides_${_uid}`      : _FLAT_DAY_OVERRIDES_KEY;
  const EXPEDITIONS_KEY         = _uid ? `summitready_expeditions_${_uid}`                : _FLAT_EXPEDITIONS_KEY;
  const ACTIVE_EXPEDITION_KEY   = _uid ? `summitready_active_expedition_id_${_uid}`       : _FLAT_ACTIVE_EXPEDITION_KEY;
  const _PENDING_KEY         = _uid ? `${PENDING_PAST_HIKES_KEY}_${_uid}`           : PENDING_PAST_HIKES_KEY;
  const [loadKey, setLoadKey] = useState(0);
  const [summitGoal, setSummitGoalState] = useState<SummitGoal | null>(null);
  const [trainingGoal, setTrainingGoalState] = useState<SummitGoal | null>(null);
  const [expeditionGoal, setExpeditionGoalState] = useState<SummitGoal | null>(null);
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
  const [shellMode, setShellModeState] = useState<"training" | "expedition">("training");
  const [expeditions, setExpeditions] = useState<SavedExpedition[]>([]);
  const [activeExpeditionId, setActiveExpeditionIdState] = useState<string | null>(null);
  const [exploreHikes, setExploreHikes] = useState<ExploreHike[]>([]);
  const [savedTrailIds, setSavedTrailIds] = useState<string[]>([]);
  const [completedTrailIds, setCompletedTrailIds] = useState<string[]>([]);
  const [customRoutes, setCustomRoutes] = useState<Trail[]>([]);
  const activityStorageQueue = useRef<Promise<void>>(Promise.resolve());
  const enqueueActivityStorageMutation = useCallback(<T,>(
    operation: () => Promise<T>,
  ): Promise<T> => {
    const queued = activityStorageQueue.current.then(operation, operation);
    activityStorageQueue.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  const applyAlpineProfile = useCallback(async (
    scope: "training" | "expedition",
    requestedGoal: SummitGoal,
    profile: AlpineProfile,
  ) => {
    const scopedGoalKey = scope === "expedition"
      ? EXPEDITION_GOAL_KEY
      : TRAINING_GOAL_KEY;
    const storedGoalStr = await AsyncStorage.getItem(scopedGoalKey);
    if (!storedGoalStr) return;

    const storedGoal = JSON.parse(storedGoalStr) as SummitGoal;
    if (!isSameGoal(storedGoal, requestedGoal)) return;

    const enrichedGoal = { ...storedGoal, alpineProfile: profile };
    await AsyncStorage.setItem(scopedGoalKey, JSON.stringify(enrichedGoal));

    if (scope === "expedition") {
      setExpeditionGoalState(prev =>
        isSameGoal(prev, requestedGoal) ? enrichedGoal : prev
      );
    } else {
      setTrainingGoalState(prev =>
        isSameGoal(prev, requestedGoal) ? enrichedGoal : prev
      );
    }

    // The user may have switched shells while the request was in flight.
    // Only touch the public active snapshot when this scope is still active.
    const persistedShellMode = await AsyncStorage.getItem(SHELL_MODE_KEY);
    const activeScope = persistedShellMode === "expedition"
      ? "expedition"
      : "training";
    if (activeScope !== scope) return;

    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(enrichedGoal));
    setSummitGoalState(prev =>
      isSameGoal(prev, requestedGoal) ? enrichedGoal : prev
    );
  }, [GOAL_KEY, TRAINING_GOAL_KEY, EXPEDITION_GOAL_KEY, SHELL_MODE_KEY]);

  const reloadApp = useCallback(async () => {
    setSummitGoalState(null);
    setTrainingGoalState(null);
    setExpeditionGoalState(null);
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
    setShellModeState("training");
    setExploreHikes([]);
    setSavedTrailIds([]);
    setCompletedTrailIds([]);
    setCustomRoutes([]);
    setExpeditions([]);
    setActiveExpeditionIdState(null);
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
              _FLAT_TRAINING_GOAL_KEY, _FLAT_EXPEDITION_GOAL_KEY,
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
          GOAL_KEY, TRAINING_GOAL_KEY, EXPEDITION_GOAL_KEY,
          SESSIONS_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY, REPS_KEY, EFFORTS_KEY, HAS_VIEWED_PLAN_KEY, ACHIEVEMENTS_KEY, COMPLETED_GOALS_KEY, APP_MODE_KEY, EXPLORE_HIKES_KEY, SAVED_TRAILS_KEY, COMPLETED_TRAILS_KEY, CUSTOM_ROUTES_KEY, MY_HILLS_KEY, EXCLUDED_HILLS_KEY, EXPEDITIONS_KEY, ACTIVE_EXPEDITION_KEY,
        ]);
        const [legacyGoalStr, storedTrainingGoalStr, storedExpeditionGoalStr, sessionsStr, planStr, hillsStr, completedStr, assignedStr, noteStr, submittedStr, hillsInPlanStr, repsStr, effortsStr, hasViewedPlanStr, achievementsStr, completedGoalsStr, appModeStr, exploreHikesStr, savedTrailsStr, completedTrailsStr, customRoutesStr, myHillsStr, excludedHillsStr, expeditionsStr, activeExpeditionStr] =
          pairs.map(([, v]) => v);

        const storedShellMode = await AsyncStorage.getItem(SHELL_MODE_KEY);
        const loadedShellMode: "training" | "expedition" =
          storedShellMode === "expedition" ? "expedition" : "training";

        // Migrate the former single shared goal into the appropriate shell.
        // `mode: "virtual"` existed before the dual-shell UI, so it is not enough
        // by itself to identify an Expedition. Require expedition-specific state
        // or an active library record to avoid moving a legacy Training goal.
        const legacyGoal: SummitGoal | null = legacyGoalStr ? JSON.parse(legacyGoalStr) : null;
        const legacyLibrary: SavedExpedition[] = expeditionsStr
          ? JSON.parse(expeditionsStr)
          : [];
        const legacyMatchesLibrary = !!legacyGoal && legacyLibrary.some(expedition =>
          expedition.challengeName === legacyGoal.mountainName ||
          expedition.targetMountainName === legacyGoal.targetMountain?.name
        );
        const legacyHasVirtualState = !!legacyGoal && (
          !!legacyGoal.targetMountain ||
          (legacyGoal.virtualHills?.length ?? 0) > 0 ||
          legacyGoal.simulationScore !== undefined ||
          !!legacyGoal.virtualHikeProgress
        );
        const legacyLooksLikeExpedition = !!legacyGoal && (
          !!activeExpeditionStr ||
          legacyMatchesLibrary ||
          !!legacyGoal.expeditionPlan ||
          (legacyGoal.completedRoutes?.length ?? 0) > 0 ||
          (
            loadedShellMode === "expedition" &&
            legacyGoal.mode === "virtual" &&
            legacyHasVirtualState
          )
        );
        const loadedTrainingGoal: SummitGoal | null = storedTrainingGoalStr
          ? JSON.parse(storedTrainingGoalStr)
          : legacyLooksLikeExpedition ? null : legacyGoal;
        const loadedExpeditionGoal: SummitGoal | null = storedExpeditionGoalStr
          ? JSON.parse(storedExpeditionGoalStr)
          : legacyLooksLikeExpedition ? legacyGoal : null;

        setTrainingGoalState(loadedTrainingGoal);
        setExpeditionGoalState(loadedExpeditionGoal);

        const goal = loadedShellMode === "expedition"
          ? loadedExpeditionGoal
          : loadedTrainingGoal;
        const goalStr = goal ? JSON.stringify(goal) : null;

        const goalMigrationWrites: [string, string][] = [];
        if (!storedTrainingGoalStr && loadedTrainingGoal) {
          goalMigrationWrites.push([TRAINING_GOAL_KEY, JSON.stringify(loadedTrainingGoal)]);
        }
        if (!storedExpeditionGoalStr && loadedExpeditionGoal) {
          goalMigrationWrites.push([EXPEDITION_GOAL_KEY, JSON.stringify(loadedExpeditionGoal)]);
        }
        if (goalMigrationWrites.length > 0) {
          await AsyncStorage.multiSet(goalMigrationWrites);
        }

        // Parse explore hikes before the goal block so they're available
        // both for readiness scoring (inside) and hike history (outside).
        const loadedHikes: ExploreHike[] = exploreHikesStr
          ? (JSON.parse(exploreHikesStr) as ExploreHike[]).map(h =>
              h.timeTaken > 300 ? { ...h, timeTaken: Math.round(h.timeTaken / 60) } : h
            )
          : [];

        if (goal) {
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
                await applyAlpineProfile(loadedShellMode, goal, profile);
              }
              setAlpineProfileLoading(false);
            });
          }
        }
        // No else — fresh users start from the landing page with no pre-loaded data

        if (appModeStr) setAppModeState(appModeStr as "summit" | "explore");
        setShellModeState(loadedShellMode);
        // loadedHikes already parsed and migrated above (before readiness calculation)
        if (loadedHikes.length > 0) setExploreHikes(loadedHikes);
        if (savedTrailsStr) setSavedTrailIds(JSON.parse(savedTrailsStr) as string[]);
        if (completedTrailsStr) setCompletedTrailIds(JSON.parse(completedTrailsStr) as string[]);
        if (customRoutesStr) setCustomRoutes(JSON.parse(customRoutesStr) as Trail[]);

        // Load expedition library + auto-migrate any pre-library virtual goal
        if (expeditionsStr) {
          const loadedExpeditions = JSON.parse(expeditionsStr) as SavedExpedition[];
          setExpeditions(loadedExpeditions);
          if (activeExpeditionStr) setActiveExpeditionIdState(activeExpeditionStr);
        } else if (loadedExpeditionGoal) {
          // One-time migration: if a summitGoal with mode "virtual" exists but no
          // expedition library, create a library entry so progress is preserved.
          const existingGoal = loadedExpeditionGoal;
          if (existingGoal.mode === "virtual" && existingGoal.virtualHills?.length) {
            const migratedId = `exp_migrated_${Date.now()}`;
            const migratedExp: SavedExpedition = {
              id:                       migratedId,
              challengeName:            existingGoal.mountainName,
              targetMountainName:       existingGoal.targetMountain?.name ?? existingGoal.mountainName,
              targetMountain:           existingGoal.targetMountain,
              virtualHills:             existingGoal.virtualHills,
              expeditionPlan:           existingGoal.expeditionPlan,
              simulationScore:          existingGoal.simulationScore,
              simulationScoreBreakdown: existingGoal.simulationScoreBreakdown,
              completedRoutes:          existingGoal.completedRoutes ?? [],
              expeditionStatus:         "active",
              virtualHikeProgress:      existingGoal.virtualHikeProgress ?? { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
              location:                 existingGoal.location ?? "United Kingdom",
              maxRadius:                existingGoal.maxRadius ?? 30,
              fitnessLevel:             existingGoal.fitnessLevel ?? "Average",
              savedAt:                  new Date().toISOString(),
              startedAt:                new Date().toISOString(),
            };
            setExpeditions([migratedExp]);
            setActiveExpeditionIdState(migratedId);
            AsyncStorage.multiSet([
              [EXPEDITIONS_KEY, JSON.stringify([migratedExp])],
              [ACTIVE_EXPEDITION_KEY, migratedId],
            ]).catch(() => {});
          }
        }
      } catch {}
      setIsLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, _uid]);

  const setSummitGoal = useCallback((goal: SummitGoal) =>
    enqueueActivityStorageMutation(async () => {
    const storedSessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const latestSessions = parseStoredArray(storedSessionsJson, sessions);
    // Archive the outgoing goal + its training stats before wiping
    // Expedition-linked records persist across plans, so archive only ordinary
    // Training records to avoid counting imported ascents twice in lifetime stats.
    const sessionsToArchive = latestSessions.filter(
      item => isTrainingActivity(item) && !item.expeditionStageKey,
    );
    if (trainingGoal && sessionsToArchive.length > 0) {
      const archived: CompletedGoal = {
        mountainName: trainingGoal.mountainName,
        elevationGain: trainingGoal.elevationGain,
        highestAltitude: trainingGoal.highestAltitude,
        difficulty: trainingGoal.difficulty,
        completedAt: new Date().toISOString().split("T")[0],
        sessionsLogged: sessionsToArchive.length,
        totalElevationTrained: sessionsToArchive.reduce((sum, s) => sum + s.elevationGain, 0),
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
    const seededSessions: Session[] = _pendingHikes.map((hike, idx) => {
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
    // Expedition records are shared source data. Always preserve every linked
    // Session; Training visibility remains controlled by trainingImportedAt.
    const expeditionSessions = latestSessions.filter(item => !!item.expeditionStageKey);
    const preservedIds = new Set(expeditionSessions.map(item => item.id));
    const initialSessions = [
      ...expeditionSessions,
      ...seededSessions.filter(item => !preservedIds.has(item.id)),
    ];
    setShellModeState("training");
    setSummitGoalState(goal);
    setTrainingGoalState(goal);
    setTrainingPlan(plan);
    // Reset ordinary Training data while keeping raw expedition source records.
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
      [TRAINING_GOAL_KEY, JSON.stringify(goal)],
      [SHELL_MODE_KEY, "training"],
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
          await applyAlpineProfile("training", goal, profile);
        }
        setAlpineProfileLoading(false);
      });
    }
  }), [trainingGoal, sessions, trainingPlan, completedGoals, exploreHikes, completedTrailIds, GOAL_KEY, TRAINING_GOAL_KEY, SHELL_MODE_KEY, SESSIONS_KEY, COMPLETED_GOALS_KEY, COMPLETED_TRAILS_KEY, _PENDING_KEY, applyAlpineProfile, enqueueActivityStorageMutation]);

  const changeSummit = useCallback(async (goal: SummitGoal) => {
    // Update the summit target WITHOUT archiving the old goal or clearing sessions.
    // Existing logged sessions are preserved — only the plan is regenerated.
    const plan = generatePlan(goal);
    void logTrainingPlanGenerated({ mountain_name: goal.mountainName, weeks: plan.length });
    setShellModeState("training");
    setSummitGoalState(goal);
    setTrainingGoalState(goal);
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
      [TRAINING_GOAL_KEY, JSON.stringify(goal)],
      [SHELL_MODE_KEY, "training"],
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
          await applyAlpineProfile("training", goal, profile);
        }
        setAlpineProfileLoading(false);
      });
    }
  }, [sessions, completedGoals, GOAL_KEY, TRAINING_GOAL_KEY, SHELL_MODE_KEY, applyAlpineProfile]);

  const clearNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked([]);
  }, []);

  const patchGoal = useCallback(async (updates: Partial<SummitGoal>) => {
    if (!summitGoal) return;
    const updated = { ...summitGoal, ...updates };
    setSummitGoalState(updated);
    if (shellMode === "expedition") {
      setExpeditionGoalState(updated);
      await AsyncStorage.multiSet([
        [GOAL_KEY, JSON.stringify(updated)],
        [EXPEDITION_GOAL_KEY, JSON.stringify(updated)],
      ]);
    } else {
      setTrainingGoalState(updated);
      await AsyncStorage.multiSet([
        [GOAL_KEY, JSON.stringify(updated)],
        [TRAINING_GOAL_KEY, JSON.stringify(updated)],
      ]);
    }
    // Auto-sync expedition-specific fields back to the active library entry
    if (shellMode === "expedition" && activeExpeditionId) {
      const expeditionFields = [
        "virtualHills", "expeditionPlan", "simulationScore",
        "simulationScoreBreakdown", "targetMountain", "virtualHikeProgress", "completedRoutes",
      ] as const;
      const expUpdates: Partial<SavedExpedition> = {};
      for (const field of expeditionFields) {
        if (field in updates) (expUpdates as Record<string, unknown>)[field] = (updates as Record<string, unknown>)[field];
      }
      if (Object.keys(expUpdates).length > 0) {
        const updatedLibrary = expeditions.map(e =>
          e.id === activeExpeditionId ? { ...e, ...expUpdates } : e
        );
        setExpeditions(updatedLibrary);
        await AsyncStorage.setItem(EXPEDITIONS_KEY, JSON.stringify(updatedLibrary));
      }
    }
  }, [summitGoal, shellMode, expeditions, activeExpeditionId, GOAL_KEY, TRAINING_GOAL_KEY, EXPEDITION_GOAL_KEY, EXPEDITIONS_KEY]);

  // ── Expedition Library ────────────────────────────────────────────────────────

  const startExpedition = useCallback(async (
    data: Omit<SavedExpedition, "id" | "savedAt" | "completedRoutes" | "expeditionStatus" | "virtualHikeProgress">
  ): Promise<string> => {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const newExp: SavedExpedition = {
      ...data,
      id,
      savedAt: now,
      startedAt: now,
      completedRoutes: [],
      expeditionStatus: "active",
      virtualHikeProgress: { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
    };

    // Mark any previously-active expedition as saved (progress is preserved)
    const updatedLibrary: SavedExpedition[] = [
      ...expeditions.map(e =>
        e.expeditionStatus === "active" ? { ...e, expeditionStatus: "saved" as const } : e
      ),
      newExp,
    ];

    setExpeditions(updatedLibrary);
    setActiveExpeditionIdState(id);

    // Update summitGoal expedition fields without resetting sessions or training plan
    const goalPatch: Partial<SummitGoal> = {
      mountainName:             data.challengeName,
      mode:                     "virtual",
      targetMountain:           data.targetMountain,
      virtualHills:             data.virtualHills,
      simulationScore:          data.simulationScore,
      simulationScoreBreakdown: data.simulationScoreBreakdown,
      expeditionPlan:           data.expeditionPlan ?? null,
      virtualHikeProgress:      { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
      completedRoutes:          [],
      location:                 data.location,
      maxRadius:                data.maxRadius,
    };

    let updatedGoal: SummitGoal;
    const expeditionBaseGoal = expeditionGoal ?? trainingGoal ?? summitGoal;
    if (expeditionBaseGoal) {
      updatedGoal = { ...expeditionBaseGoal, ...goalPatch };
    } else {
      // New user entering expedition shell before completing training setup
      updatedGoal = {
        mountainName:             data.challengeName,
        summitDate:               new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        distance:                 data.targetMountain?.totalDistance ?? 0,
        elevationGain:            data.targetMountain?.totalElevationGain ?? 0,
        highestAltitude:          data.targetMountain?.summitElevation ?? 0,
        difficulty:               data.targetMountain?.difficulty ?? "Hard",
        fitnessLevel:             data.fitnessLevel,
        location:                 data.location,
        maxRadius:                data.maxRadius,
        equipment:                ["none"],
        trainingDaysPerWeek:      3,
        hillDaysPerWeek:          2,
        mode:                     "virtual",
        targetMountain:           data.targetMountain,
        virtualHills:             data.virtualHills,
        simulationScore:          data.simulationScore,
        simulationScoreBreakdown: data.simulationScoreBreakdown,
        expeditionPlan:           data.expeditionPlan ?? null,
        virtualHikeProgress:      { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 },
        completedRoutes:          [],
      };
    }
    setSummitGoalState(updatedGoal);
    setExpeditionGoalState(updatedGoal);

    // Auto-switch to expedition shell
    setShellModeState("expedition");

    await AsyncStorage.multiSet([
      [EXPEDITIONS_KEY, JSON.stringify(updatedLibrary)],
      [ACTIVE_EXPEDITION_KEY, id],
      [GOAL_KEY, JSON.stringify(updatedGoal)],
      [EXPEDITION_GOAL_KEY, JSON.stringify(updatedGoal)],
      [SHELL_MODE_KEY, "expedition"],
    ]);

    return id;
  }, [expeditions, summitGoal, trainingGoal, expeditionGoal, EXPEDITIONS_KEY, ACTIVE_EXPEDITION_KEY, GOAL_KEY, EXPEDITION_GOAL_KEY, SHELL_MODE_KEY]);

  const setActiveExpedition = useCallback(async (id: string) => {
    const target = expeditions.find(e => e.id === id);
    if (!target) return;

    // Sync the current expedition's live progress back to the library before switching
    const syncedLibrary = expeditions.map(e => {
      if (e.id === activeExpeditionId && expeditionGoal?.virtualHikeProgress) {
        return { ...e, expeditionStatus: "saved" as const, virtualHikeProgress: expeditionGoal.virtualHikeProgress };
      }
      if (e.id === id) return { ...e, expeditionStatus: "active" as const };
      return e;
    });

    setExpeditions(syncedLibrary);
    setActiveExpeditionIdState(id);

    // Load the target expedition's fields into summitGoal so all screens update
    const expeditionBaseGoal = expeditionGoal ?? (shellMode === "expedition" ? summitGoal : trainingGoal);
    if (expeditionBaseGoal) {
      const updatedGoal: SummitGoal = {
        ...expeditionBaseGoal,
        mountainName:             target.challengeName,
        mode:                     "virtual",
        targetMountain:           target.targetMountain,
        virtualHills:             target.virtualHills,
        simulationScore:          target.simulationScore,
        simulationScoreBreakdown: target.simulationScoreBreakdown,
        expeditionPlan:           target.expeditionPlan ?? null,
        virtualHikeProgress:      target.virtualHikeProgress,
        completedRoutes:          target.completedRoutes,
        location:                 target.location,
        maxRadius:                target.maxRadius,
      };
      setExpeditionGoalState(updatedGoal);
      if (shellMode === "expedition") setSummitGoalState(updatedGoal);
      await AsyncStorage.multiSet([
        [EXPEDITION_GOAL_KEY, JSON.stringify(updatedGoal)],
        ...(shellMode === "expedition"
          ? [[GOAL_KEY, JSON.stringify(updatedGoal)] as [string, string]]
          : []),
      ]);
    }

    await AsyncStorage.multiSet([
      [EXPEDITIONS_KEY, JSON.stringify(syncedLibrary)],
      [ACTIVE_EXPEDITION_KEY, id],
    ]);
  }, [expeditions, activeExpeditionId, summitGoal, trainingGoal, expeditionGoal, shellMode, EXPEDITIONS_KEY, ACTIVE_EXPEDITION_KEY, GOAL_KEY, EXPEDITION_GOAL_KEY]);

  const patchExpedition = useCallback(async (id: string, updates: Partial<SavedExpedition>) => {
    const updated = expeditions.map(e => e.id === id ? { ...e, ...updates } : e);
    setExpeditions(updated);

    // Keep summitGoal in sync when patching the active expedition
    const expeditionBaseGoal = expeditionGoal ?? (shellMode === "expedition" ? summitGoal : null);
    if (id === activeExpeditionId && expeditionBaseGoal) {
      const goalSyncFields: Partial<SummitGoal> = {};
      if (updates.virtualHills !== undefined)             goalSyncFields.virtualHills = updates.virtualHills;
      if (updates.expeditionPlan !== undefined)           goalSyncFields.expeditionPlan = updates.expeditionPlan;
      if (updates.simulationScore !== undefined)          goalSyncFields.simulationScore = updates.simulationScore;
      if (updates.simulationScoreBreakdown !== undefined) goalSyncFields.simulationScoreBreakdown = updates.simulationScoreBreakdown;
      if (updates.targetMountain !== undefined)           goalSyncFields.targetMountain = updates.targetMountain;
      if (updates.virtualHikeProgress !== undefined)      goalSyncFields.virtualHikeProgress = updates.virtualHikeProgress;
      if (updates.completedRoutes !== undefined)          goalSyncFields.completedRoutes = updates.completedRoutes;
      if (Object.keys(goalSyncFields).length > 0) {
        const updatedGoal = { ...expeditionBaseGoal, ...goalSyncFields };
        setExpeditionGoalState(updatedGoal);
        if (shellMode === "expedition") setSummitGoalState(updatedGoal);
        await AsyncStorage.multiSet([
          [EXPEDITION_GOAL_KEY, JSON.stringify(updatedGoal)],
          ...(shellMode === "expedition"
            ? [[GOAL_KEY, JSON.stringify(updatedGoal)] as [string, string]]
            : []),
        ]);
      }
    }

    await AsyncStorage.setItem(EXPEDITIONS_KEY, JSON.stringify(updated));
  }, [expeditions, activeExpeditionId, summitGoal, expeditionGoal, shellMode, EXPEDITIONS_KEY, GOAL_KEY, EXPEDITION_GOAL_KEY]);

  const completeExpedition = useCallback(async (id: string, stats?: SavedExpedition["completionStats"]) => {
    const now = new Date().toISOString();
    const updated = expeditions.map(e =>
      e.id === id
        ? { ...e, expeditionStatus: "complete" as const, completedAt: now, ...(stats ? { completionStats: stats } : {}) }
        : e
    );
    setExpeditions(updated);

    if (id === activeExpeditionId) {
      setActiveExpeditionIdState(null);
      await AsyncStorage.multiSet([
        [EXPEDITIONS_KEY, JSON.stringify(updated)],
        [ACTIVE_EXPEDITION_KEY, ""],
      ]);
    } else {
      await AsyncStorage.setItem(EXPEDITIONS_KEY, JSON.stringify(updated));
    }
  }, [expeditions, activeExpeditionId, EXPEDITIONS_KEY, ACTIVE_EXPEDITION_KEY]);

  const checkAndNotifyAchievements = useCallback(async (
    updatedSessions: Session[],
    score: number,
    submitted: Record<string, boolean>,
    alreadyUnlocked: string[],
    hikes: ExploreHike[] = [],
  ) => {
    const trainingSessions = updatedSessions.filter(isTrainingActivity);
    const trainingHikes = hikes.filter(isTrainingActivity);
    const weekNums = new Set(
      Object.keys(submitted).filter(k => submitted[k]).map(k => k.split("-")[0])
    );
    const computed = computeUnlocked(trainingSessions, score, weekNums.size, trainingHikes);
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

  const getExpeditionAscentMigrationSummary = useCallback(
    (): ExpeditionAscentMigrationSummary | null => {
      const active = activeExpeditionId
        ? expeditions.find(item => item.id === activeExpeditionId)
        : null;
      const ordered = [
        ...(active ? [active] : []),
        ...expeditions
          .filter(item => item.id !== active?.id)
          .sort((a, b) => {
            const aDate = a.completedAt ?? a.startedAt ?? a.savedAt;
            const bDate = b.completedAt ?? b.startedAt ?? b.savedAt;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          }),
      ];

      for (const expedition of ordered) {
        const selection = selectExpeditionAscentsForTraining(
          expedition,
          sessions,
          exploreHikes,
        );
        if (!selection) continue;
        const { sessionIds: _sessionIds, hikeIds: _hikeIds, ...summary } = selection;
        return summary;
      }
      return null;
    },
    [activeExpeditionId, expeditions, sessions, exploreHikes],
  );

  const importExpeditionAscents = useCallback(async (
    expeditionId: string,
  ): Promise<ExpeditionAscentMigrationSummary> => {
    return enqueueActivityStorageMutation(async () => {
      const [
      [, storedExpeditionsJson],
      [, storedSessionsJson],
      [, storedHikesJson],
    ] = await AsyncStorage.multiGet([
      EXPEDITIONS_KEY,
      SESSIONS_KEY,
      EXPLORE_HIKES_KEY,
    ]);

    const storedExpeditions = parseStoredArray(storedExpeditionsJson, expeditions);
    const storedSessions = parseStoredArray(storedSessionsJson, sessions);
    const storedHikes = parseStoredArray(storedHikesJson, exploreHikes);
    const expedition = storedExpeditions.find(item => item.id === expeditionId);

    if (!expedition) {
      throw new Error("That expedition could not be found.");
    }

    const selection = selectExpeditionAscentsForTraining(
      expedition,
      storedSessions,
      storedHikes,
    );
    if (!selection) {
      return {
        expeditionId,
        expeditionName: expedition.challengeName,
        ascentCount: 0,
        totalElevationM: 0,
        totalDistanceKm: 0,
      };
    }

    const importedAt = new Date().toISOString();
    const sessionIds = new Set(selection.sessionIds);
    const hikeIds = new Set(selection.hikeIds);
    const updatedSessions = storedSessions.map(item =>
      sessionIds.has(item.id) && !item.trainingImportedAt
        ? { ...item, trainingImportedAt: importedAt }
        : item
    );
    const updatedHikes = storedHikes.map(item =>
      hikeIds.has(item.id) && !item.trainingImportedAt
        ? { ...item, trainingImportedAt: importedAt }
        : item
    );
    const writes: [string, string][] = [];
    if (sessionIds.size > 0) {
      writes.push([SESSIONS_KEY, JSON.stringify(updatedSessions)]);
    }
    if (hikeIds.size > 0) {
      writes.push([EXPLORE_HIKES_KEY, JSON.stringify(updatedHikes)]);
    }

    try {
      await AsyncStorage.multiSet(writes);
    } catch {
      // Marker-based writes are idempotent, so retrying safely repairs a
      // partially interrupted native storage batch.
      await AsyncStorage.multiSet(writes);
    }

    setSessions(updatedSessions);
    setExploreHikes(updatedHikes);

    let score = readinessScore;
    if (trainingGoal) {
      score = calculateReadiness(
        trainingGoal,
        trainingPlan,
        updatedSessions,
        {
          sessionReps,
          assignedHills,
          completedGoals,
          exploreHikes: updatedHikes,
        },
      );
      setReadinessScore(score);
      if (score > readinessScore) {
        void logReadinessScoreImproved({
          readiness_score: score,
          previous_score: readinessScore,
        });
      }
    }
    void checkAndNotifyAchievements(
      updatedSessions,
      score,
      submittedPlanSessions,
      unlockedAchievements,
      updatedHikes,
    );

    const { sessionIds: _sessionIds, hikeIds: _hikeIds, ...summary } = selection;
      return summary;
    });
  }, [
    EXPEDITIONS_KEY,
    SESSIONS_KEY,
    EXPLORE_HIKES_KEY,
    expeditions,
    sessions,
    exploreHikes,
    readinessScore,
    trainingGoal,
    trainingPlan,
    sessionReps,
    assignedHills,
    completedGoals,
    submittedPlanSessions,
    unlockedAchievements,
    checkAndNotifyAchievements,
    enqueueActivityStorageMutation,
  ]);

  const addSession = useCallback((session: Omit<Session, "id">) =>
    enqueueActivityStorageMutation(async () => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const newSession: Session = { ...session, id };
    const storedJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const latestSessions = parseStoredArray(storedJson, sessions);
    const updated = [newSession, ...latestSessions];
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
  }), [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, readinessScore, submittedPlanSessions, unlockedAchievements, exploreHikes, checkAndNotifyAchievements, SESSIONS_KEY, enqueueActivityStorageMutation]);

  const completeExpeditionStage = useCallback((
    input: ExpeditionStageCompletionInput,
  ): Promise<ExpeditionStageCompletionResult> => {
    const run = async (): Promise<ExpeditionStageCompletionResult> => {
      const [
        [, storedExpeditionsJson],
        [, storedSessionsJson],
        [, storedHikesJson],
        [, storedActiveExpeditionId],
      ] = await AsyncStorage.multiGet([
        EXPEDITIONS_KEY,
        SESSIONS_KEY,
        EXPLORE_HIKES_KEY,
        ACTIVE_EXPEDITION_KEY,
      ]);

      const storedExpeditions = parseStoredArray(storedExpeditionsJson, expeditions);
      const expedition = storedExpeditions.find(item => item.id === input.expeditionId);
      if (
        !expedition
        || expedition.expeditionStatus !== "active"
        || storedActiveExpeditionId !== input.expeditionId
      ) {
        return { status: "invalid-expedition", isFinished: false };
      }

      const stageNames = expedition.virtualHills.map(hill => hill.name);
      if (!stageNames.includes(input.stageName)) {
        return { status: "invalid-stage", isFinished: false };
      }

      const completionKey = `${input.expeditionId}::${input.stageName}`;
      const storedSessions = parseStoredArray(storedSessionsJson, sessions);
      const storedHikes = parseStoredArray(storedHikesJson, exploreHikes);
      const completed = new Set(expedition.completedRoutes ?? []);
      const wasAlreadyCompleted = completed.has(input.stageName);
      const needsSession = !!input.session
        && !storedSessions.some(item => item.expeditionStageKey === completionKey);
      const needsHike = !!input.hike
        && !storedHikes.some(item => item.expeditionStageKey === completionKey);

      if (wasAlreadyCompleted && !needsSession && !needsHike) {
        return {
          status: "already-completed",
          isFinished: stageNames.length > 0 && stageNames.every(name => completed.has(name)),
        };
      }

      completed.add(input.stageName);
      const completedRoutes = Array.from(completed);
      const updatedExpeditions = storedExpeditions.map(item =>
        item.id === input.expeditionId ? { ...item, completedRoutes } : item,
      );
      const idBase = Date.now().toString() + Math.random().toString(36).slice(2, 8);
      const updatedSessions = needsSession && input.session
        ? [{
            ...input.session,
            id: `session_${idBase}`,
            expeditionStageKey: completionKey,
          }, ...storedSessions]
        : storedSessions;
      const updatedHikes = needsHike && input.hike
        ? [{
            ...input.hike,
            id: `hike_${idBase}`,
            expeditionStageKey: completionKey,
          }, ...storedHikes]
        : storedHikes;

      let updatedGoal: SummitGoal | null = null;
      if (input.expeditionId === activeExpeditionId) {
        const storedGoalJson = await AsyncStorage.getItem(EXPEDITION_GOAL_KEY);
        const goalBase = storedGoalJson
          ? JSON.parse(storedGoalJson) as SummitGoal
          : expeditionGoal ?? (shellMode === "expedition" ? summitGoal : null);
        if (goalBase) updatedGoal = { ...goalBase, completedRoutes };
      }

      const writes: [string, string][] = [
        [EXPEDITIONS_KEY, JSON.stringify(updatedExpeditions)],
      ];
      if (needsSession) writes.push([SESSIONS_KEY, JSON.stringify(updatedSessions)]);
      if (needsHike) writes.push([EXPLORE_HIKES_KEY, JSON.stringify(updatedHikes)]);
      if (updatedGoal) {
        writes.push([EXPEDITION_GOAL_KEY, JSON.stringify(updatedGoal)]);
        if (shellMode === "expedition") {
          writes.push([GOAL_KEY, JSON.stringify(updatedGoal)]);
        }
      }
      try {
        await AsyncStorage.multiSet(writes);
      } catch {
        // A device interruption can leave a native storage batch partially
        // applied. Replaying the same idempotent payload repairs missing keys
        // without creating duplicate stage activity records.
        await AsyncStorage.multiSet(writes);
      }

      setExpeditions(updatedExpeditions);
      if (needsSession) setSessions(updatedSessions);
      if (needsHike) setExploreHikes(updatedHikes);
      if (updatedGoal) {
        setExpeditionGoalState(updatedGoal);
        if (shellMode === "expedition") setSummitGoalState(updatedGoal);
      }

      if (needsSession && input.session) {
        const readinessGoal = updatedGoal ?? summitGoal;
        let score = readinessScore;
        if (readinessGoal) {
          score = calculateReadiness(
            readinessGoal,
            trainingPlan,
            updatedSessions,
            { sessionReps, assignedHills, completedGoals, exploreHikes: updatedHikes },
          );
          setReadinessScore(score);
          if (score > readinessScore) {
            void logReadinessScoreImproved({
              readiness_score: score,
              previous_score: readinessScore,
            });
          } else if (input.session.completed) {
            const insight = diagnoseScoreStagnation(
              readinessGoal,
              updatedSessions,
              updatedHikes,
              readinessScore,
              score,
            );
            if (insight) setScoreStagnation(insight);
          }
        }
        void checkAndNotifyAchievements(
          updatedSessions,
          score,
          submittedPlanSessions,
          unlockedAchievements,
          updatedHikes,
        );
      }

      return {
        status: "completed",
        isFinished: stageNames.length > 0 && stageNames.every(name => completed.has(name)),
      };
    };

    return enqueueActivityStorageMutation(run);
  }, [
    EXPEDITIONS_KEY,
    SESSIONS_KEY,
    EXPLORE_HIKES_KEY,
    ACTIVE_EXPEDITION_KEY,
    EXPEDITION_GOAL_KEY,
    GOAL_KEY,
    expeditions,
    sessions,
    exploreHikes,
    activeExpeditionId,
    expeditionGoal,
    shellMode,
    summitGoal,
    readinessScore,
    trainingPlan,
    sessionReps,
    assignedHills,
    completedGoals,
    submittedPlanSessions,
    unlockedAchievements,
    checkAndNotifyAchievements,
    enqueueActivityStorageMutation,
  ]);

  const updateSession = useCallback((id: string, updates: Partial<Session>) =>
    enqueueActivityStorageMutation(async () => {
    const storedJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const latestSessions = parseStoredArray(storedJson, sessions);
    const updated = latestSessions.map(s => s.id === id ? { ...s, ...updates } : s);
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes }));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }), [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, exploreHikes, SESSIONS_KEY, enqueueActivityStorageMutation]);

  const deleteSession = useCallback((id: string) =>
    enqueueActivityStorageMutation(async () => {
    const storedJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const latestSessions = parseStoredArray(storedJson, sessions);
    const updated = latestSessions.filter(s => s.id !== id);
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes }));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }), [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, exploreHikes, SESSIONS_KEY, enqueueActivityStorageMutation]);

  const clearPlan = useCallback(() =>
    enqueueActivityStorageMutation(async () => {
    const [
      [, storedSessionsJson],
      [, storedHikesJson],
    ] = await AsyncStorage.multiGet([SESSIONS_KEY, EXPLORE_HIKES_KEY]);
    const latestSessions = parseStoredArray(storedSessionsJson, sessions);
    const latestHikes = parseStoredArray(storedHikesJson, exploreHikes);
    const expeditionSessions = latestSessions.filter(item => !!item.expeditionStageKey);
    const expeditionHikes = latestHikes.filter(item => !!item.expeditionStageKey);
    const activeGoalAfterClear = shellMode === "expedition" ? expeditionGoal : null;
    setSummitGoalState(activeGoalAfterClear);
    setTrainingGoalState(null);
    setTrainingPlan([]);
    setSessions(expeditionSessions);
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
    setExploreHikes(expeditionHikes);
    setMyHills([]);
    setExcludedFromMyHills([]);
    await AsyncStorage.multiRemove([
      TRAINING_GOAL_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY, REPS_KEY, EFFORTS_KEY, HAS_VIEWED_PLAN_KEY, ACHIEVEMENTS_KEY, COMPLETED_GOALS_KEY, APP_MODE_KEY, SAVED_TRAILS_KEY, COMPLETED_TRAILS_KEY, CUSTOM_ROUTES_KEY, MY_HILLS_KEY, EXCLUDED_HILLS_KEY, "summitready_questionnaire_data", "summitready_challenges",
    ]);
    await AsyncStorage.multiSet([
      [SESSIONS_KEY, JSON.stringify(expeditionSessions)],
      [EXPLORE_HIKES_KEY, JSON.stringify(expeditionHikes)],
    ]);
    if (activeGoalAfterClear) {
      await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(activeGoalAfterClear));
    } else {
      await AsyncStorage.removeItem(GOAL_KEY);
    }
  }), [shellMode, expeditionGoal, sessions, exploreHikes, GOAL_KEY, TRAINING_GOAL_KEY, SESSIONS_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY, REPS_KEY, EFFORTS_KEY, HAS_VIEWED_PLAN_KEY, ACHIEVEMENTS_KEY, COMPLETED_GOALS_KEY, APP_MODE_KEY, EXPLORE_HIKES_KEY, SAVED_TRAILS_KEY, COMPLETED_TRAILS_KEY, CUSTOM_ROUTES_KEY, MY_HILLS_KEY, EXCLUDED_HILLS_KEY, enqueueActivityStorageMutation]);

  const seedPastActivity = useCallback((hikes: PastHike[]) =>
    enqueueActivityStorageMutation(async () => {
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
    const storedJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const latestSessions = parseStoredArray(storedJson, sessions);
    const updated = [...newSessions, ...latestSessions];
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
  }), [sessions, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, exploreHikes, completedTrailIds, SESSIONS_KEY, COMPLETED_TRAILS_KEY, enqueueActivityStorageMutation]);

  const setAppMode = useCallback(async (mode: "summit" | "explore") => {
    setAppModeState(mode);
    await AsyncStorage.setItem(APP_MODE_KEY, mode);
  }, []);

  const setShellMode = useCallback(async (mode: "training" | "expedition") => {
    if (mode === shellMode) return;
    const nextGoal = mode === "training" ? trainingGoal : expeditionGoal;
    let latestSessions = sessions;
    let latestHikes = exploreHikes;
    if (mode === "training") {
      const [
        [, storedSessionsJson],
        [, storedHikesJson],
      ] = await AsyncStorage.multiGet([SESSIONS_KEY, EXPLORE_HIKES_KEY]);
      latestSessions = parseStoredArray(storedSessionsJson, sessions);
      latestHikes = parseStoredArray(storedHikesJson, exploreHikes);
      setSessions(latestSessions);
      setExploreHikes(latestHikes);
    }
    setShellModeState(mode);
    setSummitGoalState(nextGoal);
    if (mode === "training" && nextGoal) {
      setReadinessScore(calculateReadiness(nextGoal, trainingPlan, latestSessions, {
        sessionReps,
        assignedHills,
        completedGoals,
        exploreHikes: latestHikes,
      }));
    }
    const writes: [string, string][] = [[SHELL_MODE_KEY, mode]];
    if (nextGoal) writes.push([GOAL_KEY, JSON.stringify(nextGoal)]);
    await AsyncStorage.multiSet(writes);
    if (!nextGoal) await AsyncStorage.removeItem(GOAL_KEY);
  }, [shellMode, trainingGoal, expeditionGoal, trainingPlan, sessions, sessionReps, assignedHills, completedGoals, exploreHikes, SHELL_MODE_KEY, GOAL_KEY, SESSIONS_KEY, EXPLORE_HIKES_KEY]);

  const logExploreHike = useCallback((hike: Omit<ExploreHike, "id">) =>
    enqueueActivityStorageMutation(async () => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    const newHike: ExploreHike = { ...hike, id };
    const storedJson = await AsyncStorage.getItem(EXPLORE_HIKES_KEY);
    const latestHikes = parseStoredArray(storedJson, exploreHikes);
    const updated = [newHike, ...latestHikes];
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
  }), [exploreHikes, sessions, readinessScore, summitGoal, trainingPlan, sessionReps, assignedHills, completedGoals, submittedPlanSessions, unlockedAchievements, checkAndNotifyAchievements, EXPLORE_HIKES_KEY, enqueueActivityStorageMutation]);

  const deleteExploreHike = useCallback((id: string) =>
    enqueueActivityStorageMutation(async () => {
    const storedJson = await AsyncStorage.getItem(EXPLORE_HIKES_KEY);
    const latestHikes = parseStoredArray(storedJson, exploreHikes);
    const updated = latestHikes.filter(h => h.id !== id);
    setExploreHikes(updated);
    await AsyncStorage.setItem(EXPLORE_HIKES_KEY, JSON.stringify(updated));
  }), [exploreHikes, EXPLORE_HIKES_KEY, enqueueActivityStorageMutation]);

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

  const submitWeekSessions = useCallback((weekNum: number): Promise<number> =>
    enqueueActivityStorageMutation(async () => {
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

    const storedJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const latestSessions = parseStoredArray(storedJson, sessions);
    const updated = [...toSubmit, ...latestSessions];
    setSessions(updated);
    setSubmittedPlanSessions(newSubmitted);
    const score = calculateReadiness(summitGoal, trainingPlan, updated, { sessionReps, assignedHills, completedGoals, exploreHikes });
    setReadinessScore(score);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(SUBMITTED_KEY, JSON.stringify(newSubmitted));
    checkAndNotifyAchievements(updated, score, newSubmitted, unlockedAchievements, exploreHikes);
    return toSubmit.length;
  }), [trainingPlan, sessions, summitGoal, completedPlanSessions, submittedPlanSessions, sessionReps, sessionEfforts, assignedHills, completedGoals, unlockedAchievements, exploreHikes, checkAndNotifyAchievements, SESSIONS_KEY, SUBMITTED_KEY, enqueueActivityStorageMutation]);

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
    const scopedGoalKey = shellMode === "expedition" ? EXPEDITION_GOAL_KEY : TRAINING_GOAL_KEY;
    if (shellMode === "expedition") setExpeditionGoalState(updated);
    else setTrainingGoalState(updated);
    await AsyncStorage.multiSet([
      [GOAL_KEY, JSON.stringify(updated)],
      [scopedGoalKey, JSON.stringify(updated)],
    ]);
  }, [summitGoal, shellMode, GOAL_KEY, TRAINING_GOAL_KEY, EXPEDITION_GOAL_KEY]);

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

  const visibleSessions = shellMode === "training"
    ? sessions.filter(isTrainingActivity)
    : sessions;
  const visibleExploreHikes = shellMode === "training"
    ? exploreHikes.filter(isTrainingActivity)
    : exploreHikes;

  return (
    <AppContext.Provider value={{
      summitGoal, trainingPlan, sessions: visibleSessions, readinessScore, isLoading,
      nearbyHills, hillsLoading, hillsError, alpineProfileLoading, completedPlanSessions, assignedHills,
      planAdjusting, planAdjustNote, submittedPlanSessions, sessionReps,
      hasViewedPlan, markPlanViewed,
      setSummitGoal, changeSummit, addSession, updateSession, deleteSession, clearPlan, seedPastActivity,
      fetchNearbyHills, togglePlanSession, assignHillToSession, adjustPlanWithAI,
      submitWeekSessions, hillsInPlan, addHillToPlan, myHills, addToMyHills, removeFromMyHills, addToNearbyHills, updateGoalLocation, setSessionReps, setSessionEffort, sessionEfforts, sessionDayOverrides, setSessionDayOverride, clearSessionDayOverride, updatePlanSession,
      unlockedAchievements, newlyUnlocked, clearNewlyUnlocked,
      completedGoals,
      appMode, exploreHikes: visibleExploreHikes, setAppMode, logExploreHike, deleteExploreHike,
      savedTrailIds, completedTrailIds, customRoutes,
      saveTrail, unsaveTrail, completeTrail, uncompleteTrail, addCustomRoute, deleteCustomRoute,
      reloadApp,
      scoreStagnation, clearScoreStagnation,
      patchGoal,
      shellMode, setShellMode,
      expeditions, activeExpeditionId,
      activeExpedition: expeditions.find(e => e.id === activeExpeditionId) ?? null,
      startExpedition, setActiveExpedition, patchExpedition, completeExpeditionStage, completeExpedition,
      getExpeditionAscentMigrationSummary, importExpeditionAscents,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
