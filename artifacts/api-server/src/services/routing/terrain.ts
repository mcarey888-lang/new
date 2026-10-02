import sharp from "sharp";
import type { LatLng } from "./pathSnapping";

/**
 * Ground height along a route, read from a digital elevation model.
 *
 * WHAT THIS IS AND IS NOT
 * -----------------------
 * The heights here come from a DEM — a grid of elevations derived from radar
 * and photogrammetry — not from a survey of the path. That has consequences
 * worth stating plainly, because an ascent figure looks authoritative whatever
 * produced it:
 *
 *   The grid is about 30 m across on the ground. A step, a slab or a short
 *   steep rise narrower than that does not exist in this data. On a rocky
 *   ridge the real climbing is lumpier than anything here can show.
 *
 *   Horizontal error matters more than vertical on steep ground. A line drawn
 *   20 m from where the path actually runs can sit a long way up or down a
 *   crag face, and the profile will faithfully report the wrong hillside.
 *
 * So this is a planning figure. It is good for "is this a big day", and it is
 * not a substitute for the route description.
 *
 * TERRARIUM ENCODING
 * The tiles store height in the colour channels: red is the 256 m digit, green
 * the metre, blue the fraction, with a 32768 m offset so below sea level still
 * fits in unsigned bytes. That is the whole format.
 */

const TERRAIN_TILE_URL =
  process.env.TERRAIN_TILE_URL ??
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/**
 * Zoom to sample at.
 *
 * 14 gives about 5.7 m per pixel at this latitude, which is finer than the
 * underlying data and so costs nothing in accuracy; it buys the ability to
 * place a sample precisely rather than rounding it to a coarse cell. Going
 * deeper would only resample the provider's own interpolation and present it
 * as detail.
 */
export const TERRAIN_ZOOM = 14;

const TILE_PX = 256;

/** Height in metres from one terrarium pixel. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export interface TilePos {
  tileX: number;
  tileY: number;
  /** Pixel within the tile, fractional so neighbours can be blended. */
  px: number;
  py: number;
}

/** Web Mercator tile and pixel for a position. */
export function tilePos(point: LatLng, z = TERRAIN_ZOOM): TilePos {
  const n = 2 ** z;
  const latRad = (point.latitude * Math.PI) / 180;
  const xf = ((point.longitude + 180) / 360) * n;
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(xf);
  const tileY = Math.floor(yf);
  return {
    tileX,
    tileY,
    px: (xf - tileX) * TILE_PX,
    py: (yf - tileY) * TILE_PX,
  };
}

/** A decoded tile: height per pixel, row-major. */
type Heights = Float32Array;

const tileCache = new Map<string, Heights>();
const tileInFlight = new Map<string, Promise<Heights | null>>();
const TILE_CACHE_MAX = 48;

export function clearTerrainCache(): void {
  tileCache.clear();
  tileInFlight.clear();
}
export function terrainCacheSize(): number {
  return tileCache.size;
}

export type TileFetcher = (url: string) => Promise<Response>;

async function loadTile(
  z: number,
  x: number,
  y: number,
  fetcher: TileFetcher,
): Promise<Heights | null> {
  const key = `${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  /* Shared the same way path fetches are, and for the same reason: a route
     crossing one tile asks for it once per sample otherwise, and they all miss
     while the first is still in the air. */
  const pending = tileInFlight.get(key);
  if (pending) return pending;

  const work = (async (): Promise<Heights | null> => {
    try {
      const url = TERRAIN_TILE_URL.replace("{z}", String(z))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
      const res = await fetcher(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const { data, info } = await sharp(buf)
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (info.width !== TILE_PX || info.height !== TILE_PX) return null;

      const heights = new Float32Array(TILE_PX * TILE_PX);
      const ch = info.channels;
      for (let i = 0; i < TILE_PX * TILE_PX; i += 1) {
        const o = i * ch;
        heights[i] = decodeTerrarium(data[o]!, data[o + 1]!, data[o + 2]!);
      }

      if (tileCache.size >= TILE_CACHE_MAX) {
        const oldest = tileCache.keys().next();
        if (!oldest.done) tileCache.delete(oldest.value);
      }
      tileCache.set(key, heights);
      return heights;
    } catch {
      return null;
    }
  })();

  tileInFlight.set(key, work);
  try {
    return await work;
  } finally {
    tileInFlight.delete(key);
  }
}

/**
 * Height at one position, or null when the tile could not be read.
 *
 * Null, never zero. A missing tile means we do not know the height here, and
 * zero would be sea level — which on a mountain route is not a gap in the
 * data, it is a cliff, and it would turn one failed request into hundreds of
 * metres of invented ascent.
 *
 * Bilinear between the four surrounding pixels. Nearest-neighbour would make
 * the profile a staircase and every step would be counted as climbing.
 */
export async function elevationAt(
  point: LatLng,
  fetcher: TileFetcher = fetch,
  z = TERRAIN_ZOOM,
): Promise<number | null> {
  const pos = tilePos(point, z);

  /* A sample near a tile edge needs its neighbours, which may be the next tile
     along. Reading from whichever tile each pixel actually belongs to keeps
     the join seamless rather than flattening the last half pixel. */
  const x0 = Math.floor(pos.px - 0.5);
  const y0 = Math.floor(pos.py - 0.5);
  const fx = pos.px - 0.5 - x0;
  const fy = pos.py - 0.5 - y0;

  const corners: Array<[number, number]> = [
    [x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1],
  ];
  const values: number[] = [];
  for (const [cx, cy] of corners) {
    let tileX = pos.tileX;
    let tileY = pos.tileY;
    let ix = cx;
    let iy = cy;
    if (ix < 0) { tileX -= 1; ix += TILE_PX; }
    if (ix >= TILE_PX) { tileX += 1; ix -= TILE_PX; }
    if (iy < 0) { tileY -= 1; iy += TILE_PX; }
    if (iy >= TILE_PX) { tileY += 1; iy -= TILE_PX; }

    const heights = await loadTile(z, tileX, tileY, fetcher);
    if (!heights) return null;
    values.push(heights[iy * TILE_PX + ix]!);
  }

  const top = values[0]! * (1 - fx) + values[1]! * fx;
  const bottom = values[2]! * (1 - fx) + values[3]! * fx;
  return top * (1 - fy) + bottom * fy;
}
