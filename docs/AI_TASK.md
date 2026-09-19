# SummitReady AI Task — Stage 4 Master Runbook

## S4-MASTER — Foundation Activation, Elevation Bank + Activity Completion

Stages 1–3 are COMPLETE and accepted. Stage 4 is approved as a bounded development stage. Work sequentially through S4-C01 to S4-C10 in one active Agent session where possible. Do not wait for the owner between GREEN commands.

### Goal

Turn the canonical activity foundation into a safe, understandable user experience:

**one physical activity → one canonical record → one personal elevation credit → multiple valid consequences**

A completed hike may affect Training, Expedition progress, personal Elevation Bank, challenges and achievements without duplicating the physical activity or double-crediting elevation.

Stage 4 must begin by closing/validating the deliberately unfinished Stage 2 integration boundaries. Do not assume the prepared ledgers or default-off adapters are production-ready.

### Operating protocol
- Execute commands strictly in order.
- Record S4-R01…S4-R10 in AI_CHANGELOG.md and keep AI_HANDOFF.md current.
- Commit at safe checkpoints.
- Use targeted inspection and normal/default Agent effort; do not repeatedly audit the whole repo.
- Prefer additive/backwards-compatible changes.
- Continue automatically through GREEN commands.
- Stop for RED gate, genuine blocker/failure, or after S4-R10.
- Never silently enable a production dependency.
- If a production migration/flag is required, prepare and verify it, document the exact action, then STOP at the appropriate approval gate rather than applying it.
- Do not start Stage 5.

### RED gates
Explicit owner approval is required before:
- production DB migration or production data mutation;
- destructive migration/backfill/reconciliation/deletion;
- production feature-flag/environment activation;
- App Store/Play Store/mobile production release;
- payments/subscriptions/pricing;
- authentication/security model changes;
- public privacy/competitive leaderboard activation;
- destructive/replacement changes to Summit Data Engine;
- removal/replacement/substantial redesign of Progress Mountain or cinematic/live-3D summit transition.

### Protected rules
- Training and Expedition remain distinct journeys.
- Shared primary navigation remains Basecamp, Explore, Track, Community, You.
- Preserve offline-first Start → Track → Pause → Resume → Finish → Save.
- Preserve the 21,576-mountain Summit Data Engine and stable identities.
- Preserve Progress Mountain elevation fill and summit → cinematic/live-3D transition.
- Real Summit, Expedition Completion and Mountain Simulation remain distinct.
- GPS activity evidence remains private unless an explicit later product/privacy rule says otherwise.
- Manual/indoor activities must never be silently promoted to GPS verified, real-summit evidence or public competitive evidence.
- No fuzzy deduplication by mountain name, route name, date, distance or elevation.

---

## S4-C01 — Stage 4 preflight and unfinished-foundation audit

Perform a targeted preflight of the exact Stage 4 dependency chain.

Verify:
- S2 manual Training adapter state and flag;
- S2 ExploreHike adapter state and flag;
- tracked-hill canonical bridge behavior;
- canonical links and qualification evaluator;
- canonical history projection;
- Stage 2 ledger schema/code;
- Stage 3 Shared Track completion handoff;
- existing visible elevation totals and their sources;
- existing Training completion/readiness handoff;
- existing Expedition stage completion/progress handoff;
- current challenge/achievement hooks;
- current activity completion screens.

Review 0002_stage2_activity_ledgers.sql against current schema and code. Identify any migration defect, naming mismatch, missing index/constraint, unsafe assumption, or runtime dependency before Stage 4 builds on it.

Do not change production, flags or user-visible behavior.

Deliver docs/STAGE_4_PREFLIGHT.md with a concise dependency map and exact safe implementation sequence.

Result: S4-R01. Continue automatically if COMPLETE.

## S4-C02 — Harden Stage 2 ledger migration and service contracts

Using C01 findings, make any necessary additive corrections to the development-only Stage 2 ledger migration/schema/services.

Requirements:
- owner-safe foreign keys;
- append-only/correction lineage;
- deterministic idempotency;
- one current effective personal elevation credit per activity/rule;
- no double-credit through multiple contexts;
- Expedition contribution remains explicitly simulated;
- correction/revocation supported without deleting evidence;
- migration remains additive/backwards-compatible;
- no production application.

Add/strengthen tests for migration planning and service invariants.

If a destructive schema correction is required, STOP APPROVAL REQUIRED rather than proceeding.

Result: S4-R02.

## S4-C03 — Canonical adapter end-to-end development activation

Prove NEW activity ingestion paths end-to-end in development/test boundaries without production activation.

Cover:
1. GPS tracked hill / Free Hike;
2. Manual Training completion;
3. ExploreHike where distinct from the shared tracker;
4. Training-context GPS hike;
5. Expedition-context GPS hike.

Requirements:
- stable source identity;
- retry does not duplicate;
- changed-payload conflicts are retained/rejected safely;
- one physical tracked hike is reused when linked to several contexts;
- manual evidence remains manual;
- offline/local UUID survives delayed sync;
- owner separation;
- no historical backfill;
- no production flag changes.

Where current adapters are default-off, use explicit test/development activation only. Do not alter production defaults yet.

Result: S4-R03.

## S4-C04 — Elevation Bank calculation and ledger service

Implement the personal Elevation Bank service against the prepared ledger.

Definition:
**Elevation Bank = the user's credited cumulative ascent from eligible physical activities.**

Requirements:
- source is canonical activity + qualification/evidence, not screen-local totals;
- GPS/recorded outdoor ascent may be credited under a versioned rule;
- manual/indoor handling must be explicit and conservative; never public/competitive;
- simulated Expedition target elevation itself is never banked;
- one physical activity credits at most once per active rule version regardless of Training/Expedition/challenge links;
- corrections/revocations change effective totals without deleting history;
- deterministic lifetime and period totals;
- Everest-equivalent calculation uses 8,849m and is display-only;
- no public leaderboard activation;
- tests for duplicate links, retries, corrections, revocations, zero ascent, invalid/untrusted evidence and multi-owner isolation.

Keep existing user-visible totals authoritative until C06.

Result: S4-R04.

## S4-C05 — Activity consequence resolver

Create one post-activity consequence service that evaluates what a completed canonical activity affects.

Possible consequences:
- Elevation Bank credit;
- Training session completion/link;
- readiness impact using EXISTING readiness rules only;
- Expedition stage contribution using EXISTING Expedition rules only;
- challenge/achievement hooks only where existing released logic safely supports them;
- mountain/route completion evidence without creating a Real Summit unless the explicit real-summit rule is satisfied.

Requirements:
- idempotent;
- no duplicate awards on retry;
- consequences are derived from explicit links/qualifications;
- no fuzzy inference;
- preserve legacy calculations where canonical replacement is not yet proven equivalent;
- return a structured summary suitable for an activity completion screen;
- tests for Training-only, Expedition-only, Free Hike, multi-context, manual and untrusted cases.

Result: S4-R05.

## S4-C06 — Elevation Bank user experience

Add the first user-facing personal Elevation Bank experience using the new service only when its development/runtime dependency is safely available.

Primary presentation:
- lifetime credited elevation;
- current month credited elevation where dates permit;
- Everest equivalent;
- recent credited activities/corrections where useful;
- clear empty/loading/error states.

Integrate into an appropriate existing surface (prefer You/Profile and/or completion summary) without adding a new primary navigation tab.

Design direction:
- premium outdoor achievement feel;
- one dominant number;
- restrained supporting metrics;
- avoid generic finance/dashboard styling;
- no public rank/leaderboard;
- distinguish recorded ascent from simulated Expedition elevation.

If production schema is required to make this live, implement the UI/service boundary with a safe unavailable/fallback state and leave production activation behind the RED gate.

Result: S4-R06.

## S4-C07 — Premium activity completion experience

Create/refine the post-hike completion experience around one physical activity and its consequences.

Target hierarchy:
1. activity/mountain/route completion title;
2. distance, ascent, duration;
3. **+Xm Elevation Bank** and updated lifetime total when eligible;
4. Training consequence/readiness impact when applicable;
5. Expedition progress/stage consequence when applicable;
6. existing challenge/achievement consequence when safely available;
7. Share / View Activity actions where existing functionality supports them.

Example information architecture only:
TRYFAN COMPLETE
704m climbed · 6.4km · 2h51
+704m ELEVATION BANK
Lifetime 47,280m · Everest 5.3×
Training session complete
Everest Expedition 3,821 / 8,849m · 43%

Requirements:
- never fabricate consequence values;
- hide sections with no valid consequence;
- do not call simulated Expedition completion a real summit;
- do not alter protected summit cinematic behavior;
- offline completion must still succeed; consequences that require sync can show pending/sync-safe state;
- preserve existing save/retry behavior;
- no network requirement to finish/save;
- accessibility and small-screen handling.

Result: S4-R07.

## S4-C08 — Canonical history/read projection integration

Integrate the canonical read projection into user-facing private history where equivalence has been demonstrated.

Requirements:
- one physical activity appears once in All;
- filters/labels can expose Training, Expedition and Free Hike purposes without duplicating the activity;
- preserve access to legacy records not yet canonicalized;
- no destructive historical reconciliation;
- do not hide old activities simply because they lack canonical IDs;
- clear evidence/status labels where useful;
- safe fallback to legacy projection if canonical dependency unavailable;
- compare totals/counts before switching any existing consumer.

If equivalence cannot be proven, leave the new projection shadowed and document the mismatch rather than forcing a switch.

Result: S4-R08.

## S4-C09 — Stage 4 development migration + activation readiness gate

Perform the final non-production readiness review for 0002 and all Stage 4 dependencies.

Required checks:
- migration analyzer/diff if available;
- development/test application path;
- rollback/recovery assumptions;
- adapter flags;
- canonical bridge flag;
- API compatibility;
- mobile compatibility;
- zero historical backfill;
- no production data mutation;
- duplicate-credit and owner-isolation tests;
- offline delayed-sync test;
- Expedition simulation/real-summit separation;
- SDE/protected Progress Mountain boundaries.

Produce docs/STAGE_4_PRODUCTION_READINESS.md containing:
- exact production migration statements/artifact;
- exact flags/config that would need activation, with recommended order;
- expected tables/indexes/constraints;
- preflight queries/checks;
- post-migration verification checks;
- rollback/recovery strategy;
- whether a new mobile build would ultimately be required;
- any known blocker.

DO NOT apply production migration or production flags.

If Stage 4 cannot function safely without applying production schema before C10, record APPROVAL REQUIRED and stop.

Result: S4-R09.

## S4-C10 — Stage 4 regression/completion gate

Run a bounded integration/regression pass.

Verify:
- one physical activity remains one canonical activity;
- retry cannot duplicate activity or Elevation Bank credit;
- multi-context activity does not double-credit;
- offline Start/Pause/Resume/Finish/Save remains intact;
- completion can succeed without network;
- Training calculations are unchanged except intentional presentation/integration;
- Expedition calculations are unchanged except intentional presentation/integration;
- simulated Expedition progress cannot create a Real Summit;
- manual/indoor/untrusted evidence boundaries hold;
- canonical/legacy history coexist safely;
- SDE unchanged;
- Progress Mountain/cinematic/live-3D unchanged;
- no production migration/flag/release/payment/auth/public-privacy change occurred.

Run relevant targeted tests/builds and the smallest meaningful integration suite.

Create docs/STAGE_4_COMPLETION_REPORT.md summarizing:
- delivered functionality;
- tests/builds;
- protected-boundary verification;
- remaining feature flags;
- pending production migration;
- native-device QA needs;
- exact RED-gate actions awaiting owner approval;
- Stage 5 prerequisites.

Update AI_HANDOFF.md and AI_CHANGELOG.md, commit/push, and STOP.

Result: S4-R10 — COMPLETE / PARTIAL / BLOCKED / FAILED / APPROVAL REQUIRED.

### Stage 4 completion rule

Stage 4 implementation may be marked COMPLETE with production activation still pending, provided:
- all code and development/test verification is complete;
- production changes are explicitly documented and unapplied;
- released behavior remains safe/backwards-compatible;
- no RED gate was crossed.

Do not begin Stage 5.
