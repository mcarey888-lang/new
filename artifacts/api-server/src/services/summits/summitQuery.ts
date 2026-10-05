import { filterForZoom, pinCap, type BBox, type PinFilter } from "./summitPins";

/**
 * The SQL behind the summit pins.
 *
 * Built as a pure function returning text and parameters rather than running
 * anything, so the thing most likely to be quietly wrong — which index the
 * predicate uses, whether the cap keeps the right hills — can be tested
 * without a database.
 *
 * THE INDEX. `public.mountains` has a GiST index on `geom`. The `&&` operator
 * against an envelope uses it. Comparing extracted ST_X and ST_Y values
 * against bounds does NOT, and would scan all 21,792 rows on every pan while
 * looking perfectly reasonable in the source. That is the whole reason this
 * query is written around `geom &&` and the reason this paragraph exists.
 */

/** Columns every pin needs, aliased to the shape `toPin` expects. */
const SELECT_COLUMNS = `
    m.id::text                       AS "id",
    m.name                           AS "name",
    ST_Y(m.geom)                     AS "latitude",
    ST_X(m.geom)                     AS "longitude",
    m.elevation_m                    AS "elevationM",
    m.prominence_m                   AS "prominenceM",
    m.country                        AS "country",
    m.region                         AS "region",
    m.county                         AS "county",
    COALESCE(c.codes, ARRAY[]::text[]) AS "classificationCodes"`.trim();

/* A hill's classifications live two joins away, and a hill has several, so
   they are gathered per row rather than multiplying the result set. */
const CLASSIFICATION_JOIN = `
  LEFT JOIN LATERAL (
    SELECT array_agg(DISTINCT mc.classification_code) AS codes
    FROM public.mountain_source_records AS msr
    JOIN public.mountain_classifications AS mc ON mc.source_record_id = msr.id
    WHERE msr.mountain_id = m.id
  ) AS c ON TRUE`.trim();

/**
 * A classification code and its tied-top spelling.
 *
 * DoBIH writes a tied top with a trailing "=". Stripping it in SQL would mean
 * a function call on every row and would not use the index on
 * classification_code, so the variants are listed instead and equality does
 * the work.
 */
export function withTiedVariants(codes: readonly string[]): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    const base = code.replace(/=+$/, "");
    if (!base) continue;
    out.add(base);
    out.add(`${base}=`);
  }
  return [...out];
}

export interface SummitQuery { text: string; params: unknown[] }

/**
 * Every summit in a rectangle that the given zoom should draw.
 *
 * Ordered by prominence, highest first, because the cap truncates. Without an
 * order the rows that survive are whichever the planner happened to reach, so
 * a busy area would drop Munros and keep nameless bumps. With it, the cap
 * costs you the least significant hills, which is the only acceptable way to
 * lose some.
 */
export function buildSummitQuery(box: BBox, zoom: number): SummitQuery | null {
  const filter = filterForZoom(zoom);
  if (filter.kind === "none") return null;
  const cap = pinCap(zoom);
  if (cap <= 0) return null;

  const params: unknown[] = [box.minLng, box.minLat, box.maxLng, box.maxLat];
  /* ST_MakeEnvelope takes west, south, east, north. Written out because
     getting the order wrong returns an empty rectangle rather than an error,
     and an empty result looks exactly like a moor with no hills on it. */
  const where: string[] = [`m.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`];

  where.push(...filterClause(filter, params));

  params.push(cap);
  const limitPlaceholder = `$${params.length}`;

  const text = `
SELECT
${SELECT_COLUMNS}
  FROM public.mountains AS m
  ${CLASSIFICATION_JOIN}
  WHERE ${where.join("\n    AND ")}
  ORDER BY m.prominence_m DESC NULLS LAST, m.elevation_m DESC NULLS LAST, m.id
  LIMIT ${limitPlaceholder}`.trim();

  return { text, params };
}

function filterClause(filter: PinFilter, params: unknown[]): string[] {
  switch (filter.kind) {
    case "all":
      return [];
    case "prominence":
      params.push(filter.minProminenceM);
      /* A hill with no prominence recorded is left out rather than assumed
         significant. Every DoBIH row has one; the international rows may not,
         and guessing on their behalf would put them on the map at a zoom
         where they were not earned. */
      return [`m.prominence_m IS NOT NULL`, `m.prominence_m >= $${params.length}`];
    case "classified": {
      params.push(withTiedVariants(filter.codes));
      return [`EXISTS (
      SELECT 1
      FROM public.mountain_source_records AS fsr
      JOIN public.mountain_classifications AS fc ON fc.source_record_id = fsr.id
      WHERE fsr.mountain_id = m.id AND fc.classification_code = ANY($${params.length}::text[])
    )`];
    }
    case "none":
      return [`FALSE`];
  }
}
