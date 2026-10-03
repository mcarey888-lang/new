import { describe, expect, it } from "vitest";
import {
  CACHE_WINDOW_HOURS,
  CACHE_WINDOW_MS,
  MAX_CACHE_ZOOM,
  MIN_CACHE_ZOOM,
  isFresh,
  msUntilExpiry,
  planFor,
  sweep,
  tileFor,
  tileKey,
  tilesForRoute,
  type CachedTile,
} from "./dayCache";
import type { RoutePoint } from "./offRoute";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 4, 12, 9, 0, 0);

const tile = (fetchedAt: number, bytes = 20_000): CachedTile => ({
  z: 15,
  x: 16_100,
  y: 10_400,
  fetchedAt,
  bytes,
});

const held = (entries: [string, CachedTile][]): Map<string, CachedTile> => new Map(entries);

describe("the licence window", () => {
  it("stays inside the 24 hours the Standard API permits", () => {
    // The margin is the whole point of the constant. If someone raises this to
    // 24 to squeeze out a last hour, a phone that slept through the expiry is
    // then serving tiles outside the terms.
    expect(CACHE_WINDOW_HOURS).toBeLessThan(24);
    expect(CACHE_WINDOW_MS).toBe(CACHE_WINDOW_HOURS * HOUR);
  });

  it("keeps a tile fetched this morning", () => {
    expect(isFresh(tile(NOW - 2 * HOUR), NOW)).toBe(true);
  });

  it("keeps a tile right up to the edge", () => {
    expect(isFresh(tile(NOW - CACHE_WINDOW_MS + 1000), NOW)).toBe(true);
  });

  it("drops a tile exactly on the edge", () => {
    expect(isFresh(tile(NOW - CACHE_WINDOW_MS), NOW)).toBe(false);
  });

  it("drops yesterday's tiles", () => {
    expect(isFresh(tile(NOW - 25 * HOUR), NOW)).toBe(false);
  });

  it("drops a tile stamped in the future", () => {
    // A clock that has been changed. Nothing can be concluded about the age,
    // so the tile cannot be used — holding it would mean trusting a timestamp
    // already known to be wrong.
    expect(isFresh(tile(NOW + HOUR), NOW)).toBe(false);
  });

  it("drops a tile with no usable timestamp", () => {
    expect(isFresh(tile(Number.NaN), NOW)).toBe(false);
    expect(isFresh(tile(Number.POSITIVE_INFINITY), NOW)).toBe(false);
  });
});

describe("msUntilExpiry", () => {
  it("counts down from the fetch", () => {
    expect(msUntilExpiry(tile(NOW - 2 * HOUR), NOW)).toBe(CACHE_WINDOW_MS - 2 * HOUR);
  });

  it("is zero once expired, never negative", () => {
    expect(msUntilExpiry(tile(NOW - 40 * HOUR), NOW)).toBe(0);
  });

  it("is zero for a future stamp", () => {
    expect(msUntilExpiry(tile(NOW + HOUR), NOW)).toBe(0);
  });
});

describe("sweep", () => {
  it("lists every expired key and leaves the fresh ones", () => {
    const result = sweep(
      held([
        ["15/1/1", tile(NOW - HOUR)],
        ["15/1/2", tile(NOW - 30 * HOUR)],
        ["15/1/3", tile(NOW - 23 * HOUR)],
        ["15/1/4", tile(NOW - 3 * HOUR)],
      ]),
      NOW,
    );
    expect(result.expired.sort()).toEqual(["15/1/2", "15/1/3"]);
    expect(result.keptCount).toBe(2);
  });

  it("adds up the bytes it frees", () => {
    const result = sweep(
      held([
        ["a", tile(NOW - 30 * HOUR, 50_000)],
        ["b", tile(NOW - 30 * HOUR, 25_000)],
        ["c", tile(NOW - HOUR, 90_000)],
      ]),
      NOW,
    );
    expect(result.bytesFreed).toBe(75_000);
  });

  it("ignores a nonsense byte count rather than producing a nonsense total", () => {
    const result = sweep(
      held([
        ["a", tile(NOW - 30 * HOUR, Number.NaN)],
        ["b", tile(NOW - 30 * HOUR, 10_000)],
      ]),
      NOW,
    );
    expect(result.bytesFreed).toBe(10_000);
    expect(result.expired).toHaveLength(2);
  });

  it("sweeps everything after a week away", () => {
    const week = NOW + 7 * 24 * HOUR;
    const result = sweep(
      held([
        ["a", tile(NOW - HOUR)],
        ["b", tile(NOW)],
      ]),
      week,
    );
    expect(result.expired).toHaveLength(2);
    expect(result.keptCount).toBe(0);
  });

  it("handles an empty cache", () => {
    expect(sweep(held([]), NOW)).toEqual({ expired: [], keptCount: 0, bytesFreed: 0 });
  });

  it("accepts an entry array as well as a Map", () => {
    const entries: [string, CachedTile][] = [["a", tile(NOW - 30 * HOUR)]];
    expect(sweep(entries, NOW).expired).toEqual(["a"]);
  });
});

describe("tileFor", () => {
  it("places Snowdon's summit in the right tile", () => {
    // Snowdon / Yr Wyddfa, 53.0685 N 4.0760 W. Checked against the standard
    // Web Mercator formula at zoom 14.
    const t = tileFor({ latitude: 53.0685, longitude: -4.076 }, 14);
    expect(t.z).toBe(14);
    expect(t.x).toBe(8006);
    expect(t.y).toBe(5331);
  });

  it("puts a point just east of Greenwich past the halfway column", () => {
    const t = tileFor({ latitude: 51.5, longitude: 0.001 }, 10);
    expect(t.x).toBe(512);
  });

  it("stays inside the grid at the extremes", () => {
    const n = 2 ** 10;
    const east = tileFor({ latitude: 0, longitude: 180 }, 10);
    expect(east.x).toBeLessThanOrEqual(n - 1);
    const north = tileFor({ latitude: 85, longitude: 0 }, 10);
    expect(north.y).toBeGreaterThanOrEqual(0);
  });
});

/** A short walk on Snowdon: Pen-y-Pass to the summit, roughly. */
const walk: RoutePoint[] = [
  { latitude: 53.0787, longitude: -4.0203 },
  { latitude: 53.0751, longitude: -4.0355 },
  { latitude: 53.0719, longitude: -4.0521 },
  { latitude: 53.0702, longitude: -4.0668 },
  { latitude: 53.0685, longitude: -4.076 },
];

describe("tilesForRoute", () => {
  it("returns nothing for no route", () => {
    expect(tilesForRoute([])).toEqual([]);
  });

  it("covers every zoom in the range", () => {
    const zooms = new Set(tilesForRoute(walk).map((t) => t.z));
    for (let z = MIN_CACHE_ZOOM; z <= MAX_CACHE_ZOOM; z += 1) {
      expect(zooms.has(z)).toBe(true);
    }
    expect(zooms.size).toBe(MAX_CACHE_ZOOM - MIN_CACHE_ZOOM + 1);
  });

  it("caches to a zoom where rights of way are legible", () => {
    expect(MAX_CACHE_ZOOM).toBeGreaterThanOrEqual(16);
  });

  it("never repeats an address", () => {
    const tiles = tilesForRoute(walk);
    const keys = tiles.map((t) => tileKey(t.z, t.x, t.y));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes the tile each point actually sits in", () => {
    const keys = new Set(tilesForRoute(walk).map((t) => tileKey(t.z, t.x, t.y)));
    for (const point of walk) {
      for (let z = MIN_CACHE_ZOOM; z <= MAX_CACHE_ZOOM; z += 1) {
        const t = tileFor(point, z);
        expect(keys.has(tileKey(z, t.x, t.y))).toBe(true);
      }
    }
  });

  it("leaves no hole between consecutive points at the deepest zoom", () => {
    // Samples far apart land in non-adjacent tiles. Without filling the span
    // the cache would have gaps along the line — blank squares in the middle
    // of the walk, which is the one place they must not be.
    const sparse: RoutePoint[] = [
      { latitude: 53.0787, longitude: -4.0203 },
      { latitude: 53.0685, longitude: -4.076 },
    ];
    const keys = new Set(
      tilesForRoute(sparse, { minZoom: 17, maxZoom: 17, marginTiles: 0 }).map((t) =>
        tileKey(t.z, t.x, t.y),
      ),
    );
    const a = tileFor(sparse[0]!, 17);
    const b = tileFor(sparse[1]!, 17);
    // Walk the span and check each step is present.
    let cx = a.x;
    let cy = a.y;
    const stepX = Math.sign(b.x - a.x);
    const stepY = Math.sign(b.y - a.y);
    let guard = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + 2;
    while ((cx !== b.x || cy !== b.y) && guard-- > 0) {
      if (cx !== b.x) cx += stepX;
      if (cy !== b.y) cy += stepY;
      expect(keys.has(tileKey(17, cx, cy))).toBe(true);
    }
    expect(guard).toBeGreaterThan(0);
  });

  it("surrounds the corridor so the map does not end at the screen edge", () => {
    const withMargin = tilesForRoute(walk, { minZoom: 15, maxZoom: 15, marginTiles: 1 });
    const bare = tilesForRoute(walk, { minZoom: 15, maxZoom: 15, marginTiles: 0 });
    expect(withMargin.length).toBeGreaterThan(bare.length);

    const keys = new Set(withMargin.map((t) => tileKey(t.z, t.x, t.y)));
    const centre = tileFor(walk[2]!, 15);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      expect(keys.has(tileKey(15, centre.x + dx!, centre.y + dy!))).toBe(true);
    }
  });

  it("stays a plausible download for a day's walk", () => {
    // Not a hard limit, a tripwire. If a change makes this leap, the cache has
    // stopped being a day's walk and become a region download, which is a
    // different licence.
    expect(tilesForRoute(walk).length).toBeLessThan(2000);
  });

  it("never emits a tile outside the grid", () => {
    const edge: RoutePoint[] = [{ latitude: 0, longitude: 179.999 }];
    for (const t of tilesForRoute(edge, { minZoom: 11, maxZoom: 12 })) {
      const n = 2 ** t.z;
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(n);
      expect(t.y).toBeLessThan(n);
    }
  });
});

describe("planFor", () => {
  const needed = tilesForRoute(walk, { minZoom: 15, maxZoom: 15 });
  const opts = { minZoom: 15, maxZoom: 15 };

  it("asks for everything when nothing is cached", () => {
    const plan = planFor(walk, held([]), NOW, opts);
    expect(plan.missing).toHaveLength(needed.length);
    expect(plan.freshCount).toBe(0);
    expect(plan.expiredKeys).toEqual([]);
  });

  it("asks for nothing when the whole route is in date", () => {
    const cache = held(
      needed.map((t) => [tileKey(t.z, t.x, t.y), { ...t, fetchedAt: NOW - HOUR, bytes: 1000 }]),
    );
    const plan = planFor(walk, cache, NOW, opts);
    expect(plan.missing).toEqual([]);
    expect(plan.freshCount).toBe(needed.length);
  });

  it("re-fetches a tile whose bytes are present but whose time is up", () => {
    // The clock decides, not the disk. This is the case that would otherwise
    // keep serving tiles past the window.
    const cache = held(
      needed.map((t) => [
        tileKey(t.z, t.x, t.y),
        { ...t, fetchedAt: NOW - 30 * HOUR, bytes: 1000 },
      ]),
    );
    const plan = planFor(walk, cache, NOW, opts);
    expect(plan.missing).toHaveLength(needed.length);
    expect(plan.freshCount).toBe(0);
    expect(plan.expiredKeys).toHaveLength(needed.length);
  });

  it("separates the expired from the never-had", () => {
    const first = needed[0]!;
    const cache = held([
      [tileKey(first.z, first.x, first.y), { ...first, fetchedAt: NOW - 30 * HOUR, bytes: 500 }],
    ]);
    const plan = planFor(walk, cache, NOW, opts);
    expect(plan.expiredKeys).toEqual([tileKey(first.z, first.x, first.y)]);
    expect(plan.missing.length).toBe(needed.length);
  });

  it("ignores cached tiles that have nothing to do with this route", () => {
    const cache = held([["15/1/1", tile(NOW - HOUR)]]);
    const plan = planFor(walk, cache, NOW, opts);
    expect(plan.freshCount).toBe(0);
    expect(plan.expiredKeys).toEqual([]);
  });

  it("asks for nothing when there is no route", () => {
    expect(planFor([], held([]), NOW).missing).toEqual([]);
  });
});
