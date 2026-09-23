import { describe, expect, it } from "vitest";
import {
  buildReadinessHistory,
  historyAreaPath,
  historyAxisTicks,
  historyLinePath,
  historySampleDates,
  plotHistory,
  type HistoryPeriod,
} from "./readinessHistory";

const NOW = new Date("2031-06-30T12:00:00.000Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

describe("historySampleDates", () => {
  it("ends at now and runs oldest first", () => {
    const d = historySampleDates("4W", NOW, ago(400));
    expect(d).toHaveLength(5);
    expect(d[d.length - 1].getTime()).toBe(NOW.getTime());
    expect(d[0].getTime()).toBeLessThan(d[1].getTime());
  });

  it("spans the period it names", () => {
    const d = historySampleDates("4W", NOW, ago(400));
    expect(Math.round((NOW.getTime() - d[0].getTime()) / DAY)).toBe(28);
  });

  it("never samples before the first piece of evidence", () => {
    const d = historySampleDates("1Y", NOW, ago(30));
    expect(d[0].getTime()).toBeGreaterThanOrEqual(NOW.getTime() - 30 * DAY - 1000);
  });

  it("gives ALL nothing to draw without evidence", () => {
    expect(historySampleDates("ALL", NOW, null)).toEqual([]);
    expect(historySampleDates("ALL", NOW, undefined)).toEqual([]);
  });

  it("gives ALL nothing to draw when the history is too short to mean anything", () => {
    expect(historySampleDates("ALL", NOW, ago(5))).toEqual([]);
    expect(historySampleDates("ALL", NOW, ago(40)).length).toBeGreaterThan(1);
  });

  it("ignores evidence dated in the future rather than inverting the window", () => {
    const d = historySampleDates("4W", NOW, new Date(NOW.getTime() + 10 * DAY).toISOString());
    expect(d).toHaveLength(5);
    expect(d[d.length - 1].getTime()).toBe(NOW.getTime());
  });

  it("ignores an unparseable date", () => {
    expect(historySampleDates("4W", NOW, "not-a-date")).toHaveLength(5);
  });
});

describe("buildReadinessHistory", () => {
  const rising = (asOf: string) => {
    const daysAgo = (NOW.getTime() - Date.parse(asOf)) / DAY;
    return Math.round(70 - daysAgo);
  };

  it("asks the engine for every sampled date and labels the last one Now", () => {
    const asked: string[] = [];
    const s = buildReadinessHistory({
      period: "4W", now: NOW, earliestEvidenceAt: ago(200),
      evaluate: (iso) => { asked.push(iso); return rising(iso); },
    });
    expect(asked).toHaveLength(5);
    expect(s?.points).toHaveLength(5);
    expect(s?.points[s.points.length - 1].label).toBe("Now");
  });

  it("carries the engine's own numbers, rounded and nothing else", () => {
    const s = buildReadinessHistory({
      period: "4W", now: NOW, earliestEvidenceAt: ago(200),
      evaluate: () => 63.4,
    });
    expect(s?.points.every(p => p.score === 63)).toBe(true);
    expect(s?.min).toBe(63);
    expect(s?.max).toBe(63);
  });

  it("drops the dates the engine could not score rather than filling them in", () => {
    let n = 0;
    const s = buildReadinessHistory({
      period: "4W", now: NOW, earliestEvidenceAt: ago(200),
      evaluate: () => (n++ < 2 ? null : 50),
    });
    expect(s?.points).toHaveLength(3);
    expect(s?.points.every(p => p.score === 50)).toBe(true);
  });

  it("returns null rather than drawing a trend from one point", () => {
    let n = 0;
    expect(buildReadinessHistory({
      period: "4W", now: NOW, earliestEvidenceAt: ago(200),
      evaluate: () => (n++ === 4 ? 50 : null),
    })).toBeNull();
  });

  it("returns null when the engine can score nothing at all", () => {
    expect(buildReadinessHistory({
      period: "3M", now: NOW, earliestEvidenceAt: ago(200), evaluate: () => null,
    })).toBeNull();
  });

  it("returns null for a period with no window", () => {
    expect(buildReadinessHistory({
      period: "ALL", now: NOW, earliestEvidenceAt: null, evaluate: () => 50,
    })).toBeNull();
  });

  it("ignores a non-finite score", () => {
    const s = buildReadinessHistory({
      period: "4W", now: NOW, earliestEvidenceAt: ago(200),
      evaluate: (iso) => (iso.endsWith("Z") && Math.random() < -1 ? 0 : Number.NaN),
    });
    expect(s).toBeNull();
  });

  it("reports the real min and max", () => {
    const scores = [10, 40, 30, 80, 60];
    let i = 0;
    const s = buildReadinessHistory({
      period: "4W", now: NOW, earliestEvidenceAt: ago(200), evaluate: () => scores[i++],
    });
    expect(s?.min).toBe(10);
    expect(s?.max).toBe(80);
  });

  it("labels every period without throwing", () => {
    for (const p of ["4W", "3M", "1Y", "ALL"] as HistoryPeriod[]) {
      const s = buildReadinessHistory({
        period: p, now: NOW, earliestEvidenceAt: ago(400), evaluate: () => 44,
      });
      expect(s?.points.every(x => x.label.length > 0)).toBe(true);
    }
  });
});

describe("plotting", () => {
  const geo = { width: 360, height: 130, padLeft: 30, padRight: 16, padTop: 14, padBottom: 22 };
  const series = buildReadinessHistory({
    period: "4W", now: NOW, earliestEvidenceAt: ago(200),
    evaluate: (() => { const v = [0, 25, 50, 75, 100]; let i = 0; return () => v[i++]; })(),
  })!;

  it("uses a fixed 0–100 axis so two periods cannot imply different progress", () => {
    expect(historyAxisTicks()).toEqual([0, 25, 50, 75, 100]);
    const { yFor } = plotHistory(series, geo);
    expect(yFor(0)).toBeCloseTo(geo.height - geo.padBottom, 5);
    expect(yFor(100)).toBeCloseTo(geo.padTop, 5);
  });

  it("spreads the points across the plot area", () => {
    const { points } = plotHistory(series, geo);
    expect(points[0].x).toBeCloseTo(geo.padLeft, 5);
    expect(points[points.length - 1].x).toBeCloseTo(geo.width - geo.padRight, 5);
  });

  it("clamps an out-of-range score instead of drawing outside the box", () => {
    const { yFor } = plotHistory(series, geo);
    expect(yFor(150)).toBeCloseTo(geo.padTop, 5);
    expect(yFor(-20)).toBeCloseTo(geo.height - geo.padBottom, 5);
  });

  it("builds a path that starts with a move and continues with lines", () => {
    const { points } = plotHistory(series, geo);
    const d = historyLinePath(points);
    expect(d.startsWith("M")).toBe(true);
    expect((d.match(/L/g) || []).length).toBe(points.length - 1);
  });

  it("closes the area path back to the baseline", () => {
    const { points } = plotHistory(series, geo);
    const d = historyAreaPath(points, geo.height - geo.padBottom);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("returns an empty area path for no points", () => {
    expect(historyAreaPath([], 100)).toBe("");
  });
});
