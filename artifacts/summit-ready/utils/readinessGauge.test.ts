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

/* ── Approved three-band behaviour ─────────────────────────────────────────
   0 → current      solid bright green
   current → proj   the same arc continuing, softened
   projected → 100  dark inactive track
   All of it derived, never tuned to one example. */
describe("approved gauge bands, for arbitrary values", () => {
  const bands = (current: number | null, projected: number | null) => {
    const earned = arcDash(current, R)[0];
    const p = projectedArcDash(current, projected, R);
    const soft = p ? p.dash[0] : 0;
    return { earned, soft, inactive: C - earned - soft };
  };

  it("splits the ring into exactly three bands that sum to the circumference", () => {
    const b = bands(52, 55);
    expect(b.earned + b.soft + b.inactive).toBeCloseTo(C, 6);
  });

  it("renders 63 → 67 as correctly as any other pair", () => {
    const b = bands(63, 67);
    expect(b.earned).toBeCloseTo((63 / 100) * C, 6);
    expect(b.soft).toBeCloseTo((4 / 100) * C, 6);
    expect(b.inactive).toBeCloseTo((33 / 100) * C, 6);
  });

  it("scales for any pair the engine produces", () => {
    for (const [c, p] of [[5, 9], [33, 41], [71, 72], [88, 99]] as const) {
      const b = bands(c, p);
      expect(b.earned).toBeCloseTo((c / 100) * C, 6);
      expect(b.soft).toBeCloseTo(((p - c) / 100) * C, 6);
    }
  });

  it("the soft band always begins exactly where the solid one ends", () => {
    for (const [c, p] of [[52, 55], [63, 67], [10, 90]] as const) {
      const solid = arcDash(c, R)[0];
      const soft = projectedArcDash(c, p, R)!;
      expect(-soft.offset).toBeCloseTo(solid, 6);
    }
  });

  it("current only: the whole remainder is inactive track", () => {
    const b = bands(40, null);
    expect(b.soft).toBe(0);
    expect(b.inactive).toBeCloseTo((60 / 100) * C, 6);
  });

  it("draws no soft band when the projection adds nothing", () => {
    expect(bands(55, 55).soft).toBe(0);
    expect(bands(60, 55).soft).toBe(0);      // negative change
    expect(bands(60, 0).soft).toBe(0);
  });

  it("0: no solid band, everything inactive", () => {
    const b = bands(0, null);
    expect(b.earned).toBe(0);
    expect(b.inactive).toBeCloseTo(C, 6);
  });

  it("100: the ring is entirely solid and nothing can extend it", () => {
    const b = bands(100, null);
    expect(b.earned).toBeCloseTo(C, 6);
    expect(b.inactive).toBeCloseTo(0, 6);
    expect(projectedArcDash(100, 100, R)).toBeNull();
  });

  it("a projection beyond 100 is clamped, not overdrawn", () => {
    const soft = projectedArcDash(96, 140, R)!;
    expect(soft.dash[0]).toBeCloseTo((4 / 100) * C, 6);
  });

  it("missing score: nothing is drawn and no projection is implied", () => {
    const b = bands(null, 55);
    expect(b.earned).toBe(0);
    expect(b.soft).toBe(0);
    expect(projectedArcDash(null, 55, R)).toBeNull();
  });
});

describe("projected callout anchors to the real endpoint", () => {
  it("sits at the projected value's position, not the current one", () => {
    const atCurrent = pointOnRing(52, R, 100, 100)!;
    const atProjected = pointOnRing(55, R, 100, 100)!;
    expect(atProjected.x).not.toBeCloseTo(atCurrent.x, 3);
  });

  it("moves when the projection moves", () => {
    const a = pointOnRing(55, R, 100, 100)!;
    const b = pointOnRing(67, R, 100, 100)!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
  });

  it("is undefined when there is no projection to point at", () => {
    expect(pointOnRing(null, R, 100, 100)).toBeNull();
  });
});

/* ── Motion never changes the data ────────────────────────────────────────
   The component animates TOWARD the values these functions return. The
   functions are pure and take no motion input, so the resting geometry is
   identical with reduced motion on or off. */
describe("final geometry is independent of motion", () => {
  it("takes no motion parameter, so it cannot differ between modes", () => {
    expect(arcDash.length).toBe(2);              // (score, radius)
    expect(projectedArcDash.length).toBe(3);     // (current, projected, radius)
  });

  it("is deterministic across repeated calls", () => {
    const a = arcDash(63, R);
    const b = arcDash(63, R);
    expect(a).toEqual(b);
    expect(projectedArcDash(63, 67, R)).toEqual(projectedArcDash(63, 67, R));
  });

  it("represents real data at rest whatever the animation did", () => {
    /* whatever a sweep interpolates through, it ends here */
    expect(arcDash(63, R)[0]).toBeCloseTo((63 / 100) * C, 6);
  });
});
