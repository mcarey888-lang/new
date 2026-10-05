import { Router, type IRouter } from "express";
import { executeEngineReadOnlyQuery } from "@workspace/db";
import { buildSummitQuery } from "../services/summits/summitQuery";
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
    res.json({ summits: [], truncated: false, zoom });
    return;
  }

  const query = buildSummitQuery(padBBox(box, PAN_MARGIN_DEG), zoom);
  if (!query) {
    res.json({ summits: [], truncated: false, zoom });
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
    res.json({ summits, truncated, zoom });
  } catch (err) {
    /* Never the error object: a connection error can carry the database URL,
       and that URL carries a password. */
    req.log?.warn({ zoom }, "summit pin query failed");
    res.status(503).json({ error: "summit_catalogue_unavailable" });
  }
});

export default router;
