import { describe, expect, it } from "vitest";
import { calculateAllLoggedAscent } from "./allLoggedAscent";

describe("calculateAllLoggedAscent", () => {
  it("includes completed manual/indoor sessions and hikes, but not planned sessions", () => {
    const total = calculateAllLoggedAscent(
      [
        { id: "manual-hill", completed: true, elevationGain: 320 },
        { id: "indoor-stepper", completed: true, elevationGain: 180 },
        { id: "not-done", completed: false, elevationGain: 900 },
      ],
      [{ id: "free-hike", elevationGain: 740 }],
    );

    expect(total).toEqual({ status: "available", ascentM: 1240 });
  });

  it("counts a tracked hike only once when it is also a completed session", () => {
    const total = calculateAllLoggedAscent(
      [{
        id: "session-row",
        activityId: "shared-activity",
        completed: true,
        elevationGain: 500,
      }],
      [{
        id: "hike-row",
        activityId: "shared-activity",
        elevationGain: 625,
      }],
    );

    // Prefer the hike's recorded ascent over the session estimate.
    expect(total).toEqual({ status: "available", ascentM: 625 });
  });

  it("does not report a partial total when a completed record has invalid ascent", () => {
    expect(calculateAllLoggedAscent(
      [{ id: "missing-ascent", completed: true, elevationGain: Number.NaN }],
      [],
    )).toEqual({
      status: "unavailable",
      reason: "incomplete_activity_data",
    });
  });

  it("returns a real zero only for a loaded history with no logged activities", () => {
    expect(calculateAllLoggedAscent([], [])).toEqual({
      status: "available",
      ascentM: 0,
    });
  });

  it("reflects edits and deletes from the current persisted activity lists", () => {
    const edited = calculateAllLoggedAscent(
      [{ id: "session-a", completed: true, elevationGain: 410 }],
      [],
    );
    const deleted = calculateAllLoggedAscent([], []);

    expect(edited).toEqual({ status: "available", ascentM: 410 });
    expect(deleted).toEqual({ status: "available", ascentM: 0 });
  });
});