import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useSubscription } from "@/lib/revenuecat";
import { useApp, type SummitGoal } from "@/context/AppContext";
import { loadTrainingSetupDraft, promoteTrainingSetupDraft } from "@/utils/trainingSetupDraft";

/** A free setup is kept separate from saved plans and activity history. Only
 * verified Pro access can promote it through the existing plan generator. */
export function useTrainingSetupDraft() {
  const { userId } = useAuth();
  const { access } = useSubscription();
  const { setSummitGoal, changeSummit, summitGoal, trainingPlan, isLoading } = useApp();
  const activate = useRef({ createPlan: setSummitGoal, changePlan: changeSummit });
  activate.current = { createPlan: setSummitGoal, changePlan: changeSummit };
  const activePlan = useRef({ goal: summitGoal, available: trainingPlan.length > 0 });
  activePlan.current = { goal: summitGoal, available: trainingPlan.length > 0 };
  const activated = useRef<string | null>(null);
  const owner = useRef(userId);
  owner.current = userId;
  const busy = useRef(false);
  const mounted = useRef(true);
  const [saved, setSaved] = useState<{ owner: string; goal: SummitGoal | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    let live = true;
    setError(null);
    if (userId) void loadTrainingSetupDraft(userId).then(goal => {
      if (live) setSaved({ owner: userId, goal });
    }).catch(err => { if (live) setError(err instanceof Error ? err.message : "Could not load your saved profile."); });
    else setSaved(null);
    return () => { live = false; };
  }, [userId, attempt]));
  const draft = saved && saved.owner === userId ? saved.goal : null;
  useEffect(() => {
    if (isLoading || !access.training || !userId || !draft || busy.current) return;
    const account = userId;
    busy.current = true;
    setPreparing(true);
    setError(null);
    void (async () => {
      try {
        const remaining = await promoteTrainingSetupDraft({
          userId: account, goal: draft, canTrain: access.training,
          activeGoal: activePlan.current.goal, hasPlan: activePlan.current.available,
          activated, ...activate.current,
        });
        if (mounted.current && owner.current === account) setSaved({ owner: account, goal: remaining });
      } catch (err) {
        if (mounted.current && owner.current === account) setError(err instanceof Error ? err.message : "Your profile is saved, but your programme could not be prepared. Please retry.");
      } finally {
        busy.current = false;
        if (mounted.current) {
          setPreparing(false);
          if (owner.current !== account) setAttempt(value => value + 1);
        }
      }
    })();
  }, [isLoading, access.training, userId, draft, attempt]);
  return { draft, error, preparing, loading: isLoading || (!!userId && saved?.owner !== userId && !error), retry: () => setAttempt(value => value + 1) };
}
