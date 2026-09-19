# SummitReady AI handoff

Updated: 2026-09-19 UTC
Branch: `virtual-expeditions-mode`  
Branch HEAD before S2-R02: `b3310b3dc30837df14a76fd79f8b3446430ac6e5`

## Current project state

SummitReady is an Expo mobile app with a TypeScript API server and managed PostgreSQL database in a pnpm workspace. Activity recording is offline-first: GPS sessions are retained locally, recoverable after interruption, and queued in a user-scoped sync outbox for authenticated retry. Phase 1 of SummitReady 2.0 adds an owner-scoped canonical server activity foundation while preserving released local models and APIs.

## Current task

S2-C02 is complete. The canonical source, link-target, evidence-classification, and adapter contracts are implemented and documented. Stop before S2-C03 and execute no further Stage 2 work until ChatGPT writes the next numbered command to `docs/AI_TASK.md`.

## Last completed task

Completed the S2-C02 canonical contracts and stable-ID foundation. No user-facing behavior, schema, data, production, UI, release, or protected-asset changes were made.

## Changes made

- Offline-first hike tracking preserves active-session ownership, checkpoints, pending hike selection, and authenticated outbox retries.
- Canonical ingestion uses immutable server UUIDs and owner-scoped identity `(owner_user_id, source_type, source_id)`.
- Identical retries deduplicate; changed payloads are rejected and audited.
- Raw GPS/elevation evidence is stored separately and private.
- Existing tracked hill saves bridge transactionally to canonical activities without replacing legacy models.
- Real Summit, Expedition Completion, and Mountain Simulation remain distinct concepts.
- S2-R01 maps current activity flows, qualification semantics, Summit Data Engine references, additive Stage 2 gaps, sequencing, and compatibility controls.
- S2-R02 centralizes built-in and external source namespaces, deterministic identity keys, backwards-compatible link targets, SDE references, evidence storage mappings, and future adapter boundaries.
- Existing `tracked_hill_session` source type and raw source ID persistence remain unchanged.

## Files changed

Primary activity implementation:

- `artifacts/summit-ready/app/hike-tracking.tsx`
- `artifacts/summit-ready/utils/activeHikeSession.ts`
- `artifacts/summit-ready/utils/syncOutbox.ts`
- `artifacts/api-server/src/services/canonicalActivity.ts`
- `artifacts/api-server/src/services/canonicalActivityContracts.ts`
- `artifacts/api-server/src/__tests__/canonicalActivityContracts.test.ts`
- `artifacts/api-server/src/routes/activities.ts`
- `artifacts/api-server/src/routes/hill-session.ts`
- `lib/db/src/schema/canonical-activities.ts`
- `lib/db/src/schema/canonical-hills.ts`
- `SUMMITREADY_2_PHASE_0_REPORT.txt`
- `SUMMITREADY_2_PHASE_1_REPORT.txt`
- `docs/STAGE_2_ARCHITECTURE_AUDIT.md`
- `docs/CANONICAL_ACTIVITY_CONTRACTS.md`

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
- S2-C01 used targeted read-only repository inspection and three independent audit passes. No runtime test was needed because the command changed documentation only.
- S2-C02 focused canonical contract suites: 39 passed; four database integration tests skipped by default.
- Isolated TypeScript check for `canonicalActivityContracts.ts` passed.
- API production bundle build passed.
- Full API typecheck still reports only the pre-existing object-storage response typing error and missing OpenAI declaration-build outputs; no S2-C02 file appears in those diagnostics.

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
- Manual Training completion and local ExploreHike records do not yet share the idempotent canonical ingestion path used by GPS tracked hill sessions.
- Durable Elevation Bank credits, Expedition run/stage contributions, real summit records, challenge lifecycle, and public/competitive governance remain additive future work.
- S2-C02 defines adapter contracts but intentionally does not implement or activate Manual Training or ExploreHike adapters.

## Decisions requiring review

- ChatGPT should review S2-R02 and issue the next numbered command.
- Approve or revise the implemented source namespaces, encoded SDE target formats, Phase 1 evidence mappings, and adapter boundaries before adapter implementation.
- Decide whether the canonical bridge should remain default-enabled or be explicitly controlled with `CANONICAL_ACTIVITY_BRIDGE_ENABLED`.

## Recommended next action

Wait for ChatGPT to review S2-R02 and update `docs/AI_TASK.md`. Do not begin S2-C03 early.

## Git branch and latest commit SHA

- Repository: `mcarey888-lang/new`
- Branch: `virtual-expeditions-mode`
- Latest Phase 1 implementation SHA: `bf831921c9ae2b901a25b29bdc60ab8e8af4f26c`
- Publish marker SHA: `99c41a4abb2ee26ee03b43fd5320a3ca858b2a80`
- S2-C01 command SHA: `560e1fe3410d82af0abd20a0d3774555ce0ed48f`
- S2-R01 implementation SHA: `a1cfd9fac19f7d30571a45c1d0de8f6929a60b10`
- S2-C02 command SHA: `b3310b3dc30837df14a76fd79f8b3446430ac6e5`

The commit containing these coordination documents is reported in the completion message because a Git commit cannot embed its own final SHA without changing that SHA.

## Permanent handoff protocol

At the end of every meaningful SummitReady development task:

1. Replace the operational sections of this file with the current state.
2. Append one UTC-dated entry to `docs/AI_CHANGELOG.md`.
3. Include the branch and latest available implementation commit SHA.
4. Flag decisions requiring human or ChatGPT review.
5. Never include secrets, credentials, private user information, raw production data, or production connection strings.
