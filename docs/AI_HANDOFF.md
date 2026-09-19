# SummitReady AI handoff

Updated: 2026-09-19 UTC  
Branch: `virtual-expeditions-mode`  
Latest implementation commit at this refresh: `93be88dd2f4f0266582c6c6f24fada76de47e54e`

## Current project state

SummitReady is an Expo mobile app with a TypeScript API server and managed PostgreSQL database in a pnpm workspace. Activity recording is offline-first: GPS sessions are retained locally, recoverable after interruption, and queued in a user-scoped sync outbox for authenticated retry. Phase 1 of SummitReady 2.0 adds an owner-scoped canonical server activity foundation while preserving released local models and APIs.

## Current task

Publish the reviewed Phase 1 production schema through Replit Publish, then run read-only verification. The Publish action has been offered but has **not** completed; Replit still reports the reviewed 24-statement diff as pending.

Pre-migration PITR marker recorded before the Publish prompt: `2026-09-19T08:29:30.681Z`. Production has seven-day point-in-time recovery and scheduled backups with 28-day retention, but no scheduled backup had completed at the last check.

## Last completed task

Created this permanent AI coordination workspace. The preceding completed development task was the Phase 1 canonical activity foundation in commit `bf831921c9ae2b901a25b29bdc60ab8e8af4f26c`.

## Changes made

- Offline-first hike tracking preserves active-session ownership, checkpoints, pending hike selection, and authenticated outbox retries.
- Canonical ingestion uses immutable server UUIDs and owner-scoped identity `(owner_user_id, source_type, source_id)`.
- Identical retries deduplicate; changed payloads are rejected and audited.
- Raw GPS/elevation evidence is stored separately and private.
- Existing tracked hill saves bridge transactionally to canonical activities without replacing legacy models.
- Real Summit, Expedition Completion, and Mountain Simulation remain distinct concepts.

## Files changed

Primary activity implementation:

- `artifacts/summit-ready/app/hike-tracking.tsx`
- `artifacts/summit-ready/utils/activeHikeSession.ts`
- `artifacts/summit-ready/utils/syncOutbox.ts`
- `artifacts/api-server/src/services/canonicalActivity.ts`
- `artifacts/api-server/src/routes/activities.ts`
- `artifacts/api-server/src/routes/hill-session.ts`
- `lib/db/src/schema/canonical-activities.ts`
- `lib/db/src/schema/canonical-hills.ts`
- `SUMMITREADY_2_PHASE_0_REPORT.txt`
- `SUMMITREADY_2_PHASE_1_REPORT.txt`

Coordination:

- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`

## Database/schema changes

Development contains five new tables:

- `canonical_activities`
- `canonical_activity_evidence`
- `canonical_activity_links`
- `canonical_activity_qualifications`
- `canonical_activity_conflicts`

Development also adds nullable `tracked_hill_sessions.activity_id` and `tracked_hill_sessions.canonical_activity_id`, owner/source uniqueness, private-evidence constraints, typed links, qualification constraints, foreign keys, and indexes.

Production migration status: **not applied**. The Publish-generated diff has 24 additive statements, no removals/truncations/renames/backfill, no structural data loss, and no backwards-compatibility warning. Production currently has four legacy `tracked_hill_sessions` rows; all are ownerless and must remain untouched.

## Tests performed and results

- API suite: 221 passed; four database integration tests skipped by default.
- Development DB integration: four passed, covering concurrent idempotency, cross-owner separation, conflict retention, and private evidence.
- Database TypeScript build passed.
- API production bundle build passed.
- API health check returned `{"status":"ok"}`.
- Full API `tsc --noEmit` remains blocked by unrelated pre-existing object-storage typing and OpenAI declaration-build diagnostics; no Phase 1 file appears in those diagnostics.

## Production/deployment status

- Live site: `https://summitready.uk`
- Deployment type: autoscale; latest checked deployment was healthy and public.
- Phase 1 production schema Publish is awaiting user confirmation.
- No direct production SQL was run.
- No production backfill or mobile build was performed.
- `CANONICAL_ACTIVITY_BRIDGE_ENABLED` is unset in production; current code therefore defaults the bridge to enabled after the new code is published.

## Known issues

- Production lacks both tracked-session activity ID columns until Publish.
- The legacy global unique activity ID remains a compatibility boundary; cross-owner collisions return `409` without leaking another owner's row.
- Existing production rows have no owner and are intentionally not backfilled.
- No fuzzy legacy reconciliation or correction API exists.
- Full API typecheck has unrelated pre-existing failures noted above.

## Decisions requiring review

- Confirm Publish of only the reviewed 24-statement additive diff.
- After Publish, verify all canonical tables, foreign keys, indexes, four preserved legacy rows, and null values in both new legacy columns.
- Decide whether the bridge should remain default-enabled or be explicitly controlled with `CANONICAL_ACTIVITY_BRIDGE_ENABLED`.
- Do not begin Phase 2 until production verification is accepted.

## Recommended next action

Confirm the pending Replit Publish action. Immediately after completion, run the agreed read-only production verification and compare against the PITR marker. Do not backfill, create a mobile build, or make unrelated production changes.

## Git branch and latest commit SHA

- Repository: `mcarey888-lang/new`
- Branch: `virtual-expeditions-mode`
- Latest implementation SHA at handoff refresh: `93be88dd2f4f0266582c6c6f24fada76de47e54e`

The commit containing these coordination documents is reported in the completion message because a Git commit cannot embed its own final SHA without changing that SHA.

## Permanent handoff protocol

At the end of every meaningful SummitReady development task:

1. Replace the operational sections of this file with the current state.
2. Append one UTC-dated entry to `docs/AI_CHANGELOG.md`.
3. Include the branch and latest available implementation commit SHA.
4. Flag decisions requiring human or ChatGPT review.
5. Never include secrets, credentials, private user information, raw production data, or production connection strings.
