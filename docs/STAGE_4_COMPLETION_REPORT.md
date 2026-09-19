# Stage 4 completion report

**Review:** S4-C10 / S4-R10  
**Date:** 2026-09-19 UTC  
**Branch:** `virtual-expeditions-mode`  
**Result:** **COMPLETE** under the Stage 4 completion rule; production activation remains pending the documented RED gates.

## Scope and safety boundary

This was a bounded source-level regression/completion pass. No database
connection, migration application, production data mutation, feature-flag
activation, backfill, reconciliation, consumer switch, mobile release,
payment/subscription change, authentication/security change, public-privacy
change, or Stage 5 work was performed. Browser E2E was intentionally not run:
Expo web routing is not reliable native-flow evidence, and the required
Start → Track → Pause → Resume → Finish → Save journey needs a native-device
check.

The C10 runtime hardening has two parts: the presentation layer discriminates
an unavailable Elevation Bank response before formatting totals, and
`ElevationBankCard` no longer reads `query.data.recentCredits` directly when
the presentation is unavailable. Thus a 503 body with
`status: "unavailable"` renders the unavailable state without either
`toFixed` or footer access crashing the root boundary.

## Delivered Stage 4 functionality

- Canonical activity ingestion and development activation preserve one
  physical activity identity, stable offline/source UUIDs, owner isolation,
  explicit context links, retry deduplication, and retained changed-payload
  conflicts.
- Elevation Bank planning and presentation use eligible recorded GPS evidence,
  one effective credit per activity/rule, correction/revocation lineage, and
  explicit unavailable/empty/loading states. Manual, indoor, unavailable or
  untrusted evidence and simulated Expedition elevation do not credit the
  personal bank.
- Activity consequences retain separate Training and Expedition journeys.
  Expedition contributions are explicitly simulated and never claim Real
  Summit evidence.
- Completion presentation is offline-safe and does not fabricate pending
  network consequences.
- Canonical private history is owner-scoped and shadowed. Legacy history
  remains authoritative until equivalence is proven; linked canonical rows are
  deduplicated without fuzzy matching, and legacy-only rows remain visible.
- The Stage 2 migration remains additive, prepared, and unapplied.

## Regression/build evidence

| Area | Status | Exact evidence |
|---|---|---|
| Canonical identity, links, retries, delayed UUID, activation paths | **PASS** | API Vitest: `canonicalActivityContracts`, `canonicalActivityLinks`, `canonicalActivityDevelopmentActivation` — included in **92/92** passing tests across 9 files |
| Ledger planning, idempotency, owner isolation, simulated-only constraints | **PASS** | API Vitest: `stage2LedgerPlanning` — same **92/92** run |
| Elevation Bank qualification, totals, corrections, revocations | **PASS** | API Vitest: `elevationBank` — same **92/92** run |
| Elevation Bank authenticated route and unavailable boundary | **PASS** | API Vitest: `elevationBankRoute` — same **92/92** run |
| Activity consequence resolver and retry effects | **PASS** | API Vitest: `activityConsequences` — same **92/92** run |
| Canonical history route/projection and private owner boundary | **PASS** | API Vitest: `canonicalHistoryRoute`, `canonicalActivityProjections` — same **92/92** run |
| Offline reliability, identity, pause/resume contracts, local save/outbox behavior | **PASS** | SummitReady Vitest: `reliability`, `trackingLaunchContext` — included in **39/39** passing tests across 5 files |
| Completion summary and no-network/pending presentation | **PASS** | SummitReady Vitest: `activityCompletionPresentation` — same **39/39** run |
| Elevation Bank available/empty/loading/unavailable presentation | **PASS** | SummitReady Vitest: `elevationBankPresentation` — same **39/39** run, including the new unavailable 503 regression |
| Post-fix unavailable-state runtime refresh | **PASS** | Focused `elevationBankPresentation` tests **3/3**, SummitReady typecheck, clean Expo workflow restart, and latest refresh with no new browser console error; preview routing remains unreliable and this is not native UI E2E |
| Canonical/legacy history coexistence and context deduplication | **PASS** | SummitReady Vitest: `canonicalHistoryProjection` — same **39/39** run |
| API production bundle | **PASS** | `pnpm --filter @workspace/api-server run build` |
| SummitReady TypeScript | **PASS** | `pnpm --filter @workspace/summit-ready run typecheck` |
| Database package TypeScript | **PASS** | `pnpm --filter @workspace/db exec tsc --noEmit --pretty false` |
| Generated API clients/spec | **PASS** | No API/OpenAPI change in C10; `git diff --name-only -- lib/api-spec lib/api-client-react lib/api-zod` returned no files |
| Formatting/diff safety | **PASS** | `git diff --check` |
| Native device completion journey | **NOT RUN** | Browser E2E deliberately omitted; native QA is required before any mobile release |

## C10 bullet verification

- **One physical activity remains one canonical activity:** **PASS** —
  canonical identity and activation tests assert stable IDs and explicit
  links.
- **Retry cannot duplicate activity or Elevation Bank credit:** **PASS** —
  activation retry and ledger planning idempotency tests pass.
- **Multi-context activity does not double-credit:** **PASS** —
  consequence and ledger tests produce one Elevation Bank effect per physical
  activity/rule.
- **Offline Start/Pause/Resume/Finish/Save remains intact:** **PARTIAL** —
  source reliability, checkpoint, pause-time, launch, and local-save contracts
  pass; native-device interaction was not run.
- **Completion can succeed without network:** **PASS** at the presentation
  contract level — local completion remains renderable and consequences show
  pending/unavailable rather than blocking save; native-device confirmation is
  still required.
- **Unavailable Elevation Bank UI does not crash:** **PASS** at the bounded
  runtime-refresh level — both the response discriminant and the raw footer
  `recentCredits` access are guarded; the focused presentation test is 3/3,
  typecheck passes, and the post-restart refresh has no new browser console
  error. This is not native UI E2E evidence.
- **Training calculations unchanged except intentional presentation/integration:**
  **PASS** by focused consequence/reliability tests and unchanged legacy
  calculation boundaries.
- **Expedition calculations unchanged except intentional
  presentation/integration:** **PASS** by focused consequence/planning tests;
  simulated contributions remain explicit.
- **Simulated Expedition progress cannot create a Real Summit:** **PASS** —
  simulated-only metadata and real-summit qualification boundaries are tested.
- **Manual/indoor/untrusted evidence boundaries:** **PASS** — Elevation Bank and
  consequence tests reject these classes for personal credit.
- **Canonical/legacy history coexist safely:** **PASS** — route ownership,
  projection fallback, context filtering, and legacy-only preservation pass.
- **SDE unchanged:** **PASS** — Stage 4 changed-file review contains no SDE
  dataset or identity file; SDE references remain validation-only.
- **Progress Mountain/cinematic/live-3D unchanged:** **PASS** — no protected
  calculation, persistence, visual, cinematic, or live-3D path is in the
  Stage 4 diff.
- **No production migration/flag/release/payment/auth/public-privacy change:**
  **PASS** — repository status and Stage 4 operation records show no such
  operation.

## Remaining flags and pending migration

`0002_stage2_activity_ledgers.sql` remains unapplied. Production must keep
Stage 2 ledger, canonical adapter, development activation, and canonical
history controls disabled/unset. The current code hard-rejects production
ledger writes and canonical history even when the corresponding development
flags are true; a separately reviewed production-availability code change is
required before any future production rollout. Canonical history remains
shadow-only and legacy-authoritative.

## Native-device QA and release requirements

Before shipping any Stage 4 mobile behavior, create and test a native-compatible
mobile build. On a real device, verify authenticated and unauthenticated
unavailable states, offline Start → Track → Pause → Resume → Finish → Save,
restart recovery, delayed sync, completion pending state, and private history.
App Store/Play Store release remains a RED gate and was not performed.

## Exact RED-gate actions awaiting owner approval

1. Approve a controlled target and change window for applying
   `lib/db/migrations/0002_stage2_activity_ledgers.sql`; perform the documented
   read-only catalog checks with backup/PITR confirmation.
2. Approve a separately reviewed, observable, rollback-safe code release that
   introduces production Stage 2 availability; setting
   `STAGE2_LEDGER_ENABLED=true` alone cannot bypass the current hard gate.
3. Approve any adapter/bridge activation and consumer switch only after schema
   verification and legacy/canonical equivalence evidence.
4. Approve a native mobile build/store release only after device QA.
5. Keep all public privacy, competitive, payment, authentication, SDE,
   Progress Mountain, and cinematic/live-3D RED gates closed.

## Stage 5 prerequisites

Stage 5 must not begin from this checkpoint. Before it is considered, the
owner must accept this report, complete the approved Stage 2 migration and
verification, decide the production availability contract, prove canonical/
legacy equivalence for any consumer switch, complete native-device QA, and
separately approve all applicable release and protected-boundary gates.