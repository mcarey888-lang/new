import { cachedHills, seededTrails, type CachedHill, type SeededTrail } from "@workspace/db/schema";
import { and, gte, lte, or } from "drizzle-orm";
import { haversineKm, routeIdentityKeyFor, type Hill } from "../../routes/hills-unified.js";

export type SourcedHill = Hill & {
  dataSource: "legacy_cache" | "seeded_osm";
  routeDataStatus: "unverified_cache" | "seeded_estimate";
};

export type LocalCandidateSource = SourcedHill["dataSource"];

export interface LocalCandidateResult {
  hills: SourcedHill[];
  sources: LocalCandidateSource[];
  queriedRows: {
    cachedHills: number;
    seededTrails: number;
  };
}

const DEDUPE_DISTANCE_KM = 2;
const GRADES: readonly Hill["grade"][] = ["Easy", "Easy–Mod", "Moderate", "Hard", "Alpine"];

function validCoordinate(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

function mapGrade(value: string): Hill["grade"] | null {
  const normalized = value.trim().replace(/^Easy[\s\-–]+Mod$/i, "Easy–Mod");
  return GRADES.find(grade => grade.toLowerCase() === normalized.toLowerCase()) ?? null;
}

function mapCachedRouteType(value: string | null): Hill["routeType"] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "loop") return "circular";
  if (normalized === "hill" || normalized === "circular" || normalized === "out-and-back") {
    return normalized;
  }
  return null;
}

function mapSeededRouteType(value: string): Hill["routeType"] | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "loop") return "circular";
  if (normalized === "out-and-back") return "out-and-back";
  return null;
}

function isPositiveFinite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Maps a legacy cached row without filling absent route facts. In particular,
 * old summit-only rows have no routeDistance and are deliberately rejected.
 */
export function mapCachedHillRow(
  row: CachedHill,
  userLat: number,
  userLng: number,
  radiusKm: number,
): SourcedHill | null {
  const routeType = mapCachedRouteType(row.routeType);
  const grade = mapGrade(row.grade);
  if (
    !validCoordinate(row.lat, row.lng) ||
    !isPositiveFinite(row.elevation) ||
    !isPositiveFinite(row.routeDistance) ||
    !row.estimatedTime?.trim() ||
    !routeType ||
    !grade
  ) {
    return null;
  }

  const distance = haversineKm(userLat, userLng, row.lat, row.lng!);
  if (!Number.isFinite(distance) || distance > radiusKm) return null;

  return {
    name: row.name,
    routeIdentityKey: routeIdentityKeyFor("legacy_cache", row.name, row.lat, row.lng!),
    elevation: row.elevation,
    distance,
    repeats: 1,
    totalElevation: row.elevation,
    surface: row.surface,
    grade,
    emoji: row.emoji,
    lat: row.lat,
    lng: row.lng!,
    routeType,
    routeDistance: row.routeDistance,
    estimatedTime: row.estimatedTime,
    dataSource: "legacy_cache",
    routeDataStatus: "unverified_cache",
  };
}

/** Maps a synthetic OSM-derived seed while keeping its estimated fields distinct. */
export function mapSeededTrailRow(
  row: SeededTrail,
  userLat: number,
  userLng: number,
  radiusKm: number,
): SourcedHill | null {
  const routeType = mapSeededRouteType(row.routeType);
  const grade = mapGrade(row.difficulty);
  if (
    !validCoordinate(row.lat, row.lng) ||
    !isPositiveFinite(row.distance) ||
    !isPositiveFinite(row.elevationGain) ||
    !row.estimatedTime?.trim() ||
    !routeType ||
    !grade
  ) {
    return null;
  }

  const distance = haversineKm(userLat, userLng, row.lat, row.lng!);
  if (!Number.isFinite(distance) || distance > radiusKm) return null;

  return {
    name: row.name,
    routeIdentityKey: routeIdentityKeyFor("seeded_osm", row.name, row.lat, row.lng!),
    elevation: row.elevationGain,
    distance,
    repeats: 1,
    totalElevation: row.elevationGain,
    surface: row.terrain,
    grade,
    emoji: row.emoji,
    lat: row.lat,
    lng: row.lng!,
    routeType,
    routeDistance: row.distance,
    estimatedTime: row.estimatedTime,
    dataSource: "seeded_osm",
    routeDataStatus: "seeded_estimate",
  };
}

function normalizedName(name: string): string {
  return name.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Removes only geographically-near duplicates. Complete legacy cache routes
 * win over seeded routes; ties within a source are resolved by user distance.
 */
export function mergeLocalCandidates(candidates: readonly SourcedHill[]): SourcedHill[] {
  const preferred = [...candidates].sort((a, b) => {
    const sourceOrder = (a.dataSource === "legacy_cache" ? 0 : 1) -
      (b.dataSource === "legacy_cache" ? 0 : 1);
    return sourceOrder
      || a.distance - b.distance
      || normalizedName(a.name).localeCompare(normalizedName(b.name), "en")
      || a.name.localeCompare(b.name, "en")
      || (a.lat ?? Number.POSITIVE_INFINITY) - (b.lat ?? Number.POSITIVE_INFINITY)
      || (a.lng ?? Number.POSITIVE_INFINITY) - (b.lng ?? Number.POSITIVE_INFINITY);
  });
  const merged: SourcedHill[] = [];

  for (const candidate of preferred) {
    const duplicate = merged.some(existing =>
      normalizedName(existing.name) === normalizedName(candidate.name) &&
      (!validCoordinate(existing.lat, existing.lng)
        || !validCoordinate(candidate.lat, candidate.lng)
        || haversineKm(existing.lat, existing.lng!, candidate.lat, candidate.lng!) <= DEDUPE_DISTANCE_KM)
    );
    if (!duplicate) merged.push(candidate);
  }

  return merged.sort((a, b) => a.distance - b.distance);
}

function longitudePredicate(column: typeof cachedHills.lng | typeof seededTrails.lng, min: number, max: number) {
  if (min < -180) return or(gte(column, min + 360), lte(column, max));
  if (max > 180) return or(gte(column, min), lte(column, max - 360));
  return and(gte(column, min), lte(column, max));
}

/**
 * Reads both local route catalogues before callers proceed to external
 * discovery. This performs exactly one bounding-box query per table.
 */
export async function loadLocalDatabaseCandidates(
  userLat: number,
  userLng: number,
  radiusKm: number,
): Promise<LocalCandidateResult> {
  if (!validCoordinate(userLat, userLng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error("Valid user coordinates and a positive radiusKm are required");
  }

  const latDelta = radiusKm / 111.32;
  const cosine = Math.cos(userLat * Math.PI / 180);
  const lngDelta = Math.min(180, radiusKm / (111.32 * Math.max(Math.abs(cosine), 0.000001)));
  const minLat = Math.max(-90, userLat - latDelta);
  const maxLat = Math.min(90, userLat + latDelta);
  const minLng = userLng - lngDelta;
  const maxLng = userLng + lngDelta;
  const { db } = await import("@workspace/db");

  const [cacheRows, seededRows] = await Promise.all([
    db.select().from(cachedHills).where(and(
      gte(cachedHills.lat, minLat),
      lte(cachedHills.lat, maxLat),
      longitudePredicate(cachedHills.lng, minLng, maxLng),
    )),
    db.select().from(seededTrails).where(and(
      gte(seededTrails.lat, minLat),
      lte(seededTrails.lat, maxLat),
      longitudePredicate(seededTrails.lng, minLng, maxLng),
    )),
  ]);

  const candidates = [
    ...cacheRows.map(row => mapCachedHillRow(row, userLat, userLng, radiusKm)),
    ...seededRows.map(row => mapSeededTrailRow(row, userLat, userLng, radiusKm)),
  ].filter((hill): hill is SourcedHill => hill !== null);
  const hills = mergeLocalCandidates(candidates);

  return {
    hills,
    sources: [...new Set(hills.map(hill => hill.dataSource))],
    queriedRows: {
      cachedHills: cacheRows.length,
      seededTrails: seededRows.length,
    },
  };
}