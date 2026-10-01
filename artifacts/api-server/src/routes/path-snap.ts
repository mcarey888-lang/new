import { Router, type IRouter } from "express";
import {
  buildPathNetwork,
  routeAlongNetwork,
  snapToNetwork,
  type LatLng,
  type PathNetwork,
  type PathWay,
} from "../services/routing/pathSnapping";
import {
  fetchPathWays,
  type BBox,
  type Fetcher,
} from "../services/routing/pathNetworkSource";

/**
 * Snap a drawn leg onto the path network.
 *
 * The map page sends two taps; this answers with the line that actually
 * follows paths between them, or says plainly that it cannot.
 *
 * WHY THE SNAPPING IS HERE AND NOT IN THE PAGE
 * The engine is five hundred lines with twenty-five tests behind it. Rewriting
 * it as inline browser script would mean an untested copy of the one piece of
 * this feature that must not be wrong, and two copies to keep in step
 * afterwards. A round trip per tap is the price, and it is small next to that.
 *
 * WHAT THIS ENDPOINT WILL NOT DO
 * It never joins two points with a straight line and calls the result routed.
 * When no chain of paths connects the taps it says `disconnected` and gives the
 * gap, and the page keeps that leg amber. Straight-lining a gap is how a 304 m
 * hole in the data becomes 304 m of invented ridge on someone's route.
 */

/** Metres a tap may be from a path and still count as on it.
 *
 *  Generous enough for a thumb on a phone at a sensible zoom, tight enough that
 *  a tap in open country does not grab a path on the far side of a valley.
 *  Beyond it the answer is `off_path`, which is the truthful answer for ground
 *  with no path on it. */
const SNAP_RADIUS_M = 45;

/** Padding around a leg when asking for paths, in degrees (~1.1 km).
 *
 *  A route rarely runs along the straight line between its taps, so a box drawn
 *  tight to them would miss the path that actually joins them and report a gap
 *  that is not there. */
const LEG_PAD_DEG = 0.01;

export function legBBox(points: LatLng[], padDeg = LEG_PAD_DEG): BBox {
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  return {
    minLat: Math.min(...lats) - padDeg,
    maxLat: Math.max(...lats) + padDeg,
    minLng: Math.min(...lngs) - padDeg,
    maxLng: Math.max(...lngs) + padDeg,
  };
}

/** `{lat,lng}` on the wire, `{latitude,longitude}` in the engine. Converted at
 *  the boundary rather than carried as a union, so nothing downstream has to
 *  ask which spelling it is holding. */
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

const wire = (p: LatLng) => ({ lat: p.latitude, lng: p.longitude });

export type SnapResponse =
  /** Both taps are on paths and paths join them. */
  | {
      outcome: "routed";
      points: Array<{ lat: number; lng: number }>;
      lengthM: number;
      directM: number;
      detourFactor: number;
      wayName: string | null;
    }
  /** Both on paths, but nothing joins them. The page keeps this leg amber. */
  | { outcome: "disconnected"; gapM: number; from: { lat: number; lng: number }; to: { lat: number; lng: number } }
  /** A tap landed on ground with no path near it. */
  | { outcome: "off_path"; which: "from" | "to" | "both" }
  /** A single tap, snapped, with no leg to route. */
  | { outcome: "snapped"; point: { lat: number; lng: number }; distanceM: number; wayName: string | null }
  /** There is no network to snap against — nothing mapped here, or Overpass
   *  would not answer. These are kept apart because "no paths here" is a fact
   *  about the ground and "we could not ask" is a fact about our plumbing, and
   *  someone drawing a route deserves to know which. */
  | { outcome: "no_paths" }
  | { outcome: "unavailable"; detail: string }
  | { outcome: "area_too_large" }
  | { outcome: "bad_request" };

/** The whole decision, with the network fetched by an injectable so tests can
 *  drive every branch without touching Overpass. */
export async function snapLeg(
  from: LatLng | null,
  to: LatLng,
  opts: { fetcher?: Fetcher; ways?: PathWay[] } = {},
): Promise<SnapResponse> {
  let ways: PathWay[];
  if (opts.ways) {
    ways = opts.ways;
  } else {
    const got = await fetchPathWays(legBBox(from ? [from, to] : [to]), { fetcher: opts.fetcher });
    if (got.kind === "bad_bbox") return { outcome: "bad_request" };
    if (got.kind === "too_large") return { outcome: "area_too_large" };
    if (got.kind === "upstream_failed") return { outcome: "unavailable", detail: got.detail };
    ways = got.ways;
  }

  if (ways.length === 0) return { outcome: "no_paths" };
  const network: PathNetwork = buildPathNetwork(ways);
  if (network.edges.length === 0) return { outcome: "no_paths" };

  const toSnap = snapToNetwork(network, to, SNAP_RADIUS_M);

  if (!from) {
    if (!toSnap) return { outcome: "off_path", which: "to" };
    return {
      outcome: "snapped",
      point: wire(toSnap.position),
      distanceM: Math.round(toSnap.distanceM),
      wayName: toSnap.wayName,
    };
  }

  const fromSnap = snapToNetwork(network, from, SNAP_RADIUS_M);
  if (!fromSnap || !toSnap) {
    return {
      outcome: "off_path",
      which: !fromSnap && !toSnap ? "both" : !fromSnap ? "from" : "to",
    };
  }

  const routed = routeAlongNetwork(network, fromSnap, toSnap);
  if (routed.kind === "disconnected") {
    return {
      outcome: "disconnected",
      gapM: Math.round(routed.gapM),
      from: wire(fromSnap.position),
      to: wire(toSnap.position),
    };
  }

  return {
    outcome: "routed",
    points: routed.coordinates.map(wire),
    lengthM: Math.round(routed.lengthM),
    directM: Math.round(routed.directM),
    /* Two decimals because the page shows this when it is high, and 1.7 reads
       as a judgement where 1.70381 reads as noise. */
    detourFactor: Math.round(routed.detourFactor * 100) / 100,
    wayName: toSnap.wayName,
  };
}

const router: IRouter = Router();

router.post("/path-snap", async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const to = toLatLng(body?.["to"]);
  if (!to) { res.status(400).json({ outcome: "bad_request" }); return; }
  /* `from` absent means a first tap, which is a snap with nothing to route to.
     `from` present but malformed is a caller bug and must not be silently
     treated as absent — that would quietly turn a broken leg into a lone
     point and lose a section of someone's route without saying so. */
  const hasFrom = body?.["from"] !== undefined && body?.["from"] !== null;
  const from = hasFrom ? toLatLng(body?.["from"]) : null;
  if (hasFrom && !from) { res.status(400).json({ outcome: "bad_request" }); return; }

  try {
    res.json(await snapLeg(from, to));
  } catch (err) {
    req.log?.warn({ err }, "path-snap failed");
    res.status(500).json({ outcome: "unavailable", detail: "snap failed" });
  }
});

export default router;
