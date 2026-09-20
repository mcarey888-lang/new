import { describe, expect, it } from "vitest";
import { findElevationBankCreditForActivity } from "./elevationBankMatching";

describe("Elevation Bank canonical identity matching", () => {
  it("uses the canonical activity ID when the tracker route is only sourceId", () => {
    const result = findElevationBankCreditForActivity([
      { activityId: "canonical-activity", sourceId: "tracker-route" },
    ], "tracker-route");
    expect(result?.activityId).toBe("canonical-activity");
  });
});