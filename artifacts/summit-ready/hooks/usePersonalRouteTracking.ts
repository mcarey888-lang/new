import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import { loadRoute } from "@/utils/plannedRouteApi";
import {
  personalRouteHandoff, readPersonalRouteHandoff, validPersonalRouteHandoff,
  type PersonalRouteHandoff,
} from "@/utils/personalRouteHandoff";

export function usePersonalRouteTracking(requestedId?: string) {
  const { userId, getToken, isLoaded } = useAuth();
  const token = useRef(getToken);
  token.current = getToken;
  const [restored, setRestored] = useState<PersonalRouteHandoff | null>(null);
  const [loaded, setLoaded] = useState<PersonalRouteHandoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const restoredContext = validPersonalRouteHandoff(restored, userId ?? "") ? restored : null;
  const id = requestedId || restoredContext?.route.id;
  const context = validPersonalRouteHandoff(loaded, userId ?? "", id) ? loaded :
    restoredContext?.route.id === id ? restoredContext : null;

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    if (!id || !isLoaded) return;
    if (!userId) { setError("Sign in to follow your saved route."); return; }
    if (restoredContext?.route.id === id) return;
    const owner = userId;
    void (async () => {
      const cached = await readPersonalRouteHandoff(owner, id);
      if (cancelled) return;
      if (cached) { setLoaded(cached); return; }
      const result = await loadRoute(id, () => token.current());
      if (cancelled) return;
      if (!result.ok) { setError(result.reason); return; }
      try { setLoaded(personalRouteHandoff(owner, result.value)); }
      catch (failure) { setError(failure instanceof Error ? failure.message : "Invalid saved route."); }
    })();
    return () => { cancelled = true; };
  }, [id, userId, isLoaded, restoredContext, attempt]);

  const restore = useCallback((value: unknown, owner: string) => {
    if (validPersonalRouteHandoff(value, owner)) setRestored(value);
  }, []);
  return {
    id, context, error, restore,
    ready: !id || !!context,
    retry: () => setAttempt(value => value + 1),
  };
}