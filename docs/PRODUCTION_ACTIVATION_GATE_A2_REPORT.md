# Production Activation Gate A2 report

**Date:** 2026-09-19 UTC
**Branch:** `virtual-expeditions-mode`
**Result:** **BLOCKED** at PA-A2-C03; development migration succeeded, but the generated production Publish diff materially differs from the reviewed artifact. Production was not changed or published.

## Approved scope

The owner approved development-database-only application of
`lib/db/migrations/0002_stage2_activity_ledgers.sql`, followed by read-only
development verification and production Publish diff analysis. Production
schema application, deployment, flags, adapters, history activation, backfill,
consumer switching, releases, and Stage 5 remained outside scope.

## Artifact and target verification

- Git blob: `e8848dfc4592390b6040d2c7e2a82d949f0a7be1`
- SHA-256: `f2aeccb3cda06c663789c14b2b908c1b095f55d5143ddeb68b852e66396e6c69`
- Target: managed SummitReady development database, `public` schema, writable
  primary rather than the production read replica.
- Static scan: no `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`,
  destructive alteration, or table recreation.
- Application method: the exact file content was sent unchanged as one
  development-only database operation. No schema synchronization or
  `push-force` was used.

## Development before and after

Before application, all five ledger tables were absent. Baseline counts were:

| Relation | Before | After |
|---|---:|---:|
| `canonical_activities` | 0 | 0 |
| `tracked_hill_sessions` | 4 | 4 |
| `personal_elevation_credit_events` | absent | 0 |
| `personal_elevation_credit_corrections` | absent | 0 |
| `expedition_runs` | absent | 0 |
| `expedition_stage_contributions` | absent | 0 |
| `expedition_contribution_corrections` | absent | 0 |

Development verification confirmed all five tables, five primary keys, the
reviewed owner-safe composite foreign keys, status/evidence/metric/simulation/
revision/lineage checks, identity and correction uniqueness, lookup indexes,
effective-revision indexes, and the four composite unique indexes required by
foreign-key targets. No rows were added or modified.

## Production Publish analyzer

The read-only analyzer produced 24 proposed statements:

- 5 `CREATE TABLE` statements containing the reviewed columns, primary keys,
  and check constraints;
- 7 `ALTER TABLE ... ADD CONSTRAINT` owner-safe foreign keys;
- 12 reviewed lookup, identity, effective-revision, run, and correction
  indexes.

It reported:

- `hasStructuralDataLoss: false`;
- `maybeNonBackwardsCompatible: false`;
- no tables, columns, schemas, or materialized views to remove;
- no tables to truncate;
- no warnings.

The apparent `DELETE` tokens in the SQL are only `ON DELETE RESTRICT` clauses;
there are no data-deletion statements.

## Blocking discrepancy

The analyzer omitted these four reviewed unique indexes even though they exist
in development and are required by the reviewed migration:

1. `canonical_activities_owner_id_uidx`
2. `personal_elevation_credit_events_lineage_uidx`
3. `expedition_runs_owner_id_uidx`
4. `expedition_stage_contributions_lineage_uidx`

Read-only production inspection confirmed that none of the four currently
exists. The proposed foreign keys reference the corresponding composite column
sets. Publishing the 24-statement diff would therefore materially differ from
the reviewed `0002` artifact and may fail when PostgreSQL validates the
referenced uniqueness.

Per PA-A2-C03, the diff was not published and no repair was attempted.

## Production remains unchanged

- All five ledger tables remain absent in production.
- `canonical_activities` remains at 0 rows.
- `tracked_hill_sessions` remains at 4 rows.
- All relevant Stage 2/Stage 4 production flags remain unset.
- No production SQL, Publish, deployment, backfill, reconciliation, test rows,
  runtime activation, mobile release, or Stage 5 work occurred.

## Required next action

Before production approval, resolve why the controlled Publish analyzer omits
the four composite unique indexes and regenerate the diff. The next diff must
include the complete reviewed uniqueness required by every proposed composite
foreign key, remain additive, and be inspected again. Production publication
requires a new explicit approval after that clean diff is available.