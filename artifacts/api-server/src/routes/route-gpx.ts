import { Router, type IRouter } from "express";
import { buildGpx, gpxFilename, type GpxPoint } from "../services/routing/gpx";
import { elevationAt } from "../services/routing/terrain";

/**
 * Download a drawn route as GPX.
 *
 * Takes the points the page already holds rather than recomputing the line.
 * The page knows what it drew, including which sections never found a path,
 * and that is what has to reach the file — a server that re-derived it could
 * disagree with what the person is looking at.
 *
 * HEIGHTS ARE LOOKED UP HERE, NOT SENT UP
 * The first version had the page send the profile's elevations alongside the
 * route and matched them by position in the list. That is wrong, and it was
 * wrong in a way a file looks fine with: the profile is sampled every thirty
 * metres while the route has a point at every bend in the path, so a route of
 * 122 points carried 46 elevations, each attached to a coordinate it did not
 * belong to. Heights landed on the wrong part of the hill and nothing about
 * the file said so.
 *
 * Looking each one up for the exact coordinate being written removes the
 * question entirely. Tiles are cached, so a route crossing one tile costs one
 * fetch however many points it has.
 */

const MAX_POINTS = 10000;

function toPoint(v: unknown): GpxPoint | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = typeof o["lat"] === "number" ? o["lat"] : o["latitude"];
  const lng = typeof o["lng"] === "number" ? o["lng"] : o["longitude"];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const ele = o["elevationM"] ?? o["ele"];
  return {
    latitude: lat,
    longitude: lng,
    elevationM: typeof ele === "number" && Number.isFinite(ele) ? ele : null,
  };
}

const router: IRouter = Router();

router.post("/route-gpx", async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const raw = body?.["points"];
  if (!Array.isArray(raw) || raw.length < 2) {
    res.status(400).json({ error: "a route needs at least two points" });
    return;
  }
  if (raw.length > MAX_POINTS) {
    res.status(413).json({ error: "too many points" });
    return;
  }

  const points: GpxPoint[] = [];
  for (const p of raw) {
    const pt = toPoint(p);
    /* Rejected rather than skipped. Dropping a bad point would hand someone a
       file that quietly cuts a corner off their route. */
    if (!pt) { res.status(400).json({ error: "bad coordinate" }); return; }
    points.push(pt);
  }

  /* A height for each point actually being written. A lookup that fails
     leaves that point without an elevation tag rather than with a zero, which
     a device would read as sea level. */
  const withHeights: GpxPoint[] = [];
  for (const pt of points) {
    if (typeof pt.elevationM === "number") { withHeights.push(pt); continue; }
    let e: number | null = null;
    try { e = await elevationAt(pt); } catch { e = null; }
    withHeights.push({ ...pt, elevationM: e === null ? null : Math.round(e * 10) / 10 });
  }

  const name = typeof body?.["name"] === "string" ? (body["name"] as string) : undefined;
  const gpx = buildGpx({
    points: withHeights,
    name,
    unsnappedSections: typeof body?.["unsnappedSections"] === "number"
      ? (body["unsnappedSections"] as number) : undefined,
    ascentM: typeof body?.["ascentM"] === "number" ? (body["ascentM"] as number) : null,
    lengthM: typeof body?.["lengthM"] === "number" ? (body["lengthM"] as number) : null,
  });

  res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${gpxFilename(name)}"`);
  res.send(gpx);
});

export default router;
