import type { EvidenceReference } from "./challengeDomain";

export const RANK_DOMAIN_VERSION = "summitready-rank-v1" as const;

export type RankSignal =
  | "eligibleActivities"
  | "eligibleElevation"
  | "distinctMountains"
  | "summitCompletions"
  | "activeWeeks"
  | "expeditionMilestones";

export type RankSignalAvailability = "available" | "degraded" | "unavailable";

export type RankName = "Trailhead" | "Hillwalker" | "Summiteer" | "Mountaineer" | "Expeditioner";

export interface RankRequirement {
  signal: RankSignal;
  minimum: number;
  label: string;
  /** A missing authoritative producer must never be silently treated as zero. */
  mandatory: boolean;
}

export interface RankDefinition {
  rank: RankName;
  order: number;
  identity: string;
  requirements: readonly RankRequirement[];
}

export interface RankEvidenceInput {
  ownerUserId: string;
  evidence: readonly EvidenceReference[];
  signalAvailability?: Partial<Record<RankSignal, RankSignalAvailability>>;
}

export interface RankRequirementResult extends RankRequirement {
  value: number | null;
  availability: RankSignalAvailability;
  status: "met" | "missing" | "degraded" | "unavailable";
  remaining: number | null;
}

export interface RankResult {
  domainVersion: typeof RANK_DOMAIN_VERSION;
  ownerUserId: string;
  currentRank: RankName | null;
  nextRank: RankName | null;
  promotionBlocked: boolean;
  blockedReasons: readonly string[];
  progress: number;
  requirements: readonly RankRequirementResult[];
  nextRequirements: readonly RankRequirementResult[];
  eligibleEvidenceIds: readonly string[];
  excludedEvidence: readonly { evidenceId: string; reason: string }[];
}