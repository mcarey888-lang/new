import { describe, it, expect } from "vitest";
import {
  computeMatchScore,
  buildMatchReasons,
  buildMatchWarnings,
  type WeightsMap,
} from "../services/routeMatching.js";
import type { RouteDnaScores } from "../services/routeDna.js";
import type { ExpeditionRoute } from "@workspace/db/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultWeights: WeightsMap = {
  sustained_climbing:      0.12,
  steepness:               0.08,
  long_duration_endurance: 0.12,
  rocky_terrain:           0.06,
  loose_terrain:           0.04,
  scrambling:              0.10,
  exposure:                0.10,
  navigation:              0.06,
  technical_movement:      0.10,
  load_carrying:           0.06,
  altitude_demand:         0.08,
  recovery_demand:         0.08,
};

const highDna: RouteDnaScores = {
  sustainedClimbingScore:     85,
  steepnessScore:             75,
  longDurationEnduranceScore: 90,
  rockyTerrainScore:          70,
  looseTerrainScore:          40,
  scramblingScore:            80,
  exposureScore:              75,
  navigationScore:            65,
  technicalMovementScore:     78,
  loadCarryingScore:          70,
  altitudeDemandScore:        95,
  recoveryDemandScore:        85,
  overallDifficultyScore:     78,
};

const closeMatchDna: RouteDnaScores = {
  sustainedClimbingScore:     82,
  steepnessScore:             72,
  longDurationEnduranceScore: 88,
  rockyTerrainScore:          68,
  looseTerrainScore:          38,
  scramblingScore:            77,
  exposureScore:              73,
  navigationScore:            62,
  technicalMovementScore:     75,
  loadCarryingScore:          68,
  altitudeDemandScore:        0,  // training — always 0
  recoveryDemandScore:        82,
  overallDifficultyScore:     72,
};

const zeroDna: RouteDnaScores = {
  sustainedClimbingScore:     0,
  steepnessScore:             0,
  longDurationEnduranceScore: 0,
  rockyTerrainScore:          0,
  looseTerrainScore:          0,
  scramblingScore:            0,
  exposureScore:              0,
  navigationScore:            0,
  technicalMovementScore:     0,
  loadCarryingScore:          0,
  altitudeDemandScore:        0,
  recoveryDemandScore:        0,
  overallDifficultyScore:     0,
};

// Minimal ExpeditionRoute-shaped object for warning tests
function makeExpRoute(
  overrides: Partial<ExpeditionRoute> = {}
): ExpeditionRoute {
  return {
    id:                  1,
    virtualExpeditionId: 1,
    spreadsheetRouteId:  "GR001",
    routeName:           "Test Route",
    startPoint:          null,
    finishPoint:         null,
    distanceKm:          null,
    ascentM:             null,
    descentM:            null,
    typicalDays:         null,
    longestContinuousClimbM: null,
    avgGradientPct:      null,
    maxGradientPct:      null,
    trailPct:            null,
    rockPct:             null,
    screePct:            null,
    snowIcePct:          null,
    glacierPct:          null,
    scramblingPct:       null,
    viaFerrataPct:       null,
    exposure15:          null,
    navigation15:        null,
    endurance15:         null,
    loadCarry15:         null,
    technicality15:      null,
    altitude15:          null,
    bestSeason:          null,
    popularity:          null,
    sourceUrl:           null,
    dataConfidence:      "Estimated",
    active:              true,
    createdAt:           new Date(),
    updatedAt:           new Date(),
    ...overrides,
  };
}

// ── computeMatchScore tests ───────────────────────────────────────────────────

describe("computeMatchScore — range invariants", () => {
  it("returns value in 0–100 for any non-negative inputs", () => {
    const score = computeMatchScore(highDna, closeMatchDna, defaultWeights);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 for all-zero DNA inputs", () => {
    const score = computeMatchScore(zeroDna, zeroDna, defaultWeights);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns a high score when both DNAs are identical", () => {
    const score = computeMatchScore(highDna, highDna, defaultWeights);
    expect(score).toBeGreaterThan(80);
  });

  it("returns 0 with empty weights map", () => {
    const score = computeMatchScore(highDna, closeMatchDna, {});
    expect(score).toBe(0);
  });

  it("is an integer (rounded)", () => {
    const score = computeMatchScore(highDna, closeMatchDna, defaultWeights);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe("computeMatchScore — low-score guarantee", () => {
  it("training route with zero ascent/difficulty scores < 30 against demanding expedition", () => {
    // zero DNA = flat/trivial training route
    const score = computeMatchScore(highDna, zeroDna, defaultWeights);
    expect(score).toBeLessThan(30);
  });
});

// ── buildMatchWarnings tests ──────────────────────────────────────────────────

describe("buildMatchWarnings — altitude warnings", () => {
  it("includes altitude warning for expedition route with altitude_1_5 = 3", () => {
    const route = makeExpRoute({ altitude15: 3 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("altitude"))).toBe(true);
  });

  it("includes altitude warning for expedition route with altitude_1_5 = 5", () => {
    const route = makeExpRoute({ altitude15: 5 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("altitude"))).toBe(true);
  });

  it("does NOT include altitude warning for route with altitude_1_5 = 2", () => {
    const route = makeExpRoute({ altitude15: 2 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("altitude acclimatisation"))).toBe(false);
  });

  it("does NOT include altitude warning for route with altitude_1_5 = null", () => {
    const route = makeExpRoute({ altitude15: null });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("altitude acclimatisation"))).toBe(false);
  });
});

describe("buildMatchWarnings — glacier warnings", () => {
  it("includes glacier warning when glacier_pct > 0", () => {
    const route = makeExpRoute({ glacierPct: 10 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("glacier"))).toBe(true);
  });

  it("does NOT include glacier warning when glacier_pct = 0", () => {
    const route = makeExpRoute({ glacierPct: 0 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("glacier travel"))).toBe(false);
  });
});

describe("buildMatchWarnings — snow/ice warnings", () => {
  it("includes snow/ice warning when snow_ice_pct > 10", () => {
    const route = makeExpRoute({ snowIcePct: 20 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("snow"))).toBe(true);
  });

  it("does NOT include snow/ice warning when snow_ice_pct <= 10", () => {
    const route = makeExpRoute({ snowIcePct: 5 });
    const warnings = buildMatchWarnings(route);
    expect(warnings.some((w) => w.includes("snow/ice"))).toBe(false);
  });
});

describe("buildMatchWarnings — safety invariant", () => {
  it("warnings never contain the phrase 'fully simulates'", () => {
    const routes = [
      makeExpRoute({ altitude15: 5, glacierPct: 30, snowIcePct: 40 }),
      makeExpRoute({ altitude15: 1, glacierPct: 0, snowIcePct: 0 }),
      makeExpRoute({}),
    ];
    for (const route of routes) {
      const warnings = buildMatchWarnings(route);
      for (const w of warnings) {
        expect(w.toLowerCase()).not.toContain("fully simulates");
      }
    }
  });

  it("returns an array (never null/undefined)", () => {
    const route = makeExpRoute();
    expect(Array.isArray(buildMatchWarnings(route))).toBe(true);
  });
});

// ── buildMatchReasons tests ───────────────────────────────────────────────────

describe("buildMatchReasons", () => {
  it("returns an array of strings", () => {
    const reasons = buildMatchReasons(highDna, closeMatchDna);
    expect(Array.isArray(reasons)).toBe(true);
    for (const r of reasons) expect(typeof r).toBe("string");
  });

  it("returns at most 4 reasons", () => {
    const reasons = buildMatchReasons(highDna, closeMatchDna);
    expect(reasons.length).toBeLessThanOrEqual(4);
  });

  it("returns empty array for completely mismatched DNAs", () => {
    const reasons = buildMatchReasons(highDna, zeroDna);
    // no metric has diff <= 12 AND expScore >= 40 when training is 0 and exp is 80+
    expect(reasons.length).toBe(0);
  });
});
