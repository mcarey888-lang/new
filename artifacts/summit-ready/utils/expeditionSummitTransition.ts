import type { SavedExpedition } from "@/context/AppContext";

export type SummitTransitionState = "not_ready" | "ready" | "started" | "completed";
export type SummitTransitionEvent = "eligibility" | "cinematic_ready" | "complete" | "reopen";

export type SummitTransitionInput = {
  eligible: boolean;
  expeditionStatus?: SavedExpedition["expeditionStatus"] | null;
  visualStarted?: boolean;
  completionAwarded?: boolean;
};

/**
 * Derives the monotonic summit handoff state from local expedition state.
 * Visual replay/reopen never becomes a second completion award.
 */
export function selectSummitTransition(input: SummitTransitionInput): SummitTransitionState {
  if (input.completionAwarded || input.expeditionStatus === "complete") return "completed";
  if (input.visualStarted) return "started";
  return input.eligible ? "ready" : "not_ready";
}

export function advanceSummitTransition(
  state: SummitTransitionState,
  event: SummitTransitionEvent,
): SummitTransitionState {
  if (state === "completed") return state;
  if (event === "complete") return state === "started" || state === "ready" ? "completed" : state;
  if (event === "cinematic_ready") return state === "ready" || state === "started" ? "started" : state;
  if (event === "eligibility") return state === "not_ready" ? "ready" : state;
  // Reopening is visual-only; preserve the persisted award state.
  return state;
}