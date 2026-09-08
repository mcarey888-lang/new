import { describe, expect, it } from "vitest";
import type { CachedHill, SeededTrail } from "@workspace/db/schema";
import {
  mapCachedHillRow,
  mapSeededTrailRow,
  mergeLocalCandidates,
  type SourcedHill,
} from "../services/virtualExpedition/localCandidates.js";

const cachedRow: CachedHill = {
  slug: "local-loop",
  name: "Local Loop",
  elevation: 420,
  distance: 999,
  repeats: 4,
  totalElevation: 1_680,
  surface: "Rock",
  grade: "Moderate",
  emoji: "⛰️",
  lat: 51,
  lng: -3,
  routeType: "circular",
  routeDistance: 9.5,
  estimatedTime: "3 hours",
  imageUrl: null,
  cachedAt: new Date(),
};

const seededRow: SeededTrail = {
  id: "osm-1",
  osmId: "1",
  name: "Local Loop",
  location: "Wales",
  distance: 12,
  elevationGain: 650,
  estimatedTime: "4 hours",
  difficulty: "Hard",
  terrain: "Rocky trail",
  routeType: "loop",
  bestFor: [],
  description: "A route",
  trainingBenefits: [],
  emoji: "🥾",
  lat: 51.005,
  lng: -3,
  osmArea: null,
  seededAt: new Date(),
};

describe("local database candidate row mapping", () => {
  it("rejects cache rows without a real route distance rather than treating summit data as ascent", () => {
    expect(mapCachedHillRow({ ...cachedRow, routeDistance: null }, 51, -3, 25)).toBeNull();
  });

  it("keeps seeded ascent separate from route distance and does not reuse stored proximity or repeats", () => {
    const mapped = mapSeededTrailRow(seededRow, 51, -3, 25);

    expect(mapped).toMatchObject({
      routeIdentityKey: "route:v1:seeded_osm:local-loop:51.00500,-3.00000",
      elevation: 650,
      totalElevation: 650,
      routeDistance: 12,
      repeats: 1,
      routeType: "circular",
      dataSource: "seeded_osm",
      routeDataStatus: "seeded_estimate",
    });
    expect(mapped!.distance).toBeLessThan(1);
    expect(mapped!.routeIdentityKey).not.toContain(seededRow.id);
  });

  it("applies exact radius filtering after mapping", () => {
    const roughlyElevenKmNorth = { ...seededRow, lat: 51.1 };
    expect(mapSeededTrailRow(roughlyElevenKmNorth, 51, -3, 10)).toBeNull();
    expect(mapSeededTrailRow(roughlyElevenKmNorth, 51, -3, 12)).not.toBeNull();
  });

  it("rejects unsupported or absent facts instead of inventing values", () => {
    expect(mapSeededTrailRow({ ...seededRow, elevationGain: 0 }, 51, -3, 25)).toBeNull();
    expect(mapSeededTrailRow({ ...seededRow, routeType: "point-to-point" }, 51, -3, 25)).toBeNull();
    expect(mapSeededTrailRow({ ...seededRow, difficulty: "Expert" }, 51, -3, 25)).toBeNull();
  });
});

describe("local candidate merge", () => {
  function mappedCache(overrides: Partial<SourcedHill> = {}): SourcedHill {
    return { ...mapCachedHillRow(cachedRow, 51, -3, 50)!, ...overrides };
  }

  function mappedSeed(overrides: Partial<SourcedHill> = {}): SourcedHill {
    return { ...mapSeededTrailRow(seededRow, 51, -3, 50)!, ...overrides };
  }

  it("prefers a route-complete cache row over a nearer seeded duplicate", () => {
    const result = mergeLocalCandidates([
      mappedSeed({ distance: 0.1 }),
      mappedCache({ distance: 1 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].dataSource).toBe("legacy_cache");
  });

  it("prefers the nearer candidate after source precedence ties", () => {
    const result = mergeLocalCandidates([
      mappedSeed(),
      mappedSeed({ distance: 0.1, lat: 51.004 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].distance).toBe(0.1);
  });

  it("does not merge same-name hills more than two kilometres apart", () => {
    const result = mergeLocalCandidates([
      mappedCache(),
      mappedSeed({ lat: 51.05, distance: 5.5 }),
    ]);
    expect(result).toHaveLength(2);
  });
});