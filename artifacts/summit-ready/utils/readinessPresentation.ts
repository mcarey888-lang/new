/**
 * Readiness presentation adapter.
 *
 * Maps what Readiness 2.0 already returned onto the approved Full Readiness
 * visual. It is a PRESENTATION layer and contains no scoring: every number it
 * emits was produced by `utils/readinessV2.ts`.
 *
 * The one piece of genuine mapping is the status label. The engine's states are
 * `available | degraded | unavailable`; the approved design shows BUILDING.
 * Those are not the same vocabulary, so the mapping is declared here, once,
 * rather than guessed per screen — and it never invents a score to go with it.
 */
import type { ReadinessDimensionName, ReadinessResult, ReadinessState } from "./readinessV2";

export type ReadinessDisplayStatus = "ready" | "nearly" | "building" | "pending" | "unavailable";

export interface PillarDisplay {
  key: ReadinessDimensionName;
  /** Short label from the approved design. */
  label: string;
  /** Null means the engine had no eligible evidence — never render this as 0. */
  score: number | null;
  /** True when the dimension could not be scored at all. */
  missing: boolean;
}

/** Approved pillar order and labels: Endurance · Elevation · Consistency · Experience. */
export const PILLAR_ORDER: ReadinessDimensionName[] = [
  "endurance", "elevationCapacity", "consistency", "mountainExperience",
];
export const PILLAR_LABELS: Record<ReadinessDimensionName, string> = {
  endurance: "Endurance",
  elevationCapacity: "Elevation",
  consistency: "Consistency",
  mountainExperience: "Experience",
};

export const STATUS_COPY: Record<ReadinessDisplayStatus, { label: string; detail: string }> = {
  ready:       { label: "READY",     detail: "Your evidence supports this objective." },
  nearly:      { label: "NEARLY",    detail: "Close. Keep the sessions going." },
  building:    { label: "BUILDING",  detail: "Still gathering evidence across all four pillars." },
  pending:     { label: "PENDING",   detail: "Waiting on your latest activity to be processed." },
  unavailable: { label: "UNAVAILABLE", detail: "Readiness needs a summit goal and some recorded activity." },
};

/**
 * Derive the display status.
 *
 * `degraded` means the engine scored fewer than all four pillars — the user is
 * still building evidence, which is exactly what BUILDING communicates. A
 * missing score never becomes a zero and never becomes "ready".
 */
export function readinessStatus(
  state: ReadinessState | undefined,
  overallScore: number | null | undefined,
  opts: { processing?: boolean } = {},
): ReadinessDisplayStatus {
  if (opts.processing) return "pending";
  if (!state || state === "unavailable" || overallScore === null || overallScore === undefined) {
    return "unavailable";
  }
  if (state === "degraded") return "building";
  if (overallScore >= 70) return "ready";
  if (overallScore >= 50) return "nearly";
  return "building";
}

export function pillars(result: ReadinessResult | null | undefined): PillarDisplay[] {
  return PILLAR_ORDER.map((key) => {
    const dim = result?.dimensions?.[key];
    const score = dim?.score ?? null;
    return { key, label: PILLAR_LABELS[key], score, missing: score === null };
  });
}

/**
 * Projected readiness, kept structurally separate from the earned score so a
 * screen cannot render one where the other belongs.
 *
 * `delta` is whatever the Readiness engine's next-action projection reported.
 * This function does not compute a projection; it only formats one.
 */
export interface ProjectionDisplay {
  current: number;
  projected: number;
  delta: number;
}
export function projection(
  overallScore: number | null | undefined,
  projectedDelta: number | null | undefined,
): ProjectionDisplay | null {
  if (overallScore === null || overallScore === undefined) return null;
  if (projectedDelta === null || projectedDelta === undefined || projectedDelta <= 0) return null;
  const projected = Math.min(100, overallScore + projectedDelta);
  if (projected <= overallScore) return null;
  return { current: overallScore, projected, delta: projected - overallScore };
}

/** Formats a possibly-missing score. Never prints "0" for "unknown". */
export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? "—" : `${Math.round(score)}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Pillar detail — added for the Full Readiness rebuild.

   The approved design opens a pillar and explains it in four parts: what it
   measures, the evidence behind it, why it sits where it does, and what would
   move it.

   · WHAT IT MEASURES is fixed descriptive copy about the pillar itself. It is
     the same sentence for every user, so it belongs here as UI copy, not as
     data — and it states nothing about any particular person.
   · WHY is the engine's own per-dimension `explanation`. Never rewritten.
   · WHAT WILL MOVE IT is only shown when the engine's next action targets that
     pillar. Production produces no per-pillar advice, and this layer does not
     invent one.
   ────────────────────────────────────────────────────────────────────────── */

export const PILLAR_MEASURES: Record<ReadinessDimensionName, string> = {
  endurance:
    "Your ability to keep moving at a steady effort for many hours — time on feet, not pace.",
  elevationCapacity:
    "Height gained and how repeatably you can gain it, week after week.",
  consistency:
    "How reliably you complete training, weighted towards your recent weeks.",
  mountainExperience:
    "Real mountain days, height reached, and exposure to the terrain your goal demands.",
};

/** A pillar is a GAP when the engine listed it as one. Never a threshold here. */
export interface PillarDetail extends PillarDisplay {
  /** The engine's own explanation for this dimension. */
  explanation: string | null;
  /** True when Readiness 2.0 listed this dimension among its gaps. */
  isGap: boolean;
  /** True when Readiness 2.0 listed it among the user's strengths. */
  isStrength: boolean;
  /** True when the engine's next action targets this dimension. */
  isFocus: boolean;
  /** How many pieces of evidence the engine attributed to it. */
  evidenceCount: number;
  measures: string;
}

export function pillarDetails(
  result: ReadinessResult | null | undefined,
  focusDimension?: ReadinessDimensionName | null,
): PillarDetail[] {
  const gaps = new Set(result?.gaps ?? []);
  const strengths = new Set(result?.strengths ?? []);
  return PILLAR_ORDER.map((key) => {
    const dim = result?.dimensions?.[key];
    const score = dim?.score ?? null;
    return {
      key,
      label: PILLAR_LABELS[key],
      score,
      missing: score === null,
      explanation: dim?.explanation?.trim() || null,
      isGap: gaps.has(key),
      isStrength: strengths.has(key),
      isFocus: focusDimension === key,
      evidenceCount: dim?.evidenceIds?.length ?? 0,
      measures: PILLAR_MEASURES[key],
    };
  });
}
