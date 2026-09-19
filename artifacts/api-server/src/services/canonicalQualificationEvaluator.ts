import type {
  CanonicalActivityLinkInput,
  CanonicalEvidenceClassification,
  PersistedCanonicalEvidenceState,
} from "./canonicalActivityContracts";
import {
  parseSdeMountainTarget,
  parseSdeRouteTarget,
  validateCanonicalLinkTarget,
} from "./canonicalActivityContracts";

export const CANONICAL_QUALIFICATION_PURPOSES = [
  "personal_history",
  "readiness",
  "personal_elevation",
  "expedition_progress",
  "real_summit_evidence",
  "challenge_eligibility",
  "competitive_elevation",
] as const;

export type CanonicalQualificationPurpose =
  (typeof CANONICAL_QUALIFICATION_PURPOSES)[number];

export type PersistedQualificationPurpose =
  | "personal_history"
  | "elevation_bank_personal"
  | "readiness"
  | "real_summit_evidence";

export type QualificationStatus =
  | "eligible"
  | "ineligible"
  | "pending"
  | "revoked";

export type QualificationReasonCode =
  | "accepted_recorded_evidence"
  | "accepted_validated_evidence"
  | "manual_evidence_requires_rule"
  | "indoor_evidence_requires_rule"
  | "unavailable_or_untrusted_evidence"
  | "missing_expedition_link"
  | "missing_challenge_link"
  | "missing_sde_reference"
  | "insufficient_validated_evidence"
  | "competitive_evidence_not_enabled"
  | "purpose_is_output_only"
  | "activity_revoked"
  | "activity_deleted"
  | "activity_not_completed";

export const CANONICAL_QUALIFICATION_RULE_VERSION = "s2-c06-v1";

export interface QualificationEvaluatorActivity {
  id: string;
  lifecycle:
    | "recording"
    | "completed_local"
    | "pending_sync"
    | "synced"
    | "sync_failed"
    | "corrected"
    | "deleted";
  evidenceClassification: CanonicalEvidenceClassification;
  evidenceState: PersistedCanonicalEvidenceState;
  recordedAscentM?: number | null;
  validatedAscentM?: number | null;
  links?: readonly CanonicalActivityLinkInput[];
  revoked?: boolean;
}

export interface QualificationEvaluation {
  activityId: string;
  purpose: CanonicalQualificationPurpose;
  status: QualificationStatus;
  evidenceClass: PersistedCanonicalEvidenceState;
  reasonCodes: readonly QualificationReasonCode[];
  ruleVersion: string;
  creditedMetric: number | null;
  persistablePurpose: PersistedQualificationPurpose | null;
  persistence: "phase1_compatible" | "read_only_output";
  supersessionKey: string;
  supersedesRuleVersions: readonly string[];
}

const PERSISTABLE_PURPOSES: Readonly<
  Partial<Record<CanonicalQualificationPurpose, PersistedQualificationPurpose>>
> = {
  personal_history: "personal_history",
  personal_elevation: "elevation_bank_personal",
  readiness: "readiness",
  real_summit_evidence: "real_summit_evidence",
};

function hasLink(
  activity: QualificationEvaluatorActivity,
  linkType: CanonicalActivityLinkInput["linkType"],
): boolean {
  return (activity.links ?? []).some((link) => link.linkType === linkType);
}

export function hasSdeReference(activity: QualificationEvaluatorActivity): boolean {
  return (activity.links ?? []).some((link) => {
    try {
      validateCanonicalLinkTarget(link);
      if (link.linkType === "canonical_hill" && link.targetId.startsWith("sde:mountain:")) {
        parseSdeMountainTarget(link.targetId);
        return true;
      }
      if (link.linkType === "canonical_route" && link.targetId.startsWith("sde:route:")) {
        parseSdeRouteTarget(link.targetId);
        return true;
      }
    } catch {
      // Invalid or mismatched SDE references are not summit evidence.
    }
    return false;
  });
}

function baseDecision(
  activity: QualificationEvaluatorActivity,
  purpose: CanonicalQualificationPurpose,
): Pick<
  QualificationEvaluation,
  "status" | "reasonCodes" | "creditedMetric"
> {
  if (activity.revoked) {
    return {
      status: "revoked",
      reasonCodes: ["activity_revoked"],
      creditedMetric: null,
    };
  }
  if (activity.lifecycle === "deleted") {
    return {
      status: "revoked",
      reasonCodes: ["activity_deleted"],
      creditedMetric: null,
    };
  }
  if (activity.lifecycle === "recording") {
    return {
      status: "pending",
      reasonCodes: ["activity_not_completed"],
      creditedMetric: null,
    };
  }

  switch (activity.evidenceClassification) {
    case "gps_recorded":
      return {
        status:
          activity.evidenceState === "quality_accepted"
          || activity.evidenceState === "verified_activity"
          || activity.evidenceState === "verified_summit_ascent"
          || activity.evidenceState === "competition_eligible"
            ? "eligible"
            : "pending",
        reasonCodes:
          activity.evidenceState === "recorded_unverified"
            ? ["accepted_recorded_evidence"]
            : ["accepted_validated_evidence"],
        creditedMetric:
          activity.validatedAscentM ?? activity.recordedAscentM ?? null,
      };
    case "estimated_manual":
      return {
        status: "pending",
        reasonCodes: ["manual_evidence_requires_rule"],
        creditedMetric: null,
      };
    case "indoor_training":
      return {
        status: "pending",
        reasonCodes: ["indoor_evidence_requires_rule"],
        creditedMetric: null,
      };
    case "unavailable_untrusted":
      return {
        status: purpose === "personal_history" ? "eligible" : "ineligible",
        reasonCodes: ["unavailable_or_untrusted_evidence"],
        creditedMetric: null,
      };
  }
}

function applyPurposeRule(
  activity: QualificationEvaluatorActivity,
  purpose: CanonicalQualificationPurpose,
): Pick<
  QualificationEvaluation,
  "status" | "reasonCodes" | "creditedMetric"
> {
  const baseline = baseDecision(activity, purpose);
  if (baseline.status === "revoked" || baseline.status === "pending") {
    return baseline;
  }

  if (purpose === "personal_history") return baseline;

  if (purpose === "readiness") {
    if (activity.evidenceClassification === "unavailable_untrusted") {
      return { ...baseline, status: "ineligible" };
    }
    return baseline;
  }

  if (purpose === "personal_elevation") {
    if (
      activity.evidenceClassification !== "gps_recorded"
      || (activity.validatedAscentM ?? activity.recordedAscentM ?? 0) <= 0
    ) {
      return {
        status: "ineligible",
        reasonCodes:
          activity.evidenceClassification === "gps_recorded"
            ? ["insufficient_validated_evidence"]
            : baseline.reasonCodes,
        creditedMetric: null,
      };
    }
    return baseline;
  }

  if (purpose === "expedition_progress") {
    if (!hasLink(activity, "expedition") && !hasLink(activity, "expedition_stage")) {
      return {
        status: "ineligible",
        reasonCodes: ["missing_expedition_link"],
        creditedMetric: null,
      };
    }
    return baseline;
  }

  if (purpose === "real_summit_evidence") {
    if (!hasSdeReference(activity)) {
      return {
        status: "ineligible",
        reasonCodes: ["missing_sde_reference"],
        creditedMetric: null,
      };
    }
    if (
      activity.evidenceClassification !== "gps_recorded"
      || activity.evidenceState !== "verified_summit_ascent"
      || (activity.validatedAscentM ?? 0) <= 0
    ) {
      return {
        status: "ineligible",
        reasonCodes: ["insufficient_validated_evidence"],
        creditedMetric: null,
      };
    }
    return baseline;
  }

  if (purpose === "challenge_eligibility") {
    if (!hasLink(activity, "challenge")) {
      return {
        status: "ineligible",
        reasonCodes: ["missing_challenge_link"],
        creditedMetric: null,
      };
    }
    return baseline;
  }

  // Competitive output is intentionally never a Phase 1 persisted qualification.
  return {
    status: "ineligible",
    reasonCodes: ["competitive_evidence_not_enabled"],
    creditedMetric: null,
  };
}

export function evaluateCanonicalQualification(
  activity: QualificationEvaluatorActivity,
  purpose: CanonicalQualificationPurpose,
  options: {
    ruleVersion?: string;
    supersedesRuleVersions?: readonly string[];
  } = {},
): QualificationEvaluation {
  const ruleVersion = options.ruleVersion ?? CANONICAL_QUALIFICATION_RULE_VERSION;
  const persistablePurpose = PERSISTABLE_PURPOSES[purpose] ?? null;
  const decision = applyPurposeRule(activity, purpose);
  const outputOnlyReason =
    persistablePurpose === null
      && !decision.reasonCodes.includes("activity_revoked")
      && !decision.reasonCodes.includes("activity_deleted")
        ? ["purpose_is_output_only" as const]
        : [];

  return {
    activityId: activity.id,
    purpose,
    status: decision.status,
    evidenceClass: activity.evidenceState,
    reasonCodes: [...outputOnlyReason, ...decision.reasonCodes],
    ruleVersion,
    creditedMetric: decision.creditedMetric,
    persistablePurpose,
    persistence:
      persistablePurpose === null ? "read_only_output" : "phase1_compatible",
    supersessionKey: `${activity.id}:${purpose}:${ruleVersion}`,
    supersedesRuleVersions: [...(options.supersedesRuleVersions ?? [])].sort(),
  };
}

export function evaluateCanonicalQualifications(
  activity: QualificationEvaluatorActivity,
  purposes: readonly CanonicalQualificationPurpose[] = CANONICAL_QUALIFICATION_PURPOSES,
  options: {
    ruleVersion?: string;
    supersedesRuleVersions?: readonly string[];
  } = {},
): QualificationEvaluation[] {
  return purposes.map((purpose) =>
    evaluateCanonicalQualification(activity, purpose, options),
  );
}
