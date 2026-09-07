import { pythonUnicode14Casefold } from "./unicodeCasefold";

export interface CanonicalLookupInput {
  name: string;
  country?: string;
  region?: string;
}

export interface TrustedCanonicalRoute {
  identityKey: string;
  name: string;
  aliases: string[];
  description: string;
  startName?: string;
  startElevationM?: number;
  summitElevationM?: number;
  distanceKm?: number;
  totalAscentM?: number;
  totalDescentM?: number;
  typicalDurationHours?: number;
  evidence: {
    publisher: string;
    title: string;
    url: string;
  };
}

export interface VerifiedCanonicalMountain {
  id: string;
  sourceFeatureId: string;
  canonicalSourceKey: string;
  name: string;
  matchedBy: "canonical_name" | "alias";
  country?: string;
  region?: string;
  area?: string;
  county?: string;
  elevationM?: number;
  prominenceM?: number;
  colHeightM?: number;
  gridReference?: string;
  summitFeature?: string;
  latitude: number;
  longitude: number;
  provenanceVersion: string;
  routes: TrustedCanonicalRoute[];
}

export interface AmbiguousCanonicalMountain {
  id: string;
  sourceFeatureId: string;
  canonicalSourceKey: string;
  name: string;
  country?: string;
  region?: string;
}

export type CanonicalLookupResult =
  | { kind: "none" }
  | { kind: "match"; mountain: VerifiedCanonicalMountain }
  | { kind: "ambiguous"; matches: AmbiguousCanonicalMountain[] };

export type CanonicalQuery = (
  text: string,
  params: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

interface CandidateRow extends Record<string, unknown> {
  id: string;
  sourceFeatureId: string;
  canonicalSourceKey: string;
  name: string;
  country: string | null;
  region: string | null;
  area: string | null;
  county: string | null;
  elevationM: number | null;
  prominenceM: number | null;
  colHeightM: number | null;
  gridReference: string | null;
  summitFeature: string | null;
  latitude: number;
  longitude: number;
  provenanceVersion: string;
}

interface NameIndexRow extends Record<string, unknown> {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
}

interface RouteRow extends Record<string, unknown> {
  identityKey: string;
  name: string;
  aliases: string[];
  description: string;
  startName: string | null;
  startElevationM: number | null;
  summitElevationM: number | null;
  distanceKm: number | null;
  totalAscentM: number | null;
  totalDescentM: number | null;
  typicalDurationHours: number | null;
  publisher: string;
  evidenceTitle: string;
  evidenceUrl: string;
}

const VERIFIED_ALIAS_CANDIDATES_SQL = `
SELECT
  DISTINCT m.id::text AS "id",
  m.name AS "name",
  m.country AS "country",
  m.region AS "region"
FROM summit_data_engine.mountain_aliases AS a
JOIN summit_data_engine.mountains AS m ON m.id = a.mountain_id
WHERE m.status = 'verified'
  AND m.canonical_source_key IS NOT NULL
  AND a.normalized_name = $1
ORDER BY "name", "country" NULLS LAST, "region" NULLS LAST, "id"
`;

const VERIFIED_CANONICAL_NAME_INDEX_SQL = `
SELECT
  m.id::text AS "id",
  m.name AS "name",
  m.country AS "country",
  m.region AS "region"
FROM summit_data_engine.mountains AS m
WHERE m.status = 'verified'
  AND m.canonical_source_key IS NOT NULL
ORDER BY m.id
`;

const VERIFIED_CANDIDATE_DETAILS_SQL = `
SELECT
  m.id::text AS "id",
  m.source_feature_id AS "sourceFeatureId",
  m.canonical_source_key AS "canonicalSourceKey",
  m.name AS "name",
  m.country AS "country",
  m.region AS "region",
  m.area AS "area",
  m.county AS "county",
  m.elevation_m AS "elevationM",
  m.prominence_m AS "prominenceM",
  m.col_height_m AS "colHeightM",
  m.grid_reference AS "gridReference",
  m.summit_feature AS "summitFeature",
  ST_Y(m.geom)::float8 AS "latitude",
  ST_X(m.geom)::float8 AS "longitude",
  m.provenance_version AS "provenanceVersion"
FROM summit_data_engine.mountains AS m
WHERE m.status = 'verified'
  AND m.canonical_source_key IS NOT NULL
  AND m.id = ANY($1::uuid[])
ORDER BY m.name, m.country NULLS LAST, m.region NULLS LAST, m.id
`;

const VERIFIED_ROUTES_SQL = `
SELECT
  ri.identity_key AS "identityKey",
  ri.canonical_name AS "name",
  ri.aliases AS "aliases",
  rd.description AS "description",
  rf.start_name AS "startName",
  rf.start_elevation_m AS "startElevationM",
  rf.summit_elevation_m AS "summitElevationM",
  rf.distance_km AS "distanceKm",
  rf.total_ascent_m AS "totalAscentM",
  rf.total_descent_m AS "totalDescentM",
  rf.typical_duration_hours AS "typicalDurationHours",
  e.publisher AS "publisher",
  e.title AS "evidenceTitle",
  e.url AS "evidenceUrl"
FROM summit_data_engine.route_identities AS ri
JOIN summit_data_engine.route_definitions AS rd
  ON rd.route_identity_id = ri.id
JOIN summit_data_engine.route_facts AS rf
  ON rf.route_definition_id = rd.id
JOIN summit_data_engine.evidence_sources AS e
  ON e.id = rf.evidence_source_id
WHERE ri.mountain_id = $1::uuid
  AND ri.status = 'verified'
  AND rd.status = 'verified'
  AND rf.status = 'verified'
ORDER BY ri.canonical_name, ri.identity_key
`;

function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

async function defaultQuery(
  text: string,
  params: readonly unknown[],
): Promise<Record<string, unknown>[]> {
  const { pool } = await import("@workspace/db");
  const result = await pool.query(text, [...params]);
  return result.rows as Record<string, unknown>[];
}

/**
 * Match the importer's NFKC → case-fold → Unicode alphanumeric normalization.
 *
 * Combining marks are intentionally discarded, matching Python's
 * `str.isalnum()` filter in the importer.
 */
export function normalizeMountainLookupTerm(value: string): string {
  const caseFolded = pythonUnicode14Casefold(value.normalize("NFKC"));

  return Array.from(caseFolded)
    .filter((character) => /[\p{Letter}\p{Number}]/u.test(character))
    .join("");
}

function normalizeContext(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function contextMatches(
  candidate: NameIndexRow,
  input: CanonicalLookupInput,
): boolean {
  if (
    input.country &&
    (!candidate.country ||
      normalizeContext(candidate.country) !== normalizeContext(input.country))
  ) {
    return false;
  }
  if (
    input.region &&
    (!candidate.region ||
      normalizeContext(candidate.region) !== normalizeContext(input.region))
  ) {
    return false;
  }
  return true;
}

async function loadCanonicalNameIndex(
  query: CanonicalQuery,
): Promise<NameIndexRow[]> {
  return (await query(
    VERIFIED_CANONICAL_NAME_INDEX_SQL,
    [],
  )) as NameIndexRow[];
}

export async function lookupVerifiedCanonicalMountain(
  input: CanonicalLookupInput,
  query: CanonicalQuery = defaultQuery,
): Promise<CanonicalLookupResult> {
  const normalizedTerm = normalizeMountainLookupTerm(input.name);
  const [aliasCandidates, canonicalNameIndex] = await Promise.all([
    query(VERIFIED_ALIAS_CANDIDATES_SQL, [normalizedTerm]) as Promise<
      NameIndexRow[]
    >,
    loadCanonicalNameIndex(query),
  ]);
  const matches = new Map<
    string,
    { row: NameIndexRow; matchedBy: "canonical_name" | "alias" }
  >();

  for (const candidate of aliasCandidates) {
    if (contextMatches(candidate, input)) {
      matches.set(candidate.id, { row: candidate, matchedBy: "alias" });
    }
  }
  for (const candidate of canonicalNameIndex) {
    if (
      normalizeMountainLookupTerm(candidate.name) === normalizedTerm &&
      contextMatches(candidate, input)
    ) {
      matches.set(candidate.id, {
        row: candidate,
        matchedBy: "canonical_name",
      });
    }
  }

  if (matches.size === 0) {
    return { kind: "none" };
  }

  const candidates = (await query(VERIFIED_CANDIDATE_DETAILS_SQL, [
    [...matches.keys()],
  ])) as CandidateRow[];

  if (candidates.length === 0) {
    return { kind: "none" };
  }

  if (candidates.length > 1) {
    return {
      kind: "ambiguous",
      matches: candidates.map((candidate) => ({
        id: candidate.id,
        sourceFeatureId: candidate.sourceFeatureId,
        canonicalSourceKey: candidate.canonicalSourceKey,
        name: candidate.name,
        country: optional(candidate.country),
        region: optional(candidate.region),
      })),
    };
  }

  const candidate = candidates[0];
  const matchedBy = matches.get(candidate.id)?.matchedBy;
  if (!matchedBy) {
    throw new Error("Canonical candidate details did not match the name index");
  }
  const routeRows = (await query(VERIFIED_ROUTES_SQL, [
    candidate.id,
  ])) as RouteRow[];

  return {
    kind: "match",
    mountain: {
      id: candidate.id,
      sourceFeatureId: candidate.sourceFeatureId,
      canonicalSourceKey: candidate.canonicalSourceKey,
      name: candidate.name,
      matchedBy,
      country: optional(candidate.country),
      region: optional(candidate.region),
      area: optional(candidate.area),
      county: optional(candidate.county),
      elevationM: optional(candidate.elevationM),
      prominenceM: optional(candidate.prominenceM),
      colHeightM: optional(candidate.colHeightM),
      gridReference: optional(candidate.gridReference),
      summitFeature: optional(candidate.summitFeature),
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      provenanceVersion: candidate.provenanceVersion,
      routes: routeRows.map((route) => ({
        identityKey: route.identityKey,
        name: route.name,
        aliases: route.aliases,
        description: route.description,
        startName: optional(route.startName),
        startElevationM: optional(route.startElevationM),
        summitElevationM: optional(route.summitElevationM),
        distanceKm: optional(route.distanceKm),
        totalAscentM: optional(route.totalAscentM),
        totalDescentM: optional(route.totalDescentM),
        typicalDurationHours: optional(route.typicalDurationHours),
        evidence: {
          publisher: route.publisher,
          title: route.evidenceTitle,
          url: route.evidenceUrl,
        },
      })),
    },
  };
}
