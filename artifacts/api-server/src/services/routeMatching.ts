/**
 * Route Matching Service
 *
 * Scores UK training routes against a target expedition route using
 * weighted DNA similarity. Weights are loaded from the `match_weights` table.
 *
 * Critical safety rule: no function in this file may ever produce output
 * that claims a UK training route "fully simulates" an alpine or high-altitude
 * expedition. Warnings are always generated for altitude, glacier, and snow
 * demands.
 */

import { db } from "@workspace/db";
import {
  expeditionRoutes,
  trainingRoutes,
  routeDna,
  matchWeights,
  routeMatches,
} from "@workspace/db/schema";
import type {
  ExpeditionRoute,
  TrainingRoute,
  RouteDna,
  MatchWeight,
  InsertRouteMatch,
} from "@workspace/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import type { RouteDnaScores } from "./routeDna.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchResult {
  trainingRoute:  TrainingRoute;
  trainingDna:    RouteDnaScores;
  score:          number;
  matchReasons:   string[];
  warnings:       string[];
}

export interface WeightsMap {
  [metric: string]: number;
}

// ── DNA metric key → RouteDnaScores key mapping ───────────────────────────────
// Match_Weights sheet metric names → our DNA score field names
const METRIC_TO_DNA: Record<string, keyof RouteDnaScores> = {
  sustained_climbing:      "sustainedClimbingScore",
  steepness:               "steepnessScore",
  long_duration_endurance: "longDurationEnduranceScore",
  rocky_terrain:           "rockyTerrainScore",
  loose_terrain:           "looseTerrainScore",
  scrambling:              "scramblingScore",
  exposure:                "exposureScore",
  navigation:              "navigationScore",
  technical_movement:      "technicalMovementScore",
  load_carrying:           "loadCarryingScore",
  altitude_demand:         "altitudeDemandScore",
  recovery_demand:         "recoveryDemandScore",
};

// ── Score computation ─────────────────────────────────────────────────────────

/**
 * Compute a 0–100 match score between expedition and training route DNA
 * using the supplied weights map.
 * Uses (1 - |expScore - trainScore| / 100) per metric, weighted.
 */
export function computeMatchScore(
  expeditionDna: RouteDnaScores,
  trainingDna:   RouteDnaScores,
  weights:       WeightsMap,
): number {
  let totalWeight = 0;
  let weightedSim = 0;

  for (const [metric, dnaKey] of Object.entries(METRIC_TO_DNA)) {
    const w = weights[metric] ?? 0;
    if (w === 0) continue;

    const expScore   = expeditionDna[dnaKey] ?? 0;
    const trainScore = trainingDna[dnaKey]   ?? 0;

    // Skip altitude comparison — UK routes always 0, expedition may be high.
    // Instead of penalising the score, the limitation is captured in warnings.
    if (metric === "altitude_demand") continue;

    const similarity = 1 - Math.abs(expScore - trainScore) / 100;
    weightedSim  += similarity * w;
    totalWeight  += w;
  }

  if (totalWeight === 0) return 0;
  return Math.round(Math.max(0, Math.min(100, (weightedSim / totalWeight) * 100)));
}

// ── Reason generation ─────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  sustained_climbing:      "sustained climbing demand",
  steepness:               "gradient profile",
  long_duration_endurance: "long-duration endurance",
  rocky_terrain:           "rocky terrain",
  loose_terrain:           "loose/scree terrain",
  scrambling:              "scrambling sections",
  exposure:                "exposed positions",
  navigation:              "navigation complexity",
  technical_movement:      "technical movement",
  load_carrying:           "load carrying",
  recovery_demand:         "recovery demand",
};

export function buildMatchReasons(
  expeditionDna: RouteDnaScores,
  trainingDna:   RouteDnaScores,
): string[] {
  const reasons: string[] = [];

  for (const [metric, dnaKey] of Object.entries(METRIC_TO_DNA)) {
    if (metric === "altitude_demand") continue;

    const expScore   = expeditionDna[dnaKey] ?? 0;
    const trainScore = trainingDna[dnaKey]   ?? 0;
    const diff       = Math.abs(expScore - trainScore);

    if (diff <= 12 && expScore >= 40) {
      const label = METRIC_LABELS[metric] ?? metric;
      reasons.push(`Strong match on ${label} (expedition ${expScore}, training ${trainScore})`);
    }
  }

  return reasons.slice(0, 4); // cap at 4 most relevant reasons
}

/**
 * Build mandatory limitation warnings for an expedition route.
 * NEVER states "fully simulates" — these are explicit caveats.
 */
export function buildMatchWarnings(expeditionRoute: ExpeditionRoute): string[] {
  const warnings: string[] = [];

  if ((expeditionRoute.altitude15 ?? 0) >= 3) {
    warnings.push(
      "Does not reproduce altitude acclimatisation — this route reaches significant altitude that UK training cannot simulate"
    );
  }
  if ((expeditionRoute.glacierPct ?? 0) > 0) {
    warnings.push(
      "Does not reproduce glacier travel — crampons, rope work, and crevasse awareness require dedicated alpine training"
    );
  }
  if ((expeditionRoute.snowIcePct ?? 0) > 10) {
    warnings.push(
      "Does not reproduce sustained snow/ice conditions — UK training provides terrain and fitness preparation only"
    );
  }

  return warnings;
}

// ── Load weights from DB ──────────────────────────────────────────────────────

export async function loadActiveWeights(version = 1): Promise<WeightsMap> {
  const rows = await db
    .select({ metric: matchWeights.metric, weight: matchWeights.weight })
    .from(matchWeights)
    .where(
      and(
        eq(matchWeights.version, version),
        eq(matchWeights.active, true),
      )
    );

  const map: WeightsMap = {};
  for (const row of rows) {
    map[row.metric] = row.weight;
  }
  return map;
}

// ── DNA row → RouteDnaScores helper ──────────────────────────────────────────

function dnaToDnaScores(row: RouteDna): RouteDnaScores {
  return {
    sustainedClimbingScore:     row.sustainedClimbingScore     ?? 0,
    steepnessScore:             row.steepnessScore             ?? 0,
    longDurationEnduranceScore: row.longDurationEnduranceScore ?? 0,
    rockyTerrainScore:          row.rockyTerrainScore          ?? 0,
    looseTerrainScore:          row.looseTerrainScore          ?? 0,
    scramblingScore:            row.scramblingScore            ?? 0,
    exposureScore:              row.exposureScore              ?? 0,
    navigationScore:            row.navigationScore            ?? 0,
    technicalMovementScore:     row.technicalMovementScore     ?? 0,
    loadCarryingScore:          row.loadCarryingScore          ?? 0,
    altitudeDemandScore:        row.altitudeDemandScore        ?? 0,
    recoveryDemandScore:        row.recoveryDemandScore        ?? 0,
    overallDifficultyScore:     row.overallDifficultyScore     ?? 0,
  };
}

// ── Main matching function ────────────────────────────────────────────────────

export async function matchExpeditionRouteAgainstTraining(
  expeditionRouteId: number,
  options: { regionFilter?: string; limit?: number } = {},
): Promise<{ results: MatchResult[]; expeditionRoute: ExpeditionRoute | null; warnings: string[] }> {
  const { regionFilter, limit = 10 } = options;

  // Load the expedition route and its DNA
  const [expRouteRow] = await db
    .select()
    .from(expeditionRoutes)
    .where(eq(expeditionRoutes.id, expeditionRouteId))
    .limit(1);

  if (!expRouteRow) {
    return { results: [], expeditionRoute: null, warnings: ["Expedition route not found"] };
  }

  const [expDnaRow] = await db
    .select()
    .from(routeDna)
    .where(
      and(
        eq(routeDna.expeditionRouteId, expeditionRouteId),
        eq(routeDna.calculationVersion, 1),
      )
    )
    .limit(1);

  if (!expDnaRow) {
    return {
      results: [],
      expeditionRoute: expRouteRow,
      warnings: ["No DNA scores calculated for this expedition route yet — run /admin/recalculate-dna first"],
    };
  }

  const expDna = dnaToDnaScores(expDnaRow);

  // Load weights
  const weights = await loadActiveWeights();

  // Load all active training routes (with optional region filter)
  const conditions = [eq(trainingRoutes.active, true)];
  if (regionFilter) conditions.push(eq(trainingRoutes.region, regionFilter));

  const trainRouteRows = await db
    .select()
    .from(trainingRoutes)
    .where(and(...conditions));

  if (trainRouteRows.length === 0) {
    return {
      results: [],
      expeditionRoute: expRouteRow,
      warnings: regionFilter
        ? [`No active training routes found for region: ${regionFilter}`]
        : ["No active training routes found in the database"],
    };
  }

  // Load DNA for all training routes in one query
  const trainRouteIds = trainRouteRows.map((r) => r.id);
  const trainDnaRows = await db
    .select()
    .from(routeDna)
    .where(
      and(
        isNotNull(routeDna.trainingRouteId),
        eq(routeDna.calculationVersion, 1),
      )
    );

  const dnaByTrainingRouteId = new Map<number, RouteDna>();
  for (const dna of trainDnaRows) {
    if (dna.trainingRouteId != null) {
      dnaByTrainingRouteId.set(dna.trainingRouteId, dna);
    }
  }

  // Score each training route
  const results: MatchResult[] = [];
  const MIN_SCORE = 20;

  for (const trainRoute of trainRouteRows) {
    if (!trainRouteIds.includes(trainRoute.id)) continue;

    const dnaRow = dnaByTrainingRouteId.get(trainRoute.id);
    if (!dnaRow) continue; // skip routes without DNA

    const trainDna  = dnaToDnaScores(dnaRow);
    const score     = computeMatchScore(expDna, trainDna, weights);

    if (score < MIN_SCORE) continue;

    const reasons  = buildMatchReasons(expDna, trainDna);
    const warns    = buildMatchWarnings(expRouteRow);

    results.push({ trainingRoute: trainRoute, trainingDna: trainDna, score, matchReasons: reasons, warnings: warns });
  }

  // Sort by score descending, take top N
  results.sort((a, b) => b.score - a.score);

  const globalWarnings = buildMatchWarnings(expRouteRow);

  return {
    results: results.slice(0, limit),
    expeditionRoute: expRouteRow,
    warnings: globalWarnings,
  };
}

// ── Recalculate and persist all matches ───────────────────────────────────────

export async function recalculateAllMatches(
  algorithmVersion = 1,
): Promise<{ updated: number; created: number }> {
  const weights = await loadActiveWeights();

  const allExpRoutes = await db
    .select()
    .from(expeditionRoutes)
    .where(eq(expeditionRoutes.active, true));

  const allTrainRoutes = await db
    .select()
    .from(trainingRoutes)
    .where(eq(trainingRoutes.active, true));

  // Load all DNA records
  const allExpDna = await db
    .select()
    .from(routeDna)
    .where(and(isNotNull(routeDna.expeditionRouteId), eq(routeDna.calculationVersion, 1)));

  const allTrainDna = await db
    .select()
    .from(routeDna)
    .where(and(isNotNull(routeDna.trainingRouteId), eq(routeDna.calculationVersion, 1)));

  const expDnaMap   = new Map(allExpDna.map((d) => [d.expeditionRouteId!, d]));
  const trainDnaMap = new Map(allTrainDna.map((d) => [d.trainingRouteId!, d]));

  let created = 0;
  let updated = 0;

  for (const expRoute of allExpRoutes) {
    const expDnaRow = expDnaMap.get(expRoute.id);
    if (!expDnaRow) continue;
    const expDna = dnaToDnaScores(expDnaRow);

    for (const trainRoute of allTrainRoutes) {
      const trainDnaRow = trainDnaMap.get(trainRoute.id);
      if (!trainDnaRow) continue;
      const trainDna = dnaToDnaScores(trainDnaRow);

      const score    = computeMatchScore(expDna, trainDna, weights);
      const reasons  = buildMatchReasons(expDna, trainDna);
      const warnings = buildMatchWarnings(expRoute);

      const insertRow: InsertRouteMatch = {
        expeditionRouteId: expRoute.id,
        trainingRouteId:   trainRoute.id,
        score,
        matchReasons:      reasons,
        warnings,
        algorithmVersion,
        calculatedAt:      new Date(),
      };

      const result = await db
        .insert(routeMatches)
        .values(insertRow)
        .onConflictDoUpdate({
          target: [
            routeMatches.expeditionRouteId,
            routeMatches.trainingRouteId,
            routeMatches.algorithmVersion,
          ],
          set: {
            score,
            matchReasons: reasons,
            warnings,
            calculatedAt: new Date(),
          },
        })
        .returning({ id: routeMatches.id });

      if (result.length > 0) created++; // simplification — onConflict means either create or update
    }
  }

  return { created, updated };
}
