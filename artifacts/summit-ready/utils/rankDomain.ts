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

export type RankName =
  | "Trailhead"
  | "Hillwalker"
  | "Summiteer"
  | "Mountaineer"
  | "Alpinist"
  | "Expeditioner"
  | "Summit Elite";

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

/**
 * The single authoritative ladder definition. Keep names and thresholds here
 * so evaluators, journey views, and future projections cannot drift apart.
 */
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
    rank: "Alpinist",
    order: 5,
    identity: "Proving depth across sustained, authoritative mountain objectives.",
    requirements: [
      { signal: "eligibleActivities", minimum: 75, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 25000, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 16, label: "distinct canonical mountains", mandatory: true },
      { signal: "summitCompletions", minimum: 12, label: "canonical summit completions", mandatory: true },
      { signal: "activeWeeks", minimum: 16, label: "active weeks", mandatory: true },
      { signal: "expeditionMilestones", minimum: 5, label: "authoritative Expedition milestones", mandatory: true },
    ],
  },
  {
    rank: "Expeditioner",
    order: 6,
    identity: "A long-term record of prepared mountain progression.",
    requirements: [
      { signal: "eligibleActivities", minimum: 120, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 40000, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 24, label: "distinct canonical mountains", mandatory: true },
      { signal: "summitCompletions", minimum: 20, label: "canonical summit completions", mandatory: true },
      { signal: "activeWeeks", minimum: 24, label: "active weeks", mandatory: true },
      { signal: "expeditionMilestones", minimum: 10, label: "authoritative Expedition milestones", mandatory: true },
    ],
  },
  {
    rank: "Summit Elite",
    order: 7,
    identity: "The highest record of verified, sustained mountain progression.",
    requirements: [
      { signal: "eligibleActivities", minimum: 200, label: "eligible outdoor activities", mandatory: true },
      { signal: "eligibleElevation", minimum: 75000, label: "metres of eligible elevation", mandatory: true },
      { signal: "distinctMountains", minimum: 40, label: "distinct canonical mountains", mandatory: true },
      { signal: "summitCompletions", minimum: 35, label: "canonical summit completions", mandatory: true },
      { signal: "activeWeeks", minimum: 36, label: "active weeks", mandatory: true },
      { signal: "expeditionMilestones", minimum: 20, label: "authoritative Expedition milestones", mandatory: true },
    ],
  },
] as const;

export interface RankEvidenceInput {
  ownerUserId: string;
  evidence: readonly EvidenceReference[];
  /** Callers must state producer authority explicitly; omission must never imply availability. */
  signalAvailability: Record<RankSignal, RankSignalAvailability>;
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