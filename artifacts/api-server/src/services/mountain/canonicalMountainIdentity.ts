import { executeEngineReadOnlyQuery } from "@workspace/db";
import { CANONICAL_TRUST_SQL } from "./canonicalMountainLookup.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_MATCHES = 50;

export interface CanonicalMountainIdentity {
  id: string;
  canonicalSourceKey: string;
  name: string;
  country: string | null;
  region: string | null;
  area: string | null;
  elevationM: number | null;
  prominenceM: number | null;
}

function normalizeName(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeLocation(value: string): string {
  return normalizeName(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function locationMatches(mountain: CanonicalMountainIdentity, location: string): boolean {
  const target = normalizeLocation(location);
  if (!target) return false;
  const candidates = [
    mountain.region,
    mountain.country,
    mountain.area,
    [mountain.region, mountain.country].filter(Boolean).join(" "),
    [mountain.region, mountain.country].filter(Boolean).join(", "),
    [mountain.area, mountain.region, mountain.country].filter(Boolean).join(" "),
    [mountain.area, mountain.region, mountain.country].filter(Boolean).join(", "),
  ];
  return candidates.some((candidate) => candidate && normalizeLocation(candidate) === target);
}

const selectColumns = `
  m.id::text AS "id",
  m.canonical_source_key AS "canonicalSourceKey",
  m.name,
  m.country,
  m.region,
  m.area,
  m.elevation_m::float8 AS "elevationM",
  m.prominence_m::float8 AS "prominenceM"
`;

const canonicalPredicate = `
  ${CANONICAL_TRUST_SQL}
  AND
  m.canonical_source_key IS NOT NULL
  AND btrim(m.canonical_source_key) <> ''
`;

export async function getCanonicalMountainById(
  id: string,
  query: typeof executeEngineReadOnlyQuery = executeEngineReadOnlyQuery,
): Promise<CanonicalMountainIdentity | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const rows = await query<Record<string, unknown>>(`
    SELECT ${selectColumns}
    FROM public.mountains AS m
    WHERE ${canonicalPredicate}
      AND m.id::text = $1
    LIMIT 1
  `, [id]);
  return (rows[0] as unknown as CanonicalMountainIdentity | undefined) ?? null;
}

/**
 * Resolve a canonical name only when it identifies one catalogue row. A
 * caller-supplied UUID is accepted only after its canonical row name matches.
 */
export async function resolveCanonicalMountainIdentity(
  name: string,
  location?: string,
  mountainId?: string,
  query: typeof executeEngineReadOnlyQuery = executeEngineReadOnlyQuery,
): Promise<CanonicalMountainIdentity | null> {
  const requestedName = normalizeName(name);
  if (!requestedName) return null;
  if (mountainId) {
    const mountain = await getCanonicalMountainById(mountainId, query);
    return mountain && normalizeName(mountain.name) === requestedName &&
      (!location || locationMatches(mountain, location))
      ? mountain
      : null;
  }

  const rows = await query<Record<string, unknown>>(`
    SELECT ${selectColumns}
    FROM public.mountains AS m
    WHERE ${canonicalPredicate}
      AND lower(btrim(m.name)) = lower(btrim($1))
    ORDER BY m.id
    LIMIT ${MAX_NAME_MATCHES}
  `, [name]);
  const mountains = rows as unknown as CanonicalMountainIdentity[];
  if (mountains.length === 1) {
    return !location || locationMatches(mountains[0]!, location) ? mountains[0]! : null;
  }
  if (!location || mountains.length === 0 || mountains.length >= MAX_NAME_MATCHES) return null;
  const matches = mountains.filter((mountain) => locationMatches(mountain, location));
  return matches.length === 1 ? matches[0]! : null;
}

export function isCanonicalMountainId(value: string): boolean {
  return UUID_PATTERN.test(value);
}