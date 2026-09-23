/**
 * Coach Insight presentation adapter.
 *
 * THE CONTRACT this file exists to enforce:
 *
 *     CANONICAL USER / TRAINING DATA
 *       → SUMMITREADY ENGINES
 *       → AUTHORITATIVE STATE          (Readiness, Plan, Elevation Bank, mountain)
 *       → AI COACH                     (interpretation only)
 *       → EXPLANATION / GUIDANCE
 *
 * The Coach is an interpretation layer. It must never become the source of an
 * authoritative number. So the view model is split in two:
 *
 *   `facts`          — supplied by the engines. The Coach cannot write these.
 *   `interpretation` — the assessment text the /coach-assessment service returns.
 *
 * `buildCoachInsight` takes the two separately and refuses to let the
 * interpretation contribute a fact. If the engines have not produced a value,
 * the field is null and the UI shows nothing rather than letting the model's
 * prose stand in for it.
 *
 * This does NOT replace the existing AI Coach service or its fetch/retry
 * behaviour — that stays in the screen. This only shapes what gets drawn.
 */

/** Exactly the shape the existing /coach-assessment endpoint returns. */
export interface CoachAssessment {
  summary: string;
  tone: "positive" | "warning" | "neutral";
  tips: string[];
}

/** Values the engines own. Every one may legitimately be unavailable. */
export interface CoachFacts {
  mountainName: string | null;
  currentReadiness: number | null;
  projectedReadiness: number | null;
  nextSessionTitle: string | null;
  nextSessionElevationM: number | null;
  nextSessionDuration: string | null;
  nextSessionDay: string | null;
}

export type CoachInsightState =
  | { kind: "hidden" }                                   /* no goal yet */
  | { kind: "locked" }                                   /* entitlement gate */
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; facts: CoachFacts; interpretation: CoachAssessment; disclaimer: string };

/** Shown on the card itself, never tucked away. Guidance, never a guarantee. */
export const COACH_DISCLAIMER =
  "AI guidance only — not medical advice. Mountain conditions change; always check forecasts " +
  "and local guidance before heading out.";

export const EMPTY_FACTS: CoachFacts = {
  mountainName: null, currentReadiness: null, projectedReadiness: null,
  nextSessionTitle: null, nextSessionElevationM: null, nextSessionDuration: null,
  nextSessionDay: null,
};

/**
 * Normalise engine-supplied facts. Anything non-finite becomes null so a bad
 * upstream value can never render as a confident number.
 */
export function normaliseFacts(input: Partial<CoachFacts> | null | undefined): CoachFacts {
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  const pct = (v: unknown): number | null => {
    const n = num(v);
    return n === null ? null : Math.max(0, Math.min(100, Math.round(n)));
  };
  return {
    mountainName: str(input?.mountainName),
    currentReadiness: pct(input?.currentReadiness),
    projectedReadiness: pct(input?.projectedReadiness),
    nextSessionTitle: str(input?.nextSessionTitle),
    nextSessionElevationM: num(input?.nextSessionElevationM),
    nextSessionDuration: str(input?.nextSessionDuration),
    nextSessionDay: str(input?.nextSessionDay),
  };
}

export function buildCoachInsight(args: {
  hasGoal: boolean;
  entitled: boolean;
  loading: boolean;
  error: boolean;
  assessment: CoachAssessment | null | undefined;
  facts: Partial<CoachFacts> | null | undefined;
}): CoachInsightState {
  if (!args.hasGoal) return { kind: "hidden" };
  if (!args.entitled) return { kind: "locked" };
  if (args.error) return { kind: "error" };
  if (args.loading || !args.assessment) return { kind: "loading" };
  return {
    kind: "ready",
    facts: normaliseFacts(args.facts),
    interpretation: {
      summary: args.assessment.summary,
      tone: args.assessment.tone,
      /* Cap what the card shows; the full list stays available in the fuller
         Coach experience rather than being truncated away entirely. */
      tips: Array.isArray(args.assessment.tips) ? args.assessment.tips : [],
    },
    disclaimer: COACH_DISCLAIMER,
  };
}

/** Compact Basecamp treatment: identity, one assessment line, one next action. */
export function compactCoach(state: CoachInsightState, maxTips = 1) {
  if (state.kind !== "ready") return null;
  return {
    facts: state.facts,
    summary: state.interpretation.summary,
    tone: state.interpretation.tone,
    nextActions: state.interpretation.tips.slice(0, maxTips),
    hasMore: state.interpretation.tips.length > maxTips,
    disclaimer: state.disclaimer,
  };
}

/**
 * True when the card has an engine-supplied projection worth drawing. Used to
 * decide whether the readiness row appears at all — the Coach's prose is never
 * enough on its own.
 */
export function hasProjection(facts: CoachFacts): boolean {
  return facts.currentReadiness !== null
    && facts.projectedReadiness !== null
    && facts.projectedReadiness > facts.currentReadiness;
}
