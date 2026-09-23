/**
 * Assembles the engine-supplied facts the Coach Insight card draws.
 *
 * Every field here is READ from an authoritative source:
 *   · mountain name        → summit goal (Summit Data Engine backed)
 *   · current readiness    → Readiness 2.0 (`useReadinessV2().result.overallScore`)
 *   · projected readiness  → Readiness 2.0's own next-action projection
 *   · priority session     → the Training Plan's next incomplete session
 *
 * Nothing is computed, estimated or inferred. If a source has not produced a
 * value, the field stays null and the card omits that row rather than showing
 * a plausible-looking number.
 */
import type { CoachFacts } from "./coachInsightPresentation";
import { projection } from "./readinessPresentation";

/** The subset of `PlanSession` this adapter reads. */
export interface PlanSessionLike {
  label?: string | null;
  targetElevation?: number | null;
  duration?: string | null;
}

export interface CoachFactsInput {
  mountainName?: string | null;
  /** Readiness 2.0 overall score. Null when the engine could not score. */
  overallScore?: number | null;
  /** Delta from Readiness 2.0's next-action projection. Null when absent. */
  projectedDelta?: number | null;
  /** The Training Plan's next incomplete session, if there is one. */
  nextSession?: PlanSessionLike | null;
  /** Day label for that session, when the plan supplies one. */
  nextSessionDay?: string | null;
}

export function buildCoachFacts(input: CoachFactsInput): CoachFacts {
  const proj = projection(input.overallScore ?? null, input.projectedDelta ?? null);
  const s = input.nextSession ?? null;
  return {
    mountainName: input.mountainName?.trim() || null,
    currentReadiness: input.overallScore ?? null,
    /* Only ever the engine's projection — never current + a guess. */
    projectedReadiness: proj ? proj.projected : null,
    nextSessionTitle: s?.label?.trim() || null,
    nextSessionElevationM:
      typeof s?.targetElevation === "number" && Number.isFinite(s.targetElevation) && s.targetElevation > 0
        ? s.targetElevation
        : null,
    nextSessionDuration: s?.duration?.trim() || null,
    nextSessionDay: input.nextSessionDay?.trim() || null,
  };
}
