# Stage 8 Challenge and Achievement Domain Model

**Command:** O8-C03  
**Model version:** `challenge-domain-v1`  
**Status:** Additive local projection implementation; legacy catalogue/state remain authoritative for compatibility

## Purpose and invariants

Challenges convert legitimate mountain-capability evidence into explainable
personal progress and sparse achievements. The model is deterministic,
versioned, owner-scoped, and consequence-oriented.

The model does not own physical activities. It references the existing
canonical activity/evidence identity and may emit several independently
idempotent consequences for one activity.

Permanent invariants:

1. One physical activity is stored once.
2. A single activity may progress many definitions, but never twice for the
   same definition/window/rule aggregate identity; contribution lineage is recorded separately.
3. Training Readiness, Elevation Bank, Expedition simulated progress, real
   summit authority, and challenge progress remain separate outputs.
4. SDE mountain/route IDs remain stable references, never display-name
   identities.
5. Missing, pending, unverified, revoked, and unavailable evidence is explicit.
6. Pure evaluation receives all dates and windows as input; it reads no clock,
   network, randomness, or mutable global state.

## Versioned contract

The following TypeScript-like shapes are the conceptual contract for
`challenge-domain-v1`. They are not a production schema.

```ts
type DomainVersion = "challenge-domain-v1";
type RuleVersion = string; // immutable evaluator/catalogue rule
type Scope = "personal" | "competitive_candidate";
type Status =
  | "draft" | "active" | "completed" | "pending"
  | "unavailable" | "revoked" | "superseded";

type ChallengeFamily =
  | "monthly_elevation"
  | "cumulative_elevation"
  | "mountain_count"
  | "summit_count"
  | "hiking_distance"
  | "activity_consistency"
  | "expedition_milestone"
  | "training_milestone"
  | "readiness_milestone";

interface ChallengeDefinition {
  definitionId: string;       // stable catalogue identity, not a user record
  version: DomainVersion;
  ruleVersion: RuleVersion;
  family: ChallengeFamily;
  title: string;
  description: string;
  unit: "metres" | "kilometres" | "activities" | "mountains"
    | "summits" | "stages" | "weeks" | "readiness_points";
  target: number;
  scope: Scope;
  window: ChallengeWindowSpec;
  enrollment: ChallengeEnrollmentPolicy;
  eligibility: QualificationPolicy;
  targetReference?: CanonicalTargetReference;
  metadata: { safeMotivation: true; competitiveEligible: boolean };
  availability?: { status: "available" | "pending" | "unavailable"; reason: string };
}

interface ChallengeWindowSpec {
  kind: "calendar_month" | "rolling_days" | "lifetime"
    | "fixed_period" | "expedition_run" | "training_block";
  timezone: string;           // explicit IANA zone or "UTC"
  startInclusive?: string;    // supplied/resolved ISO instant
  endExclusive?: string;      // supplied/resolved ISO instant
  durationDays?: number;
}

interface ChallengeEnrollmentPolicy {
  kind: "automatic" | "explicit" | "linked_context" | "none";
  maxActive?: number;
  enrollmentRequired: boolean;
}

interface ChallengeProgress {
  ownerUserId: string;
  definitionId: string;
  definitionVersion: DomainVersion;
  windowKey: string;
  status: "active" | "completed" | "pending" | "unavailable" | "revoked";
  value: number;
  target: number;
  evidenceIds: readonly string[];
  lastEvaluatedAt?: string;
  evaluationVersion: RuleVersion;
  pendingReason?: string;
  correctionVersion: number;
  progressIdentity: string; // owner:definition:domainVersion:ruleVersion:windowKey
  contributionIdentities?: readonly string[]; // stable per-lineage derivation metadata
}

interface AchievementDefinition {
  achievementId: string;
  version: DomainVersion;
  ruleVersion: RuleVersion;
  title: string;
  description: string;
  category: "mountain" | "elevation" | "expedition"
    | "training" | "consistency" | "exploration";
  tier: "bronze" | "silver" | "gold";
  qualification: QualificationPolicy;
  repeatable: false;
  availability?: { status: "available" | "pending" | "unavailable"; reason: string };
}

interface AchievementAward {
  awardIdentity: string; // owner:achievement:domainVersion:ruleVersion
  ownerUserId: string;
  achievementId: string;
  achievementVersion: DomainVersion;
  status: "confirmed" | "pending" | "revoked" | "superseded";
  evidenceIds: readonly string[];
  earnedAt: string;
  ruleVersion: RuleVersion;
  correctionVersion: number;
}

interface EvidenceReference {
  evidenceId: string;         // stable source reference used for derivation metadata
  lineageId?: string;         // stable identity across corrections/revisions
  ownerUserId: string;
  sourceType: "canonical_activity" | "training_session"
    | "expedition_consequence" | "canonical_route_evidence"
    | "local_activity";
  sourceId: string;
  activityId?: string;
  evidenceClass: "trusted_gps_outdoor" | "recorded_unverified"
    | "manual_outdoor" | "indoor" | "simulated_expedition"
    | "canonical_summit" | "community_route";
  occurredAt: string;
  qualificationStatus: "eligible" | "ineligible" | "pending"
    | "revoked";
  qualificationPurpose?: string;
  qualificationRuleVersion?: RuleVersion;
  sourceCursor?: string;       // authoritative eventAt ordering cursor
  sdeTargetId?: string;
  provenanceHash?: string;
  correctionVersion?: number;
  windowBucketKey?: string;   // trusted explicit local day/week/window bucket
}
```

Corrections replace the prior reference with the same `lineageId`; revisions never
coexist in an evaluation set. A revoked/deleted latest revision causes dependent
progress or awards to be recomputed and deterministically revoked/superseded.
When competing records for one lineage arrive, authority is normative and
order-independent: (1) higher `correctionVersion`, (2) higher `sourceCursor`
(`eventAt`), (3) revoked over non-revoked, then (4) lexical canonical
serialization as a deterministic tie-break. Exact repeats are idempotent.
For Elevation Bank activity lineages, `correctionVersion` is the safe eventAt
epoch-millisecond value, not the ledger revision (which is scoped to
activity+rule). Its `sourceCursor` is `eventAt|zero-padded revision|ruleVersion`;
this preserves server ordering when old and new rules overlap. String ordering
uses UTF-16 code units, never locale collation.
Confirmed awards retain their original `earnedAt` when a later recomputation still
qualifies. Progress uses aggregate `progressIdentity`; accepted contributions use
stable lineage-derived `contributionIdentities`. Evidence IDs are explanatory
inputs, never award or progress identity.

`CanonicalTargetReference` accepts only the existing stable SDE forms
`sde:mountain:<id>` and `sde:route:<identity>@<version>`. It never accepts a
display name, slug, app serial ID, or user GPS trace as canonical identity.

## Qualification policy

Qualification is evaluated before presentation. Every definition declares
required evidence classes, purpose, minimum quality, and whether competitive
eligibility is even possible.
Policies may pin `requiredQualificationRuleVersion`; evidence must match its
purpose and rule exactly. Competitive policies may additionally specify
`competitivePurpose` and required `competitiveStatus`.

| Evidence class | Personal rules | Competitive candidate rules |
| --- | --- | --- |
| `trusted_gps_outdoor` | May count for eligible elevation, distance, activity consistency, mountain/summit evidence, and permitted exploration | Only if the existing `competitive_elevation`/equivalent qualification is eligible and plausibility policy is satisfied |
| `recorded_unverified` | Pending/history or explicitly personal-only, never silently verified | Not eligible |
| `manual_outdoor` | Personal/history and clearly labelled personal achievements | Not eligible by default |
| `indoor` | Training/fitness and personal consistency where definition permits | Not eligible for outdoor/public challenge |
| `simulated_expedition` | Expedition milestones only | Not eligible for real outdoor ranking/elevation |
| `canonical_summit` | Only when existing summit evidence rules authorize it | Candidate only with the same authoritative evidence |
| `community_route` | Discovery/history context only | Not a real-summit or public-elevation proof |

Readiness milestones may consume already-approved Readiness evidence, but the
challenge evaluator must not recompute or replace Readiness 2.0. Elevation
challenge credit must not bypass Elevation Bank qualification. Expedition
milestones consume the selected-stage consequence and remain simulated.

Required reason states include `eligible`, `ineligible`, `pending`,
`unavailable`, `missing_target_reference`, `missing_provenance`,
`competitive_not_enabled`, `manual_personal_only`, `indoor_personal_only`,
`simulated_expedition_only`, `activity_revoked`, and `activity_deleted`.

## Windows and timezone rules

Window resolution is explicit and stable:

- monthly challenges use a supplied IANA timezone and a calendar-month
  `[startInclusive, endExclusive)` interval;
- rolling challenges use an explicit anchor instant and duration;
  a duration of 28 means exactly `[anchor - 28*24h, anchor)`;
- lifetime challenges use the owner’s accepted evidence history with no hidden
  current-time lookup;
- Expedition windows use the immutable expedition run identity and stage
  rule/version;
- Training/readiness windows use the supplied training block boundaries.

Evidence exactly at `startInclusive` is included; evidence exactly at
`endExclusive` is excluded. An evidence event is assigned to a window by its
authoritative occurrence timestamp, not upload/retry time. If the timestamp or
timezone cannot be trusted, progress is `pending` or `unavailable`, not
invented.
Consistency definitions require an explicit trusted timezone-local day/week
bucket on each evidence reference; UTC date slicing is not a substitute.

## Required challenge families

The initial model supports these families:

| Family | Default metric | Safe source |
| --- | --- | --- |
| Monthly elevation | eligible real metres in calendar month | existing personal/competitive qualification |
| Cumulative elevation | eligible real metres over lifetime or fixed period | Elevation Bank-compatible personal elevation |
| Mountain count | distinct canonical SDE mountain IDs | legitimate route/mountain evidence |
| Summit count | distinct authorized summit completions | existing summit authority only |
| Hiking distance | eligible outdoor kilometres | qualified completed outdoor activity |
| Activity consistency | distinct eligible activity dates/weeks | qualified completed activity; no speed incentive |
| Expedition milestone | selected stages or completion | simulated Expedition consequence only |
| Training milestone | completed linked sessions or approved plan milestone | Training consequence/evidence |
| Readiness milestone | approved readiness threshold/improvement event | existing Readiness 2.0 output only |

Definitions must not reward dangerous descent speed, unsafe ascent speed, or
unverified public activity.

## Safe initial achievements

The initial catalogue should be sparse and evidence-aware:

- **First Tracked Mountain** — first legitimate activity with a canonical SDE
  mountain/route reference; not a name-only or community-route claim.
- **First 1,000m Eligible Elevation** — 1,000 eligible real metres under the
  existing personal elevation qualification; simulated and indoor evidence
  excluded.
- **First Expedition Stage** — first completed selected Expedition stage,
  labelled simulated and never presented as a real summit.
- **Expedition Complete** — authoritative Expedition completion, distinct from
  real summit completion.
- **Five Mountains** — five distinct canonical SDE mountain identities with
  legitimate evidence.
- **Consistent Climber** — a definition-versioned streak or activity-week
  milestone using explicit window boundaries, not dangerous frequency.
- **Training Block Complete** — approved Training milestone based on completion
  evidence, not a manually asserted result.
- **Readiness Milestone** — an approved Readiness 2.0 threshold event,
  explicitly labelled as readiness rather than summit attainment.

Existing local achievement IDs may be mapped as presentation aliases, but a
legacy IDs are presentation aliases; award identity remains the stable
owner/achievement/version/rule aggregate.

## Idempotency identities

Each consequence is independently idempotent:

```text
progressIdentity =
  ownerUserId : definitionId : definitionVersion : ruleVersion : windowKey

awardIdentity =
  ownerUserId : achievementId : achievementVersion : ruleVersion

contributionIdentity =
  ownerUserId : definitionId : definitionVersion : ruleVersion : windowKey : lineageId

enrollmentIdentity =
  ownerUserId : definitionId : definitionVersion : enrollmentWindowKey
```

Evidence IDs are sorted derivation metadata, not identity inputs. Replaying the
same activity, uploading it again, restarting the app, or retrying a sync
produces the same aggregate/contribution identities. Different challenge
definitions may therefore each receive one valid consequence from one
activity, while duplicate processing of one definition is ignored.

Owner ID is always server/user scoped and never accepted from a cross-owner
evidence payload. Display names, route names, timestamps alone, and metric
similarity are not identity.

## Corrections and revocations

Progress and awards are derived consequences, not irreversible facts.

- A corrected evidence record creates a new correction version and causes
  deterministic recomputation for affected windows.
- A revoked/deleted activity marks dependent progress/awards `revoked` or
  `superseded`; it does not silently leave stale totals.
- A rule-definition replacement uses a new immutable rule version and
  supersession metadata rather than mutating historical evaluation.
- A pending consequence may later become confirmed, but an unavailable result
  must not be treated as zero evidence.
- Correction/revocation processing must use the same stable lineage and owner
  scope as initial evaluation.

The model does not authorize a production backfill or retroactive rewrite.
Those operations require a separate reviewed rollout.

## Offline and pending states

Definitions bundled in the app can be browsed offline. Local progress may be
shown as `pending` when the activity is saved locally but canonical
qualification or consequence confirmation is not available. The tracker’s
Finish/Save path remains immediate and independent.

Presentation rules:

- `confirmed`: show earned progress/award;
- `pending`: show saved locally / awaiting verification or sync;
- `unavailable`: explain which definition/evidence is missing;
- `revoked`: explain that a prior consequence was removed;
- `ineligible`: show the reason where useful, without exposing private
  evidence to other users.

Offline replay submits the same evidence and idempotency identities. No local
random ID, clock-based award, or optimistic public ranking is authoritative.

## Compatibility and persistence decision

O8-C03 is intentionally a pure/local model definition. It can be implemented
with static definitions, deterministic evaluators, consequence intents, and a
user-scoped compatibility projection over existing AsyncStorage. It requires
**no production migration** and no production flag.

If a later server writer is approved, it must be additive, owner-scoped,
uniquely constrained by the identities above, and integrated through
`activityConsequences.ts`. It must reuse canonical activity/evidence,
qualification, Elevation Bank, Readiness, Expedition, and SDE boundaries.
Production SQL, migration application, backfill, public leaderboard activation,
auth/privacy changes, PA-A2, PA-A3, tracker redesign, and protected
Progress Mountain/cinematic changes are explicitly out of scope.

**O8-R03 status: COMPLETE**