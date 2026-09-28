/**
 * Ordnance Survey raster tiles for the map.
 *
 * OS cartography is the reason to build route planning for a UK audience: it
 * shows rights of way, field boundaries and the path furniture people actually
 * navigate by, which no generic basemap does.
 *
 * PROJECTION IS THE CONSTRAINT, AND IT DECIDES THE LAYER
 * -----------------------------------------------------
 * `UrlTile` in react-native-maps speaks one tile scheme: Web Mercator ZXY, the
 * `{z}/{x}/{y}` grid every slippy map uses. The OS Maps API serves two
 * projections, and only one of them is that:
 *
 *   *_3857   EPSG:3857, Web Mercator — drops straight into UrlTile
 *   *_27700  EPSG:27700, British National Grid — a different grid entirely
 *
 * This matters more than it sounds, because the layer most walkers want is the
 * 1:25k Explorer mapping, and OS publishes that as `Leisure_27700`. It cannot
 * be consumed by UrlTile without reprojection, so it is deliberately not
 * offered here — a 27700 layer requested on a 3857 grid does not fail loudly,
 * it returns tiles for the wrong place on Earth. `Outdoor_3857` is the closest
 * Web Mercator equivalent and is what this module defaults to.
 *
 * NO KEY IS A NORMAL STATE
 * `osTileTemplate` returns null when no key is configured, and the map then
 * shows the platform basemap with no overlay. A developer without the secret
 * gets a working app, and the drawing engine does not care what is underneath.
 *
 * VERIFIED AGAINST THE LIVE API, over Tryfan: the host, path, `Outdoor_3857`
 * and the `key` parameter all return imagery, and a wrong layer name returns an
 * OGC ExceptionReport rather than failing silently, so a mistake here is loud.
 *
 * ⚠️ STILL OPEN: whether the licence permits CACHING tiles for offline use.
 * That is a separate permission from fetching them, it is not answerable from
 * the API's behaviour, and it is the one that matters most for a mountain app —
 * settle it before offline planning is designed around stored tiles.
 */

/** OS Maps API layers that are Web Mercator, and so usable with UrlTile. */
export type OsWebMercatorLayer = "Outdoor_3857" | "Light_3857" | "Road_3857";

/** Paths, access land and contours. The walker's layer of the three. */
export const DEFAULT_OS_LAYER: OsWebMercatorLayer = "Outdoor_3857";

const OS_ZXY_HOST = "https://api.os.uk/maps/raster/v1/zxy";

/**
 * Deepest zoom to request.
 *
 * Asking past a layer's published maximum returns blank tiles rather than an
 * error, so the map goes empty exactly when someone zooms in to place a point
 * precisely. Capping means the last good level is stretched instead, which is
 * ugly and legible rather than tidy and blank.
 *
 * 17 is confirmed against the live API over Tryfan rather than assumed: z15, 16
 * and 17 all return imagery, and 17 is where rights of way become legible — the
 * detail that makes OS worth carrying over the path network we snap to. The
 * layer may serve deeper still; nothing breaks if it does, since the map
 * stretches the last level rather than blanking. Raise this only on the same
 * evidence.
 */
export const OS_MAX_ZOOM = 17;

export interface OsTileSource {
  urlTemplate: string;
  maximumZ: number;
  /** Shown on the map. OS licensing requires it; so does honesty. */
  attribution: string;
  layer: OsWebMercatorLayer;
}

/**
 * Build a tile source, or null when there is no key.
 *
 * The key travels in the URL because that is how the OS Maps API authenticates
 * tile requests, which means it is visible to anything watching the device's
 * traffic. That is inherent to client-side tiles rather than a flaw here, and
 * it is why the key needs restricting at the OS Data Hub rather than hiding.
 */
export function osTileSource(
  key: string | null | undefined,
  layer: OsWebMercatorLayer = DEFAULT_OS_LAYER,
): OsTileSource | null {
  const trimmed = typeof key === "string" ? key.trim() : "";
  if (!trimmed) return null;
  return {
    // `{z}` `{x}` `{y}` are placeholders UrlTile substitutes, not a template
    // literal — they must reach the string intact.
    urlTemplate: `${OS_ZXY_HOST}/${layer}/{z}/{x}/{y}.png?key=${encodeURIComponent(trimmed)}`,
    maximumZ: OS_MAX_ZOOM,
    attribution: "Contains OS data © Crown copyright and database right",
    layer,
  };
}

/** Just the template, for a caller that only needs the one string. */
export function osTileTemplate(
  key: string | null | undefined,
  layer: OsWebMercatorLayer = DEFAULT_OS_LAYER,
): string | null {
  return osTileSource(key, layer)?.urlTemplate ?? null;
}
