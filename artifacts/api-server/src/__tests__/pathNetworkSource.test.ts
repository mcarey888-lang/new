import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  contains,
  inFlightCount,
  MAX_BBOX_AREA_DEG2,
  bboxAreaDeg2,
  cacheKey,
  clearNetworkCache,
  fetchPathWays,
  networkCacheSize,
  overpassQuery,
  parseOverpass,
  snapBBox,
  validBBox,
  type BBox,
} from "../services/routing/pathNetworkSource";

/* A recorded Overpass response for the Ogwen valley — 277 real ways around
   Tryfan, including the breaks in the data that matter. Real geometry rather
   than a hand-drawn grid, because the failures worth catching here are the ones
   real OSM data produces. OSM data is ODbL; it is used as a test fixture. */
const ogwen = () =>
  JSON.parse(readFileSync(`${__dirname}/fixtures/ogwen-overpass.json`, "utf8"));

const box = (minLat: number, minLng: number, maxLat: number, maxLng: number): BBox =>
  ({ minLat, minLng, maxLat, maxLng });

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

afterEach(() => clearNetworkCache());

describe("validBBox", () => {
  it("accepts a sane box", () => {
    expect(validBBox(box(53.1, -4.02, 53.14, -3.98))).toBe(true);
  });

  it("rejects one that is inside out", () => {
    /* Swapped corners are the classic caller bug, and Overpass answers them
       with an empty result rather than an error — so it would look like
       "nowhere here has paths" instead of "you sent it backwards". */
    expect(validBBox(box(53.14, -3.98, 53.1, -4.02))).toBe(false);
  });

  it("rejects a point, which has no area to search", () => {
    expect(validBBox(box(53.1, -4, 53.1, -4))).toBe(false);
  });

  it("rejects values off the globe and values that are not numbers", () => {
    expect(validBBox(box(-91, -4, 53, -3))).toBe(false);
    expect(validBBox(box(53, -181, 54, -3))).toBe(false);
    expect(validBBox(box(NaN, -4, 53.2, -3.9))).toBe(false);
  });
});

describe("cache key", () => {
  it("gives two nearby views the same key", () => {
    /* The point of the grid. Panning a hundred metres must not re-ask Overpass
       for a region it just answered for. */
    const a = box(53.1001, -4.0001, 53.1201, -3.9801);
    const b = box(53.1003, -4.0003, 53.1203, -3.9803);
    expect(cacheKey(a)).toBe(cacheKey(b));
  });

  it("gives genuinely different views different keys", () => {
    expect(cacheKey(box(53.1, -4.02, 53.14, -3.98)))
      .not.toBe(cacheKey(box(54.1, -3.02, 54.14, -2.98)));
  });

  it("only ever grows the box, so the answer still covers the question", () => {
    const asked = box(53.1234, -4.0123, 53.1456, -3.9876);
    const snapped = snapBBox(asked);
    expect(snapped.minLat).toBeLessThanOrEqual(asked.minLat);
    expect(snapped.minLng).toBeLessThanOrEqual(asked.minLng);
    expect(snapped.maxLat).toBeGreaterThanOrEqual(asked.maxLat);
    expect(snapped.maxLng).toBeGreaterThanOrEqual(asked.maxLng);
  });

  it("produces a clean key, not a floating point artefact", () => {
    /* Math.floor(53.115 / 0.005) * 0.005 lands on 53.11500000000001, and two
       identical requests would then miss each other in the cache. */
    expect(cacheKey(box(53.115, -4.005, 53.125, -3.995))).not.toMatch(/0000000|9999999/);
  });
});

describe("the Overpass query", () => {
  it("asks for ways people walk, and not for roads", () => {
    const q = overpassQuery(box(53.1, -4.02, 53.14, -3.98));
    for (const kind of ["path", "footway", "track", "bridleway", "steps"]) {
      expect(q).toContain(kind);
    }
    /* Snapping a hill route onto the A5 because it was the nearest line is
       worse than not snapping at all, so roads must never be requested. */
    expect(q).not.toMatch(/motorway|trunk|primary|residential/);
  });

  it("asks for geometry inline, so no second lookup is needed", () => {
    expect(overpassQuery(box(53.1, -4.02, 53.14, -3.98))).toContain("out geom");
  });

  it("carries a timeout, so a slow query is dropped rather than held", () => {
    expect(overpassQuery(box(53.1, -4.02, 53.14, -3.98))).toContain("timeout:25");
  });

  it("queries the snapped box, matching what gets cached", () => {
    /* If the query and the cache key disagreed, the cache would answer with a
       region that was never actually fetched. */
    const b = box(53.1234, -4.0123, 53.1456, -3.9876);
    const s = snapBBox(b);
    expect(overpassQuery(b)).toContain(`${s.minLat},${s.minLng},${s.maxLat},${s.maxLng}`);
  });
});

describe("parsing a response", () => {
  it("reads the real Ogwen data", () => {
    const ways = parseOverpass(ogwen());
    expect(ways.length).toBe(277);
    expect(ways.every(w => w.points.length >= 2)).toBe(true);
  });

  it("keeps the names that exist and leaves the rest null", () => {
    const ways = parseOverpass(ogwen());
    const named = ways.filter(w => w.name !== null);
    expect(named.length).toBeGreaterThan(0);
    expect(named.map(w => w.name)).toContain("Crib Ogwen");
    /* Most mountain paths are unnamed, and null says so. A name invented from
       the surrounding tags would be read back later as fact. */
    expect(ways.filter(w => w.name === null).length).toBeGreaterThan(named.length);
  });

  it("drops a way too short to carry a segment", () => {
    const ways = parseOverpass({
      elements: [
        { type: "way", id: 1, geometry: [{ lat: 53.1, lon: -4 }] },
        { type: "way", id: 2, geometry: [{ lat: 53.1, lon: -4 }, { lat: 53.2, lon: -4 }] },
      ],
    });
    /* A one-point way would otherwise become a zero-length edge and sit in the
       network as a node that routing can reach but never leave. */
    expect(ways.map(w => w.wayId)).toEqual([2]);
  });

  it("loses one broken way rather than the whole region", () => {
    const ways = parseOverpass({
      elements: [
        { type: "way", id: 1, geometry: [{ lat: "x", lon: -4 }, { lat: 53.2, lon: -4 }] },
        { type: "way", id: 2, geometry: [{ lat: 53.1, lon: -4 }, { lat: 53.2, lon: -4 }] },
      ],
    });
    expect(ways.map(w => w.wayId)).toEqual([2]);
  });

  it("survives a response that is not what we expected at all", () => {
    expect(parseOverpass(null)).toEqual([]);
    expect(parseOverpass({})).toEqual([]);
    expect(parseOverpass({ elements: "nope" })).toEqual([]);
    expect(parseOverpass({ elements: [{ type: "node", id: 1 }] })).toEqual([]);
  });
});

describe("fetching", () => {
  it("refuses a box bigger than we are willing to ask for", async () => {
    let called = false;
    const res = await fetchPathWays(box(50, -6, 56, 2), {
      fetcher: async () => { called = true; return ok({ elements: [] }); },
    });
    expect(res.kind).toBe("too_large");
    /* Refused before the request, not after. Forwarding half of Britain to a
       donated service is how a deployment gets blocked for everyone. */
    expect(called).toBe(false);
    if (res.kind === "too_large") expect(res.limitDeg2).toBe(MAX_BBOX_AREA_DEG2);
  });

  it("refuses an invalid box without asking", async () => {
    let called = false;
    const res = await fetchPathWays(box(53.14, -3.98, 53.1, -4.02), {
      fetcher: async () => { called = true; return ok({ elements: [] }); },
    });
    expect(res.kind).toBe("bad_bbox");
    expect(called).toBe(false);
  });

  it("asks once and serves the second request from cache", async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return ok(ogwen()); };
    const b = box(53.1, -4.02, 53.14, -3.98);
    const first = await fetchPathWays(b, { fetcher });
    const second = await fetchPathWays(b, { fetcher });
    expect(calls).toBe(1);
    expect(first.kind === "ways" && first.cached).toBe(false);
    expect(second.kind === "ways" && second.cached).toBe(true);
    expect(second.kind === "ways" && second.ways.length).toBe(277);
  });

  it("re-asks once the cached answer is an hour old", async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return ok({ elements: [] }); };
    const b = box(53.1, -4.02, 53.14, -3.98);
    let t = 1_000_000;
    await fetchPathWays(b, { fetcher, now: () => t });
    t += 61 * 60 * 1000;
    await fetchPathWays(b, { fetcher, now: () => t });
    expect(calls).toBe(2);
  });

  it("reports a refusal as upstream failure, not as empty ground", async () => {
    /* The distinction this endpoint exists to preserve. "Overpass is rate
       limiting us" and "there are no paths here" must never arrive looking the
       same, because one is a reason to wait and the other is a fact about the
       mountain. */
    const res = await fetchPathWays(box(53.1, -4.02, 53.14, -3.98), {
      fetcher: async () => ({ ok: false, status: 429 }) as unknown as Response,
    });
    expect(res.kind).toBe("upstream_failed");
    if (res.kind === "upstream_failed") expect(res.status).toBe(429);
  });

  it("reports a network error the same honest way", async () => {
    const res = await fetchPathWays(box(53.1, -4.02, 53.14, -3.98), {
      fetcher: async () => { throw new Error("ECONNREFUSED"); },
    });
    expect(res.kind).toBe("upstream_failed");
    if (res.kind === "upstream_failed") expect(res.status).toBeNull();
  });

  it("does not cache a failure", async () => {
    /* Caching a 429 would turn a momentary rate limit into an hour of silence. */
    await fetchPathWays(box(53.1, -4.02, 53.14, -3.98), {
      fetcher: async () => ({ ok: false, status: 429 }) as unknown as Response,
    });
    expect(networkCacheSize()).toBe(0);
  });

  it("identifies itself, as the usage policy asks", async () => {
    let seen: Record<string, string> = {};
    await fetchPathWays(box(53.1, -4.02, 53.14, -3.98), {
      fetcher: async (_u, init) => {
        seen = (init.headers ?? {}) as Record<string, string>;
        return ok({ elements: [] });
      },
    });
    /* A contact in the agent is what turns a block into an email. */
    expect(seen["User-Agent"]).toContain("SummitReady");
  });
});

describe("area", () => {
  it("is computed so the cap means something", () => {
    expect(bboxAreaDeg2(box(53, -4, 53.2, -3.8))).toBeCloseTo(0.04, 6);
  });
});

describe("many taps at once", () => {
  /* The failure that sent this back for a second look. Someone tapped sixteen
     points in a few seconds. Every tap asked for a leg, every one found an
     empty cache because none of the answers had arrived yet, and all fifteen
     went to Overpass at once. Overpass serves about two concurrent queries per
     client and refused the rest, so seven sections of a real route came back
     unanswerable and were drawn as straight lines.

     The cache was never the problem. The gap between asking and answering
     was. */

  it("asks once when fifteen legs want the same region at the same time", async () => {
    let calls = 0;
    let release!: () => void;
    const held = new Promise<void>(r => { release = r; });
    const fetcher = async () => {
      calls += 1;
      await held; // nothing comes back until every request has been made
      return ok(ogwen());
    };

    const b = box(53.1, -4.02, 53.14, -3.98);
    const all = Array.from({ length: 15 }, () => fetchPathWays(b, { fetcher }));
    /* All fifteen are now in flight with nothing answered. Before the fix this
       is the moment fifteen queries left for Overpass. */
    expect(inFlightCount()).toBe(1);
    release();

    const results = await Promise.all(all);
    expect(calls).toBe(1);
    expect(results.every(r => r.kind === "ways")).toBe(true);
    expect(results.every(r => r.kind === "ways" && r.ways.length === 277)).toBe(true);
  });

  it("clears the shared request afterwards, so a later tap is not stuck on it", async () => {
    const b = box(53.1, -4.02, 53.14, -3.98);
    await fetchPathWays(b, { fetcher: async () => ok(ogwen()) });
    expect(inFlightCount()).toBe(0);
  });

  it("does not leave a failure behind for everyone after it to inherit", async () => {
    /* A settled failure left in the in-flight map would make every later
       request for that region wait on it and fail too, long after the service
       recovered. */
    const b = box(53.1, -4.02, 53.14, -3.98);
    const bad = await fetchPathWays(b, {
      fetcher: async () => ({ ok: false, status: 429 }) as unknown as Response,
    });
    expect(bad.kind).toBe("upstream_failed");
    expect(inFlightCount()).toBe(0);

    const good = await fetchPathWays(b, { fetcher: async () => ok(ogwen()) });
    expect(good.kind).toBe("ways");
  });

  it("tells waiters the shared request failed rather than reporting empty ground", async () => {
    /* "No paths here" is a fact about the mountain. "We could not ask" is a
       fact about our plumbing. A waiter must not be handed the first when the
       second happened. */
    let release!: () => void;
    const held = new Promise<void>(r => { release = r; });
    const fetcher = async () => {
      await held;
      return ({ ok: false, status: 429 }) as unknown as Response;
    };
    const b = box(53.1, -4.02, 53.14, -3.98);
    const pair = [fetchPathWays(b, { fetcher }), fetchPathWays(b, { fetcher })];
    release();
    const [first, second] = await Promise.all(pair);
    expect(first.kind).toBe("upstream_failed");
    expect(second.kind).toBe("upstream_failed");
  });
});

describe("one fetch serves a whole walk", () => {
  it("answers a smaller region from a larger one already held", async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return ok(ogwen()); };
    await fetchPathWays(box(53.10, -4.04, 53.16, -3.96), { fetcher });
    /* A leg drawn well inside the region already fetched. Asking again for it
       would be a round trip to learn something already known. */
    const inside = await fetchPathWays(box(53.12, -4.00, 53.13, -3.99), { fetcher });
    expect(calls).toBe(1);
    expect(inside.kind === "ways" && inside.cached).toBe(true);
  });

  it("still fetches for a region that sticks out of what is held", async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return ok({ elements: [] }); };
    await fetchPathWays(box(53.10, -4.04, 53.12, -4.00), { fetcher });
    await fetchPathWays(box(53.30, -4.04, 53.32, -4.00), { fetcher });
    expect(calls).toBe(2);
  });

  it("uses cells big enough that a walk fits in one or two", () => {
    /* A 2.7 km route across a hillside crossed five or six of the old 550 m
       cells and so asked five or six times for a region one query covers. */
    const a = box(53.101, -4.019, 53.104, -4.016);
    const b = box(53.105, -4.015, 53.108, -4.012);
    expect(cacheKey(a)).toBe(cacheKey(b));
    /* And the cell really is a couple of kilometres across, not a few hundred
       metres. 0.02 degrees of latitude is about 2.2 km. */
    const cell = snapBBox(a);
    /* Compared with a tolerance: 53.12 - 53.10 is 0.01999999999999602 in
       double arithmetic, and an exact comparison would fail on a cell that is
       the right size. */
    expect(cell.maxLat - cell.minLat).toBeCloseTo(0.02, 6);
  });
});

describe("contains", () => {
  it("is true only when one box fully encloses the other", () => {
    const outer = box(53.0, -4.1, 53.2, -3.9);
    expect(contains(outer, box(53.05, -4.05, 53.15, -3.95))).toBe(true);
    expect(contains(outer, outer)).toBe(true);
    /* Overlapping is not containing: half a region's paths is worse than none,
       because the missing half looks like genuine gaps. */
    expect(contains(outer, box(53.05, -4.05, 53.25, -3.95))).toBe(false);
    expect(contains(outer, box(52.9, -4.05, 53.15, -3.95))).toBe(false);
  });
});
