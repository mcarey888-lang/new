# Stage 4 production readiness review

**Review:** S4-C09  
**Date:** 2026-09-19 UTC  
**Branch:** `virtual-expeditions-mode`  
**Decision:** **Not ready for production migration or activation. C10 may proceed in the bounded, non-production mode described below.**

## Scope and red-gate result

This is a static and non-production readiness review of Stage 2 migration
`lib/db/migrations/0002_stage2_activity_ledgers.sql` and its Stage 4
dependencies. No SQL migration was applied, no production flag was set, no
production database was accessed or mutated, no historical backfill or
reconciliation was performed, and no release or mobile build was made.

Production migration and production activation remain pending explicit owner
approval. The migration is an artifact for a later controlled operation, not a
deployment instruction for this task.

## Required-check evidence and results matrix

The status below distinguishes a completed safe check from an intentionally
unrun operation. No row marked NOT RUN is being represented as a database or
production verification.

| Required check | Status | Exact command / evidence | Bounded interpretation |
|---|---|---|---|
| API compatibility and production build | **PASS** | `pnpm --filter @workspace/api-server run build` | API bundle compiles; this does not prove production schema availability. |
| Canonical adapter/bridge compatibility | **PASS** | `pnpm --filter @workspace/api-server exec vitest run src/__tests__/canonicalActivityContracts.test.ts src/__tests__/canonicalActivityLinks.test.ts src/__tests__/canonicalActivityDevelopmentActivation.test.ts` (also included in the seven-file focused run) | Development harness, identity, links, retries, delayed UUID, and owner boundaries pass; no production activation is implied. |
| Duplicate-credit and owner isolation | **PASS** | `pnpm --filter @workspace/api-server exec vitest run src/__tests__/stage2LedgerPlanning.test.ts src/__tests__/elevationBank.test.ts src/__tests__/canonicalActivityDevelopmentActivation.test.ts` (covered by the seven-file focused run) | Pure/planning and injected-harness evidence only; no DB integration claim. |
| Offline delayed-sync and local UUID | **PASS** | `pnpm --filter @workspace/summit-ready exec vitest run utils/reliability.test.ts utils/canonicalHistoryProjection.test.ts utils/trackingLaunchContext.test.ts`; `canonicalActivityDevelopmentActivation.test.ts` delayed-UUID case — 31 mobile tests and API harness coverage | Local outbox ownership and delayed UUID behavior are covered; no network or production sync was exercised. |
| Expedition simulation versus Real Summit | **PASS** | `activityConsequences.test.ts`, `stage2LedgerPlanning.test.ts`, and `canonicalActivityDevelopmentActivation.test.ts` in the API focused command — 77 tests total | Contributions are explicitly simulated-only; pure contracts do not prove a deployed route or database row. |
| Mobile presentation/history behavior | **PASS** | Mobile command above — `canonicalHistoryProjection.test.ts` plus reliability/tracking tests, 31 passed | Projection preserves legacy-only rows and unavailable behavior in pure utilities; no consumer switch or visual release evidence. |
| Mobile TypeScript compatibility | **PASS** | `pnpm --filter @workspace/summit-ready run typecheck` | Source typecheck passes; this is not a native build artifact. |
| Migration static scan/schema contract | **PASS** | `pnpm --filter @workspace/api-server exec vitest run src/__tests__/stage2LedgerPlanning.test.ts`; `grep -En '^[[:space:]]*(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b' lib/db/migrations/0002_stage2_activity_ledgers.sql` (no output); `grep -E '^CREATE (TABLE|UNIQUE INDEX|INDEX)' ...` (21 statements); `pnpm --filter @workspace/db exec tsc --noEmit --pretty false` | Migration names/checks/no-destructive statements and Drizzle types are checked without applying schema. |
| Development/test migration application path | **NOT RUN** | No `push`, `push-force`, direct SQL, migration runner, or DB connector was used. | Intentionally not run in C09; the path is documented for a disposable dev DB only and is not a schema-application result. |
| Adapter flag semantics | **PASS** | Static inspection of `manualTrainingCanonicalAdapter.ts`, `exploreHikeCanonicalAdapter.ts`, and `canonicalActivityDevelopmentActivation.ts`; `canonicalActivityDevelopmentActivation.test.ts` in the focused API run | Adapter-specific flags are opt-in; the development activation wrapper requires test/development and cannot activate production. |
| Canonical bridge flag semantics | **PASS** | Static inspection of `canonicalActivity.ts`; `canonicalActivityContract.test.ts` and `stage2LedgerPlanning.test.ts` in the focused API run | `CANONICAL_ACTIVITY_BRIDGE_ENABLED=true` is an explicit bridge opt-in, but it does not bypass schema availability or authorize a release. |
| Drizzle analyzer/diff | **NOT RUN** | Attempted `pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts`; it exited before analysis because `drizzle.config.ts` requires `DATABASE_URL` and reported missing AWS Data API `database` (`secretArn: 'postgresql'`). | No database connection was made. A disposable dev DB could use `pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts` or `push` only after supplying that DB URL; never use `push-force` for production. |
| Read-only post-migration catalog verification | **NOT RUN** | Queries are catalogued below but intentionally not executed. | Correct by design: Stage 2 schema is unapplied and no DB access is permitted in C09. |
| Zero historical backfill — SQL inspection | **PASS** | Destructive/data-statement scan of `lib/db/migrations/0002_stage2_activity_ledgers.sql`; no `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, or `INSERT` statements | The artifact cannot backfill rows; this is static evidence only. |
| Zero ledger rows — row-level verification | **NOT RUN** | Five-table count query is catalogued below and intentionally not executed. | No row-level database result is claimed because the migration is unapplied and DB access is prohibited. |
| No production data mutation — C09 operation record | **PASS** | C09 operation record: no DB connector, SQL, migration, flag, backfill, reconciliation, or release was used; `git diff --check` passed | The C09 agent performed no production mutation. |
| No production data mutation — production DB verification | **NOT RUN** | No production connection or read-only production query was made. | C09 does not claim current production contents; operational verification requires a later approved read-only check. |
| Rollback/recovery assumptions | **PASS** | Static review of configuration rollback, append-only correction lineage, PITR/backup prerequisites, and the no-reverse-apply rule documented below | Documentation-level readiness only; no rollback drill, backup restore, or production recovery was run. |
| Production migration/activation | **NOT RUN** | No migration tool, SQL, production connection, flag, backfill, or release was used. | **PARTIAL readiness only:** migration application is NOT RUN by design, not a failed check. |
| Mobile build/release artifact | **NOT RUN** | No Expo/native build or store release was performed. | **YES:** Stage 4 mobile code changes require a new tested mobile build/release artifact before shipping. Store release remains a RED gate and is not done. |
| Protected boundaries | **PASS** | Static changed-file review (`git diff --name-only HEAD`), focused API tests above, and source inspection of SDE/Progress Mountain/cinematic boundaries | No protected asset changes were made; static review is not a production deployment proof. |
| C10 safety determination | **PASS** | This review plus explicit default-off/unavailable gates in `stage2Ledgers.ts`, `canonical-history.ts`, and `canonicalActivityDevelopmentActivation.ts` | C10 can run default-off without schema; it must not cross a RED gate. |

The API focused command completed **77/77** tests across seven files; the
mobile focused command completed **31/31** tests across three files. The DB
TypeScript command produced no diagnostics. These are source/test results,
not DB integration results.

## Protected-boundary findings

- **Summit Data Engine:** The protected dataset and mountain/route IDs are
  unchanged. The C09 static changed-file review (`git diff --name-only HEAD`)
  contains only the coordination documents; no SDE data or schema file is
  changed by this review.
- **Progress Mountain:** Unchanged. No Progress Mountain calculation,
  persistence, or protected visual component is in the C09 diff.
- **Summit cinematic/live-3D:** Unchanged. No cinematic transition, live-3D
  asset, or rendering path is in the C09 diff.
- **Expedition versus Real Summit:** `activityConsequences.test.ts`,
  `stage2LedgerPlanning.test.ts`, and
  `canonicalActivityDevelopmentActivation.test.ts` pass in the focused API
  run. They assert explicit simulated-only Expedition contributions and
  `simulated_completion = TRUE`; the planner cannot turn a contribution into
  Real Summit evidence. This is source/test evidence, not a claim that a
  production contribution row exists.

## Migration artifact and exact operation inventory

The reviewed artifact is exactly:

`lib/db/migrations/0002_stage2_activity_ledgers.sql`

It contains only additive `CREATE ... IF NOT EXISTS` statements:

1. Create unique owner/activity index
   `canonical_activities_owner_id_uidx` on
   `canonical_activities(owner_user_id, id)`.
2. Create `personal_elevation_credit_events`, including its primary key,
   owner/activity composite foreign key, status/evidence/metric/revision/
   correction checks, and identity, lineage, activity, effective, and rule
   indexes.
3. Create `expedition_runs`, including its primary key, active/completed/
   revoked status check, owner/run and owner/id unique indexes, and
   owner/expedition index.
4. Create `expedition_stage_contributions`, including owner/run and
   owner/activity composite foreign keys, accepted/revoked/corrected status,
   non-negative metric/elevation checks, mandatory `simulated_completion = TRUE`,
   revision/correction checks, identity/lineage/run-stage/activity/effective
   indexes.
5. Create `personal_elevation_credit_corrections`, including current/prior
   owner-safe composite foreign keys, revision-order check, and unique
   current/prior event index.
6. Create `expedition_contribution_corrections`, including current/prior
   owner-safe composite foreign keys, revision-order check, and unique
   current/prior contribution index.

For an exact statement-level inventory, the artifact contains **21** create
statements: 5 table statements and these 16 index statements:

```text
canonical_activities_owner_id_uidx
personal_elevation_credit_events_identity_uidx
personal_elevation_credit_events_lineage_uidx
personal_elevation_credit_events_activity_idx
personal_elevation_credit_events_effective_idx
personal_elevation_credit_events_rule_idx
expedition_runs_owner_run_uidx
expedition_runs_owner_id_uidx
expedition_runs_owner_expedition_idx
expedition_stage_contributions_identity_uidx
expedition_stage_contributions_lineage_uidx
expedition_stage_contributions_run_stage_idx
expedition_stage_contributions_activity_idx
expedition_stage_contributions_effective_idx
personal_elevation_credit_corrections_uidx
expedition_contribution_corrections_uidx
```

The SQL contains no `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`, backfill,
or data-copy statement. `ON DELETE RESTRICT` protects ledger history and
lineage. The Drizzle contract in
`lib/db/src/schema/stage2-activity-ledgers.ts` matches the reviewed tables,
constraints, foreign keys, and indexes, including the deliberate
`simulated_completion` invariant.

## Expected objects after a later approved application

Expected tables:

- `personal_elevation_credit_events`
- `expedition_runs`
- `expedition_stage_contributions`
- `personal_elevation_credit_corrections`
- `expedition_contribution_corrections`

Expected index families include the owner/activity identity index on
`canonical_activities`; owner-scoped run identity and expedition lookup;
event/contribution identity, lineage, activity/run-stage, effective-revision,
and rule indexes; and correction-pair uniqueness indexes. Expected foreign keys
are owner-composite keys to `canonical_activities`, owner-composite keys from
contributions to `expedition_runs` and `canonical_activities`, and
owner/identity/revision-composite keys between each correction table and its
current/prior ledger events. All ledger and lineage deletes are restricted.

The objective acceptance criteria for a later catalog check are:

- exactly **5** Stage 2 tables;
- exactly **16** migration-created indexes (including the prerequisite
  `canonical_activities_owner_id_uidx`);
- exactly **21** named check/foreign-key constraints, plus exactly **5**
  primary-key constraints (one per table);
- exactly **5** zero-row counts, one for each ledger table.

The count of 21 named check/foreign-key constraints is verified from the
migration artifact before documenting this criterion: `grep -o
'CONSTRAINT "[^"]*"' lib/db/migrations/0002_stage2_activity_ledgers.sql |
wc -l` returned **21**. The five primary keys are implicit table primary keys
and are not included in that count.

## Later approved read-only SQL catalog

The following PostgreSQL statements are an operational catalog for a later
approved target connection. They are **SELECT-only**, contain no connection
string, and were **not run in C09**. Replace the target connection outside the
repository using the approved disposable/development or production read-only
procedure; never paste credentials into this document.

```sql
-- Target identity and five expected Stage 2 tables.
SELECT current_database() AS database_name, current_user AS database_user;
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'personal_elevation_credit_events',
    'expedition_runs',
    'expedition_stage_contributions',
    'personal_elevation_credit_corrections',
    'expedition_contribution_corrections'
  )
ORDER BY table_name;

-- The owner/activity prerequisite plus all 16 migration-created indexes.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'canonical_activities_owner_id_uidx',
    'personal_elevation_credit_events_identity_uidx',
    'personal_elevation_credit_events_lineage_uidx',
    'personal_elevation_credit_events_activity_idx',
    'personal_elevation_credit_events_effective_idx',
    'personal_elevation_credit_events_rule_idx',
    'expedition_runs_owner_run_uidx',
    'expedition_runs_owner_id_uidx',
    'expedition_runs_owner_expedition_idx',
    'expedition_stage_contributions_identity_uidx',
    'expedition_stage_contributions_lineage_uidx',
    'expedition_stage_contributions_run_stage_idx',
    'expedition_stage_contributions_activity_idx',
    'expedition_stage_contributions_effective_idx',
    'personal_elevation_credit_corrections_uidx',
    'expedition_contribution_corrections_uidx'
  )
ORDER BY indexname;

-- All named Stage 2 checks and owner-safe foreign keys.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'c' THEN 'check'
    WHEN 'f' THEN 'foreign_key'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND con.conname IN (
    'personal_elevation_credit_events_activity_owner_fk',
    'chk_personal_elevation_credit_status',
    'chk_personal_elevation_credit_evidence',
    'chk_personal_elevation_credit_metric',
    'chk_personal_elevation_credit_revision',
    'chk_personal_elevation_credit_correction',
    'chk_expedition_run_status',
    'expedition_stage_contributions_run_owner_fk',
    'expedition_stage_contributions_activity_owner_fk',
    'chk_expedition_contribution_status',
    'chk_expedition_contribution_metric',
    'chk_expedition_contribution_elevation',
    'chk_expedition_contribution_simulated',
    'chk_expedition_contribution_revision',
    'chk_expedition_contribution_correction',
    'personal_elevation_credit_corrections_current_owner_fk',
    'personal_elevation_credit_corrections_prior_owner_fk',
    'chk_personal_elevation_credit_correction_order',
    'expedition_contribution_corrections_current_owner_fk',
    'expedition_contribution_corrections_prior_owner_fk',
    'chk_expedition_contribution_correction_order'
  )
ORDER BY table_name, constraint_name;

-- All five expected primary keys; acceptance requires exactly five rows.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND con.contype = 'p'
  AND c.relname IN (
    'personal_elevation_credit_events',
    'expedition_runs',
    'expedition_stage_contributions',
    'personal_elevation_credit_corrections',
    'expedition_contribution_corrections'
  )
ORDER BY table_name;

-- Explicit simulated-only invariant.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND con.conname = 'chk_expedition_contribution_simulated';

-- Required zero-row baseline; one row is returned per expected ledger table.
SELECT 'personal_elevation_credit_events' AS table_name,
       count(*) AS row_count FROM personal_elevation_credit_events
UNION ALL
SELECT 'expedition_runs', count(*) FROM expedition_runs
UNION ALL
SELECT 'expedition_stage_contributions', count(*) FROM expedition_stage_contributions
UNION ALL
SELECT 'personal_elevation_credit_corrections', count(*) FROM personal_elevation_credit_corrections
UNION ALL
SELECT 'expedition_contribution_corrections', count(*) FROM expedition_contribution_corrections
ORDER BY table_name;
```

The final query is read-only but intentionally references the expected tables,
so it must only be used after the migration has been applied to the approved
target. C09 makes no claim about its results.

## Configuration and activation gates

These controls have different production semantics. In particular, setting
`STAGE2_LEDGER_ENABLED=true` in production does **not** make ledger writes
available: `assertStage2LedgerWritesAvailable()` hard-rejects whenever
`NODE_ENV=production`, before it checks the flag. Likewise,
`canonicalHistoryProjectionEnabled()` hard-rejects production, and
`developmentCanonicalActivationEnabled()` is explicitly test/development
only. There is currently no production activation sequence consisting only of
setting environment variables.

| Class | Variable | Required value | Actual boundary |
|---|---|---|---|
| Dev/test-only | `NODE_ENV` | `test` or `development` | Required by all development-only gates; `production` is hard-rejected |
| Dev/test-only | `STAGE2_LEDGER_ENABLED` | `true` | Permits ledger writes only after the non-production environment gate; ignored for production availability |
| Dev/test-only | `CANONICAL_ACTIVITY_DEVELOPMENT_ACTIVATION` | `true` | Enables the five-path orchestrator only in test/development |
| Dev/test-only | `CANONICAL_HISTORY_PROJECTION_ENABLED` | `true` | Enables the shadow projection only in test/development; production is hard-rejected |
| Production-capable opt-in (if separately wired) | `CANONICAL_ACTIVITY_BRIDGE_ENABLED` | `true` | Tracked-hill bridge helper is an explicit opt-in and is not itself a production release/approval |
| Production-capable opt-in (if separately wired) | `CANONICAL_MANUAL_TRAINING_ADAPTER_ENABLED` | `true` | Adapter-specific opt-in; the current development activation wrapper remains non-production |
| Production-capable opt-in (if separately wired) | `CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED` | `true` | Adapter-specific opt-in; the current development activation wrapper remains non-production |

The last three flags are code-level opt-ins, not a production rollout
sequence. They do not bypass the unavailable Stage 2 schema, create a
production ledger capability, or authorize a release. Any production use
requires a separately reviewed code change/release that introduces an
explicit owner-approved production availability capability after migration
verification, with its own safety, observability, rollback, and consumer
approval. Until that exists, production must leave all these flags unset or
false.

Canonical history remains shadow-only:
`/tabs/hikes` remains legacy-authoritative, and the projection must not replace
legacy rows or perform fuzzy reconciliation. Existing offline/local tracking
must continue to save and present legacy behavior when the schema or flags are
unavailable.

## Development/test application path (not run in S4-C09)

When an owner deliberately provisions a disposable development database, the
reviewed SQL may be applied once through the repository's controlled database
process, followed by the DB package/type checks and focused API tests. The
application is manual and environment-specific; this review intentionally does
not run `pnpm --filter @workspace/db push`, `push-force`, migration tooling,
direct SQL, or any database connector. `push-force` is not an acceptable
production procedure.

After schema availability is independently confirmed, enable the
dev/test-only flags only for the bounded test/development harness. Do not use
a development database as evidence that production has been migrated.

The eventual production order is necessarily longer than configuration:

1. Obtain owner approval for the migration and production change window.
2. Apply and read-only verify the migration in the approved target, with no
   backfill or consumer switch.
3. Complete a separately reviewed code change/release that deliberately
   introduces a production availability capability; this must replace the
   current hard production gates with an approved, observable, rollback-safe
   contract rather than treating `STAGE2_LEDGER_ENABLED=true` as sufficient.
4. Only after that release is verified, configure any approved bridge/adapter
   opt-ins, and keep ledger writes/read surfaces within the approved rollout.
5. Treat canonical history and any mobile consumer switch as later gates,
   requiring equivalence evidence and separate approval. The current history
   implementation cannot be activated in production by a flag.

## Preflight, post-migration, and runtime checks

Before a later approved application:

- verify the target environment and database identity;
- capture the approved backup/PITR marker and owner-approved change window;
- inspect the migration file and Drizzle schema hash/content;
- confirm the target is not production for development activation;
- confirm all Stage 2 and projection flags are disabled;
- confirm no pending destructive or unrelated schema diff exists;
- record baseline table/index/constraint inventory without reading private
  activity payloads.

After a later approved development application, verify read-only:

- all five expected tables exist;
- every expected primary key, owner-composite foreign key, check constraint,
  unique index, lookup index, and effective-revision index exists;
- ledger tables contain no unexpected backfill rows;
- cross-owner and invalid-status/metric/simulation writes are rejected;
- identical retries are idempotent and changed payloads remain conflicts;
- correction lineage is append-only and latest-effective reads are
  deterministic;
- legacy activity save, offline completion, and unavailable responses remain
  functional with flags disabled;
- focused API tests, DB TypeScript, mobile typecheck/tests, API build, and
  `git diff --check` pass.

No production verification is claimed by this document because no production
operation was performed.

## Rollback and recovery

The preferred rollback is configuration rollback: disable all Stage 2,
adapter, development activation, and history projection flags, then restart
the non-production service. This returns new reads/writes to their explicit
legacy or unavailable paths; it does not delete ledger history.

Do not hand-edit, delete, truncate, or reverse-apply the additive tables to
“undo” a test. If an approved production rollout later needs recovery, stop
new activation, preserve append-only evidence, use the owner-approved database
backup/PITR process for catastrophic database recovery, and perform any
correction through reviewed revision/lineage writers. A production rollback
plan, backup confirmation, migration observability, and owner approval are
required before production application.

## Mobile and release requirement

No mobile build or release is part of this readiness review. Before any
consumer switch or release, SummitReady must pass its typecheck and focused
regression suite on a native-compatible build, with offline Start → Track →
Pause → Resume → Finish → Save verified. The current mobile completion
presentation is deliberately safe when canonical consequences are pending or
unavailable. Canonical history must remain shadowed until a separate
legacy/canonical equivalence review proves counts, ownership, filters, and
context links.

## Known blockers and safety determination

Production remains blocked by the explicit hard production gates in the
current code, owner approval for migration/activation, absence of a
production migration verification, absence of a production rollback
window/backup confirmation for this change, the need for a separately
reviewed production-availability code change/release, and unresolved
legacy/canonical-history equivalence evidence. Setting
`STAGE2_LEDGER_ENABLED=true` cannot bypass this blocker. Existing full API
typecheck diagnostics in unrelated object-storage/OpenAI/integration
declarations also remain known technical noise and are not a
production-readiness sign-off.

These blockers do **not** block C10's safe non-production exercise. C10 may
validate legacy behavior, offline completion, explicit unavailable/pending
responses, and default-off flag boundaries without the Stage 2 schema. This
does not trigger the current **APPROVAL REQUIRED** stop because C10 is
bounded/default-off and needs no schema or production capability. C10 must
not apply the migration, enable production flags, create production ledger
rows, backfill/reconcile history, switch consumers, release a mobile build,
or cross any other RED gate. Therefore **C10 is safe to proceed only under
those constraints**; this document is not approval for production migration,
the required production-availability code change, or activation.