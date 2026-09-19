import type { CanonicalActivity } from "@workspace/db/schema";
import type { QualificationEvaluation } from "./canonicalQualificationEvaluator";
import {
  calculatePersonalElevationTotalsFromEvents,
  getPersonalElevationCreditEventsWithClient,
  writePersonalElevationCredit,
  assertStage2LedgerWritesAvailable,
  type LedgerTotals,
  type PersonalElevationCreditWrite,
} from "./stage2Ledgers";
import type { ElevationCreditInput } from "./stage2LedgerPlanning";
import { db } from "@workspace/db";
import { canonicalActivities } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const ELEVATION_BANK_RULE_VERSION = "elevation-bank-v1";
export const EVEREST_HEIGHT_M = 8_849;
export const ELEVATION_BANK_ELIGIBLE_EVIDENCE = [
  "recorded_unverified",
  "quality_accepted",
  "verified_activity",
] as const;

type EligibleEvidenceState = (typeof ELEVATION_BANK_ELIGIBLE_EVIDENCE)[number];

export type ElevationBankActivity = Pick<
  CanonicalActivity,
  | "id"
  | "ownerUserId"
  | "primaryContext"
  | "activityKind"
  | "occurredAt"
  | "recordedAscentM"
  | "validatedAscentM"
  | "evidenceState"
  | "lifecycle"
> & {
  revoked?: boolean;
};

export type ElevationBankQualification = Pick<
  QualificationEvaluation,
  | "purpose"
  | "status"
  | "evidenceClass"
  | "creditedMetric"
  | "persistablePurpose"
  | "ruleVersion"
>;

export type ElevationBankDecision =
  | {
      status: "eligible";
      creditedAscentM: number;
      evidenceClass: EligibleEvidenceState;
      ruleVersion: string;
    }
  | {
      status: "revoke";
      reason: "activity_revoked" | "activity_deleted" | "qualification_revoked";
      ruleVersion: string;
      evidenceClass: EligibleEvidenceState;
    }
  | {
      status: "ineligible";
      reason:
        | "missing_activity_identity"
        | "wrong_qualification_purpose"
        | "qualification_not_persistable"
        | "qualification_not_eligible"
        | "manual_or_indoor_evidence"
        | "untrusted_evidence"
        | "simulated_activity"
        | "unsupported_evidence_state"
        | "zero_or_missing_ascent"
        | "qualification_metric_mismatch"
        | "invalid_rule_version"
        | "revocation_evidence_unavailable";
    };

function isEligibleEvidenceState(value: string): value is EligibleEvidenceState {
  return (ELEVATION_BANK_ELIGIBLE_EVIDENCE as readonly string[]).includes(value);
}

export function evaluateElevationBankCredit(
  activity: ElevationBankActivity,
  qualification: ElevationBankQualification,
): ElevationBankDecision {
  const ruleVersion = qualification.ruleVersion.trim();
  if (!activity.ownerUserId.trim() || !activity.id.trim()) {
    return { status: "ineligible", reason: "missing_activity_identity" };
  }
  if (!ruleVersion) {
    return { status: "ineligible", reason: "invalid_rule_version" };
  }
  if (qualification.purpose !== "personal_elevation") {
    return { status: "ineligible", reason: "wrong_qualification_purpose" };
  }
  if (qualification.persistablePurpose !== "elevation_bank_personal") {
    return { status: "ineligible", reason: "qualification_not_persistable" };
  }
  if (qualification.status !== "eligible") {
    if (qualification.status === "revoked") {
      if (!isEligibleEvidenceState(qualification.evidenceClass)) {
        return { status: "ineligible", reason: "revocation_evidence_unavailable" };
      }
      return {
        status: "revoke",
        reason: "qualification_revoked",
        ruleVersion,
        evidenceClass: qualification.evidenceClass,
      };
    }
    return { status: "ineligible", reason: "qualification_not_eligible" };
  }
  if (activity.activityKind === "indoor_training") {
    return { status: "ineligible", reason: "manual_or_indoor_evidence" };
  }
  if (activity.revoked || activity.lifecycle === "deleted") {
    if (!isEligibleEvidenceState(qualification.evidenceClass)) {
      return { status: "ineligible", reason: "revocation_evidence_unavailable" };
    }
    return {
      status: "revoke",
      reason: activity.lifecycle === "deleted" ? "activity_deleted" : "activity_revoked",
      ruleVersion,
      evidenceClass: qualification.evidenceClass,
    };
  }
  if (activity.primaryContext === "mountain_simulation") {
    return { status: "ineligible", reason: "simulated_activity" };
  }
  if (
    activity.evidenceState === "unverified_manual"
    || qualification.evidenceClass === "unverified_manual"
  ) {
    return { status: "ineligible", reason: "manual_or_indoor_evidence" };
  }
  if (
    activity.evidenceState === "verified_summit_ascent"
    || activity.evidenceState === "competition_eligible"
    || !ELEVATION_BANK_ELIGIBLE_EVIDENCE.includes(
      activity.evidenceState as EligibleEvidenceState,
    )
    || !ELEVATION_BANK_ELIGIBLE_EVIDENCE.includes(
      qualification.evidenceClass as EligibleEvidenceState,
    )
  ) {
    return { status: "ineligible", reason: "unsupported_evidence_state" };
  }
  if (qualification.evidenceClass !== activity.evidenceState) {
    return { status: "ineligible", reason: "qualification_metric_mismatch" };
  }
  const sourceAscent = activity.validatedAscentM ?? activity.recordedAscentM ?? null;
  if (sourceAscent === null || !Number.isInteger(sourceAscent) || sourceAscent <= 0) {
    return { status: "ineligible", reason: "zero_or_missing_ascent" };
  }
  if (qualification.creditedMetric !== sourceAscent) {
    return { status: "ineligible", reason: "qualification_metric_mismatch" };
  }
  return {
    status: "eligible",
    creditedAscentM: sourceAscent,
    evidenceClass: activity.evidenceState as EligibleEvidenceState,
    ruleVersion,
  };
}

export type ElevationBankWriteOptions = {
  correction?: boolean;
  revocation?: boolean;
};

export type ElevationBankWriteResult =
  | { status: "ineligible"; decision: ElevationBankDecision }
  | { status: "created" | "deduplicated" | "rejected"; decision: ElevationBankDecision; write: PersonalElevationCreditWrite };

export async function creditCanonicalActivityToElevationBank(
  activity: ElevationBankActivity,
  qualification: ElevationBankQualification,
  options: ElevationBankWriteOptions = {},
): Promise<ElevationBankWriteResult> {
  const decision = evaluateElevationBankCredit(activity, qualification);
  if (decision.status === "ineligible") return { status: "ineligible", decision };
  const input: ElevationCreditInput = {
    ownerUserId: activity.ownerUserId,
    activityId: activity.id,
    evidenceClass: decision.status === "revoke"
      ? decision.evidenceClass
      : decision.evidenceClass,
    creditedAscentM: decision.status === "revoke" ? 0 : decision.creditedAscentM,
    ruleVersion: decision.ruleVersion,
    effectiveAt: activity.occurredAt,
    correction: options.correction,
    revocation: options.revocation || decision.status === "revoke",
  };
  const write = await writePersonalElevationCredit(input);
  return { status: write.status, decision, write };
}

export type ElevationBankSummary = LedgerTotals & {
  everestEquivalent: number;
};

export function calculateEverestEquivalent(creditedAscentM: number): number {
  if (!Number.isFinite(creditedAscentM) || creditedAscentM <= 0) return 0;
  return Number((creditedAscentM / EVEREST_HEIGHT_M).toFixed(1));
}

export function buildElevationBankSummary(
  rows: Parameters<typeof calculatePersonalElevationTotalsFromEvents>[0],
  period?: { from?: Date; to?: Date },
): ElevationBankSummary {
  const totals = calculatePersonalElevationTotalsFromEvents(rows, period);
  return { ...totals, everestEquivalent: calculateEverestEquivalent(totals.lifetimeAscentM) };
}

export async function getElevationBankSummary(
  ownerUserId: string,
  period?: { from?: Date; to?: Date },
): Promise<ElevationBankSummary> {
  assertStage2LedgerWritesAvailable();
  return db.transaction(async (client) => {
    const rows = await getPersonalElevationCreditEventsWithClient(client, ownerUserId);
    return buildElevationBankSummary(rows, period);
  });
}

export async function getRecentElevationBankCredits(
  ownerUserId: string,
  limit = 10,
) {
  assertStage2LedgerWritesAvailable();
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  return db.transaction(async (client) => {
    const rows = await getPersonalElevationCreditEventsWithClient(client, ownerUserId);
    const effectiveRows = rows
      .filter((row) => row.status === "credited" || row.status === "corrected")
      .filter((row, index, all) =>
        !all.some((other) =>
          other.activityId === row.activityId
          && other.ruleVersion === row.ruleVersion
          && other.revision > row.revision,
        ),
      )
      .sort((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime())
      .slice(0, safeLimit);
    const activityIds = effectiveRows.map((row) => row.activityId);
    const activities = activityIds.length === 0
      ? []
      : await client
        .select({
          id: canonicalActivities.id,
          sourceId: canonicalActivities.sourceId,
          sourceType: canonicalActivities.sourceType,
        })
        .from(canonicalActivities)
        .where(and(
          eq(canonicalActivities.ownerUserId, ownerUserId),
          inArray(canonicalActivities.id, activityIds),
        ));
    const activityById = new Map(activities.map((activity) => [activity.id, activity]));
    return effectiveRows.map((row) => {
      const activity = activityById.get(row.activityId);
      if (!activity) {
        throw new Error("Elevation Bank activity identity could not be resolved");
      }
      return {
        ...row,
        sourceId: activity.sourceId,
        sourceType: activity.sourceType,
      };
    });
  });
}