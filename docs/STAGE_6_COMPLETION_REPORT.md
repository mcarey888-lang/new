# Stage 6 Expedition Experience Completion Report

**Checkpoint:** S6-C10 / S6-R10
**Runbook:** `docs/AI_TASK.md`
**Branch:** `virtual-expeditions-mode`
**Implementation checkpoint:** `2dc1e16`
**Regression checkpoint:** `4d93819`

## Result

**Stage 6 is COMPLETE under the authorized runbook.** It is not mobile release
approval. Native-device QA was **NOT RUN** and remains required before release.
Stage 7 was not started.

The protected journey is now:

```text
Expedition selection → Basecamp → next local stage → Track → completion
→ expanded Progress → summit
```

Basecamp has a compact Progress Mountain. Tapping it opens the preserved
expanded Progress experience. Both views consume one canonical typed
presentation selector, and the final-stage journey returns through Basecamp
before the protected summit/cinematic handoff.

## Commands and responses

### SummitReady mobile

| Command | Response |
| --- | --- |
| `pnpm --filter @workspace/summit-ready test` | 9 files, **65/65 tests passed** |
| `pnpm --filter @workspace/summit-ready exec vitest run utils/readinessV2.test.ts utils/readinessAdapter.test.ts utils/readinessTargetDemand.test.ts utils/readinessActions.test.ts utils/canonicalHistoryProjection.test.ts utils/trackingLaunchContext.test.ts utils/reliability.test.ts utils/signatureExpedition.test.ts utils/manualExpedition.test.ts` | **68/68 tests passed** |
| Initial bounded Expedition/Readiness suite | **85/85 tests passed** |
| Final focused regression suites | 4 files, **37/37 tests passed** |
| `pnpm --filter @workspace/summit-ready run typecheck` | passed |
| `git diff --check 05ee329..HEAD` | passed |

The package test command includes Stage 6 shared-progress, contribution,
summit-transition, and completion-presentation suites.

### API, database, and build

| Command | Response |
| --- | --- |
| API canonical/consequence/readiness regression suite | **85/85 tests passed** |
| `pnpm --filter @workspace/api-server run build` | passed |
| `pnpm --filter @workspace/db exec tsc --noEmit --pretty false` | passed |

No workflow restart, production command, production database operation, or
mobile build/release command was run for S6-C10.

## Architecture delivered

### Canonical compact/expanded state

`artifacts/summit-ready/utils/expeditionProgress.ts` provides the pure typed
`selectExpeditionPresentation` read model over persisted `SavedExpedition`
state. It is the only place that derives:

- target simulated elevation;
- bounded current simulated elevation and `0..1` percentage;
- stable ordered stage identity/status;
- current and next stage;
- completed-stage count and canonical 100% eligibility.

The selector uses stable route/summit identities and existing completion
helpers, with legacy names only as a compatibility boundary. It does not use
real GPS elevation as simulated elevation and does not create a second store or
activity.

`CompactBasecampMountain` consumes that state and preserves the existing
mountain silhouette/route-fill renderer, simulated labels, stage cue,
accessible tap target, reduced-motion fallback, and `View progress` navigation.
Expanded Progress consumes the same target/current/stage state and retains its
detailed artwork, local/offline rendering, and back navigation.

### Basecamp UX

Basecamp was refined to present:

1. expedition identity and status;
2. compact Progress Mountain;
3. **NEXT LOCAL STAGE**;
4. one primary **Start Next Stage** action;
5. concise completed/current/upcoming journey history.

Completed expeditions have no stage-one fallback and no Start Next Stage CTA.
The shared `Basecamp | Explore | Track | Community | You` shell remains intact.

### Selected-stage consequence and offline recovery

Finish/Save remains:

```text
Start → Track → Pause → Resume → Finish → Save
```

One physical activity remains linked by canonical activity and expedition
identity. The selected-stage consequence atomically/idempotently adds the
stable completed route identity and the stage's simulated contribution,
distance/count fields, and credited activity identity. Retry cannot double
credit it, and recorded GPS ascent is never converted into simulated
elevation.

A finished local checkpoint remains persistable until Save and consequence
acknowledgement. Restart restores the finished Save state and stage context
without requiring network access. Local save and recording are not gated by
sync or Elevation Bank availability.

Completion presentation keeps these separate:

- **Your recorded activity:** real distance, ascent, duration, and activity
  facts;
- **Expedition progress:** simulated stage contribution and updated journey;
- **next-stage state:** current/completed/upcoming status;
- **Elevation Bank:** credited, pending, or unavailable only when independently
  eligible;
- **sync:** local save or later synchronization.

Simulated elevation is not real ascent, Elevation Bank credit, Training
Readiness evidence, or real summit evidence.

### Summit and cinematic sequence

The final selected-stage path returns to Basecamp instead of routing directly to
completion. The protected sequence remains:

```text
route reaches summit → Basecamp summit transition
→ existing cinematic/live-3D mountain → climber reaches summit
→ Expedition completion
```

Summit state is persisted and expedition-scoped. Canonical 100% plus stable
route completion are required before `completeExpedition`; route keys alone
cannot award completion. Duplicate callbacks, replay, reopen, deep link,
restart, reduced-motion, and non-3D fallback cannot issue a second award.

## Architect review history

The first S6-C03–C08 architecture review returned **FAIL** with concrete
blockers: selected-stage progress did not advance simulated elevation;
finished sessions were not durably recoverable; completed Basecamp could fall
back to stage one; summit guards were mount-local; completion presentation could
be stale or show Elevation Bank without eligibility; and expanded stage identity
and launch context were incomplete.

Authorized fixes:

- `0efdc27` — fixed expedition transition durability and consequences;
- `2dc1e16` — hardened finished recovery, canonical summit routing and
  completion gating, and expanded chart/identity continuity.

The follow-up review found the inner finished-checkpoint write guard and a
final-stage path bypassing Basecamp cinematic transition. `2dc1e16` fixed both.
The final architecture review returned **PASS** with no remaining concrete
Stage 6 code blocker. The complete regression evidence is in
`docs/STAGE_6_REGRESSION_REVIEW.md`.

## Protected boundaries and production state

Unchanged protected implementations:

- `artifacts/summit-ready/components/MountainProgress.tsx`;
- `artifacts/summit-ready/components/ExpeditionMountainProgress.tsx`;
- `artifacts/summit-ready/components/CinematicPrototype.tsx`.

`app/(expedition)/base-camp.tsx` was refined only within the authorized
additive/refactoring/UI scope; its protected mountain and cinematic behavior
was preserved. No substantial replacement or redesign occurred.

No production DB/schema change, migration, backfill, reconciliation,
activation, auth/privacy/payment/pricing change, SDE identity/provenance change,
mobile/store release, or deployment change was made. Production remains
unchanged/default-safe.

PA-A2 remains parked and isolated. The unsafe 24-statement Publish/migration
issue was not applied, inspected through a production action, or used as a
Stage 6 prerequisite.

## Limitations and native QA

Native-device QA was **NOT RUN**. Before release, physical iOS/Android testing
must cover:

1. airplane-mode Start → Pause/Resume → Finish → process termination →
   restored Save state → local Save/consequence retry;
2. final-stage Basecamp return and complete protected cinematic/live-3D handoff,
   including interruption and relaunch;
3. reduced-motion/non-3D fallback and completion persistence after restart.

This report does not claim production-data verification, native hardware
behavior, or mobile/store release approval.