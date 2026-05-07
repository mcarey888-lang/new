import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { generatePlan } from "@/utils/planGenerator";
import { calculateReadiness } from "@/utils/readinessScore";

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
}

export interface PlanSession {
  type: "cardio" | "hill" | "bigDay";
  label: string;
  description: string;
  targetElevation: number;
  duration: string;
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
  hills: { name: string; elevation: number; distance: number; repeats: number; totalElevation: number }[];
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
}

interface AppState {
  summitGoal: SummitGoal | null;
  trainingPlan: TrainingWeek[];
  sessions: Session[];
  readinessScore: number;
  isLoading: boolean;
  nearbyHills: NearbyHill[];
  hillsLoading: boolean;
  completedPlanSessions: Record<string, boolean>;
  assignedHills: Record<string, NearbyHill>;
  planAdjusting: boolean;
  planAdjustNote: string | null;
  submittedPlanSessions: Record<string, boolean>;
  setSummitGoal: (goal: SummitGoal) => Promise<void>;
  addSession: (session: Omit<Session, "id">) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearPlan: () => Promise<void>;
  fetchNearbyHills: (radiusOverride?: number) => Promise<void>;
  togglePlanSession: (weekNum: number, sessionIdx: number) => Promise<void>;
  assignHillToSession: (weekNum: number, sessionIdx: number, hill: NearbyHill) => Promise<void>;
  adjustPlanWithAI: () => Promise<void>;
  submitWeekSessions: (weekNum: number) => Promise<number>;
  hillsInPlan: string[];
  addHillToPlan: (hill: NearbyHill) => Promise<void>;
  updateGoalLocation: (location: string) => Promise<void>;
}

const AppContext = createContext<AppState>({
  summitGoal: null,
  trainingPlan: [],
  sessions: [],
  readinessScore: 0,
  isLoading: true,
  nearbyHills: [],
  hillsLoading: false,
  completedPlanSessions: {},
  assignedHills: {},
  planAdjusting: false,
  planAdjustNote: null,
  submittedPlanSessions: {},
  setSummitGoal: async () => {},
  addSession: async () => {},
  updateSession: async () => {},
  deleteSession: async () => {},
  clearPlan: async () => {},
  fetchNearbyHills: async () => {},
  togglePlanSession: async () => {},
  assignHillToSession: async () => {},
  adjustPlanWithAI: async () => {},
  submitWeekSessions: async () => 0,
  hillsInPlan: [],
  addHillToPlan: async () => {},
  updateGoalLocation: async () => {},
});

const GOAL_KEY = "summitready_goal";
const SESSIONS_KEY = "summitready_sessions";
const PLAN_KEY = "summitready_plan";
const HILLS_KEY = "summitready_nearby_hills";
const COMPLETED_KEY = "summitready_completed_plan_sessions";
const ASSIGNED_KEY = "summitready_assigned_hills";
const ADJUST_NOTE_KEY = "summitready_adjust_note";
const SUBMITTED_KEY = "summitready_submitted_plan_sessions";
const HILLS_IN_PLAN_KEY = "summitready_hills_in_plan";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

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
  const [summitGoal, setSummitGoalState] = useState<SummitGoal | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingWeek[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [readinessScore, setReadinessScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [nearbyHills, setNearbyHills] = useState<NearbyHill[]>([]);
  const [hillsLoading, setHillsLoading] = useState(false);
  const [completedPlanSessions, setCompletedPlanSessions] = useState<Record<string, boolean>>({});
  const [assignedHills, setAssignedHills] = useState<Record<string, NearbyHill>>({});
  const [planAdjusting, setPlanAdjusting] = useState(false);
  const [planAdjustNote, setPlanAdjustNote] = useState<string | null>(null);
  const [submittedPlanSessions, setSubmittedPlanSessions] = useState<Record<string, boolean>>({});
  const [hillsInPlan, setHillsInPlan] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          GOAL_KEY, SESSIONS_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY,
        ]);
        const [goalStr, sessionsStr, planStr, hillsStr, completedStr, assignedStr, noteStr, submittedStr, hillsInPlanStr] =
          pairs.map(([, v]) => v);

        if (goalStr) {
          const goal: SummitGoal = JSON.parse(goalStr);
          const plan: TrainingWeek[] = planStr ? JSON.parse(planStr) : generatePlan(goal);
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
          setReadinessScore(calculateReadiness(goal, plan, storedSessions));
          if (noteStr) setPlanAdjustNote(noteStr);
          if (hillsInPlanStr) setHillsInPlan(JSON.parse(hillsInPlanStr));
        } else {
          const plan = generatePlan(DEMO_GOAL);
          setSummitGoalState(DEMO_GOAL);
          setTrainingPlan(plan);
          setSessions(DEMO_SESSIONS);
          setReadinessScore(calculateReadiness(DEMO_GOAL, plan, DEMO_SESSIONS));
          await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(DEMO_GOAL));
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(DEMO_SESSIONS));
          await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const setSummitGoal = useCallback(async (goal: SummitGoal) => {
    const plan = generatePlan(goal);
    setSummitGoalState(goal);
    setTrainingPlan(plan);
    setCompletedPlanSessions({});
    setAssignedHills({});
    setSubmittedPlanSessions({});
    setPlanAdjustNote(null);
    const score = calculateReadiness(goal, plan, sessions);
    setReadinessScore(score);
    await AsyncStorage.multiSet([
      [GOAL_KEY, JSON.stringify(goal)],
      [PLAN_KEY, JSON.stringify(plan)],
      [COMPLETED_KEY, "{}"],
      [ASSIGNED_KEY, "{}"],
      [SUBMITTED_KEY, "{}"],
      [ADJUST_NOTE_KEY, ""],
    ]);
  }, [sessions]);

  const addSession = useCallback(async (session: Omit<Session, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    const newSession: Session = { ...session, id };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }, [sessions, summitGoal, trainingPlan]);

  const updateSession = useCallback(async (id: string, updates: Partial<Session>) => {
    const updated = sessions.map(s => s.id === id ? { ...s, ...updates } : s);
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }, [sessions, summitGoal, trainingPlan]);

  const deleteSession = useCallback(async (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (summitGoal) setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  }, [sessions, summitGoal, trainingPlan]);

  const clearPlan = useCallback(async () => {
    setSummitGoalState(null);
    setTrainingPlan([]);
    setSessions([]);
    setNearbyHills([]);
    setCompletedPlanSessions({});
    setAssignedHills({});
    setSubmittedPlanSessions({});
    setHillsInPlan([]);
    setPlanAdjustNote(null);
    setReadinessScore(0);
    await AsyncStorage.multiRemove([
      GOAL_KEY, SESSIONS_KEY, PLAN_KEY, HILLS_KEY, COMPLETED_KEY, ASSIGNED_KEY, ADJUST_NOTE_KEY, SUBMITTED_KEY, HILLS_IN_PLAN_KEY,
    ]);
  }, []);

  const fetchNearbyHills = useCallback(async (radiusOverride?: number) => {
    if (!summitGoal) return;
    setHillsLoading(true);
    try {
      const radius = radiusOverride ?? summitGoal.maxRadius;
      const res = await fetch(`${API_BASE}/hills-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: summitGoal.location, radius }),
      });
      if (!res.ok) throw new Error("Hills lookup failed");
      const data: { hills: NearbyHill[] } = await res.json();
      setNearbyHills(data.hills);
      await AsyncStorage.setItem(HILLS_KEY, JSON.stringify(data.hills));
    } catch {}
    setHillsLoading(false);
  }, [summitGoal]);

  const togglePlanSession = useCallback(async (weekNum: number, sessionIdx: number) => {
    const key = `${weekNum}-${sessionIdx}`;
    const updated = { ...completedPlanSessions, [key]: !completedPlanSessions[key] };
    setCompletedPlanSessions(updated);
    // Recalculate readiness in real-time using checked-but-not-submitted sessions as virtual progress
    if (summitGoal) {
      const virtualCount = Object.keys(updated).filter(k => updated[k] && !submittedPlanSessions[k]).length;
      setReadinessScore(calculateReadiness(summitGoal, trainingPlan, sessions, { virtualSessionCount: virtualCount }));
    }
    await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(updated));
  }, [completedPlanSessions, submittedPlanSessions, summitGoal, trainingPlan, sessions]);

  const assignHillToSession = useCallback(async (weekNum: number, sessionIdx: number, hill: NearbyHill) => {
    const key = `${weekNum}-${sessionIdx}`;
    const updated = { ...assignedHills, [key]: hill };
    setAssignedHills(updated);
    await AsyncStorage.setItem(ASSIGNED_KEY, JSON.stringify(updated));
  }, [assignedHills]);

  function parseDuration(dur: string): number {
    if (dur.includes("hour")) {
      const m = dur.match(/(\d+)-(\d+)/);
      return m ? Math.round(((+m[1]) + (+m[2])) / 2 * 60) : 180;
    }
    const m = dur.match(/(\d+)-(\d+)/);
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
        toSubmit.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 6) + i,
          type: s.type,
          date: d.toISOString().split("T")[0],
          distance: s.type === "cardio" ? 5 : s.type === "hill" ? 6 : 10,
          elevationGain: s.targetElevation,
          duration: parseDuration(s.duration),
          effort: 3,
          notes: `Submitted from plan: ${s.label}`,
          completed: true,
          weekNumber: weekNum,
        });
        newSubmitted[key] = true;
      }
    });

    if (toSubmit.length === 0) return 0;

    const updated = [...toSubmit, ...sessions];
    setSessions(updated);
    setSubmittedPlanSessions(newSubmitted);
    setReadinessScore(calculateReadiness(summitGoal, trainingPlan, updated));
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(SUBMITTED_KEY, JSON.stringify(newSubmitted));
    return toSubmit.length;
  }, [trainingPlan, sessions, summitGoal, completedPlanSessions, submittedPlanSessions]);

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

      const updatedSessions = week.sessions.map(s =>
        s.type === "hill"
          ? { ...s, targetElevation: hill.elevation * hill.repeats, label: `${hill.name} × ${hill.repeats}` }
          : s
      );

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
        adjustNote: `Recalculated for ${hill.name} (${hill.elevation}m × ${hill.repeats} reps = ${hill.totalElevation}m)`,
      };
    });

    setTrainingPlan(updatedPlan);
    setReadinessScore(calculateReadiness(summitGoal, updatedPlan, sessions));
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updatedPlan));
    await AsyncStorage.setItem(HILLS_IN_PLAN_KEY, JSON.stringify(updatedInPlan));
  }, [summitGoal, trainingPlan, sessions, hillsInPlan]);

  const updateGoalLocation = useCallback(async (location: string) => {
    if (!summitGoal) return;
    const updated = { ...summitGoal, location };
    setSummitGoalState(updated);
    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(updated));
  }, [summitGoal]);

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
    } catch {}
    setPlanAdjusting(false);
  }, [summitGoal, trainingPlan, completedPlanSessions]);

  return (
    <AppContext.Provider value={{
      summitGoal, trainingPlan, sessions, readinessScore, isLoading,
      nearbyHills, hillsLoading, completedPlanSessions, assignedHills,
      planAdjusting, planAdjustNote, submittedPlanSessions,
      setSummitGoal, addSession, updateSession, deleteSession, clearPlan,
      fetchNearbyHills, togglePlanSession, assignHillToSession, adjustPlanWithAI,
      submitWeekSessions, hillsInPlan, addHillToPlan, updateGoalLocation,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
