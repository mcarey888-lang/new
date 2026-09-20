# Stage 8 Challenges & Achievements — Completion Report

Date: 2026-09-20 UTC
Branch: `virtual-expeditions-mode`
Authorization baseline: `81711de`
Implementation/regression checkpoint: `27b27a8`

## Completion status

Stage 8 is **COMPLETE** under O8-C10.

This means the authorized local Challenge & Achievement foundation, additive
integration, UX, and regression gate are complete. It does not authorize a
production migration, production activation, public competition, deployment,
mobile/store release, or Stage 9 implementation.

Native-device QA was **NOT RUN** and remains a release gate.

## Completion criteria

| O8-C10 criterion | Result | Evidence |
|---|---|---|
| Deterministic, evidence-aware rules | PASS | Versioned definitions, exact qualification purpose/rule, explicit evidence classes, resolved windows, canonical authority ordering |
| One activity can produce multiple consequences without duplication | PASS | Stable aggregate/contribution/award identities; owner-scoped projection; retry/restart/correction tests |
| Real/manual/indoor/simulated semantics remain distinct | PASS | Evidence mapping and qualification policies never promote manual, indoor, unverified, or simulated evidence into trusted outdoor qualification |
| Personal vs future competitive eligibility is explicit | PASS | Personal recognition and competitive purpose/status are separate; public competition remains disabled |
| Core challenge and achievement UX exists | PASS | Additive Stage 8 projection on Challenges, Account, Profile, and completion presentation |
| Offline/pending behavior is honest | PASS | Pending/unavailable states are explicit; unsupported producers do not fabricate progress or titles |
| Protected systems remain intact | PASS | Progress Mountain/cinematic unchanged; tracker lifecycle not redesigned; Readiness/Expedition/SDE boundaries preserved |
| Production remains unchanged | PASS | No production schema, migration, flag, backfill, reconciliation, deploy, or release |
| Regressions pass or limitations are documented | PASS | See `docs/STAGE_8_REGRESSION_REVIEW.md` |

## Delivered architecture

### Versioned domain and catalogue

The additive `challenge-domain-v1` model defines:

- challenge and achievement identity/version;
- family and target;
- personal versus competitive-candidate scope;
- availability and unavailable reason;
- accepted evidence classes;
- exact qualification purpose;
- pinned producer rule version;
- required qualification/competitive status;
- explicit window contract;
- stable projection and award records;
- evidence lineage, source cursor, corrections, and revocations.

The legacy challenge/achievement catalogues and stored IDs remain supported.
They were not replaced.

### Deterministic evaluator

The evaluator:

- isolates evidence by owner;
- reduces one authoritative record per lineage;
- applies correction authority, source cursor, revocation precedence, and a
  locale-independent canonical serialization tie-break;
- rejects missing/wrong purpose, producer rule, evidence class, owner, window,
  competitive status, SDE identity, or provenance;
- keeps aggregate identity independent of the growing evidence set;
- preserves evidence-specific contribution identity;
- keeps non-repeatable award identity stable;
- supports explicit correction and revocation.

### Persisted owner-scoped projection

The mobile `Stage8Provider`:

- keys persisted state by Clerk user;
- serializes hydration and ingestion;
- invalidates queued work on owner change;
- retries failed persistence with bounded backoff;
- keeps independent monthly windows;
- reconciles authoritative Elevation Bank corrections and revocations;
- prevents stale or reordered evidence from replacing authoritative state;
- does not replay confirmed titles on identical retry/restart.

### Elevation Bank integration

The API contract adds `recentEvents` while preserving `recentCredits`.

- `recentEvents` is a complete owner-scoped latest-per-activity state snapshot
  and includes credited, corrected, and revoked events.
- Global event time orders authority across producer rule changes.
- `recentCredits` remains an independent backwards-compatible effective-credit
  read with its prior effective-time order and limit.
- Generated React and Zod clients were regenerated.
- No database or production activation change was required.

### UX

Stage 8 is shown additively on:

- Challenges;
- Expedition Profile;
- Account/Profile summary;
- eligible hike completion consequence presentation.

Only a newly confirmed consequence whose accepted evidence includes the current
canonical activity is shown as confirmed. Revoked records are excluded from
confirmed/tracked totals.

## Evidence semantics

### Trusted current producer

Confirmed Elevation Bank events can produce:

- monthly eligible elevation challenge progress;
- eligible cumulative elevation achievement progress/award.

They use explicit Europe/London calendar windows and stable canonical activity
lineage.

### Explicitly unavailable producers

The current app does not expose an accepted durable consequence identity at a
safe integration point for every catalogue family. The following remain
explicitly unavailable rather than inferred:

- distance and consistency;
- Training and Readiness milestones;
- Expedition milestones;
- canonical mountain achievements without exact SDE target and provenance.

Activating these later requires an exact owner-scoped producer identity,
qualification purpose/rule, correction/revocation semantics, and provenance.
Raw GPS, legacy manual completion, simulated gain, or display state must not be
used as a shortcut.

## Verification

Final Stage 8 evidence:

- SummitReady configured suite: **22 files / 141 tests passed**.
- Earlier broad SummitReady utility regression: **23 files / 160 tests passed**.
- SummitReady TypeScript: **passed**.
- API suite: **29 files passed, 1 skipped / 356 tests passed, 4 optional DB
  tests skipped**.
- API production bundle build: **passed**.
- OpenAPI React/Zod generation: **passed**.
- `git diff --check`: **passed**.
- Independent O8-C09 architecture review: **PASS**.
- Expo and API workflows: **running**; current workflow logs show successful
  Metro bundling and API startup with no new Stage 8 runtime error.

Workspace-wide library/API typecheck remains limited by unrelated pre-existing
OpenAI integration and broader API diagnostics. Stage 8 generated outputs,
mobile typecheck, API tests, and API production build pass.

## Safety and protected boundaries

The Stage 8 run did not:

- apply production SQL/schema/migrations;
- enable production flags or public leaderboards;
- backfill or reconcile production data;
- deploy, publish, or release;
- alter auth, privacy, payments, pricing, RevenueCat, or Stripe;
- redesign the offline tracker;
- replace Progress Mountain or cinematic behavior;
- mutate canonical SDE identity;
- execute PA-A2 or PA-A3;
- begin Stage 9 implementation.

The unrelated generated mockup file remains outside Stage 8 commits.

## Native-device release gate

Native-device QA is outstanding. Before any mobile release, verify on iOS and
Android:

1. qualifying Finish/Save produces one consequence;
2. retry/reopen does not replay it;
3. correction/revocation changes the projection;
4. offline finish remains pending/unavailable until authoritative sync;
5. account switching never exposes another owner's projection;
6. Challenges, Account, Profile, and completion layouts remain accessible;
7. reduced-motion and screen-reader behavior is acceptable.

## Rollback

Stage 8 is additive. A code rollback can remove the provider, projection UI,
and additive event response consumption while retaining the unchanged legacy
challenge state and `recentCredits` contract. No database rollback is needed
because Stage 8 introduced no schema or migration.

## Next authorized action

Because O8-C10 is COMPLETE, O8-C11 may perform a **read-only Stage 9 Community &
Competition audit and command proposal only**. Stage 9 implementation,
production schema, leaderboard activation, and privacy decisions remain
prohibited.