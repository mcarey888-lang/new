import { describe, expect, it } from "vitest";
import {
  barFractions,
  formatBankMetres,
  monthlyGain,
  movingHours,
  yearOnYearPercent,
} from "./elevationBankHero";

const at = (y: number, m: number, d = 12) => new Date(y, m, d).toISOString();

describe("monthlyGain", () => {
  const now = new Date(2026, 8, 20); // September 2026

  it("returns a continuous run of months ending at now", () => {
    const series = monthlyGain([], 4, now);
    expect(series.map(m => m.label)).toEqual(["Jun", "Jul", "Aug", "Sep"]);
  });

  it("sums credits into the month they fell in", () => {
    const series = monthlyGain(
      [
        { effectiveAt: at(2026, 7, 3), ascentM: 400 },
        { effectiveAt: at(2026, 7, 19), ascentM: 350 },
        { effectiveAt: at(2026, 8, 2), ascentM: 900 },
      ],
      3,
      now,
    );
    expect(series.map(m => [m.label, m.ascentM])).toEqual([
      ["Jul", 0], ["Aug", 750], ["Sep", 900],
    ]);
  });

  it("keeps a month with no activity as an empty column", () => {
    /* A gap would read as "no data" when it means "climbed nothing". */
    const series = monthlyGain([{ effectiveAt: at(2026, 8), ascentM: 500 }], 3, now);
    expect(series).toHaveLength(3);
    expect(series.filter(m => m.ascentM === 0)).toHaveLength(2);
  });

  it("ignores credits outside the window rather than folding them into an edge", () => {
    const series = monthlyGain(
      [
        { effectiveAt: at(2025, 1), ascentM: 9_999 },
        { effectiveAt: at(2026, 8), ascentM: 500 },
      ],
      3,
      now,
    );
    expect(series.reduce((n, m) => n + m.ascentM, 0)).toBe(500);
  });

  it("crosses a year boundary correctly", () => {
    const series = monthlyGain(
      [{ effectiveAt: at(2025, 11), ascentM: 300 }],
      3,
      new Date(2026, 1, 10),
    );
    expect(series.map(m => [m.label, m.ascentM])).toEqual([
      ["Dec", 300], ["Jan", 0], ["Feb", 0],
    ]);
  });

  it("survives an unparseable timestamp", () => {
    const series = monthlyGain([{ effectiveAt: "not a date", ascentM: 500 }], 2, now);
    expect(series.every(m => m.ascentM === 0)).toBe(true);
  });

  it("never counts negative ascent", () => {
    const series = monthlyGain([{ effectiveAt: at(2026, 8), ascentM: -400 }], 1, now);
    expect(series[0].ascentM).toBe(0);
  });

  it("returns nothing for a non-positive window", () => {
    expect(monthlyGain([], 0, now)).toEqual([]);
    expect(monthlyGain([], -3, now)).toEqual([]);
  });
});

describe("movingHours", () => {
  it("rounds seconds to whole hours", () => {
    expect(movingHours(3600)).toBe(1);
    expect(movingHours(1_141_200)).toBe(317);
  });

  it("is zero for nothing, negatives and rubbish", () => {
    expect(movingHours(0)).toBe(0);
    expect(movingHours(-50)).toBe(0);
    expect(movingHours(Number.NaN)).toBe(0);
  });
});

describe("yearOnYearPercent", () => {
  it("computes a whole-percent change", () => {
    expect(yearOnYearPercent(12_800, 10_000)).toBe(28);
    expect(yearOnYearPercent(8_000, 10_000)).toBe(-20);
  });

  /* The rule the card depends on: no previous year, no percentage. A figure
     nobody computed must not appear on the card. */
  it("is null when there is nothing to compare against", () => {
    expect(yearOnYearPercent(12_800, 0)).toBeNull();
    expect(yearOnYearPercent(12_800, null)).toBeNull();
    expect(yearOnYearPercent(12_800, undefined)).toBeNull();
    expect(yearOnYearPercent(null, 10_000)).toBeNull();
    expect(yearOnYearPercent(12_800, Number.NaN)).toBeNull();
  });

  it("is null against a negative previous period", () => {
    expect(yearOnYearPercent(100, -10)).toBeNull();
  });
});

describe("formatBankMetres", () => {
  it("groups thousands", () => {
    expect(formatBankMetres(12_420)).toBe("12,420");
    expect(formatBankMetres(0)).toBe("0");
    expect(formatBankMetres(999)).toBe("999");
  });

  it("rounds rather than truncating", () => {
    expect(formatBankMetres(12_419.6)).toBe("12,420");
  });
});

describe("barFractions", () => {
  const month = (label: string, ascentM: number) => ({ monthIndex: 0, label, ascentM });

  it("scales to the tallest month so a quiet year still reads", () => {
    const f = barFractions([month("Jan", 500), month("Feb", 1_000), month("Mar", 250)]);
    expect(f).toEqual([0.5, 1, 0.25]);
  });

  it("draws no bar at all when nothing was climbed", () => {
    expect(barFractions([month("Jan", 0), month("Feb", 0)])).toEqual([0, 0]);
  });

  it("is empty for an empty series", () => {
    expect(barFractions([])).toEqual([]);
  });
});
