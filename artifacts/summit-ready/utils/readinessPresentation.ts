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
