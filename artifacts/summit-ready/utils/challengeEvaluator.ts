import {
  CHALLENGE_DOMAIN_VERSION,
  type AchievementDefinition,
  type AchievementEvaluationResult,
  type ChallengeDefinition,
  type ChallengeEvaluationResult,
  type ChallengeWindowSpec,
  type EvidenceReference,
  type EvaluationReason,
} from "./challengeDomain";

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const sortedEvidence = (evidence: readonly EvidenceReference[]): EvidenceReference[] =>
  [...evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

const parseDate = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function resolveExplicitWindow(
  spec: ChallengeWindowSpec,
  windowKey: string,
): { windowKey: string; startInclusive: number | null; endExclusive: number | null } {
  return {
    windowKey,
    startInclusive: spec.startInclusive ? parseDate(spec.startInclusive) : null,
    endExclusive: spec.endExclusive ? parseDate(spec.endExclusive) : null,
  };
}

function evidenceReason(
  definition: ChallengeDefinition | AchievementDefinition,
  evidence: EvidenceReference,
): EvaluationReason {
  const qualification = "eligibility" in definition ? definition.eligibility : definition.qualification;
  const scope = "scope" in definition ? definition.scope : "personal";
  if (evidence.qualificationStatus === "revoked") return "activity_revoked";
  if (evidence.qualificationStatus === "pending") return "pending";
  if (!qualification.allowedEvidenceClasses.includes(evidence.evidenceClass)) {
    if (evidence.evidenceClass === "manual_outdoor") return "manual_personal_only";
    if (evidence.evidenceClass === "indoor") return "indoor_personal_only";
    if (evidence.evidenceClass === "simulated_expedition") return "simulated_expedition_only";
    return "ineligible";
  }
  if (
    scope === "competitive_candidate" &&
    (!qualification.competitiveEligible ||
      ("metadata" in definition && !definition.metadata.competitiveEligible))
  ) {
    return "competitive_not_enabled";
  }
  if (qualification.requireQualificationStatus &&
      evidence.qualificationStatus !== qualification.requireQualificationStatus) {
    return "ineligible";
  }
  if (qualification.purpose === "canonical" && !evidence.sdeTargetId) return "missing_provenance";
  return "eligible";
}

function inWindow(evidence: EvidenceReference, window: ReturnType<typeof resolveExplicitWindow>): boolean {
  const occurredAt = parseDate(evidence.occurredAt);
  if (occurredAt === null) return false;
  if (window.startInclusive !== null && occurredAt < window.startInclusive) return false;
  if (window.endExclusive !== null && occurredAt >= window.endExclusive) return false;
  return true;
}

function valueFor(definition: ChallengeDefinition, evidence: EvidenceReference): number {
  switch (definition.family) {
    case "monthly_elevation":
    case "cumulative_elevation":
      return Math.max(0, evidence.value ?? 0);
    case "hiking_distance":
      return Math.max(0, evidence.distanceKm ?? 0);
    case "mountain_count":
    case "summit_count":
    case "activity_consistency":
    case "expedition_milestone":
    case "training_milestone":
    case "readiness_milestone":
      return 1;
  }
}

function familyAllows(definition: ChallengeDefinition, evidence: EvidenceReference): boolean {
  switch (definition.family) {
    case "mountain_count":
      return Boolean(evidence.mountainId || evidence.sdeTargetId?.startsWith("sde:mountain:"));
    case "summit_count":
      return evidence.summitCompleted === true || evidence.evidenceClass === "canonical_summit";
    case "expedition_milestone":
      return evidence.evidenceClass === "simulated_expedition" &&
        (evidence.expeditionStageCompleted === true || evidence.expeditionCompleted === true);
    case "training_milestone":
      return evidence.sourceType === "training_session";
    case "readiness_milestone":
      return evidence.sourceType === "training_session" && evidence.qualificationPurpose === "readiness";
    default:
      return true;
  }
}

export function evaluateChallenge(
  ownerUserId: string,
  definition: ChallengeDefinition,
  evidence: readonly EvidenceReference[],
  windowKey: string,
  evaluatedAt?: string,
): ChallengeEvaluationResult {
  const window = resolveExplicitWindow(definition.window, windowKey);
  const rejectedEvidence: { evidenceId: string; reason: EvaluationReason }[] = [];
  const accepted: EvidenceReference[] = [];
  const seen = new Set<string>();
  let hasPending = false;

  for (const item of sortedEvidence(evidence)) {
    if (seen.has(item.evidenceId)) continue;
    seen.add(item.evidenceId);
    if (item.ownerUserId !== ownerUserId) {
      rejectedEvidence.push({ evidenceId: item.evidenceId, reason: "cross_owner_evidence" });
      continue;
    }
    const reason = evidenceReason(definition, item);
    if (reason === "pending") {
      hasPending = true;
      rejectedEvidence.push({ evidenceId: item.evidenceId, reason });
      continue;
    }
    if (reason !== "eligible" || !inWindow(item, window)) {
      rejectedEvidence.push({ evidenceId: item.evidenceId, reason: reason === "eligible" ? "outside_window" : reason });
      continue;
    }
    if (familyAllows(definition, item)) accepted.push(item);
    else rejectedEvidence.push({ evidenceId: item.evidenceId, reason: "ineligible" });
  }

  const acceptedEvidenceIds = accepted.map((item) => item.evidenceId);
  const uniqueMountainIds = new Set(
    accepted.map((item) => item.mountainId ?? item.sdeTargetId).filter((value): value is string => Boolean(value)),
  );
  const value = definition.family === "mountain_count" ? uniqueMountainIds.size :
    definition.family === "activity_consistency" ? new Set(accepted.map((item) => item.occurredAt.slice(0, 10))).size :
    accepted.reduce((total, item) => total + valueFor(definition, item), 0);
  const status = hasPending && accepted.length === 0 ? "pending" :
    accepted.length === 0 ? "unavailable" :
    value >= definition.target ? "completed" : "active";
  const reason: EvaluationReason = status === "pending" ? "pending" :
    status === "unavailable" ? (rejectedEvidence[0]?.reason ?? "unavailable") : "eligible";
  const progressIdentity = [
    ownerUserId, definition.definitionId, definition.version, windowKey,
    ...acceptedEvidenceIds,
  ].join(":");

  return {
    definitionId: definition.definitionId,
    windowKey,
    reason,
    acceptedEvidenceIds,
    rejectedEvidence,
    progress: {
      ownerUserId,
      definitionId: definition.definitionId,
      definitionVersion: CHALLENGE_DOMAIN_VERSION,
      windowKey,
      status,
      value: Math.min(definition.target, value),
      target: definition.target,
      evidenceIds: acceptedEvidenceIds,
      lastEvaluatedAt: evaluatedAt,
      evaluationVersion: definition.ruleVersion,
      pendingReason: status === "pending" ? "Waiting for evidence qualification or sync" : undefined,
      correctionVersion: accepted.reduce((max, item) => Math.max(max, item.correctionVersion ?? 0), 0),
      progressIdentity,
    },
  };
}

export function evaluateAchievement(
  ownerUserId: string,
  definition: AchievementDefinition,
  evidence: readonly EvidenceReference[],
  earnedAt: string,
): AchievementEvaluationResult {
  const accepted: EvidenceReference[] = [];
  const rejected: EvaluationReason[] = [];
  let hasPending = false;
  for (const item of sortedEvidence(evidence)) {
    if (item.ownerUserId !== ownerUserId) {
      rejected.push("cross_owner_evidence");
      continue;
    }
    const reason = evidenceReason(definition, item);
    if (reason === "pending") {
      hasPending = true;
      continue;
    }
    if (reason !== "eligible") {
      rejected.push(reason === "ineligible" ? "semantic_mismatch" : reason);
      continue;
    }
    const conditionMatches =
      (definition.condition.kind === "first_canonical_mountain" &&
        item.evidenceClass === "trusted_gps_outdoor" &&
        Boolean(item.sdeTargetId?.startsWith("sde:mountain:"))) ||
      (definition.condition.kind === "cumulative_elevation" &&
        item.evidenceClass === "trusted_gps_outdoor" &&
        typeof item.value === "number" && item.value > 0) ||
      (definition.condition.kind === "first_expedition_stage" &&
        item.evidenceClass === "simulated_expedition" &&
        item.expeditionStageCompleted === true) ||
      (definition.condition.kind === "training_block_complete" &&
        item.sourceType === "training_session" &&
        item.trainingBlockCompleted === true);
    if (conditionMatches) accepted.push(item);
    else rejected.push("semantic_mismatch");
  }
  const uniqueEvidence = [...new Map(accepted.map((item) => [item.evidenceId, item])).values()];
  const mountainCount = new Set(
    uniqueEvidence.map((item) => item.mountainId ?? item.sdeTargetId).filter(Boolean),
  ).size;
  const metric = definition.condition.kind === "cumulative_elevation"
    ? uniqueEvidence.reduce((sum, item) => sum + Math.max(0, item.value ?? 0), 0)
    : definition.condition.kind === "first_canonical_mountain"
      ? mountainCount
      : uniqueEvidence.length;
  const target = definition.condition.kind === "cumulative_elevation"
    ? definition.condition.targetMetres
    : definition.condition.targetCount;
  const evidenceIds = uniqueEvidence.map((item) => item.evidenceId).sort();
  if (hasPending && uniqueEvidence.length === 0) {
    return { achievementId: definition.achievementId, award: null, reason: "pending", acceptedEvidenceIds: [] };
  }
  if (metric < target) {
    return {
      achievementId: definition.achievementId,
      award: null,
      reason: uniqueEvidence.length > 0 ? "threshold_not_met" : (rejected[0] ?? "unavailable"),
      acceptedEvidenceIds: evidenceIds,
    };
  }
  const awardIdentity = `${ownerUserId}:${definition.achievementId}:${definition.version}:${stableHash(evidenceIds.join("|"))}`;
  return {
    achievementId: definition.achievementId,
    reason: "eligible",
    acceptedEvidenceIds: evidenceIds,
    award: {
      awardIdentity,
      ownerUserId,
      achievementId: definition.achievementId,
      achievementVersion: definition.version,
      status: "confirmed",
      evidenceIds,
      earnedAt,
      ruleVersion: definition.ruleVersion,
      correctionVersion: evidence.reduce((max, item) => Math.max(max, item.correctionVersion ?? 0), 0),
    },
  };
}