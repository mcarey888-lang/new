/**
 * Route DNA Calculation Service — Version 1
 *
 * Pure calculation functions plus DB upsert helpers.
 * All scores are clamped to 0–100 integers.
 *
 * Key constraint: UK training routes cannot reproduce altitude, so
 * `altitude_demand_score` is always 0 for routeKind='training'.
 */

import { db, routeDna } from "@workspace/db";
import type { InsertRouteDna } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface RouteMetrics {
  ascentM?:                  number | null;
  descentM?:                 number | null;
  distanceKm?:               number | null;
  /** Expedition routes use days; training routes use hours */
  typicalDays?:              number | null;
  typicalHours?:             number | null;
  longestContinuousClimbM?:  number | null;
  avgGradientPct?:           number | null;
  maxGradientPct?:           number | null;
  trailPct?:                 number | null;
  rockPct?:                  number | null;
  screePct?:                 number | null;
  snowIcePct?:               number | null;
  glacierPct?:               number | null;
  scramblingPct?:            number | null;
  viaFerrataPct?:            number | null;
  exposure15?:               number | null;
  navigation15?:             number | null;
  endurance15?:              number | null;
  loadCarry15?:              number | null;
  technicality15?:           number | null;
  /** Expedition routes only — altitude rating 1–5 */
  altitude15?:               number | null;
}

export interface RouteDnaScores {
  sustainedClimbingScore:      number;
  steepnessScore:              number;
  longDurationEnduranceScore:  number;
  rockyTerrainScore:           number;
  looseTerrainScore:           number;
  scramblingScore:             number;
  exposureScore:               number;
  navigationScore:             number;
  technicalMovementScore:      number;
  loadCarryingScore:           number;
  altitudeDemandScore:         number;
  recoveryDemandScore:         number;
  overallDifficultyScore:      number;
}

// ── Overall difficulty component weights (must sum to 1.0) ────────────────────
const OVERALL_WEIGHTS: Record<keyof Omit<RouteDnaScores, "overallDifficultyScore">, number> = {
  sustainedClimbingScore:     0.12,
  steepnessScore:             0.08,
  longDurationEnduranceScore: 0.12,
  rockyTerrainScore:          0.06,
  looseTerrainScore:          0.04,
  scramblingScore:            0.10,
  exposureScore:              0.10,
  navigationScore:            0.06,
  technicalMovementScore:     0.10,
  loadCarryingScore:          0.06,
  altitudeDemandScore:        0.08,
  recoveryDemandScore:        0.08,
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)));
}

function n(v: number | null | undefined, fallback = 0): number {
  return (v != null && isFinite(v)) ? v : fallback;
}

function norm(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(value / cap, 1) * 100;
}

function durationNorm(m: RouteMetrics, kind: "expedition" | "training"): number {
  if (kind === "expedition") {
    return norm(n(m.typicalDays), 10);
  }
  return norm(n(m.typicalHours), 12);
}

// ── 12 DNA dimensions ─────────────────────────────────────────────────────────

function sustainedClimbing(m: RouteMetrics, kind: "expedition" | "training"): number {
  const ascentNorm = norm(n(m.ascentM),  3000);
  const lccNorm    = norm(n(m.longestContinuousClimbM), 1500);
  const durNorm    = durationNorm(m, kind);
  return clamp(ascentNorm * 0.4 + lccNorm * 0.4 + durNorm * 0.2);
}

function steepness(m: RouteMetrics): number {
  return clamp(norm(n(m.avgGradientPct), 30) * 0.6 + norm(n(m.maxGradientPct), 60) * 0.4);
}

function longDurationEndurance(m: RouteMetrics, kind: "expedition" | "training"): number {
  return clamp(durationNorm(m, kind) * 0.5 + (n(m.endurance15) / 5) * 100 * 0.5);
}

function rockyTerrain(m: RouteMetrics): number {
  return clamp(n(m.rockPct) * 0.7 + n(m.screePct) * 0.3);
}

function looseTerrain(m: RouteMetrics): number {
  return clamp(n(m.screePct));
}

function scrambling(m: RouteMetrics): number {
  return clamp(
    n(m.scramblingPct) * 0.5 +
    (n(m.technicality15) / 5) * 100 * 0.3 +
    n(m.viaFerrataPct) * 0.2,
  );
}

function exposure(m: RouteMetrics): number {
  return clamp((n(m.exposure15) / 5) * 100);
}

function navigation(m: RouteMetrics): number {
  return clamp((n(m.navigation15) / 5) * 100);
}

function technicalMovement(m: RouteMetrics): number {
  return clamp(
    (n(m.technicality15) / 5) * 100 * 0.5 +
    n(m.scramblingPct) * 0.3 +
    n(m.rockPct) * (n(m.exposure15) / 5) * 0.2,
  );
}

function loadCarrying(m: RouteMetrics, kind: "expedition" | "training"): number {
  return clamp((n(m.loadCarry15) / 5) * 100 * 0.7 + durationNorm(m, kind) * 0.3);
}

function altitudeDemand(m: RouteMetrics, kind: "expedition" | "training"): number {
  if (kind === "training") return 0;
  return clamp((n(m.altitude15) / 5) * 100);
}

function recoveryDemand(m: RouteMetrics, kind: "expedition" | "training"): number {
  return clamp(
    durationNorm(m, kind) * 0.4 +
    (n(m.endurance15) / 5) * 100 * 0.4 +
    norm(n(m.ascentM), 3000) * 0.2,
  );
}

// ── Public calculation API ────────────────────────────────────────────────────

export function calculateDna(
  metrics: RouteMetrics,
  routeKind: "expedition" | "training",
): RouteDnaScores {
  const scores: Omit<RouteDnaScores, "overallDifficultyScore"> = {
    sustainedClimbingScore:     sustainedClimbing(metrics, routeKind),
    steepnessScore:             steepness(metrics),
    longDurationEnduranceScore: longDurationEndurance(metrics, routeKind),
    rockyTerrainScore:          rockyTerrain(metrics),
    looseTerrainScore:          looseTerrain(metrics),
    scramblingScore:            scrambling(metrics),
    exposureScore:              exposure(metrics),
    navigationScore:            navigation(metrics),
    technicalMovementScore:     technicalMovement(metrics),
    loadCarryingScore:          loadCarrying(metrics, routeKind),
    altitudeDemandScore:        altitudeDemand(metrics, routeKind),
    recoveryDemandScore:        recoveryDemand(metrics, routeKind),
  };

  let overall = 0;
  for (const [key, weight] of Object.entries(OVERALL_WEIGHTS)) {
    overall += scores[key as keyof typeof scores] * weight;
  }

  return { ...scores, overallDifficultyScore: clamp(overall) };
}

/** Shape an insert row — convenience wrapper used by import script */
export function dnaToInsert(
  scores: RouteDnaScores,
  target: { expeditionRouteId: number } | { trainingRouteId: number },
  version = 1,
) {
  return {
    ...(("expeditionRouteId" in target)
      ? { expeditionRouteId: target.expeditionRouteId, trainingRouteId: null }
      : { expeditionRouteId: null, trainingRouteId: target.trainingRouteId }),
    ...scores,
    calculationVersion: version,
  };
}

// ── DB upsert helpers ─────────────────────────────────────────────────────────
// Partial unique indexes on route_dna cannot be targeted by Drizzle's
// onConflictDoUpdate, so we use a select-then-update pattern instead.

export async function upsertExpeditionDna(
  expeditionRouteId: number,
  scores: RouteDnaScores,
  version = 1,
): Promise<void> {
  const [existing] = await db
    .select({ id: routeDna.id })
    .from(routeDna)
    .where(
      and(
        eq(routeDna.expeditionRouteId, expeditionRouteId),
        eq(routeDna.calculationVersion, version),
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(routeDna)
      .set({ ...scores, calculatedAt: new Date() })
      .where(eq(routeDna.id, existing.id));
  } else {
    const row: InsertRouteDna = {
      expeditionRouteId,
      trainingRouteId: null,
      ...scores,
      calculationVersion: version,
      calculatedAt: new Date(),
    };
    await db.insert(routeDna).values(row);
  }
}

export async function upsertTrainingDna(
  trainingRouteId: number,
  scores: RouteDnaScores,
  version = 1,
): Promise<void> {
  const [existing] = await db
    .select({ id: routeDna.id })
    .from(routeDna)
    .where(
      and(
        eq(routeDna.trainingRouteId, trainingRouteId),
        eq(routeDna.calculationVersion, version),
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(routeDna)
      .set({ ...scores, calculatedAt: new Date() })
      .where(eq(routeDna.id, existing.id));
  } else {
    const row: InsertRouteDna = {
      expeditionRouteId: null,
      trainingRouteId,
      ...scores,
      calculationVersion: version,
      calculatedAt: new Date(),
    };
    await db.insert(routeDna).values(row);
  }
}
