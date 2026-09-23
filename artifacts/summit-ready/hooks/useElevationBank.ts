/**
 * The Elevation Bank query, in one place.
 *
 * Extracted while rebuilding Training Basecamp so the new tile and the existing
 * card read the SAME query, with the same cache key, the same stale time and
 * the same "refetch when a new activity lands" rule. Two components asking the
 * API separately is how two screens start disagreeing about a user's banked
 * ascent.
 *
 * This is plumbing only. It computes nothing: credit rules, qualification and
 * the lifetime total all stay in the Elevation Bank service behind the API.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/expo";
import {
  getGetElevationBankQueryKey,
  useGetElevationBank,
} from "@workspace/api-client-react";
import { useApp } from "@/context/AppContext";
import {
  getElevationBankPresentation,
  type ElevationBankPresentation,
} from "@/utils/elevationBankPresentation";

export interface UseElevationBankResult {
  presentation: ElevationBankPresentation;
  isSignedIn: boolean;
  refetch: () => void;
}

export function useElevationBank(): UseElevationBankResult {
  const { isLoaded, isSignedIn } = useAuth();
  const { sessions, exploreHikes } = useApp();

  const query = useGetElevationBank({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      staleTime: 30_000,
      queryKey: getGetElevationBankQueryKey(),
    },
  });

  /* A newly completed session or explore hike can add credit, so the total is
     re-read when the count strictly increases. */
  const previousActivityCount = useRef<number | null>(null);
  const completedActivityCount =
    sessions.filter((session) => session.completed).length + exploreHikes.length;

  useEffect(() => {
    if (
      previousActivityCount.current !== null
      && completedActivityCount > previousActivityCount.current
    ) {
      void query.refetch();
    }
    previousActivityCount.current = completedActivityCount;
  }, [completedActivityCount, query.refetch]);

  return {
    presentation: getElevationBankPresentation({
      isLoading: !isLoaded || query.isLoading,
      isError: query.isError,
      data: query.data,
    }),
    isSignedIn: Boolean(isSignedIn),
    refetch: () => { void query.refetch(); },
  };
}
