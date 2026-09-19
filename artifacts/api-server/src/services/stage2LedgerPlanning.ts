export type ElevationLedgerEvidenceClass =
  | "recorded_unverified"
  | "quality_accepted"
  | "verified_activity"
  | "unverified_manual"
  | "indoor_training"
  | "unavailable_untrusted";

export interface ElevationCreditInput {
  ownerUserId: string;
  activityId: string;
  evidenceClass: ElevationLedgerEvidenceClass;
  creditedAscentM: number;
  ruleVersion: string;
  effectiveAt: Date;
  correction?: boolean;
  revocation?: boolean;
}

export interface ExistingElevationCredit {
  id: string;
  ownerUserId: string;
  activityId: string;
  ruleVersion: string;
  revision: number;
  status: "credited" | "revoked" | "corrected";
}

export type ElevationCreditPlan =
  | { status: "create"; revision: number; correctionOfRevision: number | null; priorEventId: string | null; creditedAscentM: number }
  | { status: "deduplicated"; revision: number }
  | { status: "rejected"; reason: string };

export function planPersonalElevationCredit(
  input: ElevationCreditInput,
  existing: readonly ExistingElevationCredit[] = [],
): ElevationCreditPlan {
  if (!input.ownerUserId.trim() || !input.activityId.trim()) {
    return { status: "rejected", reason: "owner and activity are required" };
  }
  if (!Number.isInteger(input.creditedAscentM) || input.creditedAscentM < 0) {
    return { status: "rejected", reason: "credited ascent must be a non-negative integer" };
  }
  if (!["recorded_unverified", "quality_accepted", "verified_activity"].includes(input.evidenceClass)) {
    return { status: "rejected", reason: "evidence class is not eligible for personal elevation credit" };
  }
  if (Number.isNaN(input.effectiveAt.getTime())) {
    return { status: "rejected", reason: "effective time is invalid" };
  }
  const identity = existing.filter((event) =>
    event.ownerUserId === input.ownerUserId
    && event.activityId === input.activityId && event.ruleVersion === input.ruleVersion
  );
  const latest = identity.reduce<ExistingElevationCredit | undefined>(
    (current, event) => !current || event.revision > current.revision ? event : current,
    undefined,
  );
  if (latest?.status === "credited" && !input.correction && !input.revocation) {
    return { status: "deduplicated", revision: latest.revision };
  }
  const revision = (latest?.revision ?? 0) + 1;
  const prior = latest && identity.find((event) => event.revision === revision - 1);
  if (revision > 1 && (!prior || !validateTransactionalRevisionWrite({
    ownerUserId: input.ownerUserId,
    identityKey: `${input.activityId}:${input.ruleVersion}`,
    revision,
  }, {
    id: prior.id,
    ownerUserId: prior.ownerUserId,
    identityKey: `${prior.activityId}:${prior.ruleVersion}`,
    revision: prior.revision,
  }).valid)) {
    return { status: "rejected", reason: "a matching prior revision is required for correction" };
  }
  return {
    status: "create",
    revision,
    correctionOfRevision: revision === 1 ? null : revision - 1,
    priorEventId: prior?.id ?? null,
    creditedAscentM: input.creditedAscentM,
  };
}

export interface ExpeditionStageRule {
  stageKey: string;
  ruleVersion: string;
  scoreVersion: string;
  allowedActivityKinds: readonly string[];
  allowedEvidenceClasses: readonly ElevationLedgerEvidenceClass[];
}

export interface ExpeditionContributionInput {
  ownerUserId: string;
  runId: string;
  activityId: string;
  stageRule?: ExpeditionStageRule;
  activityKind: string;
  evidenceClass: ElevationLedgerEvidenceClass;
  acceptedMetric: number;
  acceptedElevationM?: number;
  correction?: boolean;
  revocation?: boolean;
  realSummitClaim?: boolean;
}

export interface ExistingExpeditionContribution {
  id: string;
  ownerUserId: string;
  runId: string;
  activityId: string;
  stageKey: string;
  ruleVersion: string;
  scoreVersion: string;
  revision: number;
  status: "accepted" | "revoked" | "corrected";
}

export type ExpeditionContributionPlan =
  | {
      status: "create";
      revision: number;
      correctionOfRevision: number | null;
      priorContributionId: string | null;
      simulatedCompletion: true;
      stageKey: string;
      acceptedMetric: number;
      acceptedElevationM: number | null;
    }
  | { status: "deduplicated"; revision: number }
  | { status: "rejected"; reason: string };

export function planExpeditionStageContribution(
  input: ExpeditionContributionInput,
  existing: readonly ExistingExpeditionContribution[] = [],
): ExpeditionContributionPlan {
  if (!input.ownerUserId.trim() || !input.runId.trim() || !input.activityId.trim()) {
    return { status: "rejected", reason: "owner, run, and activity are required" };
  }
  if (!input.stageRule) return { status: "rejected", reason: "defined stage rule is required" };
  if (input.realSummitClaim === true) {
    return { status: "rejected", reason: "Expedition contributions cannot claim a real summit" };
  }
  if (!input.stageRule.allowedActivityKinds.includes(input.activityKind)) {
    return { status: "rejected", reason: "activity kind is not allowed by the stage rule" };
  }
  if (!input.stageRule.allowedEvidenceClasses.includes(input.evidenceClass)) {
    return { status: "rejected", reason: "evidence class is not allowed by the stage rule" };
  }
  if (!Number.isInteger(input.acceptedMetric) || input.acceptedMetric < 0) {
    return { status: "rejected", reason: "accepted metric must be a non-negative integer" };
  }
  if (input.acceptedElevationM !== undefined && (!Number.isInteger(input.acceptedElevationM) || input.acceptedElevationM < 0)) {
    return { status: "rejected", reason: "accepted elevation must be a non-negative integer" };
  }
  const identity = existing.filter((contribution) =>
    contribution.ownerUserId === input.ownerUserId
    &&
    contribution.activityId === input.activityId
    && contribution.runId === input.runId
    && contribution.stageKey === input.stageRule?.stageKey
    && contribution.ruleVersion === input.stageRule?.ruleVersion
    && contribution.scoreVersion === input.stageRule?.scoreVersion
  );
  const latest = identity.reduce<ExistingExpeditionContribution | undefined>(
    (current, contribution) => !current || contribution.revision > current.revision ? contribution : current,
    undefined,
  );
  if (latest?.status === "accepted" && !input.correction && !input.revocation) {
    return { status: "deduplicated", revision: latest.revision };
  }
  const revision = (latest?.revision ?? 0) + 1;
  const prior = latest && identity.find((contribution) => contribution.revision === revision - 1);
  const identityKey = `${input.runId}:${input.stageRule.stageKey}:${input.activityId}:${input.stageRule.ruleVersion}:${input.stageRule.scoreVersion}`;
  if (revision > 1 && (!prior || !validateTransactionalRevisionWrite({
    ownerUserId: input.ownerUserId,
    identityKey,
    revision,
  }, {
    id: prior.id,
    ownerUserId: prior.ownerUserId,
    identityKey: `${prior.runId}:${prior.stageKey}:${prior.activityId}:${prior.ruleVersion}:${prior.scoreVersion}`,
    revision: prior.revision,
  }).valid)) {
    return { status: "rejected", reason: "a matching prior revision is required for correction" };
  }
  return {
    status: "create",
    revision,
    correctionOfRevision: revision === 1 ? null : revision - 1,
    priorContributionId: prior?.id ?? null,
    simulatedCompletion: true,
    stageKey: input.stageRule.stageKey,
    acceptedMetric: input.acceptedMetric,
    acceptedElevationM: input.acceptedElevationM ?? null,
  };
}

export interface RevisionLineageCandidate {
  ownerUserId: string;
  identityKey: string;
  revision: number;
}

export interface RevisionLineagePrior extends RevisionLineageCandidate {
  id: string;
}

/**
 * Transactional writer contract: lock/read the identity inside one transaction,
 * insert the event and its lineage row together, and retry on the identity
 * unique-index conflict. Revision > 1 is invalid without this exact prior row.
 */
export function validateTransactionalRevisionWrite(
  candidate: RevisionLineageCandidate,
  prior?: RevisionLineagePrior,
): { valid: true } | { valid: false; reason: string } {
  if (candidate.revision === 1) {
    return prior ? { valid: false, reason: "revision one cannot have a prior" } : { valid: true };
  }
  if (!prior) return { valid: false, reason: "prior revision is required" };
  if (!prior.id.trim()) return { valid: false, reason: "prior row id is required" };
  if (prior.ownerUserId !== candidate.ownerUserId) return { valid: false, reason: "prior owner does not match" };
  if (prior.identityKey !== candidate.identityKey) return { valid: false, reason: "prior identity does not match" };
  if (prior.revision !== candidate.revision - 1) return { valid: false, reason: "prior revision must be immediately previous" };
  return { valid: true };
}