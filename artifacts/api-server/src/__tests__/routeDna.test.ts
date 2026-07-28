import { describe, it, expect } from "vitest";
import { calculateDna, type RouteMetrics } from "../services/routeDna.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const highAltitudeExpedition: RouteMetrics = {
  ascentM:                 4800,
  descentM:                4800,
  distanceKm:              35,
  typicalDays:             8,
  longestContinuousClimbM: 1800,
  avgGradientPct:          28,
  maxGradientPct:          55,
  trailPct:                20,
  rockPct:                 35,
  screePct:                15,
  snowIcePct:              25,
  glacierPct:              5,
  scramblingPct:           30,
  viaFerrataPct:           0,
  exposure15:              4,
  navigation15:            4,
  endurance15:             5,
  loadCarry15:             4,
  technicality15:          4,
  altitude15:              5,
};

const flatUkRoute: RouteMetrics = {
  ascentM:                 120,
  descentM:                120,
  distanceKm:              8,
  typicalHours:            2.5,
  longestContinuousClimbM: 80,
  avgGradientPct:          4,
  maxGradientPct:          10,
  trailPct:                90,
  rockPct:                 5,
  screePct:                0,
  snowIcePct:              0,
  scramblingPct:           0,
  viaFerrataPct:           0,
  exposure15:              1,
  navigation15:            1,
  endurance15:             1,
  loadCarry15:             1,
  technicality15:          1,
};

const demandingUkRoute: RouteMetrics = {
  ascentM:                 950,
  descentM:                950,
  distanceKm:              18,
  typicalHours:            7,
  longestContinuousClimbM: 700,
  avgGradientPct:          22,
  maxGradientPct:          45,
  trailPct:                40,
  rockPct:                 40,
  screePct:                10,
  snowIcePct:              0,
  scramblingPct:           20,
  viaFerrataPct:           0,
  exposure15:              3,
  navigation15:            3,
  endurance15:             4,
  loadCarry15:             2,
  technicality15:          3,
};

const emptyMetrics: RouteMetrics = {};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("calculateDna — score range invariants", () => {
  it("all 13 scores stay in 0–100 for a high expedition route", () => {
    const dna = calculateDna(highAltitudeExpedition, "expedition");
    for (const [key, val] of Object.entries(dna)) {
      expect(val, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(val, `${key} should be <= 100`).toBeLessThanOrEqual(100);
    }
  });

  it("all 13 scores stay in 0–100 for a flat UK route", () => {
    const dna = calculateDna(flatUkRoute, "training");
    for (const [key, val] of Object.entries(dna)) {
      expect(val, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(val, `${key} should be <= 100`).toBeLessThanOrEqual(100);
    }
  });

  it("all 13 scores stay in 0–100 for empty metrics (edge case)", () => {
    const dna = calculateDna(emptyMetrics, "expedition");
    for (const [key, val] of Object.entries(dna)) {
      expect(val, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(val, `${key} should be <= 100`).toBeLessThanOrEqual(100);
    }
  });

  it("all 13 scores stay in 0–100 for empty metrics training", () => {
    const dna = calculateDna(emptyMetrics, "training");
    for (const [key, val] of Object.entries(dna)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

describe("calculateDna — altitude demand rule", () => {
  it("altitude_demand is always 0 for training routes", () => {
    const dna = calculateDna(demandingUkRoute, "training");
    expect(dna.altitudeDemandScore).toBe(0);
  });

  it("altitude_demand is always 0 for training routes with altitude metrics set", () => {
    const metricsWithAlt: RouteMetrics = { ...demandingUkRoute, altitude15: 5 };
    const dna = calculateDna(metricsWithAlt, "training");
    expect(dna.altitudeDemandScore).toBe(0);
  });

  it("altitude_demand > 70 for expedition route with altitude_1_5=5", () => {
    const dna = calculateDna(highAltitudeExpedition, "expedition");
    expect(dna.altitudeDemandScore).toBeGreaterThan(70);
  });

  it("altitude_demand = 0 for expedition route with altitude_1_5=0", () => {
    const lowAlt: RouteMetrics = { ...highAltitudeExpedition, altitude15: 0 };
    const dna = calculateDna(lowAlt, "expedition");
    expect(dna.altitudeDemandScore).toBe(0);
  });
});

describe("calculateDna — steepness scores", () => {
  it("flat UK route has steepness < 20", () => {
    const dna = calculateDna(flatUkRoute, "training");
    expect(dna.steepnessScore).toBeLessThan(20);
  });

  it("high-gradient expedition has steepness > 50", () => {
    const dna = calculateDna(highAltitudeExpedition, "expedition");
    expect(dna.steepnessScore).toBeGreaterThan(50);
  });
});

describe("calculateDna — overall difficulty", () => {
  it("overall difficulty is computed as a non-zero value for a demanding route", () => {
    const dna = calculateDna(highAltitudeExpedition, "expedition");
    expect(dna.overallDifficultyScore).toBeGreaterThan(30);
  });

  it("overall difficulty is lower for a flat UK route than a demanding expedition", () => {
    const expDna  = calculateDna(highAltitudeExpedition, "expedition");
    const trainDna = calculateDna(flatUkRoute, "training");
    expect(expDna.overallDifficultyScore).toBeGreaterThan(trainDna.overallDifficultyScore);
  });

  it("overall difficulty is an integer", () => {
    const dna = calculateDna(demandingUkRoute, "training");
    expect(Number.isInteger(dna.overallDifficultyScore)).toBe(true);
  });
});

describe("calculateDna — edge cases", () => {
  it("zero ascent produces sustainedClimbingScore of 0", () => {
    const dna = calculateDna({ ascentM: 0, longestContinuousClimbM: 0, typicalHours: 0 }, "training");
    expect(dna.sustainedClimbingScore).toBe(0);
  });

  it("null optional fields are treated as 0 (no error thrown)", () => {
    expect(() => calculateDna({ ascentM: null, rockPct: null }, "expedition")).not.toThrow();
  });

  it("extremely large values are clamped at 100", () => {
    const extreme: RouteMetrics = {
      ascentM:       999999,
      avgGradientPct: 999,
      maxGradientPct: 999,
      exposure15:     5,
      navigation15:   5,
      endurance15:    5,
      loadCarry15:    5,
      technicality15: 5,
      altitude15:     5,
      scramblingPct:  200,
      rockPct:        200,
      typicalDays:    100,
    };
    const dna = calculateDna(extreme, "expedition");
    for (const val of Object.values(dna)) {
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});
