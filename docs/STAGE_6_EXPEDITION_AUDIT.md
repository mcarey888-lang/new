# Stage 6 Expedition Experience Audit

**Checkpoint:** S6-C01 / S6-R01  
**Audit commit:** `05ee329` (`docs: authorize Stage 6 expedition experience`)  
**Scope:** read-only audit. No product, database, protected Progress Mountain, cinematic, release, or production files were changed.

## Status

**PARTIAL**

The existing Expedition architecture is substantial and has useful offline, canonical-identity, and simulated-contribution safeguards. It is not yet safe to claim a single shared compact/expanded progress state or an idempotent summit transition. Those are the minimum gaps for the next checkpoints. Production remains default-safe and PA-A2 remains parked.

## 1. Entry, discovery, and current-expedition flow

### Observed behavior

- `app/(expedition)/_layout.tsx:12-50` is the canonical Expedition route group. Its tabs are `base-camp`, `mountains`, `track`, `route`, `progress`, and `profile`; `expedition-complete` and `account` are programmatic-only. `initialRouteName` is `base-camp` when `activeExpeditionId` exists and `mountains` otherwise.
- The same layout synchronizes a deep-linked mode-specific route to `shellMode="expedition"` (`_layout.tsx:17-25`). This is an intentional mode-isolation exception, not a second shell.
- `app/(expedition)/mountains.tsx` re-exports `components/ExpeditionMountainsScreen.tsx`. Discovery and selection live there; selection ultimately calls `startExpedition`.
- `context/AppContext.tsx` is the persistence authority. `SavedExpedition` and `SavedExpeditionGoal` are declared around lines 185-223; the context contract is around 418-435; hydration/migration is around 854-1089; `startExpedition`, `setActiveExpedition`, `patchExpedition`, and `completeExpedition` are around 1305-1510; active/current values are exported around 2272-2275.
- Per-user AsyncStorage keys are selected around `AppContext.tsx:543,658-664`. Legacy goal and expedition-library data are migrated during hydration. The active expedition is also synchronized into the legacy `summitGoal` shape.

### Risk/gap

The library and legacy goal are dual-written. This preserves older saves but creates synchronization risk if a presentation computes progress from one copy while another screen reads the other. No separate canonical presentation selector currently prevents that drift.

### Proposed reuse

Keep `AppContext` as the owner of persisted expedition identity and lifecycle. Add a pure, typed read selector over the active `SavedExpedition` (with a documented legacy fallback only at the boundary). Do not create a second expedition store or duplicate activity model.

## 2. Basecamp hierarchy and current progress

### Observed behavior

- `app/(expedition)/base-camp.tsx` is the canonical Basecamp. It loads `CinematicPrototype` lazily (`:48-50`), reads the active expedition, linked sessions/explore hikes, completed routes, and the migrated-goal fallback (`:452-575`).
- The next stage is derived as the first incomplete `virtualHills` item (`:573-574`). The primary tracking CTA routes to `hike-tracking` with an `expeditionId` (`:1195`); stage-card navigation can route through `route` (`:1328`). Completion navigation targets `expedition-complete` (`:1165-1166,1253-1254`).
- Basecamp renders `ExpeditionMountainProgress` with `stages`, `completedRoutes`, `virtualHikeProgress`, and `allDone` (`:1216-1224`).
- Current displayed overall progress is:

  ```text
  activeProgress = activeExpedition.virtualHikeProgress ?? summitGoal.virtualHikeProgress
  linkedExpeditionElevation =
    sum(max(0, activity.elevationGain ?? 0)) over deduped linked sessions/explore hikes
  totalTrained = max(activeProgress.elevationGained, linkedExpeditionElevation)
  pct = min(100, round(totalTrained / totalGoal * 100))
  ```

  The linked activity list is merged by activity identity before aggregation.

### Risk/gap

`max()` masks divergence between persisted simulated progress and linked real activities. Other screens independently derive route completion, target elevation, and activity totals. The current UI is a nested dashboard rather than the Stage 6 hierarchy of identity → compact mountain → next local stage → one dominant CTA → concise journey.

### Proposed reuse

Preserve Basecamp as the route and reuse its linked-activity dedupe and `nextHill` ordering. Centralization should replace only duplicated *presentation derivation* with a pure selector; it must not change the existing persisted values or silently convert real elevation into simulated elevation.

## 3. Expedition, stage, run, and contribution contracts

### Observed behavior

- `SavedExpedition` includes stable `id`, challenge/route metadata, `virtualHills`, `completedRoutes`, `expeditionStatus` (`"saved" | "active" | "complete"`), `virtualHikeProgress`, and timestamps (`AppContext.tsx:185-223`).
- Activity/session records carry optional `expeditionId` and `syncState` (`"local_only" | "queued" | "synced"`) (`AppContext.tsx:319-347`).
- `creditedHikeIds` exists on expedition progress to prevent a saved GPS hike from being credited twice (`AppContext.tsx:178`).
- `utils/trackingLaunchContext.ts` carries stable `routeIdentityKey` and `summitIdentityKey` into tracking.
- `utils/activityCompletionPresentation.ts` and its tests model separate real facts, Expedition stage/contribution, and local/sync state. The current completion UI does not consistently expose all of those distinctions.
- `utils/stage2-activity-ledgers.ts` constrains simulated Expedition contribution separately from real ascent. `activityConsequences.test.ts` and `stage2LedgerPlanning.test.ts` cover this separation.

### Risk/gap

The data contracts are additive and mostly safe, but no single audited consequence transaction proves exactly-once stage contribution after retry. Elevation Bank is queried best-effort after online completion rather than represented by a durable consequence status. A stale UI can therefore look incomplete while the local activity is safely saved.

### Proposed reuse

Use the existing activity ID, `expeditionId`, `routeIdentityKey`, and `summitIdentityKey` as links. Keep one physical activity. Represent the Expedition result as a derived contribution/link, never as a duplicate activity or a real-ascent ledger entry.

## 4. Offline selected-stage tracking

### Observed behavior

- `app/hike-tracking.tsx` is the tracking implementation. The existing lifecycle is Start → Track → Pause → Resume → Finish → Save.
- Active tracking persists a checkpoint and queued GPS points locally; resume merges queued points; finish drains/stops and clears the active checkpoint; save queues while offline. `utils/reliability.ts` and `utils/reliability.test.ts` cover checkpoint restoration and activity dedupe.
- `trackingLaunchContext.ts` preserves route/stage identity at launch, so tracking does not need a network request to record the run.
- `logExploreHike` in `AppContext.tsx:1757-1775` dedupes by `activityId`.

### Risk/gap

The selected stage is currently a serialized launch snapshot, not an independently versioned cache with integrity/expiry semantics. Tests do not demonstrate corrupted-cache recovery, airplane-mode native behavior, or exactly-once Expedition consequence processing after restart.

### Proposed reuse

Retain the current local checkpoint and queue. If S6 adds selected-stage caching, make it additive and keyed by `expeditionId + routeIdentityKey`, with a version, captured-at time, and explicit unavailable/degraded result. Never gate recording or completion on network availability.

## 5. Progress Mountain contracts and reusable pieces

### Protected `MountainProgress`

`components/MountainProgress.tsx` is the protected rendering primitive.

- `ExpeditionStage` is `{ name: string; elevationGain: number; status: "completed" | "active" | "upcoming" }`.
- Props are `targetElevationGain`, `currentElevationGain`, ordered `stages`, optional `onSummitReached`, `style`, and optional `replayTrigger`.
- It renders the existing mountain artwork plus SVG route and markers using the shared `utils/mountainPath` geometry.
- The completed route length is driven by a clamped elevation ratio:

  ```text
  progress = clamp(currentElevationGain / targetElevationGain, 0, 1)
  ```

  The component animates the route to that ratio and invokes `onSummitReached` once per mounted progress cycle when the ratio reaches 1. `replayTrigger` is an animation replay input for the cinematic handoff, not a second progress calculation.

### Protected `ExpeditionMountainProgress`

`components/ExpeditionMountainProgress.tsx` is the existing card-plus-mountain composition. Its public inputs include `stages: NearbyHill[]`, `completedRoutes: string[]`, `targetElevation`, `currentElevation`, `highestPoint`, `onCtaPress`, `allDone`, a mountain image ref, and `replayTrigger`.

- It maps each hill to the protected `ExpeditionStage` contract.
- `isRouteCompleted(completedRoutes, hill)` determines completed status; the first incomplete route is active; later routes are upcoming.
- Stage gain is `hill.totalElevation ?? hill.elevation ?? 0`.
- Its card labels the target as **Simulated elevation gain** and uses stage cards plus a CTA.
- It currently computes target/current/stage presentation locally rather than consuming a shared typed progress selector.

### Full expanded flow

`app/(expedition)/progress.tsx` is the richer Progress destination. It reads `activeExpedition`, links activities by expedition ID, recovers completed routes from recoverable linked sessions, patches the expedition, calculates completed stage count, and renders `ExpeditionMountainProgress`. It routes stage actions to tracking with stable route/summit identity.

### Summit/cinematic path

- `MountainProgress` provides the visual `onSummitReached` callback.
- Basecamp detects all routes done (`base-camp.tsx:1164-1180`) and has cinematic state/handlers (`handleCinematicReady`, completion modal, and `CinematicPrototype` handoff).
- `CinematicPrototype.tsx` is lazily loaded by Basecamp and remains the protected live/cinematic implementation.
- `app/(expedition)/expedition-complete.tsx` snapshots the expedition, aggregates linked activity facts when available, and calls `completeExpedition` once through a mount-local `didComplete` ref. It falls back to Basecamp if no snapshot or if completion fails.
- The completion screen currently uses linked real activity elevation/distance/session counts when any are present, otherwise falls back to `virtualHikeProgress`. This is useful recovery behavior but is not a proof of an idempotent 100% summit transition.

### Reusable compact/expanded seam

The minimum safe seam is a pure selector/typed view model, not a visual replacement:

```text
ExpeditionProgressView {
  expeditionId: string
  targetSimulatedElevation: number
  currentSimulatedElevation: number
  simulatedPercent: number       // clamp(current / target, 0, 1)
  stages: ExpeditionStage[]
  currentStageIndex: number | null
  nextStageIndex: number | null
  completedStageCount: number
  isComplete: boolean
}
```

Inputs should be the active expedition’s persisted simulated progress, ordered stages, and canonical completion keys. The selector should be the only place that clamps/derives percentage and stage status. Compact Basecamp and expanded Progress should pass the resulting values to the existing components. Real linked activity facts remain a separate view model.

This seam does not alter `MountainProgress.tsx`, `ExpeditionMountainProgress.tsx`, `base-camp.tsx`, or `CinematicPrototype.tsx` behavior and does not introduce a competing formula.

## 6. Duplicate, dead, and legacy surfaces

### Observed behavior

- Legacy `summitGoal` and the expedition library coexist and are migrated/dual-written in `AppContext`.
- `ExpeditionMountainProgress`, `ExpeditionProgressCard`, `MountainProgress`, Basecamp, Progress, and completion each contain overlapping progress/stage presentation or aggregation.
- `completedRoutes` has legacy name-based values. `utils/routeIdentity.ts`/reliability helpers support stable completion keys, while `signatureExpedition.ts` can fall back to normalized route-name identity and `manualExpedition.ts` can retain saved route identity snapshots.
- The route group contains both current Expedition screens and hidden/programmatic legacy-compatible destinations (`track`, `route`, `profile`, `expedition-complete`).
- No fuzzy-name identity, new duplicate summit store, AI-invented route coordinates, or destructive SDE operation was observed.

### Risk/gap

Name-based legacy completion values and dual persistence are compatibility fallbacks, not safe new identity mechanisms. Any new compact or completion code that compares names directly could reintroduce duplicate-stage credit.

### Proposed reuse

Keep existing migration and legacy read fallbacks only at the boundary. New selectors and writes must prefer stable SDE/canonical route identities and `addUniqueCompletedRoute`/`routeCompletionKey` behavior. Do not delete legacy surfaces during Stage 6.

## 7. Tests and production gates

### Observed tests

Existing coverage includes:

- canonical activity consequences and simulated-vs-real ledger planning;
- readiness adapters excluding unfinished/local-ineligible records;
- elevation presentation;
- tracking launch context, checkpoint reliability, resume, and activity dedupe;
- signature/manual expedition identity and route completion;
- `activityCompletionPresentation.test.ts`, including local-save behavior and unavailable bank values.

### Missing or unclear tests

- compact and expanded views consume identical selector output;
- progress bounds, zero/missing target, missing progress, and 100% completion;
- stage-marker continuity after restart/reload;
- selected-stage cache version/corruption/expiry and offline restart;
- end-to-end offline Start → Track → Pause → Resume → Finish → Save with Expedition contribution;
- exactly-once consequence after retry;
- separate completion facts for real activity, simulated contribution, and pending Elevation Bank;
- idempotent/replay-safe 100% summit/cinematic transition;
- reduced-motion/non-3D summit fallback;
- native-device airplane-mode QA.

### Production and protected boundaries

- Stage 6 authorization (`docs/AI_TASK.md:186-189`) permits additive/default-off/refactoring work only.
- Production DB/schema changes, migration/backfill/reconciliation, production activation, mobile/store release, payments/auth/privacy changes, destructive SDE changes, and replacement/substantial redesign of protected mountain/cinematic functionality remain unauthorized.
- `docs/STAGE_5_REGRESSION_REVIEW.md` records that Progress Mountain, cinematic/live-3D, SDE identities, production flags, and releases remained unchanged/default-safe; native-device QA remains required.
- PA-A2 is the parked unsafe 24-statement Publish/migration issue. It is not to be applied, inspected through a production action, or used as a Stage 6 prerequisite.

## 8. Minimum safe next-step plan

1. Add the pure typed progress selector/view model described above, preserving current inputs and formulas.
2. Add unit tests for bounds, missing data, stage markers, reload, and 100%.
3. Make compact Basecamp consume that selector and navigate to the existing expanded Progress route; do not replace protected artwork or cinematic code.
4. Integrate the expanded view with the same selector and verify back navigation/offline rendering.
5. Refine completion presentation so real facts, simulated contribution, updated expedition state, and pending consequences are visibly separate.
6. Prove summit transition idempotency/replay safety and reduced-motion fallback without redesigning the protected cinematic.

Any need to replace or substantially redesign the protected Progress Mountain/cinematic path, alter SDE identities, apply a production migration, or release mobile must stop for explicit approval.

## Audit evidence and limitations

This audit is based on the current source and existing test/documentation evidence. It does not claim native-device behavior, production data verification, or a successful full offline run on hardware. Those remain release prerequisites.