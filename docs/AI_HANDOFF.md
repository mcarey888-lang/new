# SummitReady AI handoff

Updated: 2026-09-19T09:06:03.063Z
Branch: `virtual-expeditions-mode`  
Branch HEAD before this documentation update: `99c41a4abb2ee26ee03b43fd5320a3ca858b2a80`

## Current project state

SummitReady is an Expo mobile app with a TypeScript API server and managed PostgreSQL database in a pnpm workspace. Activity recording is offline-first: GPS sessions are retained locally, recoverable after interruption, and queued in a user-scoped sync outbox for authenticated retry. Phase 1 of SummitReady 2.0 adds an owner-scoped canonical server activity foundation while preserving released local models and APIs.

## Current task

Phase 1 production Publish and read-only verification are complete. Await ChatGPT review and a future Stage 2 task document in GitHub. Do not begin Stage 2 until that document exists.

Pre-migration PITR marker: `2026-09-19T08:29:30.681Z`. Production has seven-day point-in-time recovery and scheduled backups with 28-day retention.

## Last completed task

Verified the Phase 1 production Publish read-only. The reviewed 24-statement additive schema diff is fully applied, all legacy rows are preserved, and no backfill or mobile build was performed.

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

Development and production contain five new tables:

- `canonical_activities`
- `canonical_activity_evidence`
- `canonical_activity_links`
- `canonical_activity_qualifications`
- `canonical_activity_conflicts`

Development also adds nullable `tracked_hill_sessions.activity_id` and `tracked_hill_sessions.canonical_activity_id`, owner/source uniqueness, private-evidence constraints, typed links, qualification constraints, foreign keys, and indexes.

Production migration status: **applied and verified**. Replit now reports no development-to-production schema diff. All five canonical tables exist. Both new legacy columns are nullable with the expected types. All expected indexes exist. Canonical child foreign keys use `ON DELETE CASCADE`; the tracked-session bridge uses `ON DELETE SET NULL`.

The four pre-existing `tracked_hill_sessions` rows remain. All four have `activity_id IS NULL` and `canonical_activity_id IS NULL`. All five canonical tables contain zero rows; no backfill occurred.

## Tests performed and results

- API suite: 221 passed; four database integration tests skipped by default.
- Development DB integration: four passed, covering concurrent idempotency, cross-owner separation, conflict retention, and private evidence.
- Database TypeScript build passed.
- API production bundle build passed.
- Published API health check at `/api/healthz` returned `{"status":"ok"}`.
- Public mountain-image route returned an image successfully.
- Released-client compatibility was verified from the additive nullable schema and deployed route contract. No authenticated write smoke test was run because verification was required to remain non-mutating.
- Full API `tsc --noEmit` remains blocked by unrelated pre-existing object-storage typing and OpenAI declaration-build diagnostics; no Phase 1 file appears in those diagnostics.

## Production/deployment status

- Live site: `https://summitready.uk`
- Deployment type: autoscale; latest deployment is healthy and public.
- Phase 1 production schema Publish completed successfully.
- Publish-generated schema diff remaining: zero statements.
- No direct production SQL was run.
- No production backfill or mobile build was performed.
- `CANONICAL_ACTIVITY_BRIDGE_ENABLED` is unset in production; deployed code therefore uses its documented default of enabled.

## Known issues

- The legacy global unique activity ID remains a compatibility boundary; cross-owner collisions return `409` without leaking another owner's row.
- Existing production rows have no owner and are intentionally not backfilled.
- No fuzzy legacy reconciliation or correction API exists.
- Full API typecheck has unrelated pre-existing failures noted above.

## Decisions requiring review

- ChatGPT should review and accept the completed production verification.
- Decide whether the bridge should remain default-enabled or be explicitly controlled with `CANONICAL_ACTIVITY_BRIDGE_ENABLED`.
- Do not begin Stage 2 until its task document appears in GitHub.

## Recommended next action

Wait for ChatGPT's Stage 2 task document in GitHub. Do not backfill, create a mobile build, or begin Stage 2 early.

## Git branch and latest commit SHA

- Repository: `mcarey888-lang/new`
- Branch: `virtual-expeditions-mode`
- Latest Phase 1 implementation SHA: `bf831921c9ae2b901a25b29bdc60ab8e8af4f26c`
- Publish marker SHA: `99c41a4abb2ee26ee03b43fd5320a3ca858b2a80`

The commit containing these coordination documents is reported in the completion message because a Git commit cannot embed its own final SHA without changing that SHA.

## Permanent handoff protocol

At the end of every meaningful SummitReady development task:

1. Replace the operational sections of this file with the current state.
2. Append one UTC-dated entry to `docs/AI_CHANGELOG.md`.
3. Include the branch and latest available implementation commit SHA.
4. Flag decisions requiring human or ChatGPT review.
5. Never include secrets, credentials, private user information, raw production data, or production connection strings.
