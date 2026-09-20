import type { EvidenceReference } from "./challengeDomain";
import { compareEvidenceAuthority } from "./evidenceAuthority";
import {
  RANK_DOMAIN_VERSION,
  RANKS,
  type RankDefinition,
  type RankEvidenceInput,
  type RankName,
  type RankRequirement,
  type RankRequirementResult,
  type RankResult,
  type RankSignal,
  type RankSignalAvailability,
} from "./rankDomain";

// Compatibility export for existing evaluator consumers. The ladder itself is
// centralized in rankDomain and is also consumed directly by the UI.
export { RANKS } from "./rankDomain";

const rankSignalNames = new Set<RankSignal>([
  "eligibleActivities", "eligibleElevation", "distinctMountains",
  "summitCompletions", "activeWeeks", "expeditionMilestones",
]);

export const RANK_EVIDENCE_CONTRACT = {
  outdoor: { purpose: "rank_real_outdoor", ruleVersion: "summitready-rank-v1" },
  elevation: { purpose: "rank_real_elevation", ruleVersion: "summitready-rank-v1" },
  summit: { purpose: "rank_canonical_summit", ruleVersion: "summitready-rank-v1" },
  expedition: { purpose: "rank_expedition_milestone", ruleVersion: "summitready-rank-v1" },
} as const;

function latestByLineage(evidence: readonly EvidenceReference[]): EvidenceReference[] {
  const latest = new Map<string, EvidenceReference>();
  for (const item of evidence) {
    const key = item.lineageId ?? item.evidenceId;
    const current = latest.get(key);
    if (!current || compareEvidenceAuthority(item, current) >= 0) latest.set(key, item);
  }
  return [...latest.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
}

function weekKey(occurredAt: string): string | null {
  const date = new Date(occurredAt);
  if (!Number.isFinite(date.getTime())) return null;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function isBaseEligible(item: EvidenceReference): boolean {
  if (item.qualificationStatus !== "eligible") return false;
  return Number.isFinite(new Date(item.occurredAt).getTime());
}

function hasContract(
  item: EvidenceReference,
  contract: { purpose: string; ruleVersion: string },
): boolean {
  return item.qualificationPurpose === contract.purpose
    && item.qualificationRuleVersion === contract.ruleVersion;
}

function requirementResult(
  requirement: RankRequirement,
  value: number | null,
  availability: RankSignalAvailability,
): RankRequirementResult {
  if (availability === "unavailable") {
    return { ...requirement, value: null, availability, status: "unavailable", remaining: null };
  }
  if (availability === "degraded") {
    return {
      ...requirement,
      value,
      availability,
      status: "degraded",
      remaining: value === null ? null : Math.max(0, requirement.minimum - value),
    };
  }
  if (value === null) {
    return { ...requirement, value: null, availability, status: "missing", remaining: null };
  }
  const met = value >= requirement.minimum;
  return {
    ...requirement,
    value,
    availability,
    status: met ? "met" : "missing",
    remaining: Math.max(0, requirement.minimum - value),
  };
}

function evaluateRequirements(
  definition: RankDefinition,
  values: Partial<Record<RankSignal, number>>,
  availability: Partial<Record<RankSignal, RankSignalAvailability>>,
): RankRequirementResult[] {
  return definition.requirements.map((requirement) =>
    requirementResult(requirement, values[requirement.signal] ?? null, availability[requirement.signal] ?? "unavailable"));
}

export function evaluateRank(input: RankEvidenceInput): RankResult {
  const values: Partial<Record<RankSignal, number>> = {};
  const excludedEvidence: { evidenceId: string; reason: string }[] = [];
  const eligibleEvidenceIds: string[] = [];
  const eligible = latestByLineage(input.evidence).filter((item) => {
    if (item.ownerUserId !== input.ownerUserId) {
      excludedEvidence.push({ evidenceId: item.evidenceId, reason: "cross_owner_evidence" });
      return false;
    }
    if (item.qualificationStatus === "revoked") {
      excludedEvidence.push({ evidenceId: item.evidenceId, reason: "revoked_evidence" });
      return false;
    }
    if (!isBaseEligible(item)) {
      excludedEvidence.push({ evidenceId: item.evidenceId, reason: "ineligible_or_missing_provenance" });
      return false;
    }
    return true;
  });

  const outdoor = eligible.filter((item) =>
    item.sourceType === "canonical_activity"
    && item.evidenceClass === "trusted_gps_outdoor"
    && hasContract(item, RANK_EVIDENCE_CONTRACT.outdoor));
  const elevationEvidence = eligible.filter((item) =>
    item.sourceType === "canonical_activity"
    && item.evidenceClass === "trusted_gps_outdoor"
    && hasContract(item, RANK_EVIDENCE_CONTRACT.elevation));
  const summitEvidence = eligible.filter((item) =>
    item.sourceType === "canonical_route_evidence"
    && item.evidenceClass === "canonical_summit"
    && !!item.provenanceHash
    && !!item.sdeTargetId
    && item.summitCompleted === true
    && hasContract(item, RANK_EVIDENCE_CONTRACT.summit));
  const expeditionEvidence = eligible.filter((item) =>
    item.sourceType === "expedition_consequence"
    && item.evidenceClass === "trusted_gps_outdoor"
    && (item.expeditionStageCompleted === true || item.expeditionCompleted === true)
    && hasContract(item, RANK_EVIDENCE_CONTRACT.expedition));

  const accepted = new Set([
    ...outdoor,
    ...elevationEvidence,
    ...summitEvidence,
    ...expeditionEvidence,
  ].map((item) => item.evidenceId));
  for (const item of eligible) {
    if (accepted.has(item.evidenceId)) eligibleEvidenceIds.push(item.evidenceId);
    else excludedEvidence.push({ evidenceId: item.evidenceId, reason: "wrong_rank_purpose_or_producer" });
  }

  const mountains = new Set<string>();
  const weeks = new Set<string>();
  let elevation = 0;
  for (const item of elevationEvidence) {
    elevation += Math.max(0, item.value ?? 0);
  }
  for (const item of summitEvidence) {
    if (item.mountainId || item.sdeTargetId?.startsWith("sde:mountain:")) {
      mountains.add(item.mountainId ?? item.sdeTargetId!);
    }
  }
  for (const item of outdoor) {
    const week = weekKey(item.occurredAt);
    if (week) weeks.add(week);
  }
  values.eligibleActivities = new Set(outdoor.map((item) => item.activityId ?? item.sourceId)).size;
  values.eligibleElevation = elevation;
  values.distinctMountains = mountains.size;
  values.summitCompletions = summitEvidence.length;
  values.activeWeeks = weeks.size;
  values.expeditionMilestones = expeditionEvidence.length;

  const availability: Partial<Record<RankSignal, RankSignalAvailability>> = {};
  for (const signal of rankSignalNames) availability[signal] = input.signalAvailability[signal];
  let currentRank: RankName | null = null;
  let currentRequirements: RankRequirementResult[] = [];
  let blockedReasons: string[] = [];
  for (const definition of RANKS) {
    const requirements = evaluateRequirements(definition, values, availability);
    const blocked = requirements.filter((item) => item.status === "unavailable" || item.status === "degraded");
    const complete = requirements.every((item) => item.status === "met");
    if (complete) {
      currentRank = definition.rank;
      currentRequirements = requirements;
      continue;
    }
    if (currentRank === null) currentRequirements = requirements;
    if (blocked.length > 0) blockedReasons = blocked.map((item) => `${item.label} is ${item.status}`);
    break;
  }
  const currentIndex = currentRank ? RANKS.findIndex((item) => item.rank === currentRank) : -1;
  const next = RANKS[currentIndex + 1];
  const nextRequirements = next ? evaluateRequirements(next, values, availability) : [];
  const visibleRequirements = next ? nextRequirements : currentRequirements;
  const available = visibleRequirements.filter((item) => item.status !== "unavailable");
  const progress = available.length === 0 ? 0 :
    available.reduce((sum, item) => sum + Math.min(1, (item.value ?? 0) / item.minimum), 0) / visibleRequirements.length;

  return {
    domainVersion: RANK_DOMAIN_VERSION,
    ownerUserId: input.ownerUserId,
    currentRank,
    nextRank: next?.rank ?? null,
    promotionBlocked: blockedReasons.length > 0,
    blockedReasons,
    progress,
    requirements: currentRequirements,
    nextRequirements,
    eligibleEvidenceIds,
    excludedEvidence,
  };
}