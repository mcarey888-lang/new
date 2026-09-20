import { describe, expect, it } from "vitest";
import { selectLatestElevationBankEvents, selectLegacyElevationBankCredits } from "../services/elevationBank";

describe("Elevation Bank event lineage", () => {
  it("keeps the corrected or revoked latest revision, never both", () => {
    const rows = [
      { activityId: "a", ruleVersion: "v1", revision: 1, status: "credited", createdAt: new Date("2026-01-01") },
      { activityId: "a", ruleVersion: "v1", revision: 2, status: "corrected", createdAt: new Date("2026-01-02") },
      { activityId: "a", ruleVersion: "v1", revision: 3, status: "revoked", createdAt: new Date("2026-01-03") },
      { activityId: "b", ruleVersion: "v1", revision: 1, status: "credited", createdAt: new Date("2026-01-01") },
    ];
    expect(selectLatestElevationBankEvents(rows)).toEqual([
      { activityId: "a", ruleVersion: "v1", revision: 3, status: "revoked", createdAt: new Date("2026-01-03") },
      { activityId: "b", ruleVersion: "v1", revision: 1, status: "credited", createdAt: new Date("2026-01-01") },
    ]);
  });

  it("lets a newer rule event supersede an older-rule event for the activity", () => {
    const rows = [
      { activityId: "a", ruleVersion: "v1", revision: 9, status: "credited", createdAt: new Date("2026-01-01") },
      { activityId: "a", ruleVersion: "v2", revision: 1, status: "revoked", createdAt: new Date("2026-02-01") },
    ];
    expect(selectLatestElevationBankEvents(rows)).toEqual([rows[1]]);
  });

  it("keeps both legacy rule credits while the event snapshot collapses activity state", () => {
    const rows = [
      { activityId: "a", ruleVersion: "v1", revision: 2, status: "credited", creditedAscentM: 500, effectiveAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01") },
      { activityId: "a", ruleVersion: "v2", revision: 1, status: "credited", creditedAscentM: 600, effectiveAt: new Date("2026-02-01"), createdAt: new Date("2026-02-01") },
    ];
    expect(selectLegacyElevationBankCredits(rows, 12).map((row) => row.ruleVersion)).toEqual(["v2", "v1"]);
    expect(selectLatestElevationBankEvents(rows).map((row) => row.ruleVersion)).toEqual(["v2"]);
  });
});