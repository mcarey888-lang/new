import { describe, expect, it } from "vitest";
import {
  GAUGE_ROTATION_DEG, arcDash, circumference, clampScore, pointOnRing,
  projectedArcDash, scoreToClockHour, scoreToDegrees,
} from "./readinessGauge";

const R = 50;
const C = 2 * Math.PI * R;

describe("gauge clock mapping", () => {
  it("starts at 12 o'clock", () => {
    expect(GAUGE_ROTATION_DEG).toBe(-90);
    expect(scoreToClockHour(0)).toBe(0);
  });

  it("maps the approved quarter positions clockwise", () => {
    expect(scoreToClockHour(25)).toBe(3);
    expect(scoreToClockHour(50)).toBe(6);
    expect(scoreToClockHour(75)).toBe(9);
    expect(scoreToClockHour(100)).toBe(12);
  });

  it("puts 52% just past 6 o'clock", () => {
    const h = scoreToClockHour(52)!;
    expect(h).toBeGreaterThan(6);
    expect(h).toBeLessThan(6.5);
  });

  it("travels clockwise, not anticlockwise", () => {
    const a = pointOnRing(10, R, 0, 0)!;    // early: upper right
    const b = pointOnRing(40, R, 0, 0)!;    // later: lower right/left
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeLessThan(0);            // above centre
    expect(b.y).toBeGreaterThan(0);         // below centre
  });

  it("places 0 at the top and 50 at the bottom", () => {
    const top = pointOnRing(0, R, 100, 100)!;
    const bottom = pointOnRing(50, R, 100, 100)!;
    expect(top.y).toBeCloseTo(50, 5);
    expect(bottom.y).toBeCloseTo(150, 5);
  });
});

describe("arc geometry", () => {
  it("draws a proportional arc", () => {
    const [len, total] = arcDash(50, R);
    expect(total).toBeCloseTo(C, 6);
    expect(len).toBeCloseTo(C / 2, 6);
  });

  it("draws nothing when the score is unavailable", () => {
    expect(arcDash(null, R)[0]).toBe(0);
    expect(scoreToDegrees(null)).toBeNull();
    expect(scoreToClockHour(undefined)).toBeNull();
    expect(pointOnRing(null, R, 0, 0)).toBeNull();
  });

  it("clamps out-of-range scores rather than over-drawing", () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-20)).toBe(0);
    expect(arcDash(140, R)[0]).toBeCloseTo(C, 6);
  });

  it("never treats a missing score as zero", () => {
    expect(clampScore(null)).toBeNull();
    expect(clampScore(0)).toBe(0);          // a real zero is still a zero
  });

  it("computes circumference from radius", () => {
    expect(circumference(10)).toBeCloseTo(2 * Math.PI * 10, 9);
  });
});

describe("projected readiness is visually distinct from earned", () => {
  it("returns only the segment beyond current", () => {
    const p = projectedArcDash(52, 55, R)!;
    expect(p.dash[0]).toBeCloseTo((3 / 100) * C, 6);
    expect(p.offset).toBeCloseTo(-((52 / 100) * C), 6);
  });

  it("cannot be drawn as a full arc from zero", () => {
    const p = projectedArcDash(52, 55, R)!;
    const full = arcDash(55, R);
    expect(p.dash[0]).toBeLessThan(full[0]);
    expect(p.offset).toBeLessThan(0);        // pushed past the earned arc
  });

  it("draws nothing when there is no improvement to show", () => {
    expect(projectedArcDash(55, 55, R)).toBeNull();
    expect(projectedArcDash(60, 55, R)).toBeNull();
  });

  it("draws nothing when either value is unavailable", () => {
    expect(projectedArcDash(null, 55, R)).toBeNull();
    expect(projectedArcDash(52, null, R)).toBeNull();
  });
});
