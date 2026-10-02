import type { PathWay } from "./pathSnapping";

/**
 * Where the path network comes from.
 *
 * Snapping is only as good as the paths it snaps to, and the paths come from
 * OpenStreetMap via Overpass. This module is the boundary: it asks for ways in
 * a bounding box and returns them in the shape the snap engine wants. Nothing
 * downstream needs to know Overpass exists.
 *
 * OVERPASS IS SOMEONE ELSE'S FREE SERVICE, AND IT IS SMALL
 * -------------------------------------------------------
 * The public instances are donated capacity with a usage policy, not an API we
 * are entitled to. A tile-style endpoint pointed at it from a public page could
 * generate thousands of queries an hour and get the whole deployment blocked —
 * which would take path snapping down for every user, not just the abusive one.
 * So three things are deliberate here and should not be loosened casually:
 *
 *   1. A hard cap on bounding box area. A request for half of Wales is refused
 *      rather than forwarded.
 *   2. Cache keys snapped to a grid, so panning a few metres reuses the cached
 *      network instead of issuing a near-identical query.
 *   3. An identifying User-Agent, which the policy asks for and which means a
 *      problem reaches us as an email rather than as a silent block.
 *
 * ⚠️ UNVERIFIED AGAINST THE LIVE SERVICE. The network policy of the machine
 * this was written on refuses Overpass outright, so the query, the response
 * parsing and the error handling are all tested against recorded fixtures
 * only. Everything here is shaped from the documented API rather than observed
 * behaviour. Confirm it against the real endpoint before relying on it — the
 * most likely surprises are the exact error body on a rate limit and whether
 * the server honours the timeout in the query.
 */

/**
 * Overpass instances, tried in order.
 *
 * More than one because a single public instance is not a dependency you can
 * plan a route on. They are donated capacity, frequently at their limit, and
 * they refuse requests under load — which arrives here as a leg that will not
 * snap, on a route somebody is in the middle of drawing. Observed in use:
 * a single 0.77 km leg came back unroutable while the elevation service beside
 * it answered fine, because the one instance was busy.
 *
 * They run the same API over the same data, so moving to the next one is a
 * retry against a different queue rather than a different answer.
 *
 * OVERPASS_URL still overrides, and a self-hosted instance remains the honest
 * fix if this ever carries real traffic — this only makes the public ones less
 * fragile in the meantime.
 */
export const OVERPASS_ENDPOINTS: readonly string[] =
  process.env.OVERPASS_URL
    ? [process.env.OVERPASS_URL]
    : [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
      ];

/* ⚠️ ANY ENDPOINT ADDED HERE MUST CARRY THE WHOLE PLANET.
 *
 * Several public Overpass instances hold one country or region. One of those
 * does not fail for a query outside its area — it answers 200 with no
 * elements, which this code cannot tell from open moorland with nothing
 * mapped on it. The route would then be reported as having no paths near it,
 * confidently and wrongly, and the person would believe it.
 *
 * Both above are full-planet mirrors. A regional one is worse than no
 * fallback at all.
 *
 * ⚠️ UNVERIFIED FROM THE MACHINE THIS WAS WRITTEN ON: its network policy
 * refuses Overpass outright, so the fallback is tested against fixtures only.
 * The order, the retry rule and the sharing are proven; that these two hosts
 * answer is not. */

/** Statuses worth trying elsewhere rather than giving up on.
 *
 *  429 is "too many requests" and 504 is "I gave up"; both are about this
 *  instance's load at this moment and say nothing about the data. A 400 means
 *  the query is wrong and would be wrong everywhere, so it is not retried —
 *  three instances all rejecting the same bad query is three times the
 *  nuisance for the same answer. */
export function worthRetrying(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Identifies us to Overpass, per their usage policy.
 *
 * A contact address in the agent is what turns "we blocked an abusive IP" into
 * "we emailed someone". Set OVERPASS_CONTACT to a real address in deployment.
 */
const USER_AGENT = `SummitReady/1.0 (+${process.env.OVERPASS_CONTACT ?? "unset-contact"})`;

/**
 * Largest area we will ask for, in square degrees.
 *
 * 0.04 is roughly 22 km by 22 km at this latitude — comfortably more than a
 * day's walk, and enough that a planner zoomed out to pick a line has the whole
 * route in one fetch. Past that the response runs to megabytes and takes long
 * enough that the person assumes the map has broken.
 */
export const MAX_BBOX_AREA_DEG2 = 0.04;

/**
 * Grid the cache key is snapped to, in degrees (~2.2 km of latitude).
 *
 * Without this, every pixel of pan produces a new key and the cache never hits.
 * Snapping outward means a larger box is fetched than asked for, which costs
 * one query and saves many.
 *
 * It was 0.005 (~550 m), which was too fine: a 2.7 km route drawn across a
 * hillside crossed five or six cells and so asked Overpass five or six times
 * for a region a single query covers. A walk fits inside a couple of these
 * cells, which is the size this wants to be.
 */
const CACHE_GRID_DEG = 0.02;

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function bboxAreaDeg2(b: BBox): number {
  return Math.abs(b.maxLat - b.minLat) * Math.abs(b.maxLng - b.minLng);
}

/** Valid ranges, right way round, and not a point. */
export function validBBox(b: BBox): boolean {
  const finite = [b.minLat, b.minLng, b.maxLat, b.maxLng].every(Number.isFinite);
  if (!finite) return false;
  if (b.minLat < -90 || b.maxLat > 90 || b.minLng < -180 || b.maxLng > 180) return false;
  if (b.minLat >= b.maxLat || b.minLng >= b.maxLng) return false;
  return true;
}

/** Expand to the cache grid. Always outward, so the result still covers the ask. */
export function snapBBox(b: BBox): BBox {
  const f = (v: number) => Math.floor(v / CACHE_GRID_DEG) * CACHE_GRID_DEG;
  const c = (v: number) => Math.ceil(v / CACHE_GRID_DEG) * CACHE_GRID_DEG;
  /* Rounded because floating point leaves 53.115000000000002 here, and that
     would make two identical requests miss each other in the cache. */
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return { minLat: r(f(b.minLat)), minLng: r(f(b.minLng)), maxLat: r(c(b.maxLat)), maxLng: r(c(b.maxLng)) };
}

export function cacheKey(b: BBox): string {
  const s = snapBBox(b);
  return `${s.minLat},${s.minLng},${s.maxLat},${s.maxLng}`;
}

/**
 * The Overpass query.
 *
 * Only ways a person could reasonably walk. `highway=path` is the general case
 * in UK hill country; footway, track, bridleway and steps cover the rest of
 * what appears on a mountain. Roads are deliberately absent: snapping a hill
 * route onto the A5 because it happened to be the nearest line is worse than
 * not snapping at all.
 *
 * `out geom` returns each way's coordinates inline, which avoids a second pass
 * to resolve node ids — the ways are what we need and the nodes come with them.
 */
export function overpassQuery(b: BBox, timeoutS = 25): string {
  const s = snapBBox(b);
  const box = `${s.minLat},${s.minLng},${s.maxLat},${s.maxLng}`;
  return `[out:json][timeout:${timeoutS}];
(
  way["highway"~"^(path|footway|track|bridleway|steps|cycleway)$"](${box});
);
out geom;`;
}

/** The subset of the Overpass response this module reads. */
interface OverpassWay {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

/**
 * Turn an Overpass response into ways the snap engine can use.
 *
 * Tolerant on purpose: a single malformed way should cost that way, not the
 * whole region. A way with fewer than two points cannot carry a segment and is
 * dropped rather than passed on to become a zero-length edge.
 */
export function parseOverpass(body: unknown): PathWay[] {
  const elements = (body as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];

  const ways: PathWay[] = [];
  for (const raw of elements as OverpassWay[]) {
    if (!raw || raw.type !== "way" || !Array.isArray(raw.geometry)) continue;
    const points = raw.geometry
      .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map(p => ({ latitude: p.lat, longitude: p.lon }));
    if (points.length < 2) continue;
    ways.push({
      wayId: typeof raw.id === "number" ? raw.id : ways.length,
      /* An unnamed path is the normal case on a mountain, and null says that
         honestly. Inventing a name from the tags would put words in a map's
         mouth that a person would then read back as fact. */
      name: raw.tags?.["name"] ?? null,
      points,
    });
  }
  return ways;
}

export type FetchOutcome =
  | { kind: "ways"; ways: PathWay[]; cached: boolean }
  /** The box is bigger than we will ask for. Carries the limit so the caller
   *  can say by how much rather than just refusing. */
  | { kind: "too_large"; areaDeg2: number; limitDeg2: number }
  | { kind: "bad_bbox" }
  /** Overpass said no — rate limited, overloaded, or down. Distinguished from
   *  an empty result, because "no paths here" and "we could not ask" must not
   *  look the same to someone drawing a route. */
  | { kind: "upstream_failed"; status: number | null; detail: string };

interface CacheEntry {
  ways: PathWay[];
  at: number;
  /** The region actually fetched, so a later, smaller request inside it can be
   *  answered from here rather than asking again. */
  box: BBox;
}

/** True when `outer` fully contains `inner`. */
export function contains(outer: BBox, inner: BBox): boolean {
  return outer.minLat <= inner.minLat && outer.maxLat >= inner.maxLat
      && outer.minLng <= inner.minLng && outer.maxLng >= inner.maxLng;
}

/* OSM paths change on the timescale of weeks, so an hour is cautious. The cache
   is in memory and dies with the process, which is the right size for something
   whose job is to spare a donated service, not to be a datastore. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 64;
const cache = new Map<string, CacheEntry>();

/**
 * Fetches currently in flight, by cache key.
 *
 * THIS IS THE ONE THAT MATTERS. Someone drawing a route taps fifteen times in
 * a few seconds, and every tap asks for a leg. Without this, all fifteen find
 * an empty cache — because none of the answers has arrived yet — and all
 * fifteen go to Overpass at once. Overpass serves about two concurrent queries
 * per client and refuses the rest, so most of the route comes back
 * unanswerable and is drawn as straight lines. The cache was never the problem;
 * the gap between asking and answering was.
 *
 * Sharing the promise means the first tap fetches and the other fourteen wait
 * on the same result.
 */
const inFlight = new Map<string, Promise<PathWay[] | null>>();

export function clearNetworkCache(): void {
  cache.clear();
  inFlight.clear();
}
export function networkCacheSize(): number {
  return cache.size;
}
export function inFlightCount(): number {
  return inFlight.size;
}

/**
 * A cached region that covers this one, or null.
 *
 * Scanned rather than looked up, because a request for a small box should be
 * answered by a larger cached region containing it. With a bounded cache this
 * is a few dozen comparisons and saves a network round trip, which is not a
 * close trade.
 */
function covering(want: BBox, now: number): CacheEntry | null {
  for (const entry of cache.values()) {
    if (now - entry.at >= CACHE_TTL_MS) continue;
    if (contains(entry.box, want)) return entry;
  }
  return null;
}

/** Injectable so tests can exercise this without a network. */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function fetchPathWays(
  bbox: BBox,
  opts: { fetcher?: Fetcher; now?: () => number } = {},
): Promise<FetchOutcome> {
  if (!validBBox(bbox)) return { kind: "bad_bbox" };

  const want = snapBBox(bbox);
  const area = bboxAreaDeg2(want);
  if (area > MAX_BBOX_AREA_DEG2) {
    return { kind: "too_large", areaDeg2: area, limitDeg2: MAX_BBOX_AREA_DEG2 };
  }

  const now = opts.now ?? Date.now;
  const hit = covering(want, now());
  if (hit) return { kind: "ways", ways: hit.ways, cached: true };

  const key = cacheKey(bbox);

  /* Someone already asked for this region and has not been answered yet. Wait
     on their request instead of starting another — see the note on inFlight. */
  const pending = inFlight.get(key);
  if (pending) {
    const ways = await pending;
    if (ways) return { kind: "ways", ways, cached: true };
    /* The shared request failed. Say so rather than silently reporting empty
       ground, and do not retry here: fifteen waiters all retrying on failure
       is the stampede again, one step later. */
    return { kind: "upstream_failed", status: null, detail: "shared request failed" };
  }

  const doFetch = opts.fetcher ?? fetch;
  let failure: FetchOutcome | null = null;

  const work = (async (): Promise<PathWay[] | null> => {
    const query = new URLSearchParams({ data: overpassQuery(bbox) }).toString();
    let body: unknown = null;

    /* Each instance gets one attempt. No backoff loop on a single endpoint:
       waiting and asking the same busy queue again is how a person ends up
       staring at a half-drawn route, and the next instance is a better bet
       than the same one later. */
    for (let i = 0; i < OVERPASS_ENDPOINTS.length; i += 1) {
      const endpoint = OVERPASS_ENDPOINTS[i]!;
      let res: Response;
      try {
        res = await doFetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: query,
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        failure = {
          kind: "upstream_failed",
          status: null,
          detail: err instanceof Error ? err.message : "request failed",
        };
        continue;
      }

      if (!res.ok) {
        failure = { kind: "upstream_failed", status: res.status, detail: `overpass ${res.status}` };
        /* A rejection that is about the query rather than the load would be
           rejected identically everywhere, so stop rather than make the same
           mistake three times. */
        if (!worthRetrying(res.status)) break;
        continue;
      }

      try {
        body = await res.json();
      } catch {
        failure = { kind: "upstream_failed", status: res.status, detail: "response was not JSON" };
        continue;
      }
      failure = null;
      break;
    }

    if (body === null) return null;

    const ways = parseOverpass(body);

    /* Oldest-first eviction. The cache exists to spare Overpass, not to be
       clever, and a region nobody has looked at for an hour is the right thing
       to lose. */
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { ways, at: now(), box: want });
    return ways;
  })();

  inFlight.set(key, work);
  try {
    const ways = await work;
    if (ways) return { kind: "ways", ways, cached: false };
    return failure ?? { kind: "upstream_failed", status: null, detail: "unknown failure" };
  } finally {
    /* Cleared whether it succeeded or failed. Leaving a settled failure in here
       would make every later request for this region wait on it and inherit
       its error, long after the service recovered. */
    inFlight.delete(key);
  }
}
