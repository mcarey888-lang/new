import type { RoutePoint } from "./offRoute";

/**
 * The day cache: Ordnance Survey tiles held for one walk and then deleted.
 *
 * WHY EXPIRY IS NOT HOUSEKEEPING HERE
 * -----------------------------------
 * The Standard OS Maps API permits a temporary cache of up to 24 hours. That
 * is a condition of the licence, not a tidiness preference, so expiry has to
 * be a rule the app obeys rather than a background job that usually runs.
 *
 * Two consequences shape everything below. A tile past its window is treated
 * as absent even if the bytes are still on disk — availability is decided by
 * the clock, never by what happens to be lying around. And the window is set
 * shorter than the licence allows, because a cache that expires an hour late
 * because a phone was in a pocket is a breach, and the cost of expiring early
 * is one download.
 *
 * WHAT IT IS FOR
 * A walk. Download in the car park, walk all day on full detail, let it go
 * overnight. It is not for keeping a region for a trip next month — that needs
 * a different licence and a different store.
 *
 * Pure: the caller passes the clock and holds the records. Nothing here reads
 * a filesystem, so the rule that matters can be tested exhaustively.
 */

/**
 * How long a cached tile may be used.
 *
 * The licence allows 24 hours. This is 22, and the margin is deliberate: a
 * phone asleep in a pocket, a clock that drifts, a download that finished
 * later than its record says. Expiring early costs one refetch; expiring late
 * is a breach of the terms the maps are served under.
 */
export const CACHE_WINDOW_HOURS = 22;
export const CACHE_WINDOW_MS = CACHE_WINDOW_HOURS * 60 * 60 * 1000;

export interface CachedTile {
  /** Zoom, column, row — the tile's address. */
  z: number;
  x: number;
  y: number;
  /** Milliseconds since the epoch, when the tile was written. */
  fetchedAt: number;
  bytes: number;
}

export const tileKey = (z: number, x: number, y: number): string => `${z}/${x}/${y}`;

/** Whether a tile may still be drawn. */
export function isFresh(tile: Pick<CachedTile, "fetchedAt">, now: number): boolean {
  /* A record from the future is a clock that has been changed, and nothing can
     be concluded about its age. Treated as expired, because the alternative is
     holding a tile indefinitely on the strength of a bad timestamp. */
  if (!Number.isFinite(tile.fetchedAt) || tile.fetchedAt > now) return false;
  return now - tile.fetchedAt < CACHE_WINDOW_MS;
}

/** Milliseconds until a tile expires, or 0 once it has. */
export function msUntilExpiry(tile: Pick<CachedTile, "fetchedAt">, now: number): number {
  if (!isFresh(tile, now)) return 0;
  return tile.fetchedAt + CACHE_WINDOW_MS - now;
}

export interface SweepResult {
  /** Keys to delete. Everything the licence no longer covers. */
  expired: string[];
  /** Still usable. */
  keptCount: number;
  bytesFreed: number;
}

/**
 * Everything that must go, in one pass.
 *
 * Returns what to delete rather than deleting it, so the decision is testable
 * and the caller owns the filesystem. A sweep that silently did the work would
 * be a rule nobody could check.
 */
export function sweep(
  tiles: ReadonlyMap<string, CachedTile> | readonly [string, CachedTile][],
  now: number,
): SweepResult {
  const entries = tiles instanceof Map ? [...tiles.entries()] : tiles;
  const expired: string[] = [];
  let keptCount = 0;
  let bytesFreed = 0;
  for (const [key, tile] of entries) {
    if (isFresh(tile, now)) keptCount += 1;
    else {
      expired.push(key);
      if (Number.isFinite(tile.bytes) && tile.bytes > 0) bytesFreed += tile.bytes;
    }
  }
  return { expired, keptCount, bytesFreed };
}

/* ── Working out what a walk needs ──────────────────────────────────────── */

export interface TileAddress { z: number; x: number; y: number }

/** Web Mercator tile containing a position at one zoom. */
export function tileFor(point: RoutePoint, z: number): TileAddress {
  const n = 2 ** z;
  const latRad = (point.latitude * Math.PI) / 180;
  const x = Math.floor(((point.longitude + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { z, x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/**
 * Deepest zoom worth caching.
 *
 * 17 is where rights of way become legible, which is the detail that makes OS
 * worth carrying. Deeper would multiply the download for no information: the
 * layer is not published past it and the map stretches the last level.
 */
export const MAX_CACHE_ZOOM = 17;
/** Shallowest. Below this a whole walk fits in a handful of tiles and there is
 *  nothing to be gained by starting higher. */
export const MIN_CACHE_ZOOM = 11;

/**
 * Every tile a route needs, with a margin either side.
 *
 * The margin is the point. A cache drawn tight to the line gives a map that
 * ends at the edge of the screen the moment somebody looks sideways to work
 * out which valley they are in — which is exactly when they need it.
 */
export function tilesForRoute(
  route: readonly RoutePoint[],
  opts: { minZoom?: number; maxZoom?: number; marginTiles?: number } = {},
): TileAddress[] {
  if (route.length === 0) return [];
  const minZoom = opts.minZoom ?? MIN_CACHE_ZOOM;
  const maxZoom = opts.maxZoom ?? MAX_CACHE_ZOOM;
  const margin = opts.marginTiles ?? 1;

  const seen = new Set<string>();
  const out: TileAddress[] = [];

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const n = 2 ** z;
    /* The route's own tiles first, then the margin around them. Done per zoom
       because a margin of one tile means something different at each. */
    const core = new Set<string>();
    for (const point of route) {
      const t = tileFor(point, z);
      core.add(`${t.x},${t.y}`);
    }
    /* Consecutive samples can be more than one tile apart at deep zoom, which
       would leave holes along the line. Filling the span between each pair
       keeps the corridor continuous. */
    for (let i = 1; i < route.length; i += 1) {
      const a = tileFor(route[i - 1]!, z);
      const b = tileFor(route[i]!, z);
      const stepX = Math.sign(b.x - a.x);
      const stepY = Math.sign(b.y - a.y);
      let cx = a.x;
      let cy = a.y;
      /* Bounded by the span itself, so a pathological pair cannot loop. */
      let guard = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + 2;
      while ((cx !== b.x || cy !== b.y) && guard-- > 0) {
        if (cx !== b.x) cx += stepX;
        if (cy !== b.y) cy += stepY;
        core.add(`${cx},${cy}`);
      }
    }

    for (const cell of core) {
      const [cxs, cys] = cell.split(",");
      const cx = Number(cxs);
      const cy = Number(cys);
      for (let dx = -margin; dx <= margin; dx += 1) {
        for (let dy = -margin; dy <= margin; dy += 1) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const key = tileKey(z, x, y);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ z, x, y });
        }
      }
    }
  }
  return out;
}

export interface CachePlan {
  /** Addresses still to fetch. */
  missing: TileAddress[];
  /** Already held and still within the window. */
  freshCount: number;
  /** Held but out of time — counted as missing, and listed for deletion. */
  expiredKeys: string[];
}

/**
 * What a walk needs that is not already cached.
 *
 * An expired tile counts as missing even though its bytes are present. The
 * clock decides what the app may use, so a plan built on what is on disk
 * rather than what is in date would quietly keep serving tiles past the window
 * the licence allows.
 */
export function planFor(
  route: readonly RoutePoint[],
  held: ReadonlyMap<string, CachedTile>,
  now: number,
  opts: { minZoom?: number; maxZoom?: number; marginTiles?: number } = {},
): CachePlan {
  const needed = tilesForRoute(route, opts);
  const missing: TileAddress[] = [];
  const expiredKeys: string[] = [];
  let freshCount = 0;

  for (const t of needed) {
    const key = tileKey(t.z, t.x, t.y);
    const have = held.get(key);
    if (have && isFresh(have, now)) {
      freshCount += 1;
    } else {
      missing.push(t);
      if (have) expiredKeys.push(key);
    }
  }
  return { missing, freshCount, expiredKeys };
}
