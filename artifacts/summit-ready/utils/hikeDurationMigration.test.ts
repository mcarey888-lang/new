import { describe, expect, it } from "vitest";
import {
  IMPOSSIBLE_MINUTES_PER_KM, looksLikeSeconds, MAX_PLAUSIBLE_MINUTES,
  repairDuration, repairDurations,
} from "./hikeDurationMigration";

describe("repairing a duration stored as seconds", () => {
  it("leaves a long mountain day alone", () => {
    /* The bug this replaces: 360 became 6, and the next save made it
       permanent. Six hours on a hill is a Saturday, not a fault. */
    const hike = { timeTaken: 360, distance: 14 };
    expect(looksLikeSeconds(hike)).toBe(false);
    expect(repairDuration(hike).timeTaken).toBe(360);
  });

  it("leaves a very long day alone, right up to a full day", () => {
    for (const minutes of [301, 420, 600, 900, MAX_PLAUSIBLE_MINUTES]) {
      expect(repairDuration({ timeTaken: minutes, distance: 20 }).timeTaken).toBe(minutes);
    }
  });

  it("converts a value that cannot be minutes", () => {
    /* Two hours recorded in seconds. As minutes it is five days. */
    expect(repairDuration({ timeTaken: 7200, distance: 12 }).timeTaken).toBe(120);
  });

  it("converts a short hike stored in seconds, caught by its pace", () => {
    /* 900 is under a day, so the duration alone cannot tell. But 900 minutes
       for 1.2 km is 750 minutes per kilometre, which is not walking. */
    const hike = { timeTaken: 900, distance: 1.2 };
    expect(looksLikeSeconds(hike)).toBe(true);
    expect(repairDuration(hike).timeTaken).toBe(15);
  });

  it("does not touch a slow, short hike that is merely slow", () => {
    /* 90 minutes for 1.5 km is an hour an hour — steep, scrambling, or a
       person taking photographs. Sixty minutes per kilometre is well under
       the limit, and it is a real reading. */
    const hike = { timeTaken: 90, distance: 1.5 };
    expect(looksLikeSeconds(hike)).toBe(false);
    expect(repairDuration(hike).timeTaken).toBe(90);
  });

  it("leaves an ambiguous value alone when there is no distance to check it", () => {
    /* 600 minutes could be a ten-hour traverse or a ten-minute walk recorded
       in seconds. Nothing here can tell, so the reading stands rather than
       being quietly divided by sixty. */
    expect(repairDuration({ timeTaken: 600 }).timeTaken).toBe(600);
    expect(repairDuration({ timeTaken: 600, distance: 0 }).timeTaken).toBe(600);
  });

  it("never produces a zero-minute hike", () => {
    /* Math.round(20 / 60) is 0, and a hike of no duration breaks pace and
       readiness arithmetic downstream. */
    expect(repairDuration({ timeTaken: 1441, distance: 0.01 }).timeTaken).toBeGreaterThan(0);
    expect(repairDuration({ timeTaken: 20, distance: 0.001 }).timeTaken).toBeGreaterThan(0);
  });

  it("ignores values that are not usable numbers", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(looksLikeSeconds({ timeTaken: bad, distance: 10 })).toBe(false);
    }
  });

  it("keeps every other field untouched", () => {
    const hike = { timeTaken: 7200, distance: 12, id: "a", name: "Scafell Pike", notes: "wet" };
    expect(repairDuration(hike)).toEqual({ ...hike, timeTaken: 120 });
  });

  it("returns the same object when nothing needs repairing", () => {
    /* Re-running the load must not churn state or trigger a rewrite. */
    const hike = { timeTaken: 360, distance: 14 };
    expect(repairDuration(hike)).toBe(hike);
  });

  it("is safe to run twice", () => {
    const once = repairDurations([{ timeTaken: 7200, distance: 12 }]);
    expect(repairDurations(once)).toEqual(once);
  });

  it("is what the old rule got wrong, stated as a case", () => {
    const sixHourDay = { timeTaken: 360, distance: 15 };
    const oldRule = (h: { timeTaken: number }) =>
      h.timeTaken > 300 ? Math.round(h.timeTaken / 60) : h.timeTaken;
    expect(oldRule(sixHourDay)).toBe(6);
    expect(repairDuration(sixHourDay).timeTaken).toBe(360);
  });

  it("agrees with the pace constant it documents", () => {
    const km = 2;
    const atLimit = { timeTaken: IMPOSSIBLE_MINUTES_PER_KM * km, distance: km };
    expect(looksLikeSeconds(atLimit)).toBe(true);
    expect(looksLikeSeconds({ timeTaken: atLimit.timeTaken - 1, distance: km })).toBe(false);
  });
});
