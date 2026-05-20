import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  getProgress: (challengeId: string) => number;
  getActiveChallenge: (challengeId: string) => ActiveChallenge | undefined;
}

const ChallengesContext = createContext<ChallengesState>({
  activeChallenges: [],
  startChallenge: async () => {},
  abandonChallenge: async () => {},
  logActivity: async () => {},
  getProgress: () => 0,
  getActiveChallenge: () => undefined,
});

const CHALLENGES_KEY = "summitready_challenges";

export function ChallengesProvider({ children }: { children: React.ReactNode }) {
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const { addSession, appMode } = useApp();

  useEffect(() => {
    AsyncStorage.getItem(CHALLENGES_KEY).then(raw => {
      if (raw) setActiveChallenges(JSON.parse(raw) as ActiveChallenge[]);
    });
  }, []);

  async function persist(updated: ActiveChallenge[]) {
    setActiveChallenges(updated);
    await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(updated));
  }

  const startChallenge = useCallback(async (challengeId: string) => {
    const already = activeChallenges.find(c => c.challengeId === challengeId && !c.completed);
    if (already) return;
    const newChallenge: ActiveChallenge = {
      challengeId,
      startedAt: new Date().toISOString(),
      activities: [],
      completed: false,
      completedAt: null,
    };
    await persist([...activeChallenges, newChallenge]);
  }, [activeChallenges]);

  const abandonChallenge = useCallback(async (challengeId: string) => {
    await persist(activeChallenges.filter(c => c.challengeId !== challengeId || c.completed));
  }, [activeChallenges]);

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
    const updated = activeChallenges.map(ac => {
      if (ac.challengeId !== activityData.challengeId || ac.completed) return ac;
      const updatedActivities = [activity, ...ac.activities];

      const current = updatedActivities.reduce((sum, a) => {
        if (template?.metric === "hikes") return sum + 1;
        return sum + a.elevationGain;
      }, 0);

      const isNowComplete = template ? current >= template.targetValue : false;

      return {
        ...ac,
        activities: updatedActivities,
        completed: isNowComplete,
        completedAt: isNowComplete ? new Date().toISOString() : null,
      };
    });

    await persist(updated);

    if (activityData.elevationGain > 0 || activityData.distance > 0) {
      await addSession({
        date: activityData.date,
        type: activityData.elevationGain > 200 ? "hill" : "cardio",
        distance: activityData.distance,
        elevationGain: activityData.elevationGain,
        duration: activityData.duration,
        effort: 3,
        notes: `[Challenge: ${template?.title ?? activityData.challengeId}] ${activityData.notes}`.trim(),
        completed: true,
        weekNumber: 0,
      });
    }
  }, [activeChallenges, addSession]);

  const getProgress = useCallback((challengeId: string): number => {
    const ac = activeChallenges.find(c => c.challengeId === challengeId);
    if (!ac) return 0;
    const template = getChallenge(challengeId);
    if (!template) return 0;
    const current = ac.activities.reduce((sum, a) => {
      if (template.metric === "hikes") return sum + 1;
      return sum + a.elevationGain;
    }, 0);
    return Math.min(current, template.targetValue);
  }, [activeChallenges]);

  const getActiveChallenge = useCallback((challengeId: string) => {
    return activeChallenges.find(c => c.challengeId === challengeId);
  }, [activeChallenges]);

  return (
    <ChallengesContext.Provider value={{
      activeChallenges,
      startChallenge,
      abandonChallenge,
      logActivity,
      getProgress,
      getActiveChallenge,
    }}>
      {children}
    </ChallengesContext.Provider>
  );
}

export function useChallenges() {
  return useContext(ChallengesContext);
}
