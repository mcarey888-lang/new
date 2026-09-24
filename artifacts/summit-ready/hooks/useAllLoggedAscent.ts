import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  calculateAllLoggedAscent,
  type AllLoggedAscent,
} from "@/utils/allLoggedAscent";

export type UseAllLoggedAscentResult =
  | { status: "loading"; ascentM: null }
  | AllLoggedAscent;

/**
 * Reads every completed ascent currently persisted in the app's local
 * activity history. It intentionally does not fall back to the credited
 * Elevation Bank or synthesize a total while local persistence is hydrating.
 */
export function useAllLoggedAscent(): UseAllLoggedAscentResult {
  const { isLoading, sessions, exploreHikes } = useApp();
  const total = useMemo(
    () => calculateAllLoggedAscent(sessions, exploreHikes),
    [sessions, exploreHikes],
  );

  if (isLoading) return { status: "loading", ascentM: null };
  return total;
}