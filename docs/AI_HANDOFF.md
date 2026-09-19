# SummitReady AI handoff

Updated: 2026-09-19 UTC
Branch: `virtual-expeditions-mode`  
Branch HEAD before S2-R02: `b3310b3dc30837df14a76fd79f8b3446430ac6e5`

## Current project state

SummitReady is an Expo mobile app with a TypeScript API server and managed PostgreSQL database in a pnpm workspace. Activity recording is offline-first: GPS sessions are retained locally, recoverable after interruption, and queued in a user-scoped sync outbox for authenticated retry. Phase 1 of SummitReady 2.0 adds an owner-scoped canonical server activity foundation while preserving released local models and APIs.

## Current task

Stage 4 S4-C10 is COMPLETE under the Stage 4 completion rule.
`docs/STAGE_4_COMPLETION_REPORT.md` records the bounded regression evidence and
the remaining RED gates. Production migration and activation remain blocked by
the current hard production gates, a separately reviewed production-availability
code change/release after migration verification, owner approval,
rollback/backup confirmation, native-device QA, and legacy/canonical
equivalence evidence. The Stage 2 migration remains unapplied and all
production flags remain disabled; do not begin Stage 5.

## Last completed task

S4-C10 produced `docs/STAGE_4_COMPLETION_REPORT.md`. The report records
92/92 API tests across 9 files, 39/39 SummitReady tests across 5 files, API build, SummitReady typecheck,
DB TypeScript, generated-client diff, and diff-check results. It also records
the two-part unavailable Elevation Bank 503 runtime hardening: the response
discriminant and removal of raw `query.data.recentCredits` footer access.
Post-fix focused presentation tests pass 3/3, SummitReady typecheck passes, and
the Expo workflow restarted cleanly with no new browser console error on the
latest refresh; preview routing is unreliable and native-device QA remains not
run. S4-C09 produced `docs/STAGE_4_PRODUCTION_READINESS.md`, whose review inventories
the exact `0002_stage2_activity_ledgers.sql` additive artifact, expected
tables/indexes/constraints, actual hard production gates, dev/test-only
controls versus production-capable opt-ins, the required future
production-availability code release, development/test application path,
preflight/post-migration checks, configuration rollback and recovery, mobile
build requirements, known blockers, and the explicit C10 safety
determination. Safe focused checks now pass: API focused tests 77/77, API
build, SummitReady focused tests 31/31, SummitReady typecheck, DB TypeScript,
and migration static/schema-contract checks. The evidence matrix separately
records development migration application and row-level/production DB checks
as NOT RUN by design, while adapter/bridge semantics and rollback assumptions
are PASS static review only. No migration, production flag, data mutation,
release,
backfill, reconciliation, consumer switch, or protected
payment/authentication/privacy/SDE/Progress Mountain/cinematic change was
made.

## S4-C10 completion handoff

- Stage 4 implementation is **COMPLETE** with safe backwards-compatible
  default-off behavior; production activation remains pending RED-gate approval.
- `artifacts/summit-ready/utils/elevationBankPresentation.ts` treats an API
  `status: "unavailable"` response as unavailable instead of dereferencing
  missing totals, and `ElevationBankCard` no longer reads raw
  `query.data.recentCredits` outside the ready presentation branch.
- Post-fix focused presentation tests pass **3/3**, SummitReady typecheck
  passes, and the Expo workflow restart/latest refresh has no new browser
  console error. Preview routing remains unreliable and this is not native UI
  E2E evidence.
- API targeted regression: **92/92** across 9 files.
- SummitReady targeted regression: **39/39** across 5 files.
- API build, SummitReady typecheck, DB TypeScript, generated-client boundary
  check, and `git diff --check` pass.
- Browser E2E was intentionally not run; native-device Start → Track → Pause →
  Resume → Finish → Save and delayed-sync QA remain required.
- Do not apply `0002_stage2_activity_ledgers.sql`, enable production flags,
  switch canonical history consumers, release mobile, or begin Stage 5.

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
- S2-R03 adds a default-off Manual Training canonical adapter with stable completion identity, manual evidence, and explicit plan/session links.
- S2-R04 adds a pure ExploreHike canonicalization planner that reuses only explicit canonical IDs and never fuzzy-deduplicates.
- S2-R05 adds owner-scoped, idempotent multi-purpose contribution links with SDE target validation and simulation/real-summit separation.
- S2-R06 adds deterministic read-only qualification evaluation.
- S2-R07 prepares an owner-safe personal Elevation Bank event ledger.
- S2-R08 prepares an owner-safe simulated Expedition contribution ledger.
- S2-R09 adds private canonical-history projections and mismatch reporting without switching consumers.
- S2-R10 completes integration/regression review and the Stage 2 report.
- S3-R01 maps current navigation, shell state, Home resolution, duplicate redirects/stacks, mode-specific/shared surfaces, offline/protected boundaries, and the low-risk C02-C07 sequence.
- S3-R02 implements the shared app shell boundary (`SharedTabBar`) unifying primary navigation (Home, Explore, Track, Community, You) without duplicating navigation stacks or corrupting state.
- S3-R03 refines the Training Home dashboard hierarchy (Mountain > Readiness > Next Action > Weekly Progress) reducing nested-card clutter without changing calculations.
- S3-R04 refines Expedition Home Base Camp labels (SIMULATED ELEVATION, NEXT LOCAL STAGE, Start Next Stage) clarifying metrics while preserving Progress Mountain behavior exactly.
- S3-R05 unifies Explore discovery across modes: Training adds target-relevant context banner and "Track Hike" entry; Expedition adds explicit "Real Summit" and "Simulated Gain" metric labels.
- S3-R06 replaces disparate Track screens with a unified SharedTrackScreen offering context-appropriate tracking (Next Stage, Next Session, Free Hike) while preserving the offline GPS engine.
- S3-R07 standardizes Profile (You) and Community headers and injects a "Current Context" banner (Training Goal / Active Expedition) into the Profile view.
- S3-R08 verifies mode isolation, shared navigation boundaries, offline tracking compatibility, stable Training/Expedition completion handoff, protected files, and the unchanged/unapplied Stage 2 migration.
- S4-C04 adds `elevationBank.ts` decision/read service and focused tests; manual, indoor, unavailable/untrusted, zero/invalid, simulated, and unsupported competition evidence cannot credit personal elevation.
- S4-C08 keeps canonical history shadowed until legacy equivalence is demonstrated; `canonical-history` is owner-scoped and disabled by default, while mobile fallback preserves all legacy rows.

## Files changed

Primary activity implementation:

- `artifacts/summit-ready/app/hike-tracking.tsx`
- `artifacts/summit-ready/utils/activeHikeSession.ts`
- `artifacts/summit-ready/utils/syncOutbox.ts`
- `artifacts/api-server/src/services/canonicalActivity.ts`
- `artifacts/api-server/src/services/canonicalActivityContracts.ts`
- `artifacts/api-server/src/services/manualTrainingCanonicalAdapter.ts`
- `artifacts/api-server/src/services/exploreHikeCanonicalAdapter.ts`
- `artifacts/api-server/src/services/canonicalActivityLinks.ts`
- `artifacts/api-server/src/__tests__/canonicalActivityContracts.test.ts`
- `artifacts/api-server/src/__tests__/manualTrainingCanonicalAdapter.test.ts`
- `artifacts/api-server/src/__tests__/exploreHikeCanonicalAdapter.test.ts`
- `artifacts/api-server/src/__tests__/canonicalActivityLinks.test.ts`
- `artifacts/api-server/src/services/stage2Ledgers.ts`
- `artifacts/api-server/src/services/elevationBank.ts`
- `artifacts/api-server/src/__tests__/elevationBank.test.ts`
- `artifacts/api-server/src/routes/activities.ts`
- `artifacts/api-server/src/routes/hill-session.ts`
- `lib/db/src/schema/canonical-activities.ts`
- `lib/db/src/schema/canonical-hills.ts`
- `SUMMITREADY_2_PHASE_0_REPORT.txt`
- `SUMMITREADY_2_PHASE_1_REPORT.txt`
- `docs/STAGE_2_ARCHITECTURE_AUDIT.md`
- `docs/CANONICAL_ACTIVITY_CONTRACTS.md`
- `docs/STAGE_2_COMPLETION_REPORT.md`

Coordination:

- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`
- `docs/STAGE_3_NAVIGATION_UX_MAP.md`
- `docs/STAGE_3_COMPLETION_REPORT.md`
- `docs/STAGE_4_PRODUCTION_READINESS.md`
- `docs/STAGE_4_COMPLETION_REPORT.md`

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
- S2-C03–C05 combined focused regression: 58 passed; four database integration tests skipped by default.
- Final Stage 2 focused regression: 93 passed; four optional database integration tests skipped by default.
- Final architecture review passed with no blocking/high-impact findings.
- Stage 3 SummitReady TypeScript passed.
- Stage 3 targeted mobile regression passed: 39/39 tests.
- Stage 3 final architecture review passed after correcting Training Free Hike isolation and stable plan-session completion resolution.
- Expo restarted successfully with clean Metro/browser logs; the app-preview screenshot proxy rendered the separate landing artifact and was not treated as native mobile evidence.

## Production/deployment status

- Live site: `https://summitready.uk`
- Deployment type: autoscale; latest deployment is healthy and public.
- Phase 1 production schema Publish completed successfully.
- Publish-generated schema diff remaining: zero statements.
- No direct production SQL was run.
- No production backfill or mobile build was performed.
- Stage 2 migration `0002_stage2_activity_ledgers.sql` is prepared but was not applied to development or production.
- `CANONICAL_ACTIVITY_BRIDGE_ENABLED` is unset in production; the current
  Stage 4 bridge implementation therefore remains disabled.

## Known issues

- The legacy global unique activity ID remains a compatibility boundary; cross-owner collisions return `409` without leaking another owner's row.
- Existing production rows have no owner and are intentionally not backfilled.
- No fuzzy legacy reconciliation or correction API exists.
- Full API typecheck has unrelated pre-existing failures noted above.
- S4-C04 focused Elevation Bank and Stage 2 planning tests passed 23/23, including wrong-purpose deletion, indoor-kind evidence, activity deletion versus explicit revocation, and safe revocation evidence fallback/rejection; DB TypeScript and API bundle build passed; `git diff --check` passed.
- Manual Training and ExploreHike canonical adapters are implemented but default-off.
- Existing visible history/readiness/elevation/Expedition consumers remain on legacy paths.
- Real summit records, challenge lifecycle, public/competitive governance, backfill, and reconciliation remain future work. S4-C05 adds `activityConsequences.ts` as an unwired pure planner plus injected effect boundary; Training/readiness, Expedition, challenge/achievement, and mountain/route persistence remain caller-owned until their existing legacy contracts are explicitly supplied. Review hardening now filters replayed qualifications by activity ID, binds Expedition effects and runs to exact links/IDs and canonical metrics, deduplicates identical ledger corrections/revocations, scopes unique-conflict retries to migration-defined indexes, and gates every exported Stage 2 write boundary outside production until schema availability is explicitly enabled.
- Replit's Expo screenshot proxy can resolve the separate landing artifact at `/`; use Expo Go/native-device QA for authenticated visual release checks.

## Decisions requiring review

- Production publication of migration `0002_stage2_activity_ledgers.sql` requires separate owner approval through Replit Publish.
- Adapter activation and consumer switching require a later approved release plan.
- Keep the canonical bridge explicitly controlled by
  `CANONICAL_ACTIVITY_BRIDGE_ENABLED`; any production activation requires a
  separate owner-approved rollout.

## Recommended next action

Proceed to S4-C10 only as the bounded non-production validation described in
`docs/STAGE_4_PRODUCTION_READINESS.md`. Keep the Stage 2 migration unapplied,
production flags disabled, canonical history shadowed, and legacy consumers
authoritative.

## Git branch and latest commit SHA

- Repository: `mcarey888-lang/new`
- Branch: `virtual-expeditions-mode`
- Latest Phase 1 implementation SHA: `bf831921c9ae2b901a25b29bdc60ab8e8af4f26c`
- Publish marker SHA: `99c41a4abb2ee26ee03b43fd5320a3ca858b2a80`
- S2-C01 command SHA: `560e1fe3410d82af0abd20a0d3774555ce0ed48f`
- S2-R01 implementation SHA: `a1cfd9fac19f7d30571a45c1d0de8f6929a60b10`
- S2-C02 command SHA: `b3310b3dc30837df14a76fd79f8b3446430ac6e5`

## S4-C09 readiness handoff

- `docs/STAGE_4_PRODUCTION_READINESS.md` is the controlling C09 artifact.
- C10 is safe only for legacy/offline behavior and explicitly gated
  unavailable/pending paths in test/development.
- `STAGE2_LEDGER_ENABLED` cannot bypass the `NODE_ENV=production` hard
  rejection; production needs a separately reviewed availability code change
  and release after migration verification.
- Stage 4 mobile changes require a new tested mobile build/release artifact
  before shipping; no native/store artifact exists and store release remains
  RED-gated.
- Stage 2 migration `0002_stage2_activity_ledgers.sql` remains unapplied.
- Later catalog acceptance is exactly five tables, sixteen migration-created
  indexes, twenty-one named check/FK constraints plus five primary keys, and
  five zero-row counts; catalog queries are documented but not run.
- Do not enable `STAGE2_LEDGER_ENABLED` or any canonical adapter/history flag
  in production. Do not perform production SQL, backfill, reconciliation,
  consumer switching, or release work.

The commit containing these coordination documents is reported in the completion message because a Git commit cannot embed its own final SHA without changing that SHA.

## S4-C07 current handoff — structured activity completion

- S4-C07 integrates the finished GPS activity screen with a structured, offline-safe completion presentation in `artifacts/summit-ready/app/hike-tracking.tsx`.
- Elevation Bank recent credits now include canonical `sourceId`/`sourceType` loaded under the authenticated owner; completion matching accepts only exact canonical activity ID or exact source ID, never names/metrics/fuzzy matches. The visible completion screen performs at most four bounded online refetches for delayed outbox credit and never blocks local save/navigation.
- The hierarchy is activity/route title, recorded distance/ascent/duration, then only available consequences. Elevation Bank values appear only when an effective credited/corrected activity credit is returned by the authenticated API; unavailable or pending values are hidden rather than replaced with zeros.
- Training context is shown as a local link-to-session consequence. Expedition context is explicitly labelled simulated stage progress and never creates or claims a Real Summit. Multi-context completion is supported without merging recorded and simulated elevation.
- Existing local-first save, outbox retry, protected Progress Mountain/cinematic behavior, private GPS evidence, and navigation paths are unchanged. Offline completion remains renderable and shows that consequences will sync later.
- Added pure presentation contract/tests at `artifacts/summit-ready/utils/activityCompletionPresentation.ts` and `.test.ts` covering credited bank, Training + Expedition context, unavailable/offline behavior, and retry/no-duplicate display behavior.
- Verification: SummitReady targeted regression **13/13**, SummitReady TypeScript passed, API consequence/Elevation Bank focused suites **25/25**, API production bundle passed, OpenAPI codegen completed (workspace library typecheck retains unrelated pre-existing diagnostics), and `git diff --check` passed. No migration, production flag, backfill, release, or Stage 5 work was performed.

## Permanent handoff protocol

At the end of every meaningful SummitReady development task:

1. Replace the operational sections of this file with the current state.
2. Append one UTC-dated entry to `docs/AI_CHANGELOG.md`.
3. Include the branch and latest available implementation commit SHA.
4. Flag decisions requiring human or ChatGPT review.
5. Never include secrets, credentials, private user information, raw production data, or production connection strings.
