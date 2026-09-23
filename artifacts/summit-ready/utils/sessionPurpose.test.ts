import { describe, expect, it } from "vitest";
import { sessionPurpose } from "./sessionPurpose";

describe("session purpose", () => {
  it("states what each session type builds", () => {
    expect(sessionPurpose({ type: "cardio" }).builds).toMatch(/Aerobic base/);
    expect(sessionPurpose({ type: "hill" }).builds).toMatch(/Sustained climbing/);
    expect(sessionPurpose({ type: "bigDay" }).builds).toMatch(/Time on feet/);
  });

  it("uses the plan's own description, never a generated one", () => {
    expect(sessionPurpose({ type: "hill", description: "6 × Pendle reps" }).detail)
      .toBe("6 × Pendle reps");
    expect(sessionPurpose({ type: "hill" }).detail).toBeNull();
    expect(sessionPurpose({ type: "hill", description: "   " }).detail).toBeNull();
  });

  it("connects the session to the real objective", () => {
    expect(sessionPurpose({ type: "hill", targetElevation: 900, mountainName: "Mont Blanc" }).relationship)
      .toBe("900 m of climbing, banked toward Mont Blanc.");
  });

  it("drops the elevation clause when the plan set no target", () => {
    expect(sessionPurpose({ type: "cardio", mountainName: "Mont Blanc" }).relationship)
      .toBe("Part of your preparation for Mont Blanc.");
    expect(sessionPurpose({ type: "cardio", targetElevation: 0, mountainName: "Mont Blanc" }).relationship)
      .toBe("Part of your preparation for Mont Blanc.");
  });

  it("says nothing about an objective the user has not set", () => {
    expect(sessionPurpose({ type: "hill", targetElevation: 900 }).relationship).toBeNull();
    expect(sessionPurpose({ type: "hill", mountainName: "  " }).relationship).toBeNull();
  });

  it("ignores a non-finite target rather than printing it", () => {
    expect(sessionPurpose({ type: "hill", targetElevation: NaN, mountainName: "Eiger" }).relationship)
      .toBe("Part of your preparation for Eiger.");
  });
});
