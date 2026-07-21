import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { getChallenge } from "@/constants/challenges";

export interface ChallengeActivity {
  id: string;
  challengeId: string;
  title: string;
  date: string;
  elevationGain: number;
  distance: number;
  duration: number;
  notes: string;
  createdAt: string;
}

export interface ActiveChallenge {
  challengeId: string;
  startedAt: string;
  activities: ChallengeActivity[];
  completed: boolean;
  completedAt: string | null;
}

interface ChallengesState {
  activeChallenges: ActiveChallenge[];
  startChallenge: (challengeId: string) => Promise<void>;
  abandonChallenge: (challengeId: string) => Promise<void>;
  logActivity: (activity: Omit<ChallengeActivity, "id" | "createdAt">) => Promise<void>;
  logActivityOnly: (activity: Omit<ChallengeActivity, "id" | "createdAt">) => Promise<void>;
  getProgress: (challengeId: string) => number;
  getActiveChallenge: (challengeId: string) => ActiveChallenge | undefined;
  clearChallenges: () => Promise<void>;
}

const ChallengesContext = createContext<ChallengesState>({
  activeChallenges: [],
  startChallenge: async () => {},
  abandonChallenge: async () => {},
  logActivity: async () => {},
  logActivityOnly: async () => {},
  getProgress: () => 0,
  getActiveChallenge: () => undefined,
  clearChallenges: async () => {},
});

const _FLAT_CHALLENGES_KEY = "summitready_challenges";

export function ChallengesProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const _uid = userId ?? "";
  const CHALLENGES_KEY = _uid ? `summitready_challenges_${_uid}` : _FLAT_CHALLENGES_KEY;
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const { addSession, logExploreHike, appMode } = useApp();

  // Always-current ref — callbacks read this to avoid stale closures
  const latestRef = useRef<ActiveChallenge[]>([]);
  useEffect(() => { latestRef.current = activeChallenges; }, [activeChallenges]);

  useEffect(() => {
    (async () => {
      let raw = await AsyncStorage.getItem(CHALLENGES_KEY);
      if (!raw && _uid) {
        const flatData = await AsyncStorage.getItem(_FLAT_CHALLENGES_KEY);
        if (flatData) {
          await AsyncStorage.setItem(CHALLENGES_KEY, flatData);
          await AsyncStorage.removeItem(_FLAT_CHALLENGES_KEY);
          raw = flatData;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveChallenge[];
        const corrected = parsed.map(ac => {
          const template = getChallenge(ac.challengeId);
          if (!template) return ac;
          const total = ac.activities.reduce((sum, a) => {
            if (template.metric === "hikes") return sum + 1;
            return sum + a.elevationGain;
          }, 0);
          const shouldBeCompleted = total >= template.targetValue;
          if (ac.completed === shouldBeCompleted) return ac;
          return {
            ...ac,
            completed: shouldBeCompleted,
            completedAt: shouldBeCompleted ? (ac.completedAt ?? new Date().toISOString()) : null,
          };
        });
        const anyChanged = corrected.some((c, i) => c !== parsed[i]);
        if (anyChanged) {
          await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(corrected));
        }
        setActiveChallenges(corrected);
        latestRef.current = corrected;
      }
    })();
  }, []);

  async function persist(updated: ActiveChallenge[]) {
    latestRef.current = updated;
    setActiveChallenges(updated);
    await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(updated));
  }

  const startChallenge = useCallback(async (challengeId: string) => {
    const current = latestRef.current;
    const already = current.find(c => c.challengeId === challengeId && !c.completed);
    if (already) return;
    const newChallenge: ActiveChallenge = {
      challengeId,
      startedAt: new Date().toISOString(),
      activities: [],
      completed: false,
      completedAt: null,
    };
    await persist([...current, newChallenge]);
  }, []);

  const abandonChallenge = useCallback(async (challengeId: string) => {
    await persist(latestRef.current.filter(c => c.challengeId !== challengeId || c.completed));
  }, []);

  const logActivity = useCallback(async (
    activityData: Omit<ChallengeActivity, "id" | "createdAt">
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const activity: ChallengeActivity = {
      ...activityData,
      id,
      createdAt: new Date().toISOString(),
    };

    const template = getChallenge(activityData.challengeId);
    const current = latestRef.current;
    const updated = current.map(ac => {
      if (ac.challengeId !== activityData.challengeId || ac.completed) return ac;
      const updatedActivities = [activity, ...ac.activities];

      const total = updatedActivities.reduce((sum, a) => {
        if (template?.metric === "hikes") return sum + 1;
        return sum + a.elevationGain;
      }, 0);

      const isNowComplete = template ? total >= template.targetValue : false;

      return {
        ...ac,
        activities: updatedActivities,
        completed: isNowComplete,
        completedAt: isNowComplete ? new Date().toISOString() : null,
      };
    });

    await persist(updated);

    const challengeNote = `[Challenge: ${template?.title ?? activityData.challengeId}] ${activityData.notes}`.trim();

    if (activityData.elevationGain > 0 || activityData.distance > 0) {
      await addSession({
        date: activityData.date,
        type: activityData.elevationGain > 200 ? "hill" : "cardio",
        distance: activityData.distance,
        elevationGain: activityData.elevationGain,
        duration: activityData.duration,
        effort: 3,
        notes: challengeNote,
        completed: true,
        weekNumber: 0,
      });
    }

    await logExploreHike({
      name: activityData.title || "Challenge session",
      date: activityData.date,
      distance: activityData.distance,
      elevationGain: activityData.elevationGain,
      timeTaken: activityData.duration,
      notes: challengeNote,
    });
  }, [addSession, logExploreHike]);

  const logActivityOnly = useCallback(async (
    activityData: Omit<ChallengeActivity, "id" | "createdAt">
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const activity: ChallengeActivity = {
      ...activityData,
      id,
      createdAt: new Date().toISOString(),
    };
    const template = getChallenge(activityData.challengeId);
    const current = latestRef.current;
    const updated = current.map(ac => {
      if (ac.challengeId !== activityData.challengeId || ac.completed) return ac;
      const updatedActivities = [activity, ...ac.activities];
      const total = updatedActivities.reduce((sum, a) => {
        if (template?.metric === "hikes") return sum + 1;
        return sum + a.elevationGain;
      }, 0);
      const isNowComplete = template ? total >= template.targetValue : false;
      return {
        ...ac,
        activities: updatedActivities,
        completed: isNowComplete,
        completedAt: isNowComplete ? new Date().toISOString() : null,
      };
    });
    await persist(updated);
  }, []);

  const getProgress = useCallback((challengeId: string): number => {
    const ac = latestRef.current.find(c => c.challengeId === challengeId);
    if (!ac) return 0;
    const template = getChallenge(challengeId);
    if (!template) return 0;
    const current = ac.activities.reduce((sum, a) => {
      if (template.metric === "hikes") return sum + 1;
      return sum + a.elevationGain;
    }, 0);
    return Math.min(current, template.targetValue);
  }, []);

  const getActiveChallenge = useCallback((challengeId: string) => {
    return latestRef.current.find(c => c.challengeId === challengeId);
  }, []);

  const clearChallenges = useCallback(async () => {
    await persist([]);
  }, []);

  return (
    <ChallengesContext.Provider value={{
      activeChallenges,
      startChallenge,
      abandonChallenge,
      logActivity,
      logActivityOnly,
      getProgress,
      getActiveChallenge,
      clearChallenges,
    }}>
      {children}
    </ChallengesContext.Provider>
  );
}

export function useChallenges() {
  return useContext(ChallengesContext);
}
