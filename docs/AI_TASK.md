# SummitReady AI Task — Production Activation Gate A2

## PA-A2 — Seed reviewed ledger schema into development, then re-run production Publish preflight

PA-A correctly stopped because Replit Publish compares production against the development database, and neither database currently contains the five Stage 2 ledger tables. Publish therefore reports an empty diff.

The owner now explicitly approves the **development-database-only** application of the exact already-reviewed migration artifact so that the controlled Publish mechanism can generate a production diff.

This does NOT yet authorize applying that generated diff to production.

Reviewed artifact identity from PA-A:
- file: `lib/db/migrations/0002_stage2_activity_ledgers.sql`
- Git blob: `e8848dfc4592390b6040d2c7e2a82d949f0a7be1`
- SHA-256: `f2aeccb3cda06c663789c14b2b908c1b095f55d5143ddeb68b852e66396e6c69`

Expected five tables:
- `personal_elevation_credit_events`
- `personal_elevation_credit_corrections`
- `expedition_runs`
- `expedition_stage_contributions`
- `expedition_contribution_corrections`

## PA-A2-C01 — Reconfirm artifact and development target

Before mutation:
1. Confirm the migration file still matches BOTH the Git blob and SHA-256 above.
2. Confirm target is the managed SummitReady **development** database, not production.
3. Read-only confirm the five ledger tables are still absent from development.
4. Record non-sensitive baseline counts for `canonical_activities` and `tracked_hill_sessions`.
5. Confirm the operation will execute only the reviewed additive migration and no unrelated schema synchronization.
6. Do not use push-force.

If any check fails, STOP BLOCKED/APPROVAL REQUIRED.

## PA-A2-C02 — Apply exact migration to development only

Apply the exact reviewed `0002_stage2_activity_ledgers.sql` artifact to the development database using the controlled development migration process.

No edits, regeneration, backfill, test rows, cleanup, feature flags, production operation, consumer switch, or release.

Immediately verify:
- all five tables exist;
- reviewed PKs/FKs/checks/indexes exist;
- new ledger tables contain zero rows;
- existing baseline counts are unchanged;
- no unrelated/destructive schema change occurred.

If verification fails, do not destructively repair. STOP and report.

## PA-A2-C03 — Re-run Publish analyzer, but DO NOT publish

After development verification, run the controlled Replit Publish schema analyzer against production.

Expected result: an additive production diff corresponding to migration 0002.

Inspect and record every proposed production statement/class of statement. Verify:
- it creates only the reviewed ledger schema/index/constraint additions;
- it contains no DROP/TRUNCATE/DELETE/data rewrite/destructive alteration;
- it does not modify or backfill existing user rows;
- no unrelated schema change is bundled;
- production flags remain unset.

**DO NOT click/execute Publish and DO NOT apply the production diff in PA-A2.**

If the analyzer is still empty, differs materially from 0002, or contains unrelated/destructive work, STOP BLOCKED/APPROVAL REQUIRED.

## PA-A2-C04 — Report and stop for production approval

Create/update:
- `docs/PRODUCTION_ACTIVATION_GATE_A2_REPORT.md`
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`

Include:
- development artifact/target verification;
- before/after non-sensitive counts;
- development schema verification;
- exact Publish analyzer summary for production;
- destructive-change assessment;
- confirmation production is unchanged;
- exact next production action that would be required.

Commit and push documentation.

Then STOP with **APPROVAL REQUIRED** if the generated production diff is clean and ready for owner approval, otherwise BLOCKED/FAILED as appropriate.

## Explicitly not authorised

Do not:
- apply any schema change to production;
- publish/deploy production;
- set Stage 2/4 flags;
- remove production hard gates;
- backfill/reconcile activity history;
- activate canonical history or adapters;
- create test activity/ledger rows in production;
- start Stage 5;
- build/release mobile;
- change auth/payments/privacy;
- alter Summit Data Engine identities/data;
- alter Progress Mountain or cinematic/live-3D summit behavior.
