import { describe, expect, it } from "vitest";
import { CACHE_WINDOW_MS, tileKey, type CachedTile, type TileAddress } from "./dayCache";
import {
  fallbackMessage,
  mapReadiness,
  readinessMessage,
  resolveTile,
  shouldBlockStart,
  type Connectivity,
  type FallbackReason,
} from "./tileSource";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 4, 12, 9, 0, 0);
const AT: TileAddress = { z: 15, x: 16_100, y: 10_400 };
const KEY = tileKey(AT.z, AT.x, AT.y);

const cached = (fetchedAt: number, bytes = 20_000): Map<string, CachedTile> =>
  new Map([[KEY, { ...AT, fetchedAt, bytes }]]);

const empty = new Map<string, CachedTile>();
const withFallback = { fallbackAvailable: true };
const noFallback = { fallbackAvailable: false };

describe("resolveTile", () => {
  it("serves a fresh cached tile even with a signal", () => {
    // Cache-first is not only for offline. It is faster, it survives the
    // patchy reception that is normal on a hill, and OS bill per transaction
    // so refetching a tile already held costs money for nothing.
    const source = resolveTile(AT, cached(NOW - HOUR), NOW, "online", withFallback);
    expect(source).toEqual({ kind: "cache", key: KEY });
  });

  it("serves a fresh cached tile offline", () => {
    expect(resolveTile(AT, cached(NOW - HOUR), NOW, "offline", withFallback).kind).toBe("cache");
  });

  it("fetches a tile it has never had, with a signal", () => {
    expect(resolveTile(AT, empty, NOW, "online", withFallback)).toEqual({
      kind: "network",
      address: AT,
    });
  });

  it("still tries the network on a metered link", () => {
    // Worth a moment's wait: the alternative is a coarser map when a better
    // one was there to be had.
    expect(resolveTile(AT, empty, NOW, "metered", withFallback).kind).toBe("network");
  });

  it("refetches rather than reusing an expired tile when there is a signal", () => {
    const source = resolveTile(AT, cached(NOW - 30 * HOUR), NOW, "online", withFallback);
    expect(source).toEqual({ kind: "network", address: AT });
  });

  it("will not draw an expired OS tile offline, even with nothing else", () => {
    // The case that matters, and the one where it would be tempting to bend.
    // The 24-hour window is a licence condition, so an expired tile is not
    // drawn however badly it is wanted. The permanent layer is the answer.
    const source = resolveTile(AT, cached(NOW - 30 * HOUR), NOW, "offline", noFallback);
    expect(source.kind).not.toBe("cache");
    expect(source).toEqual({ kind: "unavailable", address: AT, reason: "expired" });
  });

  it("drops to the permanent layer when the OS tile has expired offline", () => {
    expect(resolveTile(AT, cached(NOW - 30 * HOUR), NOW, "offline", withFallback)).toEqual({
      kind: "fallback",
      address: AT,
      reason: "expired",
    });
  });

  it("distinguishes never-cached from expired", () => {
    const never = resolveTile(AT, empty, NOW, "offline", withFallback);
    expect(never).toEqual({ kind: "fallback", address: AT, reason: "not_cached" });
  });

  it("treats an empty file as unreadable rather than drawing nothing", () => {
    // Zero bytes is a file created and never written. Drawing it produces a
    // blank square that looks like a rendering fault.
    const source = resolveTile(AT, cached(NOW - HOUR, 0), NOW, "offline", withFallback);
    expect(source).toEqual({ kind: "fallback", address: AT, reason: "corrupt" });
  });

  it("refetches an empty file when there is a signal", () => {
    expect(resolveTile(AT, cached(NOW - HOUR, 0), NOW, "online", withFallback).kind).toBe(
      "network",
    );
  });

  it("keeps a tile right up to the edge of the window", () => {
    const edge = cached(NOW - CACHE_WINDOW_MS + 1000);
    expect(resolveTile(AT, edge, NOW, "offline", withFallback).kind).toBe("cache");
  });

  it("gives up on it one millisecond later", () => {
    const over = cached(NOW - CACHE_WINDOW_MS);
    expect(resolveTile(AT, over, NOW, "offline", withFallback).kind).toBe("fallback");
  });

  it("never returns a tile without a reason when it cannot draw the OS layer", () => {
    // A blank reason is the state where a broken download and unmapped ground
    // look identical.
    const cases: [Map<string, CachedTile>, Connectivity][] = [
      [empty, "offline"],
      [cached(NOW - 30 * HOUR), "offline"],
      [cached(NOW - HOUR, 0), "offline"],
    ];
    for (const [cache, connectivity] of cases) {
      const source = resolveTile(AT, cache, NOW, connectivity, withFallback);
      expect(source.kind === "fallback" || source.kind === "unavailable").toBe(true);
      if (source.kind === "fallback" || source.kind === "unavailable") {
        expect(source.reason).toBeTruthy();
        expect(fallbackMessage(source.reason).length).toBeGreaterThan(10);
      }
    }
  });
});

describe("fallbackMessage", () => {
  const reasons: FallbackReason[] = ["expired", "not_cached", "corrupt"];

  it("says something for every reason", () => {
    for (const reason of reasons) {
      expect(fallbackMessage(reason)).toMatch(/\S/);
    }
  });

  it("tells the person what to do about an expiry rather than apologising", () => {
    const message = fallbackMessage("expired");
    expect(message.toLowerCase()).toContain("download again");
    expect(message.toLowerCase()).not.toContain("sorry");
    expect(message.toLowerCase()).not.toContain("error");
  });

  it("says plainly that the standard map is being shown", () => {
    for (const reason of reasons) {
      expect(fallbackMessage(reason).toLowerCase()).toContain("standard map");
    }
  });

  it("uses no jargon a walker would not recognise", () => {
    for (const reason of reasons) {
      const message = fallbackMessage(reason).toLowerCase();
      for (const word of ["tile", "cache", "licence", "zoom", "raster", "pmtiles"]) {
        expect(message).not.toContain(word);
      }
    }
  });
});

/** A handful of addresses standing in for a route's tiles. */
const needed: TileAddress[] = Array.from({ length: 10 }, (_, i) => ({
  z: 15,
  x: 16_100 + i,
  y: 10_400,
}));
const keyOf = (t: TileAddress) => tileKey(t.z, t.x, t.y);
const build = (
  count: number,
  fetchedAt: number,
  bytes = 20_000,
): Map<string, CachedTile> =>
  new Map(needed.slice(0, count).map((t) => [keyOf(t), { ...t, fetchedAt, bytes }]));

describe("mapReadiness", () => {
  it("is full when every tile is cached and in date", () => {
    expect(mapReadiness(needed, build(10, NOW - HOUR), NOW, "offline", withFallback)).toEqual({
      kind: "full",
    });
  });

  it("is streaming whenever there is a signal and something is missing", () => {
    expect(mapReadiness(needed, build(3, NOW - HOUR), NOW, "online", withFallback).kind).toBe(
      "streaming",
    );
    expect(mapReadiness(needed, empty, NOW, "metered", withFallback).kind).toBe("streaming");
  });

  it("is full with a signal when nothing is missing", () => {
    // Already complete is already complete; no point saying it will stream.
    expect(mapReadiness(needed, build(10, NOW - HOUR), NOW, "online", withFallback).kind).toBe(
      "full",
    );
  });

  it("is mixed when part of the route is cached", () => {
    const readiness = mapReadiness(needed, build(6, NOW - HOUR), NOW, "offline", withFallback);
    expect(readiness).toEqual({
      kind: "mixed",
      osTiles: 6,
      fallbackTiles: 4,
      reason: "not_cached",
    });
  });

  it("falls back entirely when the whole cache has expired", () => {
    const readiness = mapReadiness(needed, build(10, NOW - 30 * HOUR), NOW, "offline", withFallback);
    expect(readiness).toEqual({ kind: "fallback_only", reason: "expired" });
  });

  it("has no map at all when nothing is cached and there is no fallback", () => {
    expect(mapReadiness(needed, empty, NOW, "offline", noFallback)).toEqual({
      kind: "no_map",
      reason: "not_cached",
    });
  });

  it("leads with expiry when tiles are both expired and missing", () => {
    // Expiry is the reason a person can act on, and the one that explains a
    // map that worked yesterday.
    const cache = build(4, NOW - 30 * HOUR);
    const readiness = mapReadiness(needed, cache, NOW, "offline", withFallback);
    expect(readiness.kind).toBe("fallback_only");
    if (readiness.kind === "fallback_only") expect(readiness.reason).toBe("expired");
  });

  it("counts an empty file as missing, not as coverage", () => {
    const cache = build(10, NOW - HOUR, 0);
    const readiness = mapReadiness(needed, cache, NOW, "offline", withFallback);
    expect(readiness).toEqual({ kind: "fallback_only", reason: "corrupt" });
  });

  it("is full for a route with no tiles to need", () => {
    expect(mapReadiness([], empty, NOW, "offline", withFallback).kind).toBe("full");
  });

  it("adds the counts up to the tiles needed", () => {
    const readiness = mapReadiness(needed, build(7, NOW - HOUR), NOW, "offline", withFallback);
    if (readiness.kind === "mixed") {
      expect(readiness.osTiles + readiness.fallbackTiles).toBe(needed.length);
    } else throw new Error("expected mixed");
  });
});

describe("readinessMessage", () => {
  it("says nothing when the map is complete or streaming", () => {
    expect(readinessMessage({ kind: "full" })).toBeNull();
    expect(readinessMessage({ kind: "streaming" })).toBeNull();
  });

  it("warns before setting off when there is no map at all", () => {
    const message = readinessMessage({ kind: "no_map", reason: "expired" });
    expect(message).toBeTruthy();
    expect(message!.toLowerCase()).toContain("before you set off");
  });

  it("names the plain case of no offline map", () => {
    const message = readinessMessage({ kind: "no_map", reason: "not_cached" });
    expect(message!.toLowerCase()).toContain("no offline map");
  });

  it("quotes no tile counts at anyone", () => {
    // Nobody decides anything on "412 of 500 tiles", and a number that precise
    // implies a precision about what is on screen that it does not have.
    const messages = [
      readinessMessage({ kind: "mixed", osTiles: 412, fallbackTiles: 88, reason: "expired" }),
      readinessMessage({ kind: "mixed", osTiles: 412, fallbackTiles: 0, reason: "not_cached" }),
      readinessMessage({ kind: "fallback_only", reason: "expired" }),
      readinessMessage({ kind: "no_map", reason: "not_cached" }),
    ];
    for (const message of messages) {
      expect(message).toBeTruthy();
      expect(message!).not.toMatch(/\d/);
    }
  });

  it("distinguishes a gap with a fallback from a gap without one", () => {
    const withLayer = readinessMessage({
      kind: "mixed",
      osTiles: 6,
      fallbackTiles: 4,
      reason: "not_cached",
    });
    const without = readinessMessage({
      kind: "mixed",
      osTiles: 6,
      fallbackTiles: 0,
      reason: "not_cached",
    });
    expect(withLayer).not.toBe(without);
    expect(without!.toLowerCase()).toContain("no map without a signal");
  });
});

describe("shouldBlockStart", () => {
  it("never stops somebody starting a walk", () => {
    // Offline-first Start must not wait on anything, and a map is not a
    // condition of walking. Written down so it is not quietly changed.
    const all = [
      { kind: "full" } as const,
      { kind: "streaming" } as const,
      { kind: "fallback_only", reason: "expired" } as const,
      { kind: "no_map", reason: "not_cached" } as const,
      { kind: "mixed", osTiles: 0, fallbackTiles: 10, reason: "corrupt" } as const,
    ];
    for (const readiness of all) {
      expect(shouldBlockStart(readiness)).toBe(false);
    }
  });
});
