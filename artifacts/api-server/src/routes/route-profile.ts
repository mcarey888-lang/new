import { Router, type IRouter } from "express";
import { routeProfile } from "../services/routing/profile";
import type { LatLng } from "../services/routing/pathSnapping";

/**
 * Height profile and ascent for a drawn route.
 *
 * Separate from /path-snap because the two answer different questions and fail
 * for different reasons. A route can follow paths perfectly and still have no
 * elevation data, or have elevation everywhere and cross a gap in the paths.
 * Folding them together would mean one failure hiding the other.
 *
 * It is a POST because a route is a list of coordinates, and a long one does
 * not belong in a URL.
 */

function toLatLng(v: unknown): LatLng | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = typeof o["lat"] === "number" ? o["lat"] : o["latitude"];
  const lng = typeof o["lng"] === "number" ? o["lng"] : o["longitude"];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Most coordinates one request may carry. A snapped route has a point every
 *  few metres, so this is generous for a day's walk and still bounded. */
const MAX_POINTS = 5000;

const router: IRouter = Router();

router.post("/route-profile", async (req, res) => {
  const raw = (req.body as { points?: unknown })?.points;
  if (!Array.isArray(raw)) { res.status(400).json({ outcome: "bad_request" }); return; }
  if (raw.length > MAX_POINTS) { res.status(413).json({ outcome: "too_long" }); return; }

  const points: LatLng[] = [];
  for (const p of raw) {
    const ll = toLatLng(p);
    /* One bad coordinate is rejected rather than skipped. Dropping it would
       quietly shorten the route and under-report the climb through the part
       that went missing. */
    if (!ll) { res.status(400).json({ outcome: "bad_request" }); return; }
    points.push(ll);
  }

  try {
    const result = await routeProfile(points);
    if (result.outcome !== "profiled") {
      req.log?.info({ outcome: result.outcome }, "route-profile not profiled");
    }
    res.json(result);
  } catch (err) {
    req.log?.warn({ err }, "route-profile failed");
    res.status(500).json({ outcome: "unavailable" });
  }
});

export default router;
