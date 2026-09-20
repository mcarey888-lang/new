export const CHALLENGE_DOMAIN_VERSION = "challenge-domain-v1" as const;

export type ChallengeDomainVersion = typeof CHALLENGE_DOMAIN_VERSION;
export type ChallengeScope = "personal" | "competitive_candidate";
export type ChallengeStatus =
  | "draft"
  | "active"
  | "completed"
  | "pending"
  | "unavailable"
  | "revoked"
  | "superseded";
export type ChallengeFamily =
  | "monthly_elevation"
  | "cumulative_elevation"
  | "mountain_count"
  | "summit_count"
  | "hiking_distance"
  | "activity_consistency"
  | "expedition_milestone"
  | "training_milestone"
  | "readiness_milestone";
export type ChallengeUnit =
  | "metres"
  | "kilometres"
  | "activities"
  | "mountains"
  | "summits"
  | "stages"
  | "weeks"
  | "readiness_points";
export type EvidenceClass =
  | "trusted_gps_outdoor"
  | "recorded_unverified"
  | "manual_outdoor"
  | "indoor"
  | "simulated_expedition"
  | "canonical_summit"
  | "community_route";
export type EvidenceQualification = "eligible" | "ineligible" | "pending" | "revoked";
export type EvidenceSourceType =
  | "canonical_activity"
  | "training_session"
  | "expedition_consequence"
  | "canonical_route_evidence"
  | "local_activity";

export interface CanonicalTargetReference {
  kind: "mountain" | "route";
  id: string;
}

export interface ChallengeWindowSpec {
  kind: "calendar_month" | "rolling_days" | "lifetime" | "fixed_period" | "expedition_run" | "training_block";
  timezone: string;
  startInclusive?: string;
  endExclusive?: string;
  durationDays?: number;
}

/** A window whose boundaries and bucket identity were resolved explicitly. */
export interface ResolvedChallengeWindow {
  windowKey: string;
  startInclusive: string;
  endExclusive: string;
  timezone: string;
}

export interface ChallengeEnrollmentPolicy {
  kind: "automatic" | "explicit" | "linked_context" | "none";
  maxActive?: number;
  enrollmentRequired: boolean;
}

export interface QualificationPolicy {
  allowedEvidenceClasses: readonly EvidenceClass[];
  purpose: string;
  competitiveEligible: boolean;
  requireQualificationStatus?: EvidenceQualification;
  requiredQualificationRuleVersion?: string;
  competitivePurpose?: string;
  requireCompetitiveStatus?: "eligible";
}

export interface ChallengeDefinition {
  definitionId: string;
  version: ChallengeDomainVersion;
  ruleVersion: string;
  family: ChallengeFamily;
  title: string;
  description: string;
  unit: ChallengeUnit;
  target: number;
  scope: ChallengeScope;
  window: ChallengeWindowSpec;
  enrollment: ChallengeEnrollmentPolicy;
  eligibility: QualificationPolicy;
  targetReference?: CanonicalTargetReference;
  metadata: { safeMotivation: true; competitiveEligible: boolean };
  availability?: { status: "available" | "pending" | "unavailable"; reason: string };
}

export interface ChallengeProgress {
  ownerUserId: string;
  definitionId: string;
  definitionVersion: ChallengeDomainVersion;
  windowKey: string;
  status: Exclude<ChallengeStatus, "draft" | "superseded">;
  value: number;
  target: number;
  evidenceIds: readonly string[];
  lastEvaluatedAt?: string;
  evaluationVersion: string;
  pendingReason?: string;
  correctionVersion: number;
  progressIdentity: string;
  /** Stable per-evidence contribution identities; evidenceIds are derivation metadata. */
  contributionIdentities?: readonly string[];
}

export type AchievementCategory = "mountain" | "elevation" | "expedition" | "training" | "consistency" | "exploration";
export type AchievementTier = "bronze" | "silver" | "gold";

export interface AchievementDefinition {
  achievementId: string;
  version: ChallengeDomainVersion;
  ruleVersion: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  qualification: QualificationPolicy;
  condition: AchievementCondition;
  repeatable: false;
  availability?: { status: "available" | "pending" | "unavailable"; reason: string };
}

export type AchievementCondition =
  | { kind: "first_canonical_mountain"; targetCount: 1 }
  | { kind: "cumulative_elevation"; targetMetres: number }
  | { kind: "first_expedition_stage"; targetCount: 1 }
  | { kind: "training_block_complete"; targetCount: 1 };

export interface AchievementAward {
  awardIdentity: string;
  ownerUserId: string;
  achievementId: string;
  achievementVersion: ChallengeDomainVersion;
  status: "confirmed" | "pending" | "revoked" | "superseded";
  evidenceIds: readonly string[];
  earnedAt: string;
  ruleVersion: string;
  correctionVersion: number;
}

export interface EvidenceReference {
  evidenceId: string;
  /** Stable source lineage identity; revisions reuse this identity. */
  lineageId?: string;
  sourceCursor?: string;
  ownerUserId: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  activityId?: string;
  evidenceClass: EvidenceClass;
  occurredAt: string;
  qualificationStatus: EvidenceQualification;
  qualificationPurpose?: string;
  qualificationRuleVersion?: string;
  sdeTargetId?: string;
  provenanceHash?: string;
  correctionVersion?: number;
  value?: number;
  distanceKm?: number;
  mountainId?: string;
  summitCompleted?: boolean;
  expeditionStageCompleted?: boolean;
  expeditionCompleted?: boolean;
  trainingBlockCompleted?: boolean;
  /** Explicit bucket proving this evidence belongs to a resolved evaluation window. */
  windowBucketKey?: string;
  competitivePurpose?: string;
  competitiveStatus?: "eligible" | "ineligible" | "pending";
}

export type EvaluationReason =
  | "eligible"
  | "ineligible"
  | "pending"
  | "unavailable"
  | "missing_target_reference"
  | "missing_provenance"
  | "competitive_not_enabled"
  | "manual_personal_only"
  | "indoor_personal_only"
  | "simulated_expedition_only"
  | "activity_revoked"
  | "activity_deleted"
  | "outside_window"
  | "cross_owner_evidence"
  | "invalid_timestamp"
  | "threshold_not_met"
  | "semantic_mismatch";

export interface ChallengeEvaluationResult {
  definitionId: string;
  windowKey: string;
  progress: ChallengeProgress;
  reason: EvaluationReason;
  acceptedEvidenceIds: readonly string[];
  rejectedEvidence: readonly { evidenceId: string; reason: EvaluationReason }[];
}

export interface AchievementEvaluationResult {
  achievementId: string;
  award: AchievementAward | null;
  reason: EvaluationReason;
  acceptedEvidenceIds: readonly string[];
}