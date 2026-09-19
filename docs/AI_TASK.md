# SummitReady AI Task — Production Activation Gate A

## PA-A — Apply and verify Stage 2 ledger schema only

Owner approval has been given for this narrowly bounded RED-gate action: apply the already-reviewed additive migration `lib/db/migrations/0002_stage2_activity_ledgers.sql` to the SummitReady **production database**, using the normal controlled Replit production database/publish mechanism.

This approval is for **schema migration only**. It does NOT approve production feature activation, data backfill, consumer switching, mobile release, Stage 5, or any other RED-gate action.

### Objective

Safely make the Stage 2/Stage 4 ledger schema available in production while leaving all new runtime functionality disabled.

Expected additive objects:
- `personal_elevation_credit_events`
- `personal_elevation_credit_corrections`
- `expedition_runs`
- `expedition_stage_contributions`
- `expedition_contribution_corrections`
- required additive canonical owner/id index and reviewed indexes/constraints from migration 0002.

Expected initial ledger row count: **zero**. Do not populate them.

### Mandatory preflight — PA-A-C01

Before changing production:

1. Confirm the target is the actual SummitReady production database.
2. Confirm the exact migration blob/content is the reviewed current `0002_stage2_activity_ledgers.sql`; do not regenerate it.
3. Confirm backup/PITR is enabled and record a non-secret verification in the handoff/changelog.
4. Perform read-only schema inspection and confirm there is no conflicting/destructive pending schema operation bundled with this action.
5. Record current counts of existing canonical/legacy activity tables needed to prove no data loss, without exposing private activity payloads.
6. Confirm all Stage 2/Stage 4 production flags remain unset/false and that current code still hard-rejects production ledger writes/history activation.
7. Do not use `push-force`, destructive schema synchronization, table recreation, truncate/delete, backfill or reconciliation.

If any preflight condition is not satisfied, STOP with **BLOCKED** or **APPROVAL REQUIRED** and make no production change.

Result: PA-A-R01.

### Migration — PA-A-C02

Only after C01 passes, apply **only** the reviewed additive migration 0002 through the controlled production database migration/publish path.

Rules:
- no edits to migration during application;
- no unrelated schema changes;
- no backfill;
- no feature flags;
- no application/runtime activation;
- no data cleanup;
- no release/store action.

If the controlled mechanism attempts to include unrelated/destructive changes, abort before applying and report **APPROVAL REQUIRED**.

Result: PA-A-R02.

### Post-migration verification — PA-A-C03

Immediately perform read-only verification:

- all five expected ledger tables exist;
- expected PKs, owner-safe composite FKs, status/evidence/simulated checks, lineage constraints, unique identities, lookup indexes and effective-revision indexes exist;
- `canonical_activities(owner_user_id,id)` unique index exists as reviewed;
- each new ledger table contains exactly **0 rows**;
- pre-existing canonical/legacy row counts match the preflight baseline;
- no historical activity was modified/backfilled;
- no unexpected production schema object was changed;
- production feature flags remain disabled/unset;
- production runtime still follows the existing safe legacy/unavailable path;
- perform the smallest safe production health check; do not create test activity data.

If verification differs from expectation, do not attempt destructive repair. Stop and report the exact discrepancy.

Result: PA-A-R03.

### Documentation and stop — PA-A-C04

Update:
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`
- create `docs/PRODUCTION_ACTIVATION_GATE_A_REPORT.md`

Report:
- target/environment verification (no secrets);
- migration identity/hash or Git blob;
- backup/PITR confirmation;
- before/after non-sensitive row-count evidence;
- tables/indexes/constraints verified;
- production health result;
- confirmation that no flags/backfill/runtime activation occurred;
- any discrepancy or follow-up prerequisite.

Commit and push documentation/code state if documentation changed.

Then **STOP**.

Final status must be one of:
**COMPLETE / PARTIAL / BLOCKED / FAILED / APPROVAL REQUIRED**

### Explicitly NOT authorised

Do not:
- remove the production hard gates;
- set `STAGE2_LEDGER_ENABLED`;
- enable canonical Manual Training or ExploreHike adapters;
- enable/switch canonical history;
- backfill or reconcile old activities;
- write ledger/activity test rows to production;
- modify/delete existing user data;
- start Stage 5;
- build/release mobile;
- change auth, payments, subscriptions or privacy;
- change Summit Data Engine data/identity;
- change Progress Mountain or cinematic/live-3D summit experience.

This authorization expires when PA-A-C04 is reached or any blocker occurs.
