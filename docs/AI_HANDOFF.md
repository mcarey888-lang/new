# SummitReady AI handoff

Updated: 2026-09-21 UTC
Branch: `virtual-expeditions-mode`  
Latest Stage 8 implementation/regression checkpoint: `27b27a8`
Latest Stage 8 completion documentation checkpoint: this handoff commit

## Current project state

SummitReady is an Expo mobile app with a TypeScript API server and managed PostgreSQL database in a pnpm workspace. Activity recording is offline-first: GPS sessions are retained locally, recoverable after interruption, and queued in a user-scoped sync outbox for authenticated retry. Phase 1 of SummitReady 2.0 adds an owner-scoped canonical server activity foundation while preserving released local models and APIs.

## Current task

### EX2-C01–EX2-C10 Explore Premium V2

- The locked mock-up match is complete. The authoritative report is
  `docs/EXPLORE_PREMIUM_V2_REPORT.md`.
- Explore now uses cinematic truthful mountain photography, editorial discovery
  hierarchy, integrated search, the four existing filters, rich featured cards,
  landscape result cards and only existing route intelligence fields.
- The existing catalogue, canonical IDs, detail navigation, route browser, hill
  finder, tab order and shell-mode behavior are preserved.
- Rendered QA covered six required states at 390×844/360×800. The managed tester
  exposed capture IDs but could not persist PNG bytes; IDs are recorded in the
  report and visual QA manifest.
- The correction pass improved image brightness/authenticity, exact mountain
  subject resolution, filter fit, shell-toggle scrolling and branded fallback.
- Track, Expeditions, You, Profile, SDE, schemas, protected Progress Mountain and
  Stage 9 remain untouched.

### BP-C01–BP-C10 Basecamp cleanup and Explore Premium V1

- The implementation and real-browser visual QA are complete. The authoritative report is `docs/EXPLORE_PREMIUM_V1_REPORT.md`.
- The four authorized Basecamp cleanups are complete: exact slogan removal, text-free native Up Next visual, amber/earth insight, and collapsed/expandable Alpine requirements.
- `app/(tabs)/explore.tsx` implements a photographic featured lead that integrates search and practical filters without vertical dead space.
- Discovery rhythm improved at 390px by replacing repetitive giant cards with compact editorial rows containing truthful route character previews.
- Legacy achievements and progress elements were completely removed from the view to keep the focus strictly on discovery.
- Missing images use an atmospheric branded fallback. Accessibility roles and reduced motion are applied.
- Real 390×844 managed-browser captures were inspected; IDs are recorded in the report. The managed browser could not export PNG bytes into the workspace, which remains the only incomplete BP-C09 deliverable.
- No changes to Track, Expeditions, Profile, SDE schemas, protected components, or offline tracking boundaries occurred.

### V3-C01–V3-C12 Premium Training Basecamp V3

- The bounded reference-match implementation is complete. The authoritative
  report is `docs/PREMIUM_BASECAMP_V3_REPORT.md`.
- Training Basecamp now follows the locked cinematic hierarchy while using real
  goal, plan, session, entitlement, Readiness and Elevation Bank states.
- Exact artwork consumed: approved unpublished
  `SR-MTN-MONTBLANC-001 — Mont Blanc — Alpine Dawn`, version 1, `hero`
  derivative, 1536 × 864.
- Six final real 390 × 844 captures are indexed under
  `docs/visual-qa/premium-basecamp-v3/`, including a 390 × 1731 full scroll and
  a forced genuine fallback state.
- A real-screen correction loop fixed hero height, duplicate/sticky mode
  switching, surface grouping, 390px label collisions and lower-module wrapping.
- Verification passed: SummitReady **25 files / 166 tests**, TypeScript,
  production web/iOS/Android Expo exports, `git diff --check`,
  approved/fallback network proof, and independent final review.
- Training/Readiness/Elevation Bank/canonical activity/offline semantics,
  protected Progress Mountain/cinematic/live-3D, schema, artwork publication,
  release and Stage 9 remain untouched.

### Training Basecamp approved artwork diagnostic/fix

- The approved Mont Blanc discrepancy is fixed. The controlling report is
  `docs/BASECAMP_APPROVED_ARTWORK_FIX_REPORT.md`.
- Root cause: the API allowed the standard development domain but not the Expo
  web origin. The approved resolver `fetch` failed CORS and Basecamp silently
  rendered `/api/mountain-image?name=Mont%20Blanc`.
- The API now allows the Expo development origin plus development-only
  loopback visual-QA origins. Production origins are unchanged.
- Resolver responses expose and the mobile client verifies exact asset
  `SR-MTN-MONTBLANC-001`, version 1, `hero` placement, and the v1 hero
  derivative path before accepting the stable approved URI.
- The stable approved URI and Artwork Admin v1 hero derivative are identical
  1536×864 JPEGs with SHA-256 `610126…bd7b`.
- Basecamp logs `approved`, `mountain-image`, or `gradient` source decisions in
  development. The successful real browser trace loaded only the approved
  source.
- Fresh 390×844 evidence:
  `docs/visual-qa/premium-basecamp-v2/approved-artwork-fixed-first-viewport.png`.
- Verification passed: SummitReady **25 files / 166 tests**, focused resolver
  **1 file / 8 tests**, API artwork **2 files / 7 tests**, mobile TypeScript,
  API build, live CORS, byte identity, browser network/DOM, and visual checks.
- No redesign, generation, publication, deploy/release, schema/data, Training,
  Readiness, Elevation Bank, navigation, Progress Mountain, cinematic, or
  other-screen change occurred.

### VR2-C01–VR2-C08 Premium Training Basecamp V2

- The bounded editorial refinement is complete. The authoritative report is
  `docs/PREMIUM_BASECAMP_V2_REPORT.md`.
- The deterministic DEV-only Active Hillwalker goal now uses Mont Blanc with
  existing values: 19 km, 2,800 m gain, 4,808 m altitude, Alpine. It consumes
  approved unpublished `SR-MTN-MONTBLANC-001 — Mont Blanc — Alpine Dawn`,
  exact current version 1.
- The resolver requires development mode, profile `active_hillwalker`, and
  exact goal `Mont Blanc`; negative tests prove other profiles and changed
  goals do not fetch. Production remains fail-closed.
- Basecamp now flows through unframed hero → flat mission with accessible week
  progress and valid session-detail action → signature Readiness → flat
  Elevation Bank/progress → quieter supporting rows.
- Existing session navigation, week progress, AchievementToast, complete Pro
  coach behavior, Readiness calculations/locking/baseline meaning, Elevation
  Bank semantics/destination, and bottom-tab routes are preserved.
- Five final 390×844 captures are indexed under
  `docs/visual-qa/premium-basecamp-v2/`, including locked and final fallback
  states.
- Final verification: SummitReady **31 files / 195 tests**, TypeScript,
  production iOS and Android Expo exports, `git diff --check`, and independent
  review passed.
- No generation/publication, production data/schema, deploy/release, broad
  reskin, Stage 9, or protected Expedition Progress Mountain/cinematic change
  occurred. Native-device release QA remains not run.

### UI-C01–UI-C09 Premium Training Basecamp pilot

- The bounded approved-artwork → real Training Basecamp pilot is complete.
  The authoritative report is `docs/PREMIUM_BASECAMP_PILOT_REPORT.md`.
- Persisted Batch 01 state was re-read at completion: **12 current versions,
  12 approved, 0 published**. The DEV/demo pilot consumes
  `SR-TRAIN-BASECAMP-001` version 1 by stable ID and `hero` placement only.
- The resolver and stable media stream are development-only, current-approved
  only, master/history/storage-opaque, and `no-store`. Production returns 404
  and the app falls back to the existing mountain image, then gradient.
- The real Basecamp now presents cinematic goal hero → Mission Control →
  Readiness → supporting progress. Existing routes, calculations, activity/
  offline behavior, shell semantics, and bottom navigation are unchanged.
- Final 390×844 real-screen evidence is in
  `docs/visual-qa/premium-basecamp/`: accepted before baseline, populated first
  viewport, supporting scroll, and resolver-blocked fallback.
- Lead-design review corrected truncated next-session guidance and recaptured
  the supporting state at a clean section boundary. No P0/P1 visual issue
  remains.
- Final verification after that correction: focused **6 files / 32 tests**,
  TypeScript, and production iOS/Android Expo exports passed. The implementation
  checkpoint also passed the bounded **25 files / 162 tests**, API
  **3 files / 11 tests**, API build, and live stable-media checks.
- No artwork generation/publication, production schema/data, deployment,
  release, broad reskin, Stage 9, or protected Progress Mountain/cinematic
  change occurred. Native-device QA remains not run.

### MV-C01–MV-C10 Media, visual and motion gate

- MV is complete through the bounded architecture, documentation, development
  gallery, motion foundation and one-screen pilot gate. The completion report
  is `docs/MEDIA_VISUAL_MOTION_COMPLETION_REPORT.md`.
- Artwork Admin plus the artwork API/service is the consolidation target.
  Mountain-image remains the approved-first runtime resolver/fallback; Atlas
  Media Studio remains a separate Atlas-brand domain.
- A development-only `/assets` gallery was added inside Artwork Admin. It has
  no production route, persistence, mutation, schema or publish behavior.
- Only Training Basecamp was migrated as the real-screen pilot. Its data,
  navigation, mountain resolver, Readiness, Elevation Bank and plan/session
  semantics remain intact. Existing `FadeInDown` motion is reused.
- Before/after 390×844 Active Hillwalker captures are in
  `docs/visual-qa/media-pilot/`.
- The bounded reproducible inventory classifies 41 relevant raster
  source/evidence assets. Generated outputs, prototypes, attached uploads and
  external Object Storage were excluded.
- Verification passed: targeted **3 files / 20 tests**, bounded **24 files /
  158 tests**, SummitReady and Artwork Admin TypeScript, Artwork Admin
  production build with gallery media excluded, iOS/Android production Expo
  exports and `git diff --check`. Native-device QA was not run.
- Persistent media catalogue changes remain a future AMBER/RED proposal.
- No Stage 9, broad migration, mass generation, production schema/data,
  deploy/release, auth/privacy/payment, SDE, GPS/offline, Readiness,
  Expedition-contribution or protected Progress Mountain/cinematic changes
  occurred.

Stage 8 — Challenges & Achievements is **COMPLETE** through O8-C10 under the
authorized overnight runbook. The additive `challenge-domain-v1` foundation,
deterministic evaluator, owner-scoped persisted projection, exact
correction/revocation authority, explicit windows, Elevation Bank event
reconciliation, and additive Challenges/Profile/Account/completion UX are
implemented. See `docs/STAGE_8_COMPLETION_REPORT.md` and
`docs/STAGE_8_REGRESSION_REVIEW.md`.

Only confirmed Elevation Bank evidence currently has an accepted authoritative
producer integration. Unsupported distance/consistency, Training, Readiness,
Expedition, and canonical-mountain producers remain explicitly unavailable
rather than fabricated. Production remains unchanged/default-safe. Native-device
QA was not run and remains a release gate.

### VR-C04 / VR-C06 Visual refinement completion

- VR-C04/C06 is complete after final architect-review fixes as a bounded
  documentation and visual-evidence gate;
  the completion report is `docs/VISUAL_REFINEMENT_COMPLETION_REPORT.md`.
- Final architect review is **PASS** with no P0/P1 blockers. Production
  fixture isolation records the first signed-in migration owner per fixture
  load, purges prior-owner-scoped keys before selecting another fixture, and
  on production boot purges flat plus current owner-scoped keys, including
  derived `summitready_training_goal`, before `AppContext` migration/hydration.
  Tests model A fixture migration, A→B account switch, second fixture
  selection for B, and production purge.
- Exactly five deterministic development-only personas are documented:
  Beginner, Active Hillwalker, Experienced Summiteer, Expedition-focused, and
  Advanced all-round. The fixed fixture clock is 2026-09-20 UTC. All ten PNGs
  are listed in `docs/VISUAL_QA_MANIFEST.md` and are synthetic deterministic
  data rendered through real production UI at 390 × 844, not production
  accounts or evidence.
- The seven centralized ranks are Trailhead, Hillwalker, Summiteer,
  Mountaineer, Alpinist, Expeditioner, and Summit Elite. Thresholds remain in
  `rankDomain.ts`; Summit Elite is centralized and Rank is non-persistent.
- Development Rank evidence is projected from each persona's same stored
  Explore hikes, completed goals, and completed Expedition route history. The
  expected evaluated ranks are Hillwalker, Summiteer, Mountaineer, and
  Alpinist; it is not a separate Rank-only fixture.
- Bounded presentation refinement covers SharedTabBar, Explore, Challenges,
  Track, Expedition discovery/Basecamp, and Rank journey while preserving
  semantics. Navigation remains **Basecamp | Explore | Track | Expeditions |
  You** and Challenges remains contextual.
- Verification passed: targeted devProfiles/rankEvaluator/navigation **3 files,
  20 tests**; bounded suite **24 files, 158 tests**; TypeScript; production
  iOS and Android Expo bundles; and `git diff --check`. Native-device QA is
  **NOT RUN**.
- The demo loader and Rank fixtures are `__DEV__` guarded and production
  rejection tested. Before production `AppContext` migration/hydration, every
  marked development fixture key is purged, preventing development-to-
  production fixture carryover. Protected Progress
  Mountain/cinematic/GPS/readiness/DNA/evidence/Expedition semantics are
  unchanged. No Stage 9 or production DB/schema/flags/deploy/release/auth/
  payment/privacy changes occurred.
- Screenshots were recaptured after the final architect-review fixes.
- Remaining P2/P3 work is bounded native-device QA and additional polish for
  content-length, image crops, spacing, labels, and empty/degraded states.

### VQ-C10 Visual QA and Rank completion

- VQ-C05/C09/C10 documentation is complete in
  `docs/SUMMITREADY_RANK_SYSTEM.md`, `docs/VISUAL_QA_MANIFEST.md`,
  `docs/VISUAL_QA_DESIGN_AUDIT.md`, and
  `docs/VISUAL_QA_COMPLETION_REPORT.md`.
- Rank is additive and non-persistent. Its evaluator requires exact
  signal-specific authority contracts and a complete explicit availability map;
  current callers keep producers unavailable, so the UI says “Evidence
  building” rather than promoting from local history.
- The final screenshot index covers every stable PNG/JPG with route/state,
  390 × 844 viewport, and capture label, including production Explore,
  Readiness, session, Elevation History, route/Mountain DNA, compact Base
  Camp, expanded Progress, and a completed personal Challenge. `/demo` is the
  existing development-only profile loader; no new fixture route or
  `visual-review` capture source remains.
- Final audit records fixed P1 issues for authority, deep-link shell sync,
  active-tab semantics, terminology, Community/Challenges wording, Track
  labeling, and harness boundaries. Remaining P2/P3 polish and native QA are
  explicit follow-ups.
- The pack meets principal visual judgement through real production
  screens/components and honest empty, degraded, unavailable, and completed
  states without claiming every native state. Final verification passes
  **24 files/156 tests**, focused navigation/Rank **2 files/15 tests**,
  SummitReady typecheck, and production iOS/Android Expo bundling.
  Pixel reconciliation confirms unobscured loaded Basecamp, populated Track
  (374.4 km/46 hikes, Hill Repeats CTA, recent activity), and signed-out/
  authority-unavailable empty Elevation History. Reduced-motion Expedition
  Base Camp shows the compact accessible fallback (27%, stage list, next-stage
  CTA); expanded Progress and the `__DEV__` demo show the visual renderer.
  Native-device QA remains pending. Rank fails closed
  for missing/undefined availability and degraded producers cannot promote.
  Do not begin Stage 9, production activation, migration, backfill, or release
  work.

### Previous task

Stage 6 — Expedition Experience is **COMPLETE** through S6-C10 under the
authorized runbook. Basecamp now has a compact Progress Mountain backed by the
same canonical typed presentation state as the preserved expanded Progress
experience. The next local stage, offline-safe exactly-once simulated
consequence, real/simulated/Elevation Bank separation, finished-checkpoint
recovery, and protected summit/cinematic handoff are implemented and documented.
This is a runbook completion, not mobile release approval.

PA-A2 remains a parked **BLOCKED** parallel infrastructure issue. Replit
Publish still omitted four required composite unique indexes from the unsafe
24-statement production diff. It was not applied, and production remains
unchanged/default-safe. PA-A2 does not block normal development, but no
production migration, flag, backfill, canonical-history switch, adapter
activation, or mobile release is authorized.

## Last completed task

O8-C10 completed the Stage 8 gate. The independent C09 review passed after the
GREEN self-fix loop corrected integration, identity, window, qualification,
correction/revocation, persistence, API compatibility, and owner-isolation
defects. Stage 9 implementation is not authorized. O8-C11 may perform only the
read-only Community & Competition audit and proposed command sequence, then
must stop.

S7-C10 completed the Stage 7 gate. See
`docs/STAGE_7_COMPLETION_REPORT.md` for the requirement matrix, implementation
inventory, environment/activation runbook, rollback guidance, explicit SDE
limitation, regression evidence, and native-device QA status. S7-C09 evidence
is in `docs/STAGE_7_REGRESSION_REVIEW.md`. Do not start Stage 8.

S6-C10 completed the Stage 6 gate. See
`docs/STAGE_6_COMPLETION_REPORT.md` for the exact architecture, commands,
regression evidence, protected-boundary review, limitations, and native-device
QA status. Stage 5 remains complete under
`docs/STAGE_5_COMPLETION_REPORT.md`.

PA-A2-C01/C02 confirmed the reviewed migration hashes, applied its unchanged
content to development only, and verified all five tables, constraints,
foreign keys, and indexes. Counts remain `canonical_activities=0`,
`tracked_hill_sessions=4`, and zero for every new ledger table. PA-A2-C03 found
that the 24-statement production diff omits
`canonical_activities_owner_id_uidx`,
`personal_elevation_credit_events_lineage_uidx`,
`expedition_runs_owner_id_uidx`, and
`expedition_stage_contributions_lineage_uidx`. None exists in production.
`docs/PRODUCTION_ACTIVATION_GATE_A2_REPORT.md` contains the evidence and stop
condition.

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
  switch canonical history consumers, or release mobile. Stage 5 is complete;
  do not begin Stage 6.

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
- S5-R01 audits the existing Readiness formula, evidence/target data flow, offline behavior, and duplicate calculations.
- S5-R02 defines `readiness-v2.0.0` with four dimensions, evidence provenance, recency, caps, degraded/unavailable states, explanations, actions, projections, and safety limitations.
- S5-R03 adds the pure owner-scoped Readiness engine and direct fixtures.
- S5-R04 adds stable-ID-only target-demand resolution with verified SDE/route/goal fallback provenance.
- S5-R05 adds deterministic next-action selection and same-engine estimated projection without persistence.
- S5-R06/R07 add Training Home and detailed “Am I Ready?” experiences.
- S5-R08 connects completed canonical/legacy-safe physical activity evidence while preserving immediate offline Finish/Save.
- S5-R09 verifies bounded mobile/API regressions, builds, typechecks, diff safety, and protected boundaries.
- S5-R10 records Stage 5 completion; native-device QA and any mobile release remain separate prerequisites.

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
- `docs/STAGE_5_READINESS_AUDIT.md`
- `docs/STAGE_5_READINESS_MODEL.md`
- `docs/STAGE_5_REGRESSION_REVIEW.md`
- `docs/STAGE_5_COMPLETION_REPORT.md`

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
- Publish-generated Stage 2 ledger diff: 24 additive statements, not applied;
  blocked because four reviewed composite unique indexes are omitted.
- No direct production SQL was run.
- No production backfill or mobile build was performed.
- Stage 2 migration `0002_stage2_activity_ledgers.sql` is applied and verified
  in development only; it remains unapplied to production.
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
- Stage 5 bounded verification passed SummitReady **63/63**, API **85/85**,
  SummitReady typecheck, API build, DB TypeScript, and `git diff --check`.
- Native-device QA was not run; no mobile/store release is approved.

## Decisions requiring review

- Production publication of migration `0002_stage2_activity_ledgers.sql` is
  blocked until the Publish analyzer includes all four reviewed composite
  unique indexes and a regenerated clean diff receives separate owner approval.
- Adapter activation and consumer switching require a later approved release plan.
- Keep the canonical bridge explicitly controlled by
  `CANONICAL_ACTIVITY_BRIDGE_ENABLED`; any production activation requires a
  separate owner-approved rollout.

## Stage 6 completion handoff

- The canonical journey is Expedition selection → Basecamp → next local stage
  → Track → completion → expanded Progress → summit.
- `selectExpeditionPresentation` is the sole compact/expanded simulated
  progress derivation. It clamps persisted simulated elevation, derives stable
  stage markers, and keeps linked physical activity facts separate.
- Basecamp presents identity/status, compact mountain, NEXT LOCAL STAGE, one
  primary Start Next Stage action, and concise journey history. The compact
  mountain taps through to the existing expanded Progress route.
- Selected-stage Finish/Save persists one physical activity plus one
  idempotent simulated Expedition contribution keyed by stable activity and
  route identities. A finished local checkpoint remains recoverable until Save
  and consequence acknowledgement.
- Final-stage completion returns to Basecamp so the protected
  route→summit-transition→cinematic/live-3D→climber-summit→completion sequence
  remains the owner of summit completion. Persisted expedition-scoped summit
  state and canonical 100% gating prevent repeat awards.
- Protected `MountainProgress.tsx`, `ExpeditionMountainProgress.tsx`, and
  `CinematicPrototype.tsx` were unchanged. Production/default-safe state,
  PA-A2 isolation, SDE identity/provenance, auth/privacy, payments, and release
  boundaries remain unchanged.
- Bounded suites, builds, typechecks, and architecture review passed. Native
  device QA was **NOT RUN** and is required before any mobile release.

## Recommended next action

Keep PA-A2 parked with production frozen/default-safe and await Replit support.
Do not begin Stage 7. Before any mobile release, complete native-device
airplane-mode, process-termination, reduced-motion/non-3D, and protected
cinematic QA, then obtain the separately required release approval.

## Git branch and latest commit SHA

- Repository: `mcarey888-lang/new`
- Branch: `virtual-expeditions-mode`
- Latest Phase 1 implementation SHA: `bf831921c9ae2b901a25b29bdc60ab8e8af4f26c`
- Publish marker SHA: `99c41a4abb2ee26ee03b43fd5320a3ca858b2a80`
- S2-C01 command SHA: `560e1fe3410d82af0abd20a0d3774555ce0ed48f`
- S2-R01 implementation SHA: `a1cfd9fac19f7d30571a45c1d0de8f6929a60b10`
- S2-C02 command SHA: `b3310b3dc30837df14a76fd79f8b3446430ac6e5`
- Stage 5 completion SHA: `393f559`
- Stage 6 implementation SHA: `2dc1e16`
- Stage 6 regression SHA: `4d93819`

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

## ART-C01–ART-C06 Batch 01 handoff

- The controlling review record is
  `docs/SUMMITREADY_ARTWORK_BATCH_01.md`.
- Artwork Admin now contains a development-only Batch 01 review gallery inside
  `/assets`. It renders all 12 independently stored masters with 16:9 and 4:5
  crop previews plus placement, focal/crop, provider, version, cost and status
  metadata.
- The API adds a development-only review-batch read/generation boundary backed
  by the existing OpenAI ImageProvider, crop service and Object Storage. It does
  not write signature challenge artwork rows and exposes no candidate approve
  or publish operation.
- Final result: 12/12 candidates, all 1536×1024 v1 masters, one generation
  attempt each, estimated total cost $0.48. Objective visual review found no
  authorised regeneration reason.
- Every candidate remains `REVIEW REQUIRED`, `approved=false` and
  `published=false`. No production schema/data change, approval, publication,
  deploy/release, Stage 9 work, or protected Progress Mountain/cinematic change
  occurred.
- Targeted artwork/admin verification passed. Full API TypeScript still retains
  unrelated pre-existing canonical/object-storage/OpenAI-library diagnostics;
  the production API bundle and running development workflow load the new
  route successfully.
- Human/ChatGPT review is the next and only authorised action. Do not approve,
  publish, derive runtime placements or begin another batch without new
  authority.

## GREEN Media Studio curation handoff

- `docs/MEDIA_STUDIO_CURATION_WORKFLOW.md` is the controlling workflow record.
- Batch 01 now uses its existing Object Storage manifest as a persistent
  per-version curation catalogue. Each exact version retains its prompt,
  generation metadata, master, crops, cost and editorial status.
- Assets (DEV) provides Approve, Reject, Regenerate, View Master, crop review,
  and version-history controls. Approve never publishes; Reject never deletes;
  regeneration is single-asset, objective-reasoned, confirmed and limited to
  two regenerations.
- Publish remains deliberately disabled until a persistent production Media
  catalogue is separately authorised and implemented.
- Signature bulk generation now requires an explicit confirmed target list and
  matching count, with a server hard cap of 25. The UI shows count,
  provider/model and estimated cost before starting.
- Mountain Heroes now supports review-status filtering, useful sorting, page
  jump and curated queue selection. No bulk generation action targets the
  catalogue.
- No artwork was generated, approved, rejected or published during this work.
  No production migration/data change, Stage 9 work, mobile calculation,
  Progress Mountain or protected cinematic change occurred.
