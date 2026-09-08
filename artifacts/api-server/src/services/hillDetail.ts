import { cachedHills, seededTrails, type CachedHill, type SeededTrail } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { knownGainForHill, routeIdentityKeyFor } from "../routes/hills-unified.js";

export interface HillDetailRequest {
  hillName: string;
  routeIdentityKey?: string;
  location?: string;
  summitLat?: number;
  summitLng?: number;
  elevation?: number;
  routeDistance?: number;
  estimatedTime?: string;
  grade?: string;
  difficulty?: string;
  surface?: string;
  routeType?: string;
}

export interface RouteFacts {
  routeIdentityKey?: string;
  ascent?: number;
  distance?: number;
  duration?: string;
  difficulty?: string;
  terrain?: string;
  routeType?: string;
  lat?: number;
  lng?: number;
  /** Catalogue area used to disambiguate a name search; this is not a trailhead. */
  location?: string;
  description?: string;
  source: "cached_hills" | "seeded_trails";
}

export interface HillDetailDependencies {
  findRouteFacts: (
    name: string,
    coordinates?: { lat: number; lng: number },
    location?: string,
    routeIdentityKey?: string,
  ) => Promise<RouteFacts | null>;
  narrate?: (facts: Readonly<ResolvedHillDetailFacts>) => Promise<{
    description?: string;
    directions?: string;
    parkingNotes?: string;
  }>;
  development?: boolean;
}

export interface ResolvedHillDetailFacts {
  name: string;
  location: string;
  summitLat?: number;
  summitLng?: number;
  ascent?: number;
  routeDistance?: number;
  duration?: string;
  difficulty?: string;
  terrain?: string;
  routeType?: string;
  safetyWarning?: string;
  hazardLevel?: "severe";
}

const CRIB_GOCH_WARNING =
  "SEVERE EXPOSURE WARNING: Crib Goch is a serious, committing Grade 1 scramble with sustained knife-edge exposure and consequential falls. Attempt only with suitable skills, conditions and judgement.";
const DB_MATCH_MAX_KM = 5;

export function normalizeHillName(name: string): string {
  return name.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function coordinatePair(lat: unknown, lng: unknown): { lat: number; lng: number } | undefined {
  return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180
    ? { lat, lng }
    : undefined;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function cachedFacts(row: CachedHill): RouteFacts | null {
  const coordinates = coordinatePair(row.lat, row.lng);
  if (!coordinates) return null;
  const facts: RouteFacts = {
    routeIdentityKey: routeIdentityKeyFor(
      "legacy_cache",
      row.name,
      coordinates.lat,
      coordinates.lng,
    ),
    ascent: positive(row.elevation) ? row.elevation : undefined,
    distance: positive(row.routeDistance) ? row.routeDistance : undefined,
    duration: row.estimatedTime?.trim() || undefined,
    difficulty: row.grade.trim() || undefined,
    terrain: row.surface.trim() || undefined,
    routeType: row.routeType?.trim() || undefined,
    ...coordinates,
    source: "cached_hills",
  };
  return Object.values(facts).some(value => value !== undefined) ? facts : null;
}

function seededFacts(row: SeededTrail): RouteFacts | null {
  const coordinates = coordinatePair(row.lat, row.lng);
  if (!coordinates) return null;
  return {
    routeIdentityKey: routeIdentityKeyFor(
      "seeded_osm",
      row.name,
      coordinates.lat,
      coordinates.lng,
    ),
    ascent: positive(row.elevationGain) ? row.elevationGain : undefined,
    distance: positive(row.distance) ? row.distance : undefined,
    duration: row.estimatedTime.trim() || undefined,
    difficulty: row.difficulty.trim() || undefined,
    terrain: row.terrain.trim() || undefined,
    routeType: row.routeType.trim() || undefined,
    description: row.description.trim() || undefined,
    location: row.location.trim() || undefined,
    ...coordinates,
    source: "seeded_trails",
  };
}

/** Exact normalized-name lookup constrained by coordinates or seeded location. */
export async function findDatabaseRouteFacts(
  name: string,
  coordinates?: { lat: number; lng: number },
  location?: string,
  routeIdentityKey?: string,
): Promise<RouteFacts | null> {
  const normalized = normalizeHillName(name);
  const { db } = await import("@workspace/db");
  const normalizedSql = (column: typeof cachedHills.name | typeof seededTrails.name) =>
    sql`lower(trim(regexp_replace(${column}, '[^a-zA-Z0-9]+', ' ', 'g'))) = ${normalized}`;
  const [cachedRows, seededRows] = await Promise.all([
    db.select().from(cachedHills).where(normalizedSql(cachedHills.name)),
    db.select().from(seededTrails).where(normalizedSql(seededTrails.name)),
  ]);
  const allCandidates = [
    ...cachedRows.map(cachedFacts),
    ...seededRows.map(seededFacts),
  ].filter((facts): facts is RouteFacts => facts !== null);
  if (routeIdentityKey) {
    return allCandidates.find(candidate =>
      candidate.routeIdentityKey === routeIdentityKey) ?? null;
  }
  const candidates = coordinates
    ? [
        ...allCandidates,
      ]
    : seededRows
        .filter(row => locationCompatible(location, row.location))
        .map(seededFacts)
        .filter((facts): facts is RouteFacts => facts !== null);
  const geographicallyValid = coordinates
    ? candidates.filter(candidate => {
        const candidateCoords = coordinatePair(candidate.lat, candidate.lng);
        return candidateCoords && haversineKm(coordinates, candidateCoords) <= DB_MATCH_MAX_KM;
      })
    : candidates;
  // A location phrase is only a constraint, not a route identifier. If more than
  // one exact-name seeded route remains, do not guess between approaches.
  if (!coordinates && geographicallyValid.length !== 1) return null;
  return geographicallyValid.sort((a, b) => {
    if (coordinates) {
      const proximity = haversineKm(coordinates, coordinatePair(a.lat, a.lng)!) -
        haversineKm(coordinates, coordinatePair(b.lat, b.lng)!);
      if (proximity) return proximity;
    }
    const sourcePriority = (a.source === "cached_hills" ? 0 : 1) -
      (b.source === "cached_hills" ? 0 : 1);
    return sourcePriority;
  })[0] ?? null;
}

export function locationCompatible(requestLocation: string | undefined, recordLocation: string): boolean {
  const requested = normalizeHillName(requestLocation ?? "");
  const recorded = normalizeHillName(recordLocation);
  if (!requested || !recorded) return false;
  const generic = new Set([
    "near", "the", "and", "district", "region", "area",
    "north", "south", "east", "west", "northern", "southern", "eastern", "western",
    "northwest", "northeast", "southwest", "southeast", "central",
    "uk", "united", "kingdom", "england", "english", "wales", "welsh",
    "scotland", "scottish", "ireland", "irish", "britain", "british", "great",
    "moors", "moor", "mountains", "mountain",
  ]);
  const meaningful = (value: string) =>
    value.split(" ").filter(token => token.length >= 3 && !generic.has(token));
  const requestedTokens = meaningful(requested);
  const recordedTokensArray = meaningful(recorded);
  if (requestedTokens.length === 0 || recordedTokensArray.length === 0) return false;
  const meaningfulRequest = requestedTokens.join(" ");
  const meaningfulRecord = recordedTokensArray.join(" ");
  if (meaningfulRequest === meaningfulRecord ||
      meaningfulRequest.includes(meaningfulRecord) ||
      meaningfulRecord.includes(meaningfulRequest)) return true;
  const recordedTokens = new Set(recordedTokensArray);
  return requestedTokens.some(token => recordedTokens.has(token));
}

function hasExplicitRouteIdentity(name: string): boolean {
  return /\b(?:via|path|track|ridge|route|trail|way)\b/.test(normalizeHillName(name));
}

function deterministicDescription(facts: ResolvedHillDetailFacts): string {
  const terrain = facts.terrain ? ` The selected route uses ${facts.terrain.toLowerCase()}.` : "";
  return `${facts.name} is a hillwalking training destination near ${facts.location}.${terrain}`.trim();
}

export async function buildHillDetail(
  input: HillDetailRequest,
  dependencies: HillDetailDependencies = { findRouteFacts: findDatabaseRouteFacts },
) {
  const started = Date.now();
  const suppliedCoords = coordinatePair(input.summitLat, input.summitLng);
  const requestLocation = input.location?.trim() || undefined;
  const suppliedRouteIdentityKey = input.routeIdentityKey?.trim() || undefined;
  const resolvedDatabase = await dependencies.findRouteFacts(
    input.hillName,
    suppliedCoords,
    requestLocation,
    suppliedRouteIdentityKey,
  );
  const database = suppliedRouteIdentityKey &&
    resolvedDatabase?.routeIdentityKey !== suppliedRouteIdentityKey
    ? null
    : resolvedDatabase;
  const warnings: string[] = [];
  const selectedAscent = positive(input.elevation) ? input.elevation : undefined;
  const selectedDistance = positive(input.routeDistance) ? input.routeDistance : undefined;
  const selectedDuration = input.estimatedTime?.trim() || undefined;
  const selectedDifficulty = input.difficulty?.trim() || input.grade?.trim() || undefined;
  const selectedTerrain = input.surface?.trim() || undefined;
  const selectedRouteType = input.routeType?.trim() || undefined;

  // The selected route is authoritative. A geographically constrained catalogue
  // match may only fill facts which were absent from the selection.
  const facts: ResolvedHillDetailFacts = {
    name: input.hillName.trim(),
    // A matched catalogue route describes its own area more accurately than the
    // user's search/home location. Neither is a verified trailhead.
    location: database?.location || requestLocation || "unknown location",
    summitLat: suppliedCoords?.lat ?? database?.lat,
    summitLng: suppliedCoords?.lng ?? database?.lng,
    ascent: selectedAscent ?? database?.ascent,
    routeDistance: selectedDistance ?? database?.distance,
    duration: selectedDuration ?? database?.duration,
    difficulty: selectedDifficulty ?? database?.difficulty,
    terrain: selectedTerrain ?? database?.terrain,
    routeType: selectedRouteType ?? database?.routeType,
  };

  const verifiedGain = knownGainForHill({
    name: facts.name,
    lat: facts.summitLat,
    lng: facts.summitLng,
  });
  const recognizedApproachIdentity = Boolean(
    suppliedRouteIdentityKey &&
    database?.routeIdentityKey === suppliedRouteIdentityKey,
  );
  const correctionIsRouteCompatible = selectedAscent === undefined &&
    database?.ascent === undefined &&
    recognizedApproachIdentity &&
    hasExplicitRouteIdentity(facts.name);
  const correctionApplied = Boolean(verifiedGain && correctionIsRouteCompatible);
  if (verifiedGain && correctionApplied) {
    facts.ascent = verifiedGain;
  } else if (verifiedGain && selectedAscent === undefined && database?.ascent === undefined) {
    warnings.push("A researched ascent exists for this hill, but its route identity is ambiguous; no ascent correction was applied.");
  }
  if (/\bcrib (?:goch|gough)\b/.test(normalizeHillName(facts.name))) {
    facts.safetyWarning = CRIB_GOCH_WARNING;
    facts.hazardLevel = "severe";
  }

  if (!facts.ascent) warnings.push("Route ascent is unknown; summit altitude has not been substituted.");
  if (!facts.routeDistance) warnings.push("Route distance is unknown.");
  if (!facts.duration) warnings.push("Route duration is unknown.");

  let narration: Awaited<ReturnType<NonNullable<HillDetailDependencies["narrate"]>>> = {};
  if (dependencies.narrate) {
    try {
      narration = await dependencies.narrate(Object.freeze({ ...facts }));
    } catch {
      warnings.push("Optional narration was unavailable; deterministic wording was used.");
    }
  }

  const hasCompleteRoute = positive(facts.ascent) && positive(facts.routeDistance) &&
    Boolean(facts.duration && facts.difficulty);
  // Selected, seeded, and cached coordinates identify a hill or route lookup
  // area. They are never evidence of a navigable trailhead.
  const mapCoordinates = coordinatePair(facts.summitLat, facts.summitLng);
  const lat = mapCoordinates?.lat ?? null;
  const lng = mapCoordinates?.lng ?? null;
  const mapSearchContext = database?.location || requestLocation || undefined;
  const response: Record<string, unknown> = {
    description: narration.description?.trim() || database?.description || deterministicDescription(facts),
    startPoint: {
      name: "Start point not verified",
      lat: null,
      lng: null,
      postcode: "",
      directions: narration.directions?.trim() ||
        "No verified trailhead is available. Confirm a suitable public route start before travelling.",
      parkingNotes: narration.parkingNotes?.trim() ||
        "A dedicated car park has not been independently verified. Check local access restrictions and parking signs.",
    },
    routes: hasCompleteRoute ? [{
      name: "Selected route",
      distance: facts.routeDistance,
      elevationGain: facts.ascent,
      difficulty: facts.difficulty,
      description: facts.safetyWarning || `Selected ${facts.routeType || "hillwalking"} route.`,
      estimatedTime: facts.duration,
      isRecommended: true,
    }] : [],
  };
  // Retain legacy summit fields for consumers that display hill/route metadata.
  // Consumers must consult provenance before using any coordinate for maps.
  response.summitLat = lat;
  response.summitLng = lng;
  response.mapSearchContext = mapSearchContext;
  response.mapCoordinates = mapCoordinates
    ? { lat, lng, provenance: "unverified_route_location" }
    : null;
  if (facts.safetyWarning) {
    response.safetyWarning = facts.safetyWarning;
    response.hazardLevel = facts.hazardLevel;
  }
  response.provenance = {
    identity: suppliedRouteIdentityKey && recognizedApproachIdentity
      ? "selected_route_identity"
      : suppliedCoords ? "selected_hill" : database?.source || "request_name",
    routeIdentityKey: suppliedRouteIdentityKey,
    metrics: {
      ascent: correctionApplied ? "verified_correction" : selectedAscent !== undefined ? "selected_hill" : database?.ascent !== undefined ? database.source : "unknown",
      distance: selectedDistance !== undefined ? "selected_hill" : database?.distance !== undefined ? database.source : "unknown",
      duration: selectedDuration ? "selected_hill" : database?.duration ? database.source : "unknown",
      difficulty: selectedDifficulty ? "selected_hill" : database?.difficulty ? database.source : "unknown",
      terrain: selectedTerrain ? "selected_hill" : database?.terrain ? database.source : "unknown",
      routeType: selectedRouteType ? "selected_hill" : database?.routeType ? database.source : "unknown",
    },
    narration: narration.description ? "optional_narration" : "deterministic",
    mapCoordinates: mapCoordinates ? "unverified_route_location" : "unavailable",
    startPoint: "unverified",
  };
  response.warnings = warnings;
  if (dependencies.development) {
    response.timing = { totalMs: Date.now() - started };
  }
  return response;
}