import { Router, type IRouter } from "express";

/**
 * Satellite tile proxy.
 *
 * WHY THIS EXISTS RATHER THAN A TILE URL IN THE PAGE
 * --------------------------------------------------
 * Mapbox authenticates tiles with an access token in the URL. Put that URL in
 * the map page and the token ships to every browser that loads it, where it can
 * be read from view-source and spent by anyone. Mapbox bills per tile request,
 * so an exposed token is a billing exposure, not just an untidy one.
 *
 * Proxying moves the token server-side. The browser asks this server for a
 * tile; this server asks Mapbox, holding the token. Nothing secret reaches the
 * client.
 *
 * WHAT PROXYING DOES NOT DO
 * It does not make tiles cheaper. Every miss here is still a billed Mapbox
 * request. The cache below is what reduces the bill, and it only helps for
 * tiles more than one person looks at — which, for a UK hill app, is most of
 * them: everybody opens Snowdon.
 *
 * ⚠️ THIS ENDPOINT IS PUBLIC, because the map page it serves is public. Anyone
 * who finds the URL can spend your Mapbox quota through it. The cache and the
 * tileset allowlist blunt that; they do not stop a determined abuser. Before
 * this is anything but a development convenience it wants either auth or a rate
 * limit. That is a decision with product consequences — a public share link for
 * a route needs tiles without a login — so it is flagged here rather than
 * guessed at.
 *
 * ⚠️ CACHING IS FOR PERFORMANCE, NOT OFFLINE. Mapbox terms permit temporary
 * caching to make a map responsive. They do not permit building a permanent
 * offline tile store — that needs their own SDKs and a different plan. The
 * cache here is small, in memory, and dies with the process, which keeps it on
 * the right side of that line. Do not grow it into offline storage without
 * reading the terms; the same question is still open for OS tiles.
 */

/** A tileset we are willing to fetch. The allowlist is the security boundary:
 *  without it, a path parameter would let a caller point this server at any
 *  URL it liked. */
interface TilesetSpec {
  /** Build the upstream URL. The token is applied by the caller, not stored. */
  url: (z: number, x: number, y: number, token: string) => string;
  /** Pixel size of the returned image's tile scheme — 256 or 512. The map has
   *  to be told, and getting it wrong misaligns imagery against the terrain. */
  tileSize: 256 | 512;
}

export const TILESETS: Record<string, TilesetSpec> = {
  /* Raw imagery, no labels. The v4 raster endpoint, which serves the 256 tile
     scheme; @2x returns it at double resolution for retina screens. */
  satellite: {
    url: (z, x, y, token) =>
      `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.jpg90?access_token=${token}`,
    tileSize: 256,
  },
  /* Imagery with roads, paths and place names drawn over it. A different API —
     the Static Tiles endpoint, rendering a style — and it serves the 512 tile
     scheme, hence the different tileSize. */
  "satellite-streets": {
    url: (z, x, y, token) =>
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/${z}/${x}/${y}@2x?access_token=${token}`,
    tileSize: 512,
  },
};

/** Deepest zoom we will pass upstream. Beyond this a request is refused rather
 *  than forwarded, so a runaway client cannot bill us for tiles nobody asked
 *  for. Mapbox serves deeper in places; the map stretches the last level, which
 *  is a better failure than a surprise invoice. */
export const MAX_TILE_ZOOM = 19;

/**
 * Is this a real tile address?
 *
 * Every component must be a whole number, and x and y must fall inside the grid
 * that zoom actually has — 2^z by 2^z. Anything else is either a bug upstream
 * or someone probing, and both deserve a 400 rather than a forwarded request.
 */
export function validTile(z: number, x: number, y: number): boolean {
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (z < 0 || z > MAX_TILE_ZOOM) return false;
  const span = 2 ** z;
  return x >= 0 && x < span && y >= 0 && y < span;
}

/* ── Cache ──────────────────────────────────────────────────────────────────
   Bounded by bytes, not entry count, because tile sizes vary by an order of
   magnitude: a tile of open sea is a few kilobytes, a tile of Ogwen is
   hundreds. Counting entries would let the cache quietly grow past whatever
   the process can afford. Eviction is oldest-first, which for map browsing
   approximates least-recently-useful well enough to not be worth more code. */

const CACHE_MAX_BYTES = 48 * 1024 * 1024;

interface CachedTile {
  body: Buffer;
  contentType: string;
}

const cache = new Map<string, CachedTile>();
let cacheBytes = 0;

export function cacheStats(): { entries: number; bytes: number } {
  return { entries: cache.size, bytes: cacheBytes };
}

export function clearTileCache(): void {
  cache.clear();
  cacheBytes = 0;
}

function cacheGet(key: string): CachedTile | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  /* Re-insert so this tile counts as recently used; Map preserves insertion
     order, so deleting and setting moves it to the back of the eviction queue. */
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cachePut(key: string, tile: CachedTile): void {
  /* A single tile larger than the whole budget would evict everything and then
     not fit. Refuse it instead of emptying the cache for nothing. */
  if (tile.body.byteLength > CACHE_MAX_BYTES) return;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cacheBytes -= existing.body.byteLength;
  }
  cache.set(key, tile);
  cacheBytes += tile.body.byteLength;
  while (cacheBytes > CACHE_MAX_BYTES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const evicted = cache.get(oldest.value);
    cache.delete(oldest.value);
    if (evicted) cacheBytes -= evicted.body.byteLength;
  }
}

const router: IRouter = Router();

router.get("/map-tiles/:tileset/:z/:x/:y", async (req, res) => {
  const spec = TILESETS[req.params.tileset];
  if (!spec) { res.status(404).end(); return; }

  const z = Number(req.params.z);
  const x = Number(req.params.x);
  /* The filename carries an extension the map library appends; strip it before
     parsing or every request is NaN. */
  const y = Number(String(req.params.y).replace(/\.(png|jpe?g|webp)$/i, ""));
  if (!validTile(z, x, y)) { res.status(400).end(); return; }

  const token = process.env.MAPBOX_TOKEN;
  /* No token is a deployment state, not a crash. The layer is not offered in
     the switcher when the token is absent, so reaching here means someone
     requested it directly. */
  if (!token) { res.status(503).end(); return; }

  const key = `${req.params.tileset}/${z}/${x}/${y}`;
  const hit = cacheGet(key);
  if (hit) {
    res.set("Content-Type", hit.contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("X-Tile-Cache", "hit");
    res.send(hit.body);
    return;
  }

  try {
    const upstream = await fetch(spec.url(z, x, y, token), {
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      /* Pass the status through rather than flattening it. The map treats any
         error the same, but a 401 in the server log says "token" and a 429 says
         "quota", and those need different fixes. */
      req.log?.warn({ status: upstream.status, key }, "Tile upstream failed");
      res.status(upstream.status).end();
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = Buffer.from(await upstream.arrayBuffer());
    cachePut(key, { body, contentType });
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("X-Tile-Cache", "miss");
    res.send(body);
  } catch (err) {
    req.log?.warn({ err, key }, "Tile proxy failed");
    res.status(502).end();
  }
});

export default router;
