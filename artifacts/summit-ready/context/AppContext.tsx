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
  setSummitGoal: (goal: SummitGoal) => Promise<void>;
  addSession: (session: Omit<Session, "id">) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearPlan: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  summitGoal: null,
  trainingPlan: [],
  sessions: [],
  readinessScore: 0,
  isLoading: true,
  setSummitGoal: async () => {},
  addSession: async () => {},
  updateSession: async () => {},
  deleteSession: async () => {},
  clearPlan: async () => {},
});

const GOAL_KEY = "summitready_goal";
const SESSIONS_KEY = "summitready_sessions";

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

  useEffect(() => {
    (async () => {
      try {
        const [goalStr, sessionsStr] = await Promise.all([
          AsyncStorage.getItem(GOAL_KEY),
          AsyncStorage.getItem(SESSIONS_KEY),
        ]);

        if (goalStr) {
          const goal: SummitGoal = JSON.parse(goalStr);
          const plan = generatePlan(goal);
          const storedSessions: Session[] = sessionsStr ? JSON.parse(sessionsStr) : [];
          setSummitGoalState(goal);
          setTrainingPlan(plan);
          setSessions(storedSessions);
          setReadinessScore(calculateReadiness(goal, plan, storedSessions));
        } else {
          // Load demo data
          const plan = generatePlan(DEMO_GOAL);
          setSummitGoalState(DEMO_GOAL);
          setTrainingPlan(plan);
          setSessions(DEMO_SESSIONS);
          setReadinessScore(calculateReadiness(DEMO_GOAL, plan, DEMO_SESSIONS));
          await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(DEMO_GOAL));
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(DEMO_SESSIONS));
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const setSummitGoal = useCallback(async (goal: SummitGoal) => {
    const plan = generatePlan(goal);
    setSummitGoalState(goal);
    setTrainingPlan(plan);
    const score = calculateReadiness(goal, plan, sessions);
    setReadinessScore(score);
    await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(goal));
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
    setReadinessScore(0);
    await AsyncStorage.multiRemove([GOAL_KEY, SESSIONS_KEY]);
  }, []);

  return (
    <AppContext.Provider value={{ summitGoal, trainingPlan, sessions, readinessScore, isLoading, setSummitGoal, addSession, updateSession, deleteSession, clearPlan }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
