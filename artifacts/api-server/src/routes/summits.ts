import { Router, type IRouter } from "express";
import { executeEngineReadOnlyQuery } from "@workspace/db";
import { buildSummitQuery } from "../services/summits/summitQuery";
import { MAX_RESULTS, MIN_QUERY_LENGTH, searchResults } from "../services/summits/summitSearch";
import { filterForZoom, padBBox, parseBBox, toPin, type MountainRow } from "../services/summits/summitPins";

/**
 * Summit pins for the map.
 *
 * Read-only, through the engine pool, against the Summit Data Engine
 * catalogue. The map calls this on every pan, so it has to be cheap: a GiST
 * index predicate, a hard cap on rows, and an answer the browser may hold for
 * a few minutes.
 */

/** How much beyond the visible rectangle to fetch, in degrees of latitude —
 *  roughly 2 km, so a short pan finds pins already loaded instead of a blank
 *  band while a request is in flight. */
const PAN_MARGIN_DEG = 0.02;

const router: IRouter = Router();

/**
 * Find a hill by name.
 *
 * The database narrows; the ranking happens here, where it can be tested. A
 * wide net is cast on purpose — anything containing the letters typed — and
 * then ordered properly, because SQL ordering cannot tell "the hill somebody
 * means" from "a row that matches".
 */
router.get("/summits/search", async (req, res) => {
  const raw = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (raw.length < MIN_QUERY_LENGTH) {
    /* Not an error. Two letters is simply too little to answer with, and
       saying so beats returning the first few hundred hills in the catalogue. */
    res.json({ results: [], query: raw, tooShort: true });
    return;
  }
  if (raw.length > 80) {
    res.status(400).json({ error: "search_too_long" });
    return;
  }

  /* Escaped before it reaches LIKE, or a name containing % matches everything
     and _ matches anything. */
  const pattern = `%${raw.replace(/[\\%_]/g, c => `\\${c}`)}%`;

  try {
    const rows = await executeEngineReadOnlyQuery<{
      id: string; name: string;
      latitude: number | null; longitude: number | null;
      elevationM: number | null; prominenceM: number | null;
      country: string | null; region: string | null; county: string | null;
      classificationCodes: string[] | null;
    }>(
      `SELECT
         m.id::text AS "id", m.name AS "name",
         ST_Y(m.geom) AS "latitude", ST_X(m.geom) AS "longitude",
         m.elevation_m AS "elevationM", m.prominence_m AS "prominenceM",
         m.country AS "country", m.region AS "region", m.county AS "county",
         COALESCE(c.codes, ARRAY[]::text[]) AS "classificationCodes"
       FROM public.mountains AS m
       LEFT JOIN LATERAL (
         SELECT array_agg(DISTINCT mc.classification_code) AS codes
         FROM public.mountain_source_records AS msr
         JOIN public.mountain_classifications AS mc ON mc.source_record_id = msr.id
         WHERE msr.mountain_id = m.id
       ) AS c ON TRUE
       WHERE m.name ILIKE $1 ESCAPE '\\'
       ORDER BY m.prominence_m DESC NULLS LAST
       LIMIT 200`,
      [pattern],
    );

    const results = searchResults(
      rows.map(r => ({ ...r, classificationCodes: r.classificationCodes ?? [] })),
      raw, toPin, MAX_RESULTS,
    );
    res.set("Cache-Control", "public, max-age=300");
    res.json({
      results: results.map(hit => ({ ...hit.pin, matchedAlternative: hit.matchedAlternative })),
      query: raw,
      tooShort: false,
    });
  } catch {
    /* Never the error object: a connection failure carries the database URL,
       and that URL carries a password. */
    req.log?.warn("summit search failed");
    res.status(503).json({ error: "summit_catalogue_unavailable" });
  }
});

router.get("/summits", async (req, res) => {
  const box = parseBBox(req.query["bbox"]);
  if (!box) {
    res.status(400).json({ error: "bbox must be minLng,minLat,maxLng,maxLat" });
    return;
  }
  const zoom = Number(req.query["zoom"]);
  if (!Number.isFinite(zoom)) {
    res.status(400).json({ error: "zoom must be a number" });
    return;
  }

  /* Below the first pin zoom the honest answer is an empty list, not an
     error: the map is working, there is simply nothing to draw yet. Saying so
     without a round trip to the database saves the query entirely. */
  if (filterForZoom(zoom).kind === "none") {
    res.set("Cache-Control", "public, max-age=300");
    res.json({ summits: [], truncated: false, zoom, covered: box });
    return;
  }

  const covered = padBBox(box, PAN_MARGIN_DEG);
  const query = buildSummitQuery(covered, zoom);
  if (!query) {
    res.json({ summits: [], truncated: false, zoom, covered: box });
    return;
  }

  try {
    const rows = await executeEngineReadOnlyQuery<{
      id: string; name: string;
      latitude: number | null; longitude: number | null;
      elevationM: number | null; prominenceM: number | null;
      country: string | null; region: string | null; county: string | null;
      classificationCodes: string[] | null;
    }>(query.text, query.params);

    const summits = rows
      .map(row => toPin({ ...row, classificationCodes: row.classificationCodes ?? [] } as MountainRow))
      .filter((pin): pin is NonNullable<typeof pin> => pin !== null);

    /* Said plainly, because a map that silently drops hills is worse than one
       that admits it. The client can zoom in; it cannot guess. */
    const truncated = rows.length >= Number(query.params[query.params.length - 1]);

    /* The catalogue changes when a new DoBIH release is imported, which is
       not often. Five minutes costs nothing and removes most of the repeat
       requests a person panning around generates. */
    res.set("Cache-Control", "public, max-age=300");
    /* The rectangle actually searched, which is wider than the one asked for.
       Without it the caller can only assume it holds the rectangle it sent,
       so the slightest pan looks like new ground and it asks again for hills
       it already has. */
    res.json({ summits, truncated, zoom, covered });
  } catch (err) {
    /* Never the error object: a connection error can carry the database URL,
       and that URL carries a password. */
    req.log?.warn({ zoom }, "summit pin query failed");
    res.status(503).json({ error: "summit_catalogue_unavailable" });
  }
});

export default router;
