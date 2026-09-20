import { describe, expect, it } from "vitest";
import { mapElevationBankEventToEvidence } from "./elevationBankEvidence";

const event = (evidenceClass: string, status: "credited" | "corrected" | "revoked" = "credited") => ({
  activityId: "activity-1", sourceId: "canonical-1", sourceType: "explore_hike",
  revision: 2, status, creditedAscentM: 700, evidenceClass,
  ruleVersion: "elevation-bank-v1", effectiveAt: "2026-06-15T10:00:00Z",
  eventAt: "2026-06-15T10:01:00Z",
});

describe("Elevation Bank evidence mapping", () => {
  it("maps only confirmed outdoor classes to trusted GPS evidence", () => {
    expect(mapElevationBankEventToEvidence(event("quality_accepted"), "owner")).toMatchObject({
      evidenceClass: "trusted_gps_outdoor", qualificationStatus: "eligible",
      sourceCursor: "2026-06-15T10:01:00Z|000000000002|elevation-bank-v1",
    });
    expect(mapElevationBankEventToEvidence(event("verified_activity"), "owner")?.evidenceClass).toBe("trusted_gps_outdoor");
  });

  it("keeps unverified/manual events non-eligible and rejects unknown classes", () => {
    expect(mapElevationBankEventToEvidence(event("recorded_unverified"), "owner")?.qualificationStatus).toBe("pending");
    expect(mapElevationBankEventToEvidence(event("manual"), "owner")?.evidenceClass).toBe("manual_outdoor");
    expect(mapElevationBankEventToEvidence(event("mystery"), "owner")).toBeNull();
  });

  it("uses eventAt authority across rule changes, not rule-scoped revision", () => {
    const oldRule = event("quality_accepted");
    const newerRule = {
      ...event("quality_accepted"),
      revision: 1,
      ruleVersion: "elevation-bank-v2",
      eventAt: "2026-06-16T10:01:00Z",
    };
    const oldMapped = mapElevationBankEventToEvidence(oldRule, "owner")!;
    const newMapped = mapElevationBankEventToEvidence(newerRule, "owner")!;
    expect(newMapped.correctionVersion).toBeGreaterThan(oldMapped.correctionVersion!);
    expect(newMapped.sourceCursor > oldMapped.sourceCursor!).toBe(true);
    expect(mapElevationBankEventToEvidence(newerRule, "owner")).toEqual(newMapped);
  });
});