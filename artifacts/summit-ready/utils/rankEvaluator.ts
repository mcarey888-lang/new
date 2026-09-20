import type { EvidenceReference } from "./challengeDomain";
import { compareEvidenceAuthority } from "./evidenceAuthority";
import {
  RANK_DOMAIN_VERSION,
  type RankDefinition,
  type RankEvidenceInput,
  type RankName,
  type RankRequirement,
  type RankRequirementResult,
  type RankResult,
  type RankSignal,
  type RankSignalAvailability,
} from "./rankDomain";

export const RANKS: readonly RankDefinition[] = [
  {
    rank: "Trailhead",
    order: 1,
    identity: "Beginning a deliberate mountain practice.",
    requirements: [
      { signal: "eligibleActivities", minimum: 1, label: "eligible outdoor activity", mandatory: true },
      { signal: "eligibleElevation", minimum: 100, label: "metres of eligible elevation", mandatory: true },
      { signal: "activeWeeks", minimum: 1, label: "active week", mandatory: true },
    ],
  },
  {
    rank: "Hillwalker",
    order: 2,
    identity: "Building dependable hill experience.",
    requirements: [
      { signal: "eligibleActivities", minimum: 5, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 1000, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 2, label: "distinct mountains", mandatory: true },
      { signal: "activeWeeks", minimum: 2, label: "active weeks", mandatory: true },
    ],
  },
  {
    rank: "Summiteer",
    order: 3,
    identity: "Turning repeated outings into summit experience.",
    requirements: [
      { signal: "eligibleActivities", minimum: 12, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 3000, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 4, label: "distinct mountains", mandatory: true },
      { signal: "summitCompletions", minimum: 2, label: "eligible summit completions", mandatory: true },
      { signal: "activeWeeks", minimum: 4, label: "active weeks", mandatory: true },
    ],
  },
  {
    rank: "Mountaineer",
    order: 4,
    identity: "A broad, sustained mountain capability identity.",
    requirements: [
      { signal: "eligibleActivities", minimum: 25, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 7500, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 8, label: "distinct mountains", mandatory: true },
      { signal: "summitCompletions", minimum: 5, label: "eligible summit completions", mandatory: true },
      { signal: "activeWeeks", minimum: 8, label: "active weeks", mandatory: true },
      { signal: "expeditionMilestones", minimum: 1, label: "eligible Expedition milestones", mandatory: true },
    ],
  },
  {
    rank: "Expeditioner",
    order: 5,
    identity: "A long-term record of prepared mountain progression.",
    requirements: [
      { signal: "eligibleActivities", minimum: 50, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 15000, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 12, label: "distinct mountains", mandatory: true },
      { signal: "summitCompletions", minimum: 8, label: "eligible summit completions", mandatory: true },
      { signal: "activeWeeks", minimum: 12, label: "active weeks", mandatory: true },
      { signal: "expeditionMilestones", minimum: 3, label: "eligible Expedition milestones", mandatory: true },
    ],
  },
] as const;

const rankSignalNames = new Set<RankSignal>([
  "eligibleActivities", "eligibleElevation", "distinctMountains",
  "summitCompletions", "activeWeeks", "expeditionMilestones",
]);

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

function isEligible(item: EvidenceReference): boolean {
  if (item.qualificationStatus !== "eligible") return false;
  if (item.evidenceClass !== "trusted_gps_outdoor" && item.evidenceClass !== "canonical_summit") return false;
  if (item.evidenceClass === "canonical_summit" && (!item.provenanceHash || !item.sdeTargetId)) return false;
  return Number.isFinite(new Date(item.occurredAt).getTime());
}

function requirementResult(
  requirement: RankRequirement,
  value: number | null,
  availability: RankSignalAvailability,
): RankRequirementResult {
  if (availability === "unavailable") {
    return { ...requirement, value: null, availability, status: "unavailable", remaining: null };
  }
  if (value === null) {
    return { ...requirement, value: null, availability, status: availability === "degraded" ? "degraded" : "missing", remaining: null };
  }
  const met = value >= requirement.minimum;
  return {
    ...requirement,
    value,
    availability,
    status: met ? "met" : availability === "degraded" ? "degraded" : "missing",
    remaining: Math.max(0, requirement.minimum - value),
  };
}

function evaluateRequirements(
  definition: RankDefinition,
  values: Partial<Record<RankSignal, number>>,
  availability: Partial<Record<RankSignal, RankSignalAvailability>>,
): RankRequirementResult[] {
  return definition.requirements.map((requirement) =>
    requirementResult(requirement, values[requirement.signal] ?? null, availability[requirement.signal] ?? "available"));
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
    if (!isEligible(item)) {
      excludedEvidence.push({ evidenceId: item.evidenceId, reason: "ineligible_or_missing_provenance" });
      return false;
    }
    eligibleEvidenceIds.push(item.evidenceId);
    return true;
  });

  const mountains = new Set<string>();
  const weeks = new Set<string>();
  let elevation = 0;
  let summits = 0;
  let expeditionMilestones = 0;
  for (const item of eligible) {
    elevation += Math.max(0, item.value ?? 0);
    if (item.mountainId || item.sdeTargetId?.startsWith("sde:mountain:")) {
      mountains.add(item.mountainId ?? item.sdeTargetId!);
    }
    const week = weekKey(item.occurredAt);
    if (week) weeks.add(week);
    if (item.summitCompleted === true || item.evidenceClass === "canonical_summit") summits += 1;
    if (item.expeditionStageCompleted === true || item.expeditionCompleted === true) expeditionMilestones += 1;
  }
  values.eligibleActivities = eligible.length;
  values.eligibleElevation = elevation;
  values.distinctMountains = mountains.size;
  values.summitCompletions = summits;
  values.activeWeeks = weeks.size;
  values.expeditionMilestones = expeditionMilestones;

  const availability: Partial<Record<RankSignal, RankSignalAvailability>> = {};
  for (const signal of rankSignalNames) availability[signal] = input.signalAvailability?.[signal] ?? "available";
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