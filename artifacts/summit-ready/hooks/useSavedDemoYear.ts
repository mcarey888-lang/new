import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedHeaders, responseError } from "@/utils/authRequest";

type DemoProfile = { enabled: boolean; createdAt: string | null };
type State = DemoProfile & { loading: boolean; busy: boolean; error: string | null };
const EMPTY: State = { enabled: false, createdAt: null, loading: false, busy: false, error: null };
const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

export function useSavedDemoYear() {
  const { isLoaded, userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    setState({ ...EMPTY, loading: !!userId });
    if (!isLoaded || !userId) return;
    let cancelled = false;
    const owner = userId;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error("Sign in to load your sample year.");
        const response = await fetch(`${BASE_URL}/api/user/demo-profile`, {
          headers: authenticatedHeaders(token),
          cache: "no-store",
        });
        if (!response.ok) throw await responseError(response, "Could not load sample year");
        const profile = await response.json() as DemoProfile;
        if (!cancelled && ownerRef.current === owner) setState({ ...profile, loading: false, busy: false, error: null });
      } catch (error) {
        if (!cancelled && ownerRef.current === owner) setState({ ...EMPTY, error: String(error) });
      }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, userId]);

  const update = useCallback(async (method: "PUT" | "DELETE") => {
    const owner = ownerRef.current;
    if (!owner) return;
    setState(current => ({ ...current, busy: true, error: null }));
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error("Sign in to save your sample year.");
      const response = await fetch(`${BASE_URL}/api/user/demo-profile`, {
        method,
        headers: authenticatedHeaders(token),
      });
      if (!response.ok) throw await responseError(response, "Could not update sample year");
      const profile = await response.json() as DemoProfile;
      if (ownerRef.current === owner) setState({ ...profile, loading: false, busy: false, error: null });
    } catch (error) {
      if (ownerRef.current === owner) setState(current => ({ ...current, busy: false, error: String(error) }));
    }
  }, []);
  return { ...state, add: () => update("PUT"), remove: () => update("DELETE") };
}