import { describe, expect, it } from "vitest";
import type { Hill } from "../routes/hills-unified.js";
import { englishPlaceName } from "../routes/hills-unified.js";
import {
  applyVerifiedMountainProfile,
  bridgeElevationGap,
  formatHillsForPrompt,
  prepareCandidateHills,
  reconcileExpeditionDays,
  type RouteDna,
  type TargetMountainProfile,
} from "../routes/virtual-expedition.js";

const toubkalLikeDna: RouteDna = {
  scrambling: 2,
  exposure: 2,
  ridgeTravel: 2,
  endurance: 8,
  technicalMovement: 2,
  navigationRequired: 4,
  steepness: 6,
  scenicQuality: 9,
  descentDifficulty: 4,
  sustainedClimbing: 9,
};

const matterhornLikeDna: RouteDna = {
  ...toubkalLikeDna,
  scrambling: 9,
  exposure: 10,
  technicalMovement: 9,
  ridgeTravel: 9,
};

function hill(name: string, elevation: number): Hill {
  return {
    name,
    elevation,
    distance: 10,
    repeats: 1,
    totalElevation: elevation,
    surface: "Rocky path",
    grade: elevation > 700 ? "Alpine" : "Hard",
    emoji: "🏔️",
    routeType: "hill",
  };
}

function profile(): TargetMountainProfile {
  return {
    name: "AI estimate",
    country: "Morocco",
    summitElevation: 4_100,
    totalElevationGain: 3_100,
    totalDistance: 35,
    estimatedDays: 1,
    day1ElevationGain: 3_100,
    day2ElevationGain: null,
    maxDailyElevation: 3_100,
    difficulty: "Alpine",
    technicalGrade: null,
    altitudeExposure: "High",
    notes: "AI-generated estimate",
    routeDna: toubkalLikeDna,
  };
}

describe("verified Toubkal profile", () => {
  it.each([
    "Toubkal",
    "Mount Toubkal",
    "Jebel Toubkal",
    "Jbel Toubkal",
    "Djebel Toubkal",
  ])("overrides standard-route figures for %s", alias => {
    const result = applyVerifiedMountainProfile(alias, profile());
    expect(result).toMatchObject({
      summitElevation: 4_167,
      totalElevationGain: 2_400,
      totalDistance: 27,
      estimatedDays: 2,
      day1ElevationGain: 1_450,
      day2ElevationGain: 950,
      maxDailyElevation: 1_450,
    });
  });
});

describe("English place names", () => {
  it.each([
    ["Yr Wyddfa", "Snowdon"],
    ["Yr Wyddfa via the Pyg Track", "Snowdon via the Pyg Track"],
    ["Snowdon / Yr Wyddfa", "Snowdon"],
    ["Eryri", "Snowdonia"],
    ["Bannau Brycheiniog", "Brecon Beacons"],
    ["Glyder Fawr", "Glyder Fawr"],
  ])("displays %s as %s", (input, expected) => {
    expect(englishPlaceName(input)).toBe(expected);
  });
});

describe("elevation bridge", () => {
  it("prunes a redundant summit from a 3371m selection toward a 2400m target", () => {
    const selected = [
      hill("Snowdon", 980),
      hill("Helvellyn", 760),
      hill("Skiddaw", 651),
      hill("Kinder Scout", 490),
      hill("Mam Tor", 490),
    ];

    const result = bridgeElevationGap(selected, selected, 2_400);
    const gain = result.reduce((sum, route) => sum + route.elevation * route.repeats, 0);

    expect(gain).toBe(2_391);
    expect(result.map(route => route.name)).not.toContain("Snowdon");
    expect(gain).toBeGreaterThanOrEqual(2_160);
    expect(gain).toBeLessThanOrEqual(2_640);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.every(route => route.repeats <= 3)).toBe(true);
  });

  it("removes pruned summits from the returned expedition day plan", () => {
    const selected = [
      hill("Snowdon", 980),
      hill("Helvellyn", 760),
      hill("Skiddaw", 651),
      hill("Kinder Scout", 490),
      hill("Mam Tor", 490),
    ];
    const recommended = bridgeElevationGap(selected, selected, 2_400);
    const days = reconcileExpeditionDays({
      title: "Atlas in Snowdonia",
      concept: "A sustained mountain weekend.",
      days: [
        {
          label: "Saturday",
          title: "High ridges",
          focus: "endurance",
          routes: selected.slice(0, 3).map(route => ({ name: route.name, why: `${route.name} reason` })),
        },
        {
          label: "Sunday",
          title: "Final climbs",
          focus: "sustained ascent",
          routes: selected.slice(3).map(route => ({ name: route.name, why: `${route.name} reason` })),
        },
      ],
      alternatives: {},
      adventureScore: 80,
      dnaMatchScore: 85,
      dnaMatchNotes: "A close endurance match.",
    }, recommended);
    const plannedNames = days.flatMap(day => day.routes.map(route => route.name));

    expect(plannedNames).toEqual(recommended.map(route => route.name));
    expect(plannedNames).not.toContain("Snowdon");
  });
});

describe("known hazardous routes", () => {
  const candidates = [
    hill("Crib Goch", 726),
    hill("Crib Gough Traverse", 726),
    hill("Snowdon Llanberis Path", 980),
  ];

  it("excludes Crib Goch aliases for Toubkal-like Route DNA", () => {
    const result = prepareCandidateHills(candidates, toubkalLikeDna);
    expect(result.map(route => route.name)).toEqual(["Snowdon Llanberis Path"]);
  });

  it("includes Crib Goch with severe warning for Matterhorn-like Route DNA", () => {
    const result = prepareCandidateHills(candidates, matterhornLikeDna);
    const hazardous = result.filter(route => route.name.startsWith("Crib"));

    expect(hazardous).toHaveLength(2);
    expect(hazardous.every(route => route.hazardLevel === "severe")).toBe(true);
    expect(hazardous.every(route => route.safetyWarning?.includes("SEVERE EXPOSURE WARNING"))).toBe(true);
    expect(formatHillsForPrompt(result)).toContain("SEVERE EXPOSURE WARNING");
  });
});