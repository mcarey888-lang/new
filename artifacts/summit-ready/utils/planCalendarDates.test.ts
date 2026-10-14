import { describe, expect, it } from "vitest";
import { weekDateRange, planWeekDays, weeksUntilPlanStart } from "./basecampPresentation";

// Run this file with TZ=UTC, Europe/London and America/Los_Angeles.
describe("training plan calendar dates in the process timezone", () => {
  it("does not shift a date-only week to the previous day", () => {
    expect(weekDateRange("2026-10-19", "2026-10-25")).toBe("19 – 25 Oct");
    expect(weekDateRange("2026-10-29", "2026-11-04")).toBe("29 Oct – 4 Nov");
    expect(weekDateRange("2026-12-28", "2027-01-03")).toBe("28 Dec – 3 Jan");
  });
  it("keeps the day strip in the same calendar week", () => {
    const days = planWeekDays("2026-10-19", new Date(2026, 9, 21, 12));
    expect(days.map(d => d.date)).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(days.map(d => d.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days.filter(d => d.isToday).map(d => d.date)).toEqual([21]);
  });
  it("uses the local start of the calendar day for the countdown", () => {
    expect(weeksUntilPlanStart("2026-10-19", new Date(2026, 9, 18, 23))).toBe(1);
    expect(weeksUntilPlanStart("2026-10-19", new Date(2026, 9, 19, 0))).toBeNull();
  });
  it("crosses the daylight-saving boundary without skipping or repeating days", () => {
    expect(planWeekDays("2026-11-01").map(d => d.date)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekDateRange("2026-03-08", "2026-03-14")).toBe("8 – 14 Mar");
  });
  it("rejects impossible calendar dates rather than rolling them into another month", () => {
    expect(weekDateRange("2026-02-30", "2026-03-08")).toBeNull();
    expect(weekDateRange("2026-13-01", "2026-12-07")).toBeNull();
    expect(weeksUntilPlanStart("2026-02-30")).toBeNull();
    expect(planWeekDays("2026-02-30").every(d => d.date === null)).toBe(true);
  });
});
