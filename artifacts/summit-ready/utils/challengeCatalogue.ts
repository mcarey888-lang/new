import type { AchievementDefinition, ChallengeDefinition } from "./challengeDomain";
import { CHALLENGE_DOMAIN_VERSION } from "./challengeDomain";

const personalGps: ChallengeDefinition["eligibility"] = {
  allowedEvidenceClasses: ["trusted_gps_outdoor"],
  purpose: "eligible_real_outdoor",
  competitiveEligible: true,
  requireQualificationStatus: "eligible",
};
const personalElevation: ChallengeDefinition["eligibility"] = {
  allowedEvidenceClasses: ["trusted_gps_outdoor"],
  purpose: "eligible_real_elevation",
  competitiveEligible: false,
  requireQualificationStatus: "eligible",
};

export const STAGE_8_CHALLENGES: readonly ChallengeDefinition[] = [
  {
    definitionId: "monthly-elevation-1000",
    version: CHALLENGE_DOMAIN_VERSION,
    ruleVersion: "monthly-elevation-v1",
    family: "monthly_elevation",
    title: "Climb 1,000m this month",
    description: "Build mountain capability with eligible outdoor elevation.",
    unit: "metres", target: 1000, scope: "personal",
    window: { kind: "calendar_month", timezone: "Europe/London" },
    enrollment: { kind: "automatic", enrollmentRequired: false },
    eligibility: personalElevation,
    metadata: { safeMotivation: true, competitiveEligible: false },
  },
  {
    definitionId: "lifetime-distance-100",
    version: CHALLENGE_DOMAIN_VERSION,
    ruleVersion: "distance-v1",
    family: "hiking_distance",
    title: "Walk 100km outdoors",
    description: "Explore steadily; distance matters more than speed.",
    unit: "kilometres", target: 100, scope: "personal",
    window: { kind: "lifetime", timezone: "UTC" },
    enrollment: { kind: "automatic", enrollmentRequired: false },
    eligibility: personalGps,
    metadata: { safeMotivation: true, competitiveEligible: true },
  },
  {
    definitionId: "consistent-climber-4-weeks",
    version: CHALLENGE_DOMAIN_VERSION,
    ruleVersion: "consistency-v1",
    family: "activity_consistency",
    title: "Move on four different days",
    description: "Consistency builds the capacity for your next mountain.",
    unit: "weeks", target: 4, scope: "personal",
    window: { kind: "rolling_days", timezone: "Europe/London", durationDays: 28 },
    enrollment: { kind: "automatic", enrollmentRequired: false },
    eligibility: personalGps,
    metadata: { safeMotivation: true, competitiveEligible: false },
  },
  {
    definitionId: "expedition-first-stage",
    version: CHALLENGE_DOMAIN_VERSION,
    ruleVersion: "expedition-milestone-v1",
    family: "expedition_milestone",
    title: "Complete your first Expedition stage",
    description: "A simulated milestone on the road to your real summit.",
    unit: "stages", target: 1, scope: "personal",
    window: { kind: "expedition_run", timezone: "UTC" },
    enrollment: { kind: "linked_context", enrollmentRequired: true },
    eligibility: { allowedEvidenceClasses: ["simulated_expedition"], purpose: "expedition_only", competitiveEligible: false },
    metadata: { safeMotivation: true, competitiveEligible: false },
  },
];

export const STAGE_8_ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    achievementId: "first-tracked-mountain",
    version: CHALLENGE_DOMAIN_VERSION, ruleVersion: "mountain-achievement-v1",
    title: "First Tracked Mountain", description: "Complete a legitimate route with a canonical mountain reference.",
    category: "mountain", tier: "bronze", repeatable: false,
    condition: { kind: "first_canonical_mountain", targetCount: 1 },
    qualification: { allowedEvidenceClasses: ["trusted_gps_outdoor"], purpose: "canonical", competitiveEligible: false, requireQualificationStatus: "eligible" },
  },
  {
    achievementId: "first-1000m-elevation",
    version: CHALLENGE_DOMAIN_VERSION, ruleVersion: "elevation-achievement-v1",
    title: "First 1,000m Eligible Elevation", description: "Accumulate eligible real outdoor elevation.",
    category: "elevation", tier: "bronze", repeatable: false,
    condition: { kind: "cumulative_elevation", targetMetres: 1000 },
    qualification: personalElevation,
  },
  {
    achievementId: "first-expedition-stage",
    version: CHALLENGE_DOMAIN_VERSION, ruleVersion: "expedition-achievement-v1",
    title: "First Expedition Stage", description: "Complete a simulated Expedition stage.",
    category: "expedition", tier: "bronze", repeatable: false,
    condition: { kind: "first_expedition_stage", targetCount: 1 },
    qualification: { allowedEvidenceClasses: ["simulated_expedition"], purpose: "expedition_only", competitiveEligible: false },
  },
  {
    achievementId: "training-block-complete",
    version: CHALLENGE_DOMAIN_VERSION, ruleVersion: "training-achievement-v1",
    title: "Training Block Complete", description: "Finish an approved training block.",
    category: "training", tier: "silver", repeatable: false,
    condition: { kind: "training_block_complete", targetCount: 1 },
    qualification: { allowedEvidenceClasses: ["trusted_gps_outdoor", "indoor"], purpose: "training", competitiveEligible: false },
  },
];