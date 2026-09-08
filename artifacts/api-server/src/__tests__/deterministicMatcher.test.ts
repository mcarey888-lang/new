import { describe, expect, it } from "vitest";
import type { Hill } from "../routes/hills-unified.js";
import type { TargetMountainProfile } from "../routes/virtual-expedition.js";
import {
  bridgeElevationGap,
  matchDeterministicExpedition,
} from "../services/virtualExpedition/deterministicMatcher.js";

function hill(name: string, elevation: number, overrides: Partial<Hill> = {}): Hill {
  return {
    name,
    elevation,
    distance: 8,
    repeats: 1,
    totalElevation: elevation,
    surface: "Rocky path",
    grade: "Hard",
    emoji: "mountain",
    routeType: "hill",
    estimatedTime: "3 h",
    ...overrides,
  };
}

function profile(overrides: Partial<TargetMountainProfile> = {}): TargetMountainProfile {
  return {
    name: "Target",
    country: "Test",
    summitElevation: 8_000,
    totalElevationGain: 2_000,
    totalDistance: 32,
    estimatedDays: 2,
    day1ElevationGain: 1_000,
    day2ElevationGain: 1_000,
    maxDailyElevation: 1_000,
    difficulty: "Hard",
    technicalGrade: null,
    altitudeExposure: "High",
    notes: "Narration is irrelevant to matching.",
    routeDna: {
      scrambling: 5,
      exposure: 5,
      ridgeTravel: 6,
      endurance: 8,
      technicalMovement: 5,
      navigationRequired: 4,
      steepness: 7,
      scenicQuality: 8,
      descentDifficulty: 5,
      sustainedClimbing: 8,
    },
    ...overrides,
  };
}

const candidates = [
  hill("Alpha Ridge", 620),
  hill("Bravo Fell", 540, { surface: "Grass trail", routeType: "circular" }),
  hill("Charlie Pike", 460, { routeDistance: 10 }),
  hill("Delta Tor", 380, { grade: "Moderate" }),
];

describe("deterministic expedition matcher", () => {
  it("returns a stable result using candidate names and complete score components", () => {
    const first = matchDeterministicExpedition(candidates, profile());
    const second = matchDeterministicExpedition(candidates, profile());

    expect(first).toEqual(second);
    expect(first.matchMethod).toBe("deterministic_route_facts_v1");
    expect(first.selectedHills.every(selected =>
      candidates.some(candidate => candidate.name === selected.name))).toBe(true);
    expect(first.rankedCandidates[0].components).toEqual(expect.objectContaining({
      ascentContribution: expect.any(Number),
      duration: expect.any(Number),
      gradeDifficulty: expect.any(Number),
      terrainRouteType: expect.any(Number),
      distance: expect.any(Number),
      hazardCompatibility: expect.any(Number),
    }));
  });

  it("reaches the target band when feasible with bounded diverse repeats", () => {
    const result = matchDeterministicExpedition(candidates, profile());
    expect(result.targetRatio).toBeGreaterThanOrEqual(0.9);
    expect(result.targetRatio).toBeLessThanOrEqual(1.1);
    expect(result.selectedHills.length).toBeLessThanOrEqual(8);
    expect(result.selectedHills.every(selected => selected.repeats <= 3)).toBe(true);
    expect(new Set(result.selectedHills.map(selected =>
      selected.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())).size)
      .toBe(result.selectedHills.length);
  });

  it("caps repeats in the standalone elevation bridge", () => {
    const result = bridgeElevationGap(
      [hill("Alpha Ridge", 300)],
      [hill("Alpha Ridge", 300), hill("alpha-ridge", 300)],
      2_000,
    );
    expect(result).toHaveLength(1);
    expect(result[0].repeats).toBe(3);
  });

  it("returns the closest safe result with an explicit impossible shortfall", () => {
    const result = matchDeterministicExpedition(
      [hill("Small Hill", 100), hill("Tiny Hill", 50)],
      profile({ totalElevationGain: 2_000 }),
    );
    expect(result.achievedAscent).toBe(450);
    expect(result.warnings.some(warning => warning.toLowerCase().includes("shortfall"))).toBe(true);
  });

  it("uses route ascent rather than summit elevation as the target", () => {
    const lowSummit = matchDeterministicExpedition(candidates, profile({ summitElevation: 2_100 }));
    const highSummit = matchDeterministicExpedition(candidates, profile({ summitElevation: 8_800 }));
    expect(lowSummit).toEqual(highSummit);
    expect(lowSummit.achievedAscent).toBeGreaterThanOrEqual(1_800);
  });

  it("is deterministic without narration or AI data", () => {
    const sparse = profile({ notes: "", technicalGrade: null });
    expect(matchDeterministicExpedition(candidates, sparse))
      .toEqual(matchDeterministicExpedition([...candidates], sparse));
  });

  it("scores missing route distance as unknown instead of using user proximity", () => {
    const result = matchDeterministicExpedition(
      [hill("No Route Length", 500, { distance: 8_000, routeDistance: undefined })],
      profile(),
    );

    expect(result.rankedCandidates[0].components.distance).toBe(0);
  });

  it("preserves distant same-name routes and selects the same identities after permutation", () => {
    const sameNameRoutes = [
      hill("Twin Peak", 450, {
        routeIdentityKey: "route:v1:seeded_osm:twin-peak:51.00000,-3.00000",
        lat: 51, lng: -3, routeDistance: 8,
      }),
      hill("twin-peak", 450, {
        routeIdentityKey: "route:v1:seeded_osm:twin-peak:51.05000,-3.00000",
        lat: 51.05, lng: -3, routeDistance: 8,
      }),
      hill("Other Hill", 200, { lat: 51.02, lng: -3.1, routeDistance: 8 }),
    ];
    const first = matchDeterministicExpedition(
      sameNameRoutes,
      profile({ totalElevationGain: 900 }),
    );
    const permuted = matchDeterministicExpedition(
      [sameNameRoutes[2], sameNameRoutes[1], sameNameRoutes[0]],
      profile({ totalElevationGain: 900 }),
    );

    expect(first.rankedCandidates.filter(candidate =>
      candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === "twin peak"))
      .toHaveLength(2);
    expect(first.selectedHills.map(selected => [selected.name, selected.lat, selected.lng]))
      .toEqual(permuted.selectedHills.map(selected => [selected.name, selected.lat, selected.lng]));
    expect(new Set(first.rankedCandidates
      .filter(candidate => candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === "twin peak")
      .map(candidate => candidate.routeIdentityKey))).toEqual(new Set([
        "route:v1:seeded_osm:twin-peak:51.00000,-3.00000",
        "route:v1:seeded_osm:twin-peak:51.05000,-3.00000",
      ]));
  });

  it("collapses normalized-name routes only when geographically near", () => {
    const result = matchDeterministicExpedition([
      hill("Near Peak", 500, { lat: 51, lng: -3, routeDistance: 8 }),
      hill("near-peak", 500, { lat: 51.005, lng: -3, routeDistance: 8 }),
    ], profile());

    expect(result.rankedCandidates).toHaveLength(1);
  });

  it("prefers a compact higher-quality plan within the band over exact arithmetic", () => {
    const result = matchDeterministicExpedition([
      hill("Exact But Weak", 1_000, {
        grade: "Easy",
        surface: "Unknown",
        routeDistance: undefined,
        estimatedTime: "30 min",
      }),
      hill("Quality One", 450, { routeDistance: 8 }),
      hill("Quality Two", 500, { routeDistance: 8 }),
    ], profile({ totalElevationGain: 1_000 }));

    expect(result.achievedAscent).toBe(950);
    expect(result.selectedHills.map(selected => selected.name).sort())
      .toEqual(["Quality One", "Quality Two"]);
  });

  it("bounds combination work for a large catalogue while retaining diagnostics", () => {
    const largeCatalogue = Array.from({ length: 500 }, (_, index) =>
      hill(`Candidate ${String(index).padStart(3, "0")}`, 300 + index % 400, {
        lat: 50 + index / 10_000,
        lng: -3 - index / 10_000,
        routeDistance: 6 + index % 8,
      }));
    const started = Date.now();
    const result = matchDeterministicExpedition(largeCatalogue, profile());
    const elapsedMs = Date.now() - started;

    expect(result.rankedCandidates).toHaveLength(500);
    // Generous enough for shared CI, but catches accidental optimisation over all 500.
    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("reserves ascent-diverse pool slots for a feasible lower-ranked large route", () => {
    const distractors = Array.from({ length: 60 }, (_, index) =>
      hill(`Short high-quality ${String(index).padStart(2, "0")}`, 60, {
        lat: 50 + index / 1_000,
        lng: -3,
        routeDistance: 8,
      }));
    const largeRoute = hill("Low-ranked 1900m route", 1_900, {
      lat: 52,
      lng: -4,
      grade: "Easy",
      surface: "Unknown",
      routeDistance: undefined,
      estimatedTime: "30 min",
    });
    const input = [...distractors, largeRoute];
    const first = matchDeterministicExpedition(input, profile());
    const permuted = matchDeterministicExpedition([...input].reverse(), profile());

    expect(first.rankedCandidates.findIndex(candidate => candidate.name === largeRoute.name))
      .toBeGreaterThanOrEqual(36);
    expect(first.targetRatio).toBeGreaterThanOrEqual(0.9);
    expect(first.selectedHills.some(selected => selected.name === largeRoute.name)).toBe(true);
    expect(first.selectedHills).toEqual(permuted.selectedHills);
  });

  it("keeps a target-relevant 1900m route among 36 small and ten oversized routes", () => {
    const small = Array.from({ length: 36 }, (_, index) =>
      hill(`Small quality ${String(index).padStart(2, "0")}`, 50, {
        lat: 50 + index / 1_000,
        lng: -3,
        routeDistance: 8,
      }));
    const oversized = Array.from({ length: 10 }, (_, index) =>
      hill(`Oversized ${String(index).padStart(2, "0")}`, 3_000, {
        lat: 52 + index / 1_000,
        lng: -4,
        routeDistance: 8,
      }));
    const relevant = hill("Reproduced 1900m route", 1_900, {
      lat: 54,
      lng: -5,
      grade: "Easy",
      surface: "Unknown",
      routeDistance: undefined,
      estimatedTime: "30 min",
    });
    const result = matchDeterministicExpedition(
      [...small, ...oversized, relevant],
      profile({ totalElevationGain: 2_000 }),
    );

    expect(result.rankedCandidates.findIndex(candidate => candidate.name === relevant.name))
      .toBeGreaterThanOrEqual(36);
    expect(result.targetRatio).toBeGreaterThanOrEqual(0.9);
    expect(result.targetRatio).toBeLessThanOrEqual(1.1);
    expect(result.selectedHills.some(selected => selected.name === relevant.name)).toBe(true);
  });
});