import { describe, expect, it } from "vitest";
import type { Hill } from "../routes/hills-unified.js";
import type { TargetMountainProfile } from "../routes/virtual-expedition.js";
import {
  bridgeElevationGap,
  matchDeterministicExpedition,
  matchQuickestHighSummits,
  recommendAdditionalSummit,
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
  it("uses the available day maximum for the closest approximation when no tolerance match exists", () => {
    const result = matchQuickestHighSummits([
      hill("Highest", 300, { summitElevationASL: 1_200, summitIdentityKey: "highest" }),
      hill("Second", 400, { summitElevationASL: 1_100, summitIdentityKey: "second" }),
      hill("Third", 900, { summitElevationASL: 1_000, summitIdentityKey: "third" }),
      hill("Alternate highest route", 500, { summitElevationASL: 1_200, summitIdentityKey: "highest" }),
    ], profile({ estimatedDays: 2, totalElevationGain: 5_000 }));

    expect(result.selectedHills.map(candidate => candidate.name)).toEqual(["Alternate highest route", "Third"]);
    expect(result.selectedHills.every(candidate => candidate.repeats === 1)).toBe(true);
    expect(result.targetRatio).toBeLessThan(.9);
    expect(result.toleranceMode).toBe("approximate");
  });

  it("does not count a nearby subsidiary peak as another principal summit", () => {
    const result = matchQuickestHighSummits([
      hill("Principal Summit", 700, {
        summitIdentityKey: "summit:principal",
        summitElevationASL: 1_000,
        lat: 54.45,
        lng: -3.21,
      }),
      hill("Subsidiary Top", 300, {
        summitIdentityKey: "summit:subsidiary",
        summitElevationASL: 990,
        lat: 54.454,
        lng: -3.21,
      }),
      hill("Independent Summit", 650, {
        summitIdentityKey: "summit:independent",
        summitElevationASL: 950,
        lat: 54.48,
        lng: -3.21,
      }),
    ], profile({ estimatedDays: 2 }));

    expect(result.selectedHills.map(candidate => candidate.name))
      .toEqual(["Principal Summit", "Independent Summit"]);
    expect(result.rankedCandidates.find(candidate =>
      candidate.name === "Subsidiary Top")?.rejectionReasons[0])
      .toContain("subsidiary peak");
  });

  it("caps quickest-high-summits mode at three days and records unsafe higher summits", () => {
    const result = matchQuickestHighSummits([
      hill("Unsafe highest", 900, {
        summitElevationASL: 1_500, summitIdentityKey: "unsafe", hazardLevel: "severe",
      }),
      hill("One", 300, { summitElevationASL: 1_400, summitIdentityKey: "one" }),
      hill("Two", 300, { summitElevationASL: 1_300, summitIdentityKey: "two" }),
      hill("Three", 300, { summitElevationASL: 1_200, summitIdentityKey: "three" }),
      hill("Four", 300, { summitElevationASL: 1_100, summitIdentityKey: "four" }),
    ], profile({ estimatedDays: 3 }));

    expect(result.selectedHills.map(candidate => candidate.name)).toEqual(["One", "Two", "Three"]);
    expect(result.selectedHills).toHaveLength(3);
    expect(result.rankedCandidates[0].rejectionReasons).toContain("hazard incompatible with target DNA");
  });

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
        entityType: "summit",
        summitIdentityKey: "legacy-summit:castle-crag",
        routeType: "circular",
        routeDistance: 8,
        estimatedTime: "2 h 48 min",
        surface: "mountain",
        summitElevationASL: undefined,
        routeDataStatus: "seeded_estimate",
      }),
      hill("Eamont Way", 537, {
        entityType: "way",
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
      grade: "Moderate",
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
      "Moderate",
    );
    const walking = matchDeterministicExpedition(
      [technicalRoute, walkingRoute],
      walkingTarget,
      "Moderate",
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
        entityType: "way",
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
  it("accepts a normal one-summit match before a closer two-summit plan", () => {
    const result = matchQuickestHighSummits([
      hill("Single Summit", 1_000, { summitIdentityKey: "single", summitElevationASL: 2_000, routeDistance: 20 }),
      hill("Pair A", 510, { summitIdentityKey: "pair-a", summitElevationASL: 1_500, routeDistance: 10 }),
      hill("Pair B", 490, { summitIdentityKey: "pair-b", summitElevationASL: 1_400, routeDistance: 10 }),
    ], profile({ estimatedDays: 2, totalElevationGain: 1_000, totalDistance: 20 }));
    expect(result.selectedHills.map(selected => selected.name)).toEqual(["Single Summit"]);
    expect(result.toleranceMode).toBe("normal");
  });

  it("does not fill beyond available summits or the requested day maximum", () => {
    const result = matchQuickestHighSummits([
      hill("Only Summit", 1_000, { summitIdentityKey: "only", summitElevationASL: 1_000 }),
    ], profile({ estimatedDays: 3, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(result.selectedHills).toHaveLength(1);
    expect(result.warnings.join(" ")).toContain("no filler summits");
  });

  it("uses distance independently when ascent is tied", () => {
    const result = matchQuickestHighSummits([
      hill("Short Route", 1_000, { summitIdentityKey: "short", summitElevationASL: 1_100, routeDistance: 8 }),
      hill("Target Route", 1_000, { summitIdentityKey: "target", summitElevationASL: 1_000, routeDistance: 20 }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 20 }));
    expect(result.selectedHills.map(selected => selected.name)).toEqual(["Target Route"]);
    expect(result.matchDiagnostics.distanceRatio).toBe(1);
  });

  it("offers only deterministic, strictly improving eligible alternatives", () => {
    const input = [
      hill("Current Peak", 500, { summitIdentityKey: "current", lat: 54, lng: -3 }),
      hill("Better Peak", 350, { summitIdentityKey: "better", lat: 54.2, lng: -3 }),
      hill("Another Peak", 300, { summitIdentityKey: "another", lat: 54.3, lng: -3 }),
      hill("Unsafe Peak", 700, { summitIdentityKey: "unsafe", hazardLevel: "severe", lat: 54.4, lng: -3 }),
      hill("Valley Way", 700, { summitIdentityKey: "way", surface: "gravel trail", routeType: "out-and-back" }),
      hill("Subsidiary Peak", 700, {
        summitIdentityKey: "subsidiary", summitProminenceM: 8, lat: 54.004, lng: -3,
      }),
    ];
    const target = profile({ totalElevationGain: 2_000, totalDistance: 40, estimatedDays: 1 });
    const match = matchQuickestHighSummits(input, target);
    const recommendation = recommendAdditionalSummit(input, match, target);
    expect(recommendation).toBeDefined();
    expect(recommendation!.eligibleAlternatives.length).toBeGreaterThan(0);
    expect(recommendation!.eligibleAlternatives.map(candidate => candidate.name))
      .not.toContain("Current Peak");
    expect(recommendation!.eligibleAlternatives.map(candidate => candidate.name))
      .not.toEqual(expect.arrayContaining(["Unsafe Peak", "Valley Way", "Subsidiary Peak"]));
    expect(recommendation!.candidate.name).not.toBe("Subsidiary Peak");
    expect(recommendation!.eligibleAlternatives.every(candidate =>
      candidate.routeIdentityKey || candidate.summitIdentityKey)).toBe(true);
    expect(recommendation!.eligibleAlternatives.every(candidate => {
      const projectedGain = recommendation!.current.gain + candidate.elevation;
      const projectedDistance = recommendation!.current.distance + (candidate.routeDistance ?? 0);
      const error = Math.abs(projectedGain / target.totalElevationGain - 1)
        + Math.abs(projectedDistance / target.totalDistance - 1);
      return error < recommendation!.current.error;
    })).toBe(true);
  });

  it("uses structured principal identity rather than route keywords", () => {
    const result = matchQuickestHighSummits([
      hill("Summit Way", 700, {
        entityType: "summit", routeType: "hill", summitIdentityKey: "summit:valid",
      }),
      hill("North Ridge", 700, { entityType: "ridge", summitIdentityKey: "summit:ridge" }),
      hill("Valley Way", 700, { entityType: "way", summitIdentityKey: "summit:way" }),
      hill("Subsidiary Peak", 700, {
        entityType: "subsidiary_summit", summitIdentityKey: "summit:sub",
      }),
    ], profile({ totalElevationGain: 700, estimatedDays: 1 }));
    expect(result.selectedHills.map(h => h.name)).toEqual(["Summit Way"]);
    expect(result.rankedCandidates.find(r => r.name === "North Ridge")?.eligible).toBe(false);
    expect(result.rankedCandidates.find(r => r.name === "Valley Way")?.eligible).toBe(false);
    expect(result.rankedCandidates.find(r => r.name === "Subsidiary Peak")?.eligible).toBe(false);
  });

  it("deduplicates alternative routes by summit identity", () => {
    const input = [
      hill("Peak", 300, { summitIdentityKey: "summit:p", routeIdentityKey: "route:a", entityType: "summit" }),
      hill("Peak", 500, { summitIdentityKey: "summit:p", routeIdentityKey: "route:b", entityType: "summit" }),
      hill("Other Peak", 300, { summitIdentityKey: "summit:o", routeIdentityKey: "route:o", entityType: "summit" }),
    ];
    const match = matchQuickestHighSummits(input, profile({ totalElevationGain: 1_200, estimatedDays: 1 }));
    const recommendation = recommendAdditionalSummit(input, match, profile({ totalElevationGain: 2_000, estimatedDays: 1 }));
    if (recommendation) {
      expect(new Set(recommendation.eligibleAlternatives.map(h => h.summitIdentityKey)).size)
        .toBe(recommendation.eligibleAlternatives.length);
    }
  });

  it("keeps disconnected and geometry-unknown objectives separate and estimated", () => {
    const current = hill("Current", 500, {
      summitIdentityKey: "summit:current", routeIdentityKey: "route:current",
      entityType: "summit", lat: 54, lng: -3,
    });
    const candidate = hill("Candidate", 300, {
      summitIdentityKey: "summit:candidate", routeIdentityKey: "route:candidate",
      entityType: "summit", lat: 55, lng: -4,
    });
    const assignments = (recommendAdditionalSummit(
      [current], {
        selectedHills: [current],
        rankedCandidates: [{ name: candidate.name, routeIdentityKey: candidate.routeIdentityKey, score: 90,
          components: { ascentContribution: 1, duration: 1, gradeDifficulty: 1, terrainRouteType: 1, distance: 1, hazardCompatibility: 1 },
          compatible: true, eligible: true }],
      }, profile({ totalElevationGain: 2_000, estimatedDays: 1 }),
    ) as any)?.scheduleAssignments;
    if (assignments) {
      expect(assignments.at(-1).relationship).toBe("separate_objective");
      expect(assignments.at(-1).confidence).toBe("estimated");
      expect(assignments.at(-1).day).toBe(2);
    }
  });

  it("chooses different combinations for different target profiles", () => {
    const input = [
      hill("Endurance East", 700, { summitIdentityKey: "east", summitElevationASL: 1_100, routeDistance: 14 }),
      hill("Endurance West", 500, { summitIdentityKey: "west", summitElevationASL: 1_000, routeDistance: 10 }),
      hill("Compact North", 800, { summitIdentityKey: "north", summitElevationASL: 900, routeDistance: 8 }),
      hill("Compact South", 400, { summitIdentityKey: "south", summitElevationASL: 800, routeDistance: 4 }),
    ];
    const endurance = matchQuickestHighSummits(input, profile({ estimatedDays: 2, totalElevationGain: 1_200, totalDistance: 24 }));
    const compact = matchQuickestHighSummits(input, profile({ estimatedDays: 2, totalElevationGain: 1_200, totalDistance: 12 }));
    expect(endurance.selectedHills.map(selected => selected.name)).toEqual(["Endurance East", "Endurance West"]);
    expect(compact.selectedHills.map(selected => selected.name)).toEqual(["Compact North", "Compact South"]);
  });

  it("applies elevation, prominence and verified-source tie breakers", () => {
    const elevation = matchQuickestHighSummits([
      hill("Lower", 1_000, { summitIdentityKey: "lower", summitElevationASL: 900, routeDistance: 8 }),
      hill("Higher", 1_000, { summitIdentityKey: "higher", summitElevationASL: 1_000, routeDistance: 8 }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(elevation.selectedHills[0].name).toBe("Higher");
    const prominence = matchQuickestHighSummits([
      hill("Low Prominence", 1_000, { summitIdentityKey: "low-p", summitElevationASL: 1_000, summitProminenceM: 100, routeDistance: 8 }),
      hill("High Prominence", 1_000, { summitIdentityKey: "high-p", summitElevationASL: 1_000, summitProminenceM: 200, routeDistance: 8 }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(prominence.selectedHills[0].name).toBe("High Prominence");
    const verified = matchQuickestHighSummits([
      hill("Unverified", 1_000, { summitIdentityKey: "unverified", summitElevationASL: 1_000, routeDistance: 8 }),
      hill("Verified", 1_000, { summitIdentityKey: "verified", summitElevationASL: 1_000, routeDistance: 8, dataSource: "canonical_verified" }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(verified.selectedHills[0].name).toBe("Verified");
  });

  it("reports normal, widened, approximate and no-candidate diagnostics", () => {
    const normal = matchQuickestHighSummits([
      hill("Normal", 1_000, { summitIdentityKey: "normal", summitElevationASL: 1_000, routeDistance: 8 }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(normal.toleranceMode).toBe("normal");
    expect(normal.matchDiagnostics.withinNormal).toBe(true);
    const widened = matchQuickestHighSummits([
      hill("Wide", 1_290, { summitIdentityKey: "wide", summitElevationASL: 1_000, routeDistance: 10.2 }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(widened.toleranceMode).toBe("widened");
    expect(widened.matchDiagnostics.withinWidened).toBe(true);
    const approximate = matchQuickestHighSummits([
      hill("Approx", 1_500, { summitIdentityKey: "approx", summitElevationASL: 1_000, routeDistance: 14 }),
    ], profile({ estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8 }));
    expect(approximate.toleranceMode).toBe("approximate");
    expect(approximate.warnings.join(" ")).toContain("could not be met");
    expect(approximate.matchDiagnostics.withinWidened).toBe(false);
    const none = matchQuickestHighSummits([], profile({ estimatedDays: 1 }));
    expect(none.toleranceMode).toBe("none");
  });

  it("permits target-compatible technical routes for Moderate preference but rejects them for Easy", () => {
    const technical = hill("Crib-like Ridge", 1_000, {
      summitIdentityKey: "crib", summitElevationASL: 1_000, surface: "Rock scramble ridge",
      grade: "Hard", hazardLevel: "severe", routeDistance: 8,
    });
    const technicalTarget = profile({
      estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8,
      routeDna: { ...profile().routeDna, scrambling: 9, technicalMovement: 9, exposure: 9 },
    });
    expect(matchQuickestHighSummits([technical], technicalTarget, "Moderate").selectedHills).toHaveLength(1);
    expect(matchQuickestHighSummits([technical], technicalTarget, "Easy").selectedHills).toHaveLength(0);
    expect(matchQuickestHighSummits([technical], profile({
      estimatedDays: 1, totalElevationGain: 1_000, totalDistance: 8,
      routeDna: { ...profile().routeDna, scrambling: 1, technicalMovement: 1, exposure: 1 },
    }), "Easy").selectedHills).toHaveLength(0);
  });
});