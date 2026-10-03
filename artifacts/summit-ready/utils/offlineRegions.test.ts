import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_DAYS,
  containsPoint,
  coverageWarning,
  formatBytes,
  isStale,
  isUsable,
  routeCoverage,
  storageSummary,
  type OfflineRegion,
} from "./offlineRegions";
import type { RoutePoint } from "./offRoute";

const region = (over: Partial<OfflineRegion> = {}): OfflineRegion => ({
  id: "snowdonia",
  name: "Snowdonia",
  bounds: { minLat: 52.9, minLng: -4.3, maxLat: 53.3, maxLng: -3.7 },
  status: "ready",
  bytes: 94 * 1024 * 1024,
  ...over,
});

const inside: RoutePoint[] = [
  { latitude: 53.1225, longitude: -3.9970 },
  { latitude: 53.1190, longitude: -3.9975 },
  { latitude: 53.1150, longitude: -3.9986 },
];
const outside: RoutePoint[] = [
  { latitude: 54.5000, longitude: -3.0000 },
  { latitude: 54.5100, longitude: -3.0100 },
];

describe("which regions can draw a map", () => {
  it("counts downloaded and out-of-date ones", () => {
    /* Stale paths are better than no paths, so an old region still draws. It
       is a prompt to refresh, not a reason to go blank on a hillside. */
    expect(isUsable(region({ status: "ready" }))).toBe(true);
    expect(isUsable(region({ status: "stale" }))).toBe(true);
  });

  it("does not count one that is absent, failing or still arriving", () => {
    /* A failed download leaves a person believing they have a map they do not
       have. Half a file is not a map. */
    expect(isUsable(region({ status: "absent" }))).toBe(false);
    expect(isUsable(region({ status: "failed" }))).toBe(false);
    expect(isUsable(region({ status: "downloading" }))).toBe(false);
  });
});

describe("is the walk covered", () => {
  it("says so when every point is inside a region", () => {
    const c = routeCoverage([region()], inside);
    expect(c.kind).toBe("covered");
    if (c.kind === "covered") expect(c.regionIds).toEqual(["snowdonia"]);
  });

  it("says none when the walk is somewhere else entirely", () => {
    /* THE CASE THIS EXISTS FOR. Downloaded a region last month, driving to a
       different valley today. Has maps; has no map for this walk. The app is
       the only thing placed to notice before the signal goes. */
    expect(routeCoverage([region()], outside).kind).toBe("none");
  });

  it("says partial when the route leaves the region part way", () => {
    /* A map that stops halfway up is more dangerous than no map, because the
       second one gets checked and the first one gets trusted. */
    const c = routeCoverage([region()], [...inside, ...outside]);
    expect(c.kind).toBe("partial");
    if (c.kind !== "partial") return;
    expect(c.coveredFraction).toBeCloseTo(3 / 5, 5);
    expect(c.firstGapIndex).toBe(3);
  });

  it("checks every point, not a box around the route", () => {
    /* A bounding box round a route that bends past a ridge takes in ground the
       route never touches. A region covering only that ground would be
       reported as covering the walk. */
    const corridor = region({
      bounds: { minLat: 53.10, minLng: -4.00, maxLat: 53.13, maxLng: -3.99 },
    });
    const detour: RoutePoint[] = [
      { latitude: 53.115, longitude: -3.995 },
      { latitude: 53.115, longitude: -3.950 }, // well east, outside the strip
      { latitude: 53.120, longitude: -3.995 },
    ];
    const c = routeCoverage([corridor], detour);
    expect(c.kind).toBe("partial");
  });

  it("can be covered by more than one region between them", () => {
    const west = region({ id: "w", bounds: { minLat: 53.11, minLng: -4.00, maxLat: 53.13, maxLng: -3.998 } });
    const east = region({ id: "e", bounds: { minLat: 53.11, minLng: -3.998, maxLat: 53.13, maxLng: -3.99 } });
    const c = routeCoverage([west, east], inside);
    expect(c.kind).toBe("covered");
    if (c.kind === "covered") expect(c.regionIds.sort()).toEqual(["e", "w"]);
  });

  it("ignores a region that is still downloading", () => {
    expect(routeCoverage([region({ status: "downloading" })], inside).kind).toBe("none");
  });

  it("treats no route as a question not asked", () => {
    /* Somebody browsing the map has not planned anything. Warning them about
       coverage for a route that does not exist is the kind of noise that gets
       a warning ignored when it matters. */
    expect(routeCoverage([region()], []).kind).toBe("no_route");
    expect(coverageWarning(routeCoverage([region()], []))).toBeNull();
  });

  it("includes the region's own edges", () => {
    const r = region({ bounds: { minLat: 53, minLng: -4, maxLat: 54, maxLng: -3 } });
    expect(containsPoint(r.bounds, { latitude: 53, longitude: -4 })).toBe(true);
    expect(containsPoint(r.bounds, { latitude: 54, longitude: -3 })).toBe(true);
    expect(containsPoint(r.bounds, { latitude: 54.0001, longitude: -3 })).toBe(false);
  });
});

describe("what the walker is told", () => {
  it("says nothing when the whole route is covered", () => {
    /* An app that congratulates itself for working is an app people stop
       reading. */
    expect(coverageWarning(routeCoverage([region()], inside))).toBeNull();
  });

  it("is blunt when there is no map at all", () => {
    const warning = coverageWarning(routeCoverage([region()], outside))!;
    expect(warning).toContain("will not work without a signal");
  });

  it("distinguishes a small gap from most of the route", () => {
    const mostly = { kind: "partial" as const, coveredFraction: 0.95, firstGapIndex: 90, regionIds: [] };
    const barely = { kind: "partial" as const, coveredFraction: 0.3, firstGapIndex: 2, regionIds: [] };
    expect(coverageWarning(mostly)).toContain("Part of");
    expect(coverageWarning(barely)).toContain("Most of");
  });

  it("never states a percentage", () => {
    /* A precise-looking number invites a precision this does not have — the
       fraction is of sampled points, not of distance walked. */
    const warning = coverageWarning({ kind: "partial", coveredFraction: 0.634, firstGapIndex: 4, regionIds: [] })!;
    expect(warning).not.toMatch(/\d/);
  });
});

describe("storage", () => {
  it("adds up what is actually on the device", () => {
    const s = storageSummary([
      region({ id: "a", bytes: 100 * 1024 * 1024 }),
      region({ id: "b", bytes: 50 * 1024 * 1024 }),
    ]);
    expect(s.totalBytes).toBe(150 * 1024 * 1024);
    expect(s.readyCount).toBe(2);
  });

  it("counts nothing for a region whose size is unknown", () => {
    /* Null means nothing has been written yet. Treating it as zero is fine for
       a total; inventing a figure would not be. */
    const s = storageSummary([region({ bytes: null, status: "downloading" })]);
    expect(s.totalBytes).toBe(0);
    expect(s.downloadingCount).toBe(1);
    expect(s.readyCount).toBe(0);
  });

  it("surfaces failures separately", () => {
    expect(storageSummary([region({ status: "failed", bytes: null })]).failedCount).toBe(1);
  });

  it("formats sizes the way the decision is made", () => {
    /* The decision is "will this fit on my phone", which nobody makes to three
       significant figures. */
    expect(formatBytes(94 * 1024 * 1024)).toBe("94 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("shows a dash rather than a number it does not have", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});

describe("going out of date", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("is fresh within the window", () => {
    expect(isStale({ dataPublishedAt: "2026-05-01T00:00:00Z" }, now)).toBe(false);
  });

  it("is stale past it", () => {
    expect(isStale({ dataPublishedAt: "2025-12-01T00:00:00Z" }, now)).toBe(true);
  });

  it("gives a season before nagging", () => {
    /* Paths change slowly and a three-month-old map is a far better companion
       than none. Long enough not to nag, short enough to catch a new right of
       way within a season. */
    expect(STALE_AFTER_DAYS).toBeGreaterThanOrEqual(60);
  });

  it("does not call a map stale because a date was missing or malformed", () => {
    /* Nagging somebody about a perfectly good map because a string would not
       parse is the kind of wrongness that gets the prompt dismissed forever. */
    expect(isStale({ dataPublishedAt: null }, now)).toBe(false);
    expect(isStale({ dataPublishedAt: "not a date" }, now)).toBe(false);
    expect(isStale({}, now)).toBe(false);
  });
});
