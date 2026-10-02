import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ASCENT_THRESHOLD_M,
  MAX_SAMPLES,
  SAMPLE_INTERVAL_M,
  ascentDescent,
  resample,
  routeProfile,
} from "../services/routing/profile";
import {
  TERRAIN_ZOOM,
  clearTerrainCache,
  decodeTerrarium,
  elevationAt,
  terrainCacheSize,
  tilePos,
} from "../services/routing/terrain";
import { distanceM, type LatLng } from "../services/routing/pathSnapping";

/* One real terrarium tile covering the Ogwen valley and Tryfan's flanks,
   recorded from the live service. Real terrain rather than a painted gradient,
   because the thing worth testing is behaviour on ground that actually
   undulates. Data: Mapzen / AWS Terrain Tiles. */
const TILE = readFileSync(`${__dirname}/fixtures/terrarium-14-8010-5328.png`);
const tileFetcher = async () =>
  ({ ok: true, arrayBuffer: async () => TILE }) as unknown as Response;

/* Inside tile 14/8010/5328, so the fixture answers every lookup. */
const IN_TILE: LatLng = { latitude: 53.1150, longitude: -3.9880 };

afterEach(() => clearTerrainCache());

describe("terrarium decoding", () => {
  it("reads the documented encoding", () => {
    /* red is the 256 m digit, green the metre, blue the fraction, less a
       32768 m offset so below sea level still fits in unsigned bytes. */
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
    expect(decodeTerrarium(128, 100, 0)).toBe(100);
    expect(decodeTerrarium(128, 0, 128)).toBe(0.5);
    expect(decodeTerrarium(129, 0, 0)).toBe(256);
  });

  it("handles ground below sea level without wrapping", () => {
    /* The offset exists for exactly this. Getting it wrong turns a polder into
       a mountain. */
    expect(decodeTerrarium(127, 156, 0)).toBe(-100);
  });
});

describe("tile position", () => {
  it("round-trips through the inverse projection", () => {
    /* Proves the Web Mercator maths rather than asserting a number I worked
       out by the same method it is meant to check. */
    const p: LatLng = { latitude: 53.11936, longitude: -3.99369 };
    const t = tilePos(p);
    const n = 2 ** TERRAIN_ZOOM;
    const xf = t.tileX + t.px / 256;
    const yf = t.tileY + t.py / 256;
    const lng = (xf / n) * 360 - 180;
    const e = Math.PI - (2 * Math.PI * yf) / n;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(e) - Math.exp(-e)));
    expect(lat).toBeCloseTo(p.latitude, 9);
    expect(lng).toBeCloseTo(p.longitude, 9);
  });

  it("puts a point inside a tile, not on its edge", () => {
    const t = tilePos({ latitude: 53.1150, longitude: -3.9880 });
    expect(t.px).toBeGreaterThanOrEqual(0);
    expect(t.px).toBeLessThan(256);
    expect(t.py).toBeGreaterThanOrEqual(0);
    expect(t.py).toBeLessThan(256);
  });
});

describe("reading a height", () => {
  it("returns real ground from a real tile", async () => {
    const e = await elevationAt(IN_TILE, tileFetcher);
    expect(e).not.toBeNull();
    /* Somewhere on the flank between the valley floor and the ridge. A wide
       range on purpose: this asserts the decode is sane, not that a particular
       pixel holds a particular number. */
    expect(e!).toBeGreaterThan(200);
    expect(e!).toBeLessThan(1000);
  });

  it("returns null, never zero, when a tile will not load", async () => {
    /* Zero is sea level. On a mountain route a missing tile read as zero is
       not a gap, it is a cliff, and it would invent hundreds of metres of
       ascent out of one failed request. */
    const e = await elevationAt(IN_TILE, async () => ({ ok: false }) as unknown as Response);
    expect(e).toBeNull();
  });

  it("blends between pixels rather than stepping", async () => {
    /* Nearest-neighbour would make the profile a staircase, and the threshold
       would then count every step as climbing. Two points a few metres apart
       should differ smoothly, not be identical then jump. */
    const a = await elevationAt({ latitude: 53.1150, longitude: -3.98800 }, tileFetcher);
    const b = await elevationAt({ latitude: 53.1150, longitude: -3.98795 }, tileFetcher);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it("fetches a tile once however many points land on it", async () => {
    let calls = 0;
    const counting = async () => { calls += 1; return tileFetcher(); };
    for (let i = 0; i < 20; i += 1) {
      await elevationAt({ latitude: 53.115 + i * 0.0001, longitude: -3.988 }, counting);
    }
    expect(calls).toBeLessThanOrEqual(2);
    expect(terrainCacheSize()).toBeGreaterThan(0);
  });
});

describe("resampling", () => {
  it("spaces points evenly regardless of how the line was drawn", () => {
    /* A drawn route has points where the path bends — dense on zigzags, sparse
       on a traverse. Profiling those directly weights the result by how wiggly
       the mapping is rather than by distance walked. */
    const line: LatLng[] = [
      { latitude: 53.120, longitude: -3.990 },
      { latitude: 53.121, longitude: -3.990 },
      { latitude: 53.125, longitude: -3.990 },
    ];
    const out = resample(line, 30);
    for (let i = 1; i < out.length - 1; i += 1) {
      expect(distanceM(out[i - 1]!, out[i]!)).toBeCloseTo(30, 0);
    }
  });

  it("keeps both ends", () => {
    /* Dropping the last point loses the final climb to a summit, which is the
       part of the profile that matters most. */
    const line: LatLng[] = [
      { latitude: 53.120, longitude: -3.990 },
      { latitude: 53.1255, longitude: -3.990 },
    ];
    const out = resample(line, 30);
    expect(out[0]).toEqual(line[0]);
    expect(distanceM(out[out.length - 1]!, line[1]!)).toBeLessThan(1.5);
  });

  it("survives a repeated point without looping forever", () => {
    const line: LatLng[] = [
      { latitude: 53.12, longitude: -3.99 },
      { latitude: 53.12, longitude: -3.99 },
      { latitude: 53.121, longitude: -3.99 },
    ];
    expect(resample(line, 30).length).toBeGreaterThan(1);
  });
});

describe("ascent", () => {
  it("counts a steady climb in full", () => {
    expect(ascentDescent(Array.from({ length: 101 }, (_, i) => i)))
      .toEqual({ ascentM: 100, descentM: 0 });
  });

  it("ignores noise entirely", () => {
    /* THE TEST THIS ALGORITHM EXISTS FOR. Two hundred samples of flat ground
       jittering by three metres. Summing every positive difference — the
       obvious implementation — claims three hundred metres of climbing on a
       walk with none. */
    const jitter = Array.from({ length: 200 }, (_, i) => 500 + (i % 2 ? 3 : -3));
    expect(ascentDescent(jitter)).toEqual({ ascentM: 0, descentM: 0 });

    let naive = 0;
    for (let i = 1; i < jitter.length; i += 1) {
      if (jitter[i]! > jitter[i - 1]!) naive += jitter[i]! - jitter[i - 1]!;
    }
    expect(naive).toBeGreaterThan(290);
  });

  it("counts each climb on an undulating route", () => {
    expect(ascentDescent([0, 100, 0, 100])).toEqual({ ascentM: 200, descentM: 100 });
  });

  it("does not lose the last climb", () => {
    /* The final leg never turns over, so it has to be banked at the end. A
       route finishing on a summit would otherwise report nothing for it. */
    expect(ascentDescent([0, 50]).ascentM).toBe(50);
    expect(ascentDescent([50, 0]).descentM).toBe(50);
  });

  it("gets steadily less generous as the threshold rises", () => {
    const wobble = Array.from({ length: 60 }, (_, i) => 300 + Math.sin(i / 2) * 6);
    const loose = ascentDescent(wobble, 2).ascentM;
    const tight = ascentDescent(wobble, 20).ascentM;
    expect(loose).toBeGreaterThan(tight);
    expect(tight).toBe(0);
  });

  it("says nothing rather than something for a single point", () => {
    expect(ascentDescent([500])).toEqual({ ascentM: 0, descentM: 0 });
    expect(ascentDescent([])).toEqual({ ascentM: 0, descentM: 0 });
  });
});

describe("profiling a route", () => {
  const CLIMB: LatLng[] = [
    { latitude: 53.1180, longitude: -3.9880 },
    { latitude: 53.1150, longitude: -3.9880 },
  ];

  it("reports ascent, range and how it was measured", async () => {
    const r = await routeProfile(CLIMB, { fetcher: tileFetcher });
    expect(r.outcome).toBe("profiled");
    if (r.outcome !== "profiled") return;
    expect(r.points.length).toBeGreaterThan(5);
    expect(r.maxElevationM).toBeGreaterThan(r.minElevationM);
    /* The method travels with the number so it can be argued with rather than
       taken on trust. */
    expect(r.method.thresholdM).toBe(ASCENT_THRESHOLD_M);
    expect(r.method.sampleIntervalM).toBe(SAMPLE_INTERVAL_M);
  });

  it("can never report more ascent than the height range allows on a climb", async () => {
    /* A monotonic climb cannot gain more than high minus low. If it does, the
       threshold has stopped working and noise is being counted. */
    const r = await routeProfile(CLIMB, { fetcher: tileFetcher });
    if (r.outcome !== "profiled") throw new Error("expected profiled");
    const range = r.maxElevationM - r.minElevationM;
    expect(r.ascentM).toBeLessThanOrEqual(range + ASCENT_THRESHOLD_M);
  });

  it("gives no ascent figure at all when part of the route is unknown", async () => {
    /* A figure computed from the half that loaded reads as the whole route's
       ascent, and the missing half is exactly where it might be climbing. */
    let n = 0;
    const flaky = async () => {
      n += 1;
      return n > 1 ? ({ ok: false } as unknown as Response) : tileFetcher();
    };
    clearTerrainCache();
    const r = await routeProfile(
      [{ latitude: 53.118, longitude: -3.988 }, { latitude: 53.100, longitude: -3.900 }],
      { fetcher: flaky },
    );
    expect(r.outcome).toBe("incomplete");
    expect(r).not.toHaveProperty("ascentM");
  });

  it("refuses a line too long to sample rather than grinding", async () => {
    const r = await routeProfile(
      [{ latitude: 50, longitude: -5 }, { latitude: 58, longitude: -2 }],
      { fetcher: tileFetcher },
    );
    expect(r.outcome).toBe("too_long");
    if (r.outcome === "too_long") expect(r.limit).toBe(MAX_SAMPLES);
  });

  it("says too_short for a single point", async () => {
    const r = await routeProfile([{ latitude: 53.115, longitude: -3.988 }], { fetcher: tileFetcher });
    expect(r.outcome).toBe("too_short");
  });
});
