# SummitReady AI Task — Stage 2 Master Runbook

## S2-MASTER — Unified Training/Expedition Activity Foundation

Stage 2 is approved as a complete bounded development stage. Replit may work sequentially through the commands below in one active Agent session without waiting for the owner between GREEN commands.

S2-R01 architecture audit is COMPLETE and ACCEPTED.

### Operating protocol
- Execute commands strictly in order.
- Before each command, verify the previous command's tests/checks passed.
- Record each result as S2-R02, S2-R03, etc. in AI_CHANGELOG.md and keep AI_HANDOFF.md current.
- Commit after each meaningful command/checkpoint so rollback remains easy.
- Use normal/default Agent effort and targeted repository inspection. Do not repeatedly re-audit the whole repo. Keep credit use economical.
- If a command becomes materially larger than expected, split it internally into small tested commits without changing its intended scope.
- Continue automatically through GREEN commands while the active Agent session remains available.
- Stop immediately with APPROVAL REQUIRED for any RED gate listed below.
- If a non-destructive implementation detail is ambiguous, choose the safest additive/backwards-compatible option, document it, test it, and continue.

### RED gates — stop for owner approval
Do not perform any of these during this master run:
- production database migration or production data mutation;
- destructive schema/data migration, backfill, deletion or reconciliation;
- mobile/store release or publishing;
- payment, subscription/pricing or authentication changes;
- replacement/destructive alteration of the 21,576-mountain Summit Data Engine;
- removal/replacement/substantial redesign of Progress Mountain or the 3D/cinematic summit transition;
- enabling public competitive leaderboards or changing public user-data visibility.

Development-only additive schema preparation is allowed only if it is backwards-compatible, reviewed by the Agent's migration/diff tooling, and NOT applied to production.

### Protected product rules
- Training and Expeditions remain distinct experiences.
- Training = real target mountain, readiness and personalised preparation.
- Expedition = simulated famous-mountain adventure using local hills/routes and staged progress.
- Free Hike remains a general activity origin/context.
- One physical activity should have one canonical owner-scoped activity record and may have multiple links/qualifications.
- Real Summit, Expedition Completion and Mountain Simulation are never equivalent.
- Existing Summit Data Engine is the geographic foundation and must be referenced, not duplicated.
- Existing Progress Mountain elevation fill and summit → cinematic/live-3D climber experience must be preserved.

---

## S2-C02 — Canonical contracts and stable IDs

Implement central typed contracts/helpers for canonical source namespaces, namespaced SDE link targets, evidence classifications and adapter interfaces.

Requirements:
- preserve all existing Phase 1 source_type/source_id values;
- stable source IDs must never derive from names/date/distance/elevation;
- support tracked_hill_session, training_manual, explore_hike and extensible provider/import sources;
- define/validate SDE mountain and route references without changing SDE;
- classify gps_recorded, estimated_manual, indoor_training, unavailable_untrusted while mapping compatibly to existing evidence storage;
- deterministic unit tests for formatting/parsing/validation/invalid IDs/SDE refs/idempotent identity generation;
- no runtime behavior switch, DB migration or production change.

Result: S2-R02. Continue automatically if COMPLETE.

## S2-C03 — Manual Training canonical adapter

Add stable idempotent identity and canonical ingestion for NEW manual Training completions.

Requirements:
- preserve existing legacy Training write/response behavior;
- dual-write/add canonical ingestion transactionally or via the safest existing Phase 1 pattern;
- use training_manual stable completion identity;
- evidence remains estimated/manual and cannot become GPS verified or publicly competitive;
- link to training plan/session where explicit IDs exist;
- retrying the same completion must not create another canonical activity or downstream award;
- feature flag/default-off if runtime activation would otherwise change released behavior;
- no historical backfill;
- tests for retry/idempotency, owner separation, changed-payload conflict, evidence classification and legacy compatibility.

Result: S2-R03. Continue automatically if COMPLETE.

## S2-C04 — Free Hike / ExploreHike canonical adapter

Canonicalize NEW Free Hike/ExploreHike records using stable IDs without fuzzy deduplication.

Requirements:
- reuse an existing canonical activity when the same tracked physical hike already has a stable canonical identity;
- otherwise ingest once under explore_hike stable source identity;
- never dedupe by name/date/distance/elevation;
- preserve local/offline behavior and existing user-facing history;
- explicit hill/route/SDE links only when stable identity is known;
- no historical backfill;
- feature-flag runtime changes where appropriate;
- tests for offline/local ID stability, retries, owner separation, and no accidental duplicate activity creation.

Result: S2-R04. Continue automatically if COMPLETE.

## S2-C05 — Idempotent contribution-link service

Create the service layer that attaches an existing canonical activity to multiple purposes without copying the activity.

Support at minimum:
- training_plan;
- training_session;
- expedition;
- expedition_stage;
- canonical_hill/canonical_route where already valid;
- SDE mountain/route namespaced targets;
- challenge link contract, without implementing challenge progression.

Requirements:
- links idempotent with stable uniqueness;
- validate target namespace/type;
- prevent simulation links from implying real summit completion;
- preserve current UI/calculations;
- tests for one activity carrying multiple links, retries and invalid targets.

Result: S2-R05. Continue automatically if COMPLETE.

## S2-C06 — Qualification evaluator foundation

Implement versioned qualification evaluation as additive/read-only output first.

Purposes:
- personal_history;
- readiness;
- personal_elevation;
- expedition_progress;
- real_summit_evidence;
- challenge_eligibility;
- future competitive elevation vocabulary only, not public ranking behavior.

Requirements:
- explicit evidence class and reason codes;
- deterministic rule version;
- GPS/manual/indoor/untrusted boundaries from S2-R01;
- existing readiness/elevation/Expedition calculations remain authoritative;
- evaluator may shadow-compare but must not change visible values;
- idempotent evaluation and superseded/revoked semantics where existing schema safely permits; if schema support is insufficient, prepare additive development-only schema and stop before any production migration;
- tests covering accepted/rejected/manual/indoor/untrusted cases.

Result: S2-R06. If a production migration is required to continue, stop as APPROVAL REQUIRED. Otherwise continue.

## S2-C07 — Personal Elevation Bank foundation

Create the additive personal Elevation Bank ledger/projection architecture.

Requirements:
- immutable/idempotent credit events tied to canonical activity;
- credited ascent distinct from recorded/validated/planned/simulated elevation;
- rule version and correction/revocation semantics;
- personal only; no public/competitive leaderboard activation;
- prevent double credit when one activity has multiple contexts;
- existing visible elevation totals remain unchanged unless a shadow comparison can be added safely;
- development-only additive schema is permitted; DO NOT apply it to production;
- tests for double-credit prevention, correction/revocation and mixed evidence.

Result: S2-R07. Continue if no RED gate is required.

## S2-C08 — Expedition run/stage contribution ledger

Add durable, additive Expedition contribution records while preserving current Expedition behavior.

Requirements:
- run/stage identity;
- contributing canonical activity ID;
- accepted metric/elevation;
- rule/score version;
- explicit simulated-completion semantics;
- idempotent contribution;
- one physical activity may contribute only according to defined stage rules;
- absolutely no inference of a real summit;
- do not alter Progress Mountain, stage UI/calculation output or 3D/cinematic summit code;
- existing Expedition system remains authoritative while new ledger shadow-records/compares where safe;
- development-only additive schema allowed; no production migration.

Result: S2-R08. Continue if COMPLETE.

## S2-C09 — Canonical read projections / compatibility layer

Build server/service projections capable of supplying unified private activity history while preserving existing screens.

Requirements:
- projections/filters for All, Training, Expeditions, Mountains/Free Hike where data exists;
- avoid duplicate display of one physical activity with several purposes;
- Training History, Recent Activity and Expedition Journal are not redesigned in this stage;
- compare canonical projection against legacy sources and report mismatches;
- do not switch production/user-facing consumers unless equivalence is demonstrably safe and requires no release; otherwise leave behind the compatibility layer for Stage 3;
- tests for multi-link activity appearing once in All and appropriately in filtered contexts.

Result: S2-R09. Continue if COMPLETE.

## S2-C10 — Stage 2 integration/regression pass

Perform a bounded Stage 2 integration review.

Verify:
- existing GPS tracked-hill bridge still works;
- offline Start/Track/Pause/Resume/Finish/Save architecture is not regressed;
- manual Training and ExploreHike adapters are idempotent;
- one activity can safely support Training + Expedition + challenge/SDE links;
- qualification boundaries do not promote manual/indoor data to competitive or real-summit evidence;
- Elevation Bank cannot double credit;
- Expedition contributions cannot create real summits;
- SDE catalogue/pipeline/data remain unchanged;
- Progress Mountain/3D summit protected files/behavior remain unchanged;
- released API contracts remain backwards-compatible.

Run targeted suites plus the relevant canonical integration tests. Do not create a mobile build or deploy.

Create docs/STAGE_2_COMPLETION_REPORT.md summarizing implementation, tests, schema prepared-but-not-published, feature flags, known issues, and any Stage 3 prerequisites.

Result: S2-R10.

### Stage 2 completion gate
After S2-R10:
- update AI_HANDOFF.md and AI_CHANGELOG.md;
- commit/push all work;
- mark Stage 2 COMPLETE only if every command R02–R10 is COMPLETE or explicitly documented as safely deferred without undermining the foundation;
- list any development schema changes that still require production approval;
- STOP. Do not begin Stage 3.
