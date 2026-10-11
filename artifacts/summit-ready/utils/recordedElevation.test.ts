import { describe, expect, it } from "vitest";
import { breakElevationContinuity, createRecordedElevation, recordElevation } from "./recordedElevation";

function trace(altitudes: number[], accuracy: number | null = 8) {
  return altitudes.reduce((state, alt, i) =>
    recordElevation(state, { alt, ts: i * 3000, altAcc: accuracy }), createRecordedElevation());
}

describe("recorded GPS elevation", () => {
  it("does not turn an hour of stationary vertical noise into a mountain day", () => {
    const state = trace(Array.from({ length: 1320 }, (_, i) => 250 + [0, 4, -3, 5, -4, 2][i % 6]));
    expect(state.gain).toBe(0);
    expect(state.loss).toBe(0);
  });
  it("rejects sustained poor altitude accuracy even when horizontal GPS is usable", () => {
    expect(trace(Array.from({ length: 1200 }, (_, i) => 250 + i), 80).gain).toBe(0);
  });
  it("records a steady climb and descent without suppressing genuine ascent", () => {
    const state = trace([...Array.from({ length: 101 }, (_, i) => 200 + i),
      ...Array.from({ length: 101 }, (_, i) => 300 - i)]);
    // A five-fix median can omit the short-lived final metre at a turnaround.
    expect(state.gain).toBeGreaterThanOrEqual(97);
    expect(state.gain).toBeLessThanOrEqual(100);
    expect(state.loss).toBeGreaterThanOrEqual(97);
    expect(state.loss).toBeLessThanOrEqual(100);
  });
  it("rejects vertical spikes and does not credit the return from a spike", () => {
    const state = trace([250, 250, 250, 900, 250, 250, 250]);
    expect(state.gain).toBe(0);
    expect(state.loss).toBe(0);
  });
  it("ignores duplicate and out-of-order foreground/background fixes", () => {
    let state = recordElevation(createRecordedElevation(), { alt: 250, ts: 10000 });
    const before = state;
    state = recordElevation(state, { alt: 350, ts: 10000 });
    expect(state).toBe(before);
    expect(recordElevation(state, { alt: 100, ts: 9000 })).toBe(before);
  });
  it("does not connect a missing GPS interval or a paused hike with invented ascent", () => {
    let state = recordElevation(createRecordedElevation(50, 10), { alt: 250, ts: 0 });
    state = recordElevation(state, { alt: 500, ts: 60000 });
    expect(state.gain).toBe(50);
    state = recordElevation(breakElevationContinuity(state), { alt: 100, ts: 63000 });
    expect(state.loss).toBe(10);
  });
  it("rejects missing and invalid altitude values", () => {
    const state = createRecordedElevation();
    for (const alt of [null, NaN, Infinity, 10000]) {
      expect(recordElevation(state, { alt, ts: 100 })).toBe(state);
    }
  });
  it("can checkpoint and restore without resetting or double counting", () => {
    const state = trace(Array.from({ length: 70 }, (_, i) => 200 + i));
    const restored = JSON.parse(JSON.stringify(state));
    const sample = { alt: 270, ts: 210000, altAcc: 8 };
    expect(recordElevation(restored, sample)).toEqual(recordElevation(state, sample));
  });
});
