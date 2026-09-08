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
    routeDistance: 8,
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
      surface: "Rocky path",
      routeDistance: 8,
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
      surface: "Rocky path",
      routeDistance: 8,
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

  it("rejects incomplete routes and weak generic Ways, while retaining a structurally strong Way", () => {
    const result = matchDeterministicExpedition([
      hill("Incomplete Ridge", 500, { routeDistance: undefined }),
      hill("Riverside Way", 80, {
        routeType: "out-and-back", routeDistance: 12, estimatedTime: "3 h",
        grade: "Easy", surface: "gravel trail", summitElevationASL: 120,
      }),
      hill("Summit Way", 500, {
        routeType: "out-and-back", routeDistance: 7, estimatedTime: "3 h",
        grade: "Hard", surface: "rocky ridge", summitElevationASL: 900,
      }),
    ], profile({ totalElevationGain: 1_000 }));

    expect(result.rankedCandidates.find(candidate => candidate.name === "Incomplete Ridge")?.eligible).toBe(false);
    expect(result.rankedCandidates.find(candidate => candidate.name === "Riverside Way")?.eligible).toBe(false);
    expect(result.rankedCandidates.find(candidate => candidate.name === "Summit Way")?.eligible).toBe(true);
    expect(result.selectedHills.map(candidate => candidate.name)).toEqual(["Summit Way"]);
  });

  it("accepts a substantial named summit route when a legacy seed lacks summit altitude", () => {
    const result = matchDeterministicExpedition([
      hill("Castle Crag Route", 240, {
        routeType: "circular",
        routeDistance: 8,
        estimatedTime: "2 h 48 min",
        surface: "mountain",
        summitElevationASL: undefined,
        routeDataStatus: "seeded_estimate",
      }),
      hill("Eamont Way", 537, {
        routeType: "out-and-back",
        routeDistance: 17.9,
        estimatedTime: "6 h 16 min",
        surface: "mountain",
        summitElevationASL: undefined,
        routeDataStatus: "seeded_estimate",
      }),
    ], profile({ totalElevationGain: 1_000 }));

    expect(result.rankedCandidates.find(candidate =>
      candidate.name === "Castle Crag Route")?.eligible).toBe(true);
    expect(result.rankedCandidates.find(candidate =>
      candidate.name === "Eamont Way")?.eligible).toBe(false);
    expect(result.selectedHills.map(selected => selected.name))
      .toEqual(["Castle Crag Route"]);
  });

  it("uses local summit altitude only as objective quality, never as route ascent", () => {
    const result = matchDeterministicExpedition([
      hill("High summit route", 300, { summitElevationASL: 1_500, routeDistance: 6 }),
      hill("Low summit route", 300, { summitElevationASL: 250, routeDistance: 6 }),
    ], profile({ totalElevationGain: 900 }));

    expect(result.achievedAscent).toBe(900);
    expect(result.selectedHills[0].name).toBe("High summit route");
  });

  it("excludes incompatible hazards but permits compatible technical route DNA", () => {
    const technical = hill("Technical ridge", 900, {
      hazardLevel: "high", routeDistance: 10, surface: "rocky scrambling ridge",
    });
    const incompatible = matchDeterministicExpedition([technical], profile({
      routeDna: { ...profile().routeDna, exposure: 2, scrambling: 2, technicalMovement: 2 },
    }));
    const compatible = matchDeterministicExpedition([technical], profile());

    expect(incompatible.selectedHills).toHaveLength(0);
    expect(incompatible.rankedCandidates[0].rejectionReasons).toContain("hazard incompatible with target DNA");
    expect(compatible.selectedHills).toHaveLength(1);
  });

  it("selects technical terrain for a technical target but excludes it for a non-technical target", () => {
    const technicalRoute = hill("Tryfan North Ridge", 600, {
      hazardLevel: "high",
      routeDistance: 8,
      estimatedTime: "3.5 h",
      surface: "rocky scrambling ridge",
    });
    const walkingRoute = hill("Moel Siabod Walk", 600, {
      hazardLevel: "low",
      routeDistance: 8,
      estimatedTime: "3.5 h",
      surface: "grass mountain path",
    });
    const technicalTarget = profile({
      totalElevationGain: 1_200,
      totalDistance: 16,
      estimatedDays: 1,
      routeDna: {
        ...profile().routeDna,
        exposure: 8,
        scrambling: 8,
        ridgeTravel: 8,
        technicalMovement: 8,
      },
    });
    const walkingTarget = profile({
      totalElevationGain: 1_200,
      totalDistance: 16,
      estimatedDays: 1,
      routeDna: {
        ...profile().routeDna,
        exposure: 1,
        scrambling: 1,
        ridgeTravel: 2,
        technicalMovement: 1,
      },
    });

    const technical = matchDeterministicExpedition(
      [walkingRoute, technicalRoute],
      technicalTarget,
    );
    const walking = matchDeterministicExpedition(
      [technicalRoute, walkingRoute],
      walkingTarget,
    );

    expect(technical.selectedHills[0].name).toBe("Tryfan North Ridge");
    expect(walking.selectedHills[0].name).toBe("Moel Siabod Walk");
    expect(walking.rankedCandidates.find(candidate =>
      candidate.name === "Tryfan North Ridge")?.compatible).toBe(false);
  });

  it("does not force an unsuitable trail into the ascent band", () => {
    const result = matchDeterministicExpedition([
      hill("Suitable ascent", 700, { routeDistance: 9 }),
      hill("Long valley trail", 1_200, {
        routeType: "out-and-back", routeDistance: 30, estimatedTime: "8 h",
        grade: "Easy", surface: "gravel trail", summitElevationASL: 150,
      }),
    ], profile({ totalElevationGain: 1_000 }));

    expect(result.targetRatio).toBeLessThan(0.9);
    expect(result.selectedHills.map(candidate => candidate.name)).toEqual(["Suitable ascent"]);
  });

  it("does not let several generic Ways beat a compact mountain combination", () => {
    const ways = Array.from({ length: 4 }, (_, index) =>
      hill(`Generic Valley Way ${index + 1}`, 500, {
        routeType: "circular",
        routeDistance: 16.7,
        estimatedTime: "4 h",
        grade: "Moderate",
        surface: "mountain",
        summitElevationASL: undefined,
        routeDataStatus: "seeded_estimate",
      }));
    const result = matchDeterministicExpedition([
      ...ways,
      hill("High Fell North", 900, {
        routeDistance: 15,
        summitElevationASL: 950,
      }),
      hill("High Fell South", 900, {
        routeDistance: 15,
        summitElevationASL: 900,
      }),
    ], profile({ totalElevationGain: 2_000, totalDistance: 30 }));

    expect(result.selectedHills.map(selected => selected.name).sort())
      .toEqual(["High Fell North", "High Fell South"]);
    expect(ways.every(way =>
      result.rankedCandidates.find(candidate =>
        candidate.name === way.name)?.eligible === false)).toBe(true);
  });

  it("reports a bounded runner-up combination and its lexicographic reason", () => {
    const result = matchDeterministicExpedition([
      hill("Primary A", 500, { routeDistance: 8 }),
      hill("Primary B", 500, { routeDistance: 8 }),
      hill("Alternative A", 450, { routeDistance: 8 }),
      hill("Alternative B", 500, { routeDistance: 8 }),
    ], profile({ totalElevationGain: 1_000 }));

    expect(result.strongestAlternative).toMatch(/(outings|repeat|quality|distance|duration|DNA|score|tie-break)/);
    expect(result.strongestAlternative).toContain(",");
    expect(result.outingCount).toBe(2);
    expect(result.distinctRouteCount).toBe(2);
  });

  it("prefers two substantial in-band routes over four routes with an exact ascent total", () => {
    const compact = [
      hill("High Mountain North", 900, { summitElevationASL: 950, routeDistance: 15 }),
      hill("High Mountain South", 900, { summitElevationASL: 900, routeDistance: 15 }),
    ];
    const fragmented = Array.from({ length: 4 }, (_, index) =>
      hill(`Lower Hill ${index + 1}`, 500, {
        summitElevationASL: 300,
        routeDistance: 7.5,
      }));

    const result = matchDeterministicExpedition(
      [...fragmented, ...compact],
      profile({ totalElevationGain: 2_000, totalDistance: 30 }),
    );

    expect(result.selectedHills.map(selected => selected.name).sort())
      .toEqual(["High Mountain North", "High Mountain South"]);
    expect(result.outingCount).toBe(2);
    expect(result.targetRatio).toBe(0.9);
  });

  it("uses total distance before lower-priority DNA differences", () => {
    const result = matchDeterministicExpedition([
      hill("Distance Match North", 800, {
        routeDistance: 16,
        estimatedTime: "3.5 h",
        summitElevationASL: 900,
        routeDataStatus: "external_route",
      }),
      hill("Distance Match South", 800, {
        routeDistance: 16,
        estimatedTime: "3.5 h",
        summitElevationASL: 900,
        routeDataStatus: "external_route",
      }),
      hill("Short Route North", 800, {
        routeDistance: 8,
        estimatedTime: "3.5 h",
        summitElevationASL: 900,
        routeDataStatus: "external_route",
      }),
      hill("Short Route South", 800, {
        routeDistance: 8,
        estimatedTime: "3.5 h",
        summitElevationASL: 900,
        routeDataStatus: "external_route",
      }),
    ], profile({ totalElevationGain: 1_600, totalDistance: 32, estimatedDays: 1 }));

    expect(result.selectedHills.map(selected => selected.name).sort())
      .toEqual(["Distance Match North", "Distance Match South"]);
    expect(result.distanceRatio).toBe(1);
  });

  it("uses total duration after compactness, objective quality and distance", () => {
    const result = matchDeterministicExpedition([
      hill("Duration Match North", 500, { routeDistance: 16, estimatedTime: "3.5 h" }),
      hill("Duration Match South", 500, { routeDistance: 16, estimatedTime: "3.5 h" }),
      hill("Short Day North", 500, { routeDistance: 16, estimatedTime: "1 h" }),
      hill("Short Day South", 500, { routeDistance: 16, estimatedTime: "1 h" }),
    ], profile({ totalElevationGain: 1_000, totalDistance: 32, estimatedDays: 1 }));

    expect(result.selectedHills.map(selected => selected.name).sort())
      .toEqual(["Duration Match North", "Duration Match South"]);
    expect(result.achievedDurationMinutes).toBe(7 * 60);
  });

  it("uses technical terrain similarity after physical plan facts", () => {
    const technicalProfile = profile({
      totalElevationGain: 1_000,
      totalDistance: 16,
      estimatedDays: 1,
      routeDna: {
        ...profile().routeDna,
        scrambling: 8,
        exposure: 7,
        ridgeTravel: 8,
        technicalMovement: 8,
      },
    });
    const result = matchDeterministicExpedition([
      hill("Rock Ridge North", 500, { routeDistance: 8, estimatedTime: "3.5 h", surface: "rocky scrambling ridge" }),
      hill("Rock Ridge South", 500, { routeDistance: 8, estimatedTime: "3.5 h", surface: "rocky scrambling ridge" }),
      hill("Grass Path North", 500, { routeDistance: 8, estimatedTime: "3.5 h", surface: "grass path" }),
      hill("Grass Path South", 500, { routeDistance: 8, estimatedTime: "3.5 h", surface: "grass path" }),
    ], technicalProfile);

    expect(result.selectedHills.map(selected => selected.name).sort())
      .toEqual(["Rock Ridge North", "Rock Ridge South"]);
  });

  it("avoids repeat outings when an equally compact distinct-route plan exists", () => {
    const result = matchDeterministicExpedition([
      hill("Repeatable Mountain", 500, { routeDistance: 8, estimatedTime: "3.5 h" }),
      hill("Distinct Mountain North", 500, { routeDistance: 8, estimatedTime: "3.5 h" }),
      hill("Distinct Mountain South", 500, { routeDistance: 8, estimatedTime: "3.5 h" }),
    ], profile({ totalElevationGain: 1_000, totalDistance: 16, estimatedDays: 1 }));

    expect(result.outingCount).toBe(2);
    expect(result.distinctRouteCount).toBe(2);
    expect(result.selectedHills.every(selected => selected.repeats === 1)).toBe(true);
  });

  it("keeps the new lexicographic result stable under candidate permutation", () => {
    const input = [
      hill("Compact West", 900, {
        routeIdentityKey: "route:v1:test:compact-west:54.1,-3.1",
        summitElevationASL: 900,
        routeDistance: 15,
      }),
      hill("Compact East", 900, {
        routeIdentityKey: "route:v1:test:compact-east:54.2,-3.2",
        summitElevationASL: 850,
        routeDistance: 15,
      }),
      ...Array.from({ length: 4 }, (_, index) =>
        hill(`Fragment ${index + 1}`, 500, {
          routeIdentityKey: `route:v1:test:fragment-${index + 1}:54.${index + 3},-3.3`,
          routeDistance: 7.5,
        })),
    ];
    const target = profile({ totalElevationGain: 2_000, totalDistance: 30 });
    const first = matchDeterministicExpedition(input, target);
    const reversed = matchDeterministicExpedition([...input].reverse(), target);

    expect(first.selectedHills).toEqual(reversed.selectedHills);
    expect(first.selectedHills.map(selected => selected.routeIdentityKey))
      .toEqual([
        "route:v1:test:compact-east:54.2,-3.2",
        "route:v1:test:compact-west:54.1,-3.1",
      ]);
  });
});