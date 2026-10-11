import { describe, expect, it } from "vitest";
import {
  MIN_SUSPICIOUS_DURATION_SECS, recordingFailureNote, recordingLooksFailed,
} from "./recordingOutcome";

const HOUR = 3600;

describe("spotting a recording that did not capture the walk", () => {
  it("flags an hour out with nothing recorded", () => {
    expect(recordingLooksFailed({ pointCount: 0, distanceKm: 0, elapsedSecs: HOUR })).toBe(true);
  });

  it("flags six hours recorded as two hundred metres", () => {
    /* The case this exists for: the clock kept running, the track did not. */
    expect(recordingLooksFailed({ pointCount: 40, distanceKm: 0.2, elapsedSecs: 6 * HOUR })).toBe(true);
  });

  it("leaves a genuinely short walk alone", () => {
    /* Five minutes and two hundred metres is a walk to the shop, not a
       failure, and calling it one is its own kind of wrong. */
    expect(recordingLooksFailed({ pointCount: 12, distanceKm: 0.2, elapsedSecs: 5 * 60 })).toBe(false);
  });

  it("leaves a normal hike alone", () => {
    expect(recordingLooksFailed({ pointCount: 900, distanceKm: 11.4, elapsedSecs: 5 * HOUR })).toBe(false);
  });

  it("leaves a slow hour that still covered ground alone", () => {
    /* A steep kilometre in an hour is a real hour on a real hill. */
    expect(recordingLooksFailed({ pointCount: 200, distanceKm: 1.0, elapsedSecs: HOUR })).toBe(false);
  });

  it("says nothing about a recording with no time on it", () => {
    for (const elapsedSecs of [0, -1, NaN]) {
      expect(recordingLooksFailed({ pointCount: 0, distanceKm: 0, elapsedSecs })).toBe(false);
    }
  });

  it("holds its line exactly at the threshold", () => {
    const at = MIN_SUSPICIOUS_DURATION_SECS;
    expect(recordingLooksFailed({ pointCount: 0, distanceKm: 0, elapsedSecs: at })).toBe(true);
    expect(recordingLooksFailed({ pointCount: 0, distanceKm: 0, elapsedSecs: at - 1 })).toBe(false);
  });
});

describe("what it tells the person", () => {
  it("separates no GPS at all from GPS that dropped out", () => {
    /* Different causes, and the second one means some of the track is
       real — worth saying, because it changes what they do next. */
    const none = recordingFailureNote({ pointCount: 0, distanceKm: 0, elapsedSecs: HOUR })!;
    const partial = recordingFailureNote({ pointCount: 40, distanceKm: 0.2, elapsedSecs: HOUR })!;
    expect(none).toMatch(/no gps/i);
    expect(partial).toMatch(/dropped out/i);
    expect(none).not.toBe(partial);
  });

  it("offers the way out in both", () => {
    for (const outcome of [
      { pointCount: 0, distanceKm: 0, elapsedSecs: HOUR },
      { pointCount: 40, distanceKm: 0.2, elapsedSecs: HOUR },
    ]) {
      expect(recordingFailureNote(outcome)).toMatch(/by hand/i);
    }
  });

  it("says nothing at all about a recording that worked", () => {
    expect(recordingFailureNote({ pointCount: 900, distanceKm: 11.4, elapsedSecs: 5 * HOUR })).toBeNull();
  });
});
