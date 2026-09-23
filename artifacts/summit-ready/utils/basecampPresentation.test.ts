import { describe, expect, it } from "vitest";
import {
  formatMetres,
  missionQueue,
  objectiveMetrics,
  pendingSessions,
  planSessionKey,
  sessionFacts,
  targetDateDisplay,
  weekProgress,
  type BasecampWeekLike,
} from "./basecampPresentation";

/* Deliberately NOT the prototype's mountain, date or figures — these are
   arbitrary shapes chosen to prove the adapter is driven by its inputs. */
const week = (weekNumber: number, sessions: Array<Partial<{ id: string; label: string; targetElevation: number; duration: string; type: string; description: string }>>): BasecampWeekLike => ({
  weekNumber,
  phase: "Build",
  sessions: sessions.map(s => ({ type: "hill", label: "Session", ...s })),
});

describe("targetDateDisplay", () => {
  const now = new Date("2031-03-01T09:00:00Z");

  it("returns null without a date", () => {
    expect(targetDateDisplay(null, now)).toBeNull();
    expect(targetDateDisplay("", now)).toBeNull();
    expect(targetDateDisplay("not-a-date", now)).toBeNull();
  });

  it("formats the goal's own date and counts whole days", () => {
    const d = targetDateDisplay("2031-03-11", now);
    expect(d?.label).toBe("11 Mar 2031");
    expect(d?.daysRemaining).toBe(10);
    expect(d?.past).toBe(false);
  });

  it("does not drift across a timezone boundary", () => {
    /* Parsed at midday, so a negative UTC offset cannot roll the date back. */
    expect(targetDateDisplay("2031-12-31", now)?.label).toBe("31 Dec 2031");
  });

  it("clamps a past date to zero rather than counting backwards", () => {
    const d = targetDateDisplay("2030-01-01", now);
    expect(d?.daysRemaining).toBe(0);
    expect(d?.past).toBe(true);
  });

  it("reads zero on the day itself", () => {
    expect(targetDateDisplay("2031-03-01", now)?.daysRemaining).toBe(0);
  });
});

describe("objectiveMetrics", () => {
  it("is empty without a goal", () => {
    expect(objectiveMetrics(null)).toEqual([]);
  });

  it("formats the goal's real figures", () => {
    const m = objectiveMetrics({ highestAltitude: 3841, elevationGain: 1290, distance: 18.25 });
    expect(m.map(x => x.value)).toEqual(["3,841 m", "1,290 m", "18.3 km"]);
    expect(m.map(x => x.label)).toEqual(["Summit", "Ascent", "Distance"]);
  });

  it("omits a missing or zero figure instead of showing 0", () => {
    const m = objectiveMetrics({ highestAltitude: 0, elevationGain: null, distance: 7 });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ key: "distance", value: "7 km" });
  });

  it("omits a non-finite figure", () => {
    expect(objectiveMetrics({ elevationGain: Number.NaN, distance: Infinity })).toEqual([]);
  });
});

describe("planSessionKey", () => {
  it("prefers the persisted id", () => {
    expect(planSessionKey(week(2, [{ id: "abc" }]), { id: "abc" }, 0)).toBe("abc");
  });
  it("falls back to the week/index key legacy plans use", () => {
    expect(planSessionKey(week(2, [{}]), {}, 3)).toBe("2-3");
  });
});

describe("pendingSessions", () => {
  const plan = [
    week(1, [{ id: "w1s1" }, { id: "w1s2" }]),
    week(2, [{ id: "w2s1" }, { id: "w2s2" }]),
  ];

  it("is empty without a plan", () => {
    expect(pendingSessions(null, {})).toEqual([]);
    expect(pendingSessions([], {})).toEqual([]);
  });

  it("skips everything the app has recorded as complete", () => {
    const out = pendingSessions(plan, { w1s1: true, w2s1: true });
    expect(out.map(s => s.key)).toEqual(["w1s2", "w2s2"]);
  });

  it("keeps plan order and carries the indices session-detail needs", () => {
    const out = pendingSessions(plan, {});
    expect(out[3]).toMatchObject({ weekNumber: 2, sessionIndex: 1, weekLabel: "Week 2 · Session 2" });
  });

  it("can start from the current week", () => {
    const out = pendingSessions(plan, {}, 2);
    expect(out.every(s => s.weekNumber === 2)).toBe(true);
  });

  it("returns nothing when the whole plan is done", () => {
    expect(pendingSessions(plan, { w1s1: true, w1s2: true, w2s1: true, w2s2: true })).toEqual([]);
  });

  it("normalises the session's own values and never invents them", () => {
    const [s] = pendingSessions([week(4, [{ id: "x", label: "  Long Hike  ", targetElevation: 0, duration: " " }])], {});
    expect(s.title).toBe("Long Hike");
    expect(s.elevationM).toBeNull();
    expect(s.duration).toBeNull();
  });
});

describe("missionQueue", () => {
  const plan = [week(1, [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }])];

  it("takes the first pending session as the mission", () => {
    const q = missionQueue(plan, { a: true });
    expect(q.mission?.key).toBe("b");
    expect(q.upNext.map(s => s.key)).toEqual(["c", "d", "e", "f"]);
  });

  it("never repeats the mission in the rail", () => {
    const q = missionQueue(plan, {});
    expect(q.upNext.map(s => s.key)).not.toContain(q.mission?.key);
  });

  it("honours the rail limit", () => {
    expect(missionQueue(plan, {}, { upNextLimit: 2 }).upNext).toHaveLength(2);
  });

  it("has no mission once the plan is finished", () => {
    const q = missionQueue(plan, { a: true, b: true, c: true, d: true, e: true, f: true });
    expect(q.mission).toBeNull();
    expect(q.upNext).toEqual([]);
  });

  it("has no mission without a plan", () => {
    expect(missionQueue(null, {}).mission).toBeNull();
  });
});

describe("weekProgress", () => {
  it("is null without a week or without sessions", () => {
    expect(weekProgress(null, {})).toBeNull();
    expect(weekProgress(week(1, []), {})).toBeNull();
  });

  it("counts completion against the week's own prescribed sessions", () => {
    const w = week(3, [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    const p = weekProgress(w, { a: true, c: true });
    expect(p).toMatchObject({ weekNumber: 3, phase: "Build", completed: 2, total: 4, percent: 50 });
  });

  it("scales bars against the heaviest session in that week", () => {
    const w = week(1, [{ id: "a", targetElevation: 1000 }, { id: "b", targetElevation: 500 }]);
    const p = weekProgress(w, {});
    expect(p?.bars[0].load).toBe(1);
    expect(p?.bars[1].load).toBeCloseTo(0.5, 5);
  });

  it("gives an unprescribed session a visible floor rather than a zero bar", () => {
    const w = week(1, [{ id: "a", targetElevation: 900 }, { id: "b" }]);
    const p = weekProgress(w, {});
    expect(p?.bars[1].load).toBeGreaterThan(0);
    expect(p?.bars[1].load).toBeLessThan(1);
  });

  it("does not divide by zero when no session prescribes ascent", () => {
    const p = weekProgress(week(1, [{ id: "a" }, { id: "b" }]), {});
    expect(p?.bars.every(b => Number.isFinite(b.load) && b.load > 0)).toBe(true);
    expect(p?.percent).toBe(0);
  });

  it("marks bars from the same completion map the plan writes", () => {
    const p = weekProgress(week(9, [{ id: "a" }, { id: "b" }]), { b: true });
    expect(p?.bars.map(b => b.done)).toEqual([false, true]);
  });
});

describe("formatMetres and sessionFacts", () => {
  it("returns null for a missing value rather than a zero", () => {
    expect(formatMetres(null)).toBeNull();
    expect(formatMetres(undefined)).toBeNull();
    expect(formatMetres(Number.NaN)).toBeNull();
  });

  it("groups thousands", () => {
    expect(formatMetres(1234)).toBe("1,234 m");
  });

  it("builds a facts line only from what the plan supplied", () => {
    expect(sessionFacts({ elevationM: 900, duration: "3–5 hours" })).toEqual(["900 m gain", "3–5 hours"]);
    expect(sessionFacts({ elevationM: null, duration: "60 minutes" })).toEqual(["60 minutes"]);
    expect(sessionFacts({ elevationM: null, duration: null })).toEqual([]);
  });
});
