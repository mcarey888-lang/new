import { describe, expect, it } from "vitest";
import {
  buildElevationBankSummary,
  calculateEverestEquivalent,
  evaluateElevationBankCredit,
  ELEVATION_BANK_RULE_VERSION,
} from "../services/elevationBank";
import { calculatePersonalElevationTotalsFromEvents } from "../services/stage2Ledgers";

const baseActivity = {
  id: "activity-1",
  ownerUserId: "owner-1",
  primaryContext: "free_hike" as const,
  activityKind: "outdoor_hike",
  occurredAt: new Date("2026-09-10T10:00:00Z"),
  recordedAscentM: 700,
  validatedAscentM: null,
  evidenceState: "recorded_unverified" as const,
  lifecycle: "synced" as const,
};

const baseQualification = {
  purpose: "personal_elevation" as const,
  status: "eligible" as const,
  evidenceClass: "recorded_unverified" as const,
  creditedMetric: 700,
  persistablePurpose: "elevation_bank_personal" as const,
  ruleVersion: ELEVATION_BANK_RULE_VERSION,
};

describe("Elevation Bank qualification", () => {
  it("credits recorded GPS ascent only with an explicit personal-elevation qualification", () => {
    expect(evaluateElevationBankCredit(baseActivity, baseQualification)).toEqual({
      status: "eligible",
      creditedAscentM: 700,
      evidenceClass: "recorded_unverified",
      ruleVersion: ELEVATION_BANK_RULE_VERSION,
    });
    expect(evaluateElevationBankCredit(baseActivity, {
      ...baseQualification,
      purpose: "readiness",
      persistablePurpose: "readiness",
    }).status).toBe("ineligible");
  });

  it("rejects zero, manual, indoor, untrusted, and simulated elevation", () => {
    expect(evaluateElevationBankCredit(
      { ...baseActivity, recordedAscentM: 0 },
      { ...baseQualification, creditedMetric: 0 },
    )).toMatchObject({ status: "ineligible", reason: "zero_or_missing_ascent" });
    expect(evaluateElevationBankCredit(
      { ...baseActivity, evidenceState: "unverified_manual" },
      { ...baseQualification, evidenceClass: "unverified_manual" },
    )).toMatchObject({ status: "ineligible", reason: "manual_or_indoor_evidence" });
    expect(evaluateElevationBankCredit(
      { ...baseActivity, evidenceState: "recorded_unverified" },
      { ...baseQualification, evidenceClass: "recorded_unverified", status: "pending" },
    )).toMatchObject({ status: "ineligible", reason: "qualification_not_eligible" });
    expect(evaluateElevationBankCredit(
      { ...baseActivity, primaryContext: "mountain_simulation" },
      baseQualification,
    )).toMatchObject({ status: "ineligible", reason: "simulated_activity" });
  });

  it("rejects mismatched qualification evidence/metrics and unsupported competition evidence", () => {
    expect(evaluateElevationBankCredit(baseActivity, {
      ...baseQualification,
      evidenceClass: "quality_accepted",
    })).toMatchObject({ status: "ineligible", reason: "qualification_metric_mismatch" });
    expect(evaluateElevationBankCredit(
      { ...baseActivity, evidenceState: "competition_eligible" },
      { ...baseQualification, evidenceClass: "competition_eligible" },
    )).toMatchObject({ status: "ineligible", reason: "unsupported_evidence_state" });
  });

  it("turns revoked activity/qualification into append-only revocation decisions", () => {
    expect(evaluateElevationBankCredit(
      { ...baseActivity, revoked: true },
      baseQualification,
    )).toMatchObject({ status: "revoke", reason: "activity_revoked" });
    expect(evaluateElevationBankCredit(
      baseActivity,
      { ...baseQualification, status: "revoked" },
    )).toMatchObject({
      status: "revoke",
      reason: "qualification_revoked",
      evidenceClass: "recorded_unverified",
    });
    expect(evaluateElevationBankCredit(
      { ...baseActivity, lifecycle: "deleted" },
      baseQualification,
    )).toMatchObject({ status: "revoke", reason: "activity_deleted" });
  });

  it("does not revoke for another purpose and rejects indoor kind despite recorded evidence", () => {
    expect(evaluateElevationBankCredit(
      { ...baseActivity, lifecycle: "deleted" },
      { ...baseQualification, purpose: "readiness", persistablePurpose: "readiness" },
    )).toMatchObject({ status: "ineligible", reason: "wrong_qualification_purpose" });
    expect(evaluateElevationBankCredit(
      { ...baseActivity, activityKind: "indoor_training" },
      baseQualification,
    )).toMatchObject({ status: "ineligible", reason: "manual_or_indoor_evidence" });
  });

  it("rejects revocation when no persisted eligible evidence class is available", () => {
    expect(evaluateElevationBankCredit(
      { ...baseActivity, evidenceState: "unverified_manual", revoked: true },
      { ...baseQualification, evidenceClass: "unverified_manual" },
    )).toMatchObject({
      status: "ineligible",
      reason: "revocation_evidence_unavailable",
    });
  });
});

function event(
  ownerUserId: string,
  activityId: string,
  revision: number,
  status: "credited" | "revoked" | "corrected",
  ascent: number,
  effectiveAt: string,
  ruleVersion = ELEVATION_BANK_RULE_VERSION,
) {
  return {
    id: `${ownerUserId}-${activityId}-${revision}`,
    ownerUserId,
    activityId,
    revision,
    status,
    creditedAscentM: ascent,
    evidenceClass: "recorded_unverified",
    ruleVersion,
    correctionOfRevision: revision > 1 ? revision - 1 : null,
    reasonCodes: [],
    effectiveAt: new Date(effectiveAt),
    createdAt: new Date(effectiveAt),
  };
}

describe("Elevation Bank effective totals and display model", () => {
  it("counts one latest effective row despite duplicate links/retries and applies corrections/revocations", () => {
    const rows = [
      event("owner-1", "activity-1", 1, "credited", 700, "2026-09-01T00:00:00Z"),
      event("owner-1", "activity-1", 2, "corrected", 650, "2026-09-02T00:00:00Z"),
      event("owner-1", "activity-2", 1, "credited", 300, "2026-09-03T00:00:00Z"),
      event("owner-1", "activity-2", 2, "revoked", 0, "2026-09-04T00:00:00Z"),
    ];
    expect(calculatePersonalElevationTotalsFromEvents(rows)).toEqual({
      lifetimeAscentM: 650,
      periodAscentM: 650,
      creditedActivities: 1,
    });
    expect(buildElevationBankSummary(rows)).toMatchObject({
      lifetimeAscentM: 650,
      everestEquivalent: 0.1,
    });
  });

  it("calculates deterministic period totals per owner and uses display-only Everest math", () => {
    const rows = [
      event("owner-1", "activity-1", 1, "credited", 8849, "2026-09-01T00:00:00Z"),
      event("owner-1", "activity-2", 1, "credited", 151, "2026-09-20T00:00:00Z"),
    ];
    expect(buildElevationBankSummary(rows, {
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-10T00:00:00Z"),
    })).toMatchObject({
      lifetimeAscentM: 9000,
      periodAscentM: 8849,
      everestEquivalent: 1,
    });
    expect(calculateEverestEquivalent(0)).toBe(0);
    expect(calculateEverestEquivalent(8849 * 2)).toBe(2);
  });
});