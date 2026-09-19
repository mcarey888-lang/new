# Stage 6 Expedition Presentation Model

**Checkpoint:** S6-C02 / S6-R02  
**Status:** COMPLETE  
**Scope:** Documentation-only canonical presentation and state specification.

This model follows the S6-C01 audit and does not replace the existing Expedition
store, activity records, Progress Mountain artwork, or cinematic implementation.
`AppContext` remains the persistence authority. The future shared selector is a
pure read model over the persisted active `SavedExpedition`; it preserves the
current simulated-progress behavior and stable completion identities.

## 1. Canonical screen hierarchy

The single Expedition journey is:

```text
Expedition selection
  → Basecamp
  → next local stage
  → Track
  → completion
  → progress
  → summit
```

### Expedition selection

`mountains` is the discovery and selection surface. Selecting an expedition
creates or activates one persisted `SavedExpedition` through the existing
`startExpedition`/`setActiveExpedition` lifecycle. The selection must retain the
catalogue/SDE identity, route and summit identity keys, stage snapshots, and
provenance already supplied by the source. It must not invent coordinates or
create a duplicate activity or summit store.

When no active expedition exists, selection is the useful empty state and the
Expedition shell opens there. A saved but inactive expedition can be selected
without losing another expedition's progress.

### Basecamp

Basecamp is the active expedition dashboard in this order:

1. expedition identity and status;
2. compact Progress Mountain;
3. `NEXT LOCAL STAGE`;
4. one primary `Start Next Stage` action;
5. concise completed/current/upcoming journey history.

The compact mountain is a tappable doorway to the existing expanded `progress`
route. Basecamp must not calculate a competing percentage or turn real activity
elevation into simulated Expedition elevation.

### Next local stage and Track

The next stage is the first ordered stage not represented by a stable completed
route identity. Starting it uses the existing
`buildExpeditionStageLaunchContext` contract:

- `expeditionId`;
- `routeIdentityKey`;
- `summitIdentityKey`;
- objective type;
- serialized stage snapshot.

Tracking remains offline-first:
`Start → Track → Pause → Resume → Finish → Save`.
Network availability cannot gate recording, saving, or local completion.

### Completion, progress, and summit

Completion first presents the saved physical activity facts and the separate
simulated Expedition consequence. It then returns to the updated journey or
opens expanded Progress. Expanded Progress remains the detailed Progress
Mountain destination and consumes the same presentation state as Basecamp.

When the shared state reaches 100% through the ordered stage completion path,
the summit transition is eligible once. The existing summit callback and
protected cinematic/live-3D handoff remain the visual implementation. A
successful handoff leads to climber summit and Expedition completion; it does
not award real ascent or duplicate a physical activity.

## 2. Canonical presentation state

The selector input is the active persisted `SavedExpedition`, its ordered
`virtualHills`, stable completion keys, and the already-linked activity facts
kept separate from simulated progress. Legacy `summitGoal` data is read only as
a migration-boundary fallback when an active saved expedition field is absent.

The canonical presentation state is:

```ts
type ExpeditionPresentationState = {
  mode: "expedition";
  status: "no_expedition" | "active" | "completed";
  expeditionId: string | null;
  challengeId: string | null;
  challengeName: string | null;
  targetMountainName: string | null;

  progress: {
    targetSimulatedElevationM: number;
    currentSimulatedElevationM: number;
    simulatedPercent: number; // 0..1, clamped
    completedStageCount: number;
    totalStageCount: number;
    currentStageIndex: number | null;
    nextStageIndex: number | null;
    isComplete: boolean;
  };

  stages: Array<{
    index: number;
    routeIdentityKey: string;
    summitIdentityKey: string;
    name: string;
    simulatedElevationGainM: number;
    status: "completed" | "current" | "locked" | "upcoming";
  }>;

  nextStage: {
    index: number;
    name: string;
    routeIdentityKey: string;
    summitIdentityKey: string;
    simulatedElevationGainM: number;
  } | null;

  summit: {
    eligible: boolean;
    transitionState: "not_ready" | "ready" | "started" | "completed";
    completionAwarded: boolean;
  };

  availability: "ready" | "offline" | "degraded" | "unavailable";
};
```

The selector is the sole place that clamps the simulated percentage and derives
stage markers. Its calculation remains:

```text
target = max(0, sum(stage simulated elevation gains))
current = max(0, persisted virtualHikeProgress.elevationGained)
percent = target == 0 ? 0 : clamp(current / target, 0, 1)
```

Existing persisted values remain authoritative; no `max(real elevation,
simulated elevation)` presentation formula is introduced. Real linked activity
facts are a separate model and are never silently credited as simulated
elevation.

## 3. Identity and consequence rules

- `SavedExpedition.id` identifies the active run.
- Catalogue/SDE `challengeId`, `routeIdentityKey`, and `summitIdentityKey`
  remain stable identity fields where present.
- `completedRoutes` is interpreted through stable route completion helpers.
  Legacy name values are boundary compatibility only, not a new identity rule.
- A physical GPS activity exists once and is linked by `activityId` and
  `expeditionId`; `creditedHikeIds` prevents duplicate credit.
- Simulated Expedition progress is not real ascent, Elevation Bank credit,
  Readiness evidence, or real summit evidence.
- Elevation Bank eligibility is independently determined and may be
  `credited`, `pending`, or `unavailable`.

## 4. Stage state and labels

Stage markers are ordered and deterministic:

- **completed:** stable completion identity is present;
- **current:** first incomplete selectable stage;
- **locked:** a prerequisite stage is incomplete or the stage is unavailable;
- **upcoming:** later stage whose prerequisites are not yet reached.

The current stage is the next actionable local stage. A completed Expedition
has no next stage and shows a summit/completion state instead.

Required user-facing semantics:

- simulated values: **Simulated elevation gain**;
- physical activity values: **Your recorded activity**;
- pending consequence: **Saved locally — consequences will sync**;
- unavailable remote consequence: **Elevation Bank unavailable**;
- offline state: **Offline — tracking and saving still work**.

Avoid language implying that simulated metres were climbed, banked, or proven by
GPS.

## 5. Real, simulated, and completion presentation

After Finish/Save, completion presents these independent sections:

1. **Your recorded activity:** distance, ascent, duration, and activity ID
   facts when recorded.
2. **Expedition progress:** selected stage and simulated contribution.
3. **Expedition journey:** updated completed/current/next stage state.
4. **Elevation Bank:** credited, pending, or unavailable only when independently
   eligible.
5. **Sync:** saved locally or ready to sync.

The existing `buildActivityCompletionPresentation` contract is the compatible
source for these distinctions. A local save is successful even when sync or
Elevation Bank data is unavailable.

## 6. Offline, degraded, and unavailable behavior

### Ready

Render all identity, stage, compact mountain, next-stage action, and progress
values from local persisted state. Network enrichment may update metadata later.

### Offline

Render cached expedition/stage context, label remote consequences as pending,
and allow the complete tracking lifecycle without network gating. Persist the
checkpoint, queued points, activity, and Expedition link locally. On restart,
restore the checkpoint or saved result before attempting enrichment.

### Degraded

If metadata or Elevation Bank enrichment fails but local identity and stage
snapshot are valid, keep the journey actionable and clearly label the missing
remote value. Do not substitute real or invented values.

### Unavailable

If no valid active expedition or stage identity is available, do not start
Expedition tracking. Show a recovery action to select an expedition or return
to Basecamp. If a stage snapshot is corrupt/expired, preserve the saved
activity/checkpoint and present the stage as unavailable rather than guessing
route facts.

## 7. Compact and expanded Progress Mountain contract

Both views consume the same `ExpeditionPresentationState.progress` and
`stages` output in the same render pass. Neither view owns a progress formula,
stage identity lookup, or independent persisted state.

### Compact Basecamp contract

- roughly 30–35% of useful screen height;
- existing recognizable mountain silhouette and route-fill language;
- current simulated elevation and percentage with honest labeling;
- current/next marker from `currentStageIndex`/`nextStageIndex`;
- tappable whole component with accessible `View progress` affordance;
- reduced-motion and accessible fallback;
- no nested competing dashboard.

Tap navigates to the existing expanded Progress route, carrying no copied
progress snapshot that could drift.

### Expanded Progress contract

- preserves the existing detailed `MountainProgress` and
  `ExpeditionMountainProgress` behavior and artwork;
- receives the same target, current, stage order, and completion identities;
- supports back navigation to Basecamp without reset or recalculation drift;
- renders from local state when offline;
- retains the protected summit callback/cinematic handoff.

Any replacement or substantial redesign of the protected visual/cinematic path
requires explicit owner approval.

## 8. Summit transition and idempotency

Summit eligibility is true only when the canonical selector reports
`isComplete` (100% bounded simulated progress and all required stable stages
completed). The transition is a monotonic state machine:

```text
not_ready → ready → started → completed
```

The transition must be idempotent:

- one Expedition run can award completion once;
- repeated mountain callbacks, replay, route remount, deep link, or restart
  must observe `started`/`completed` and not award again;
- `completeExpedition` remains the persisted lifecycle operation;
- cinematic replay is visual only and cannot create a second completion;
- recovery opens the completion/progress state if the cinematic is interrupted.

Reduced-motion and no-3D paths must reach the same `completed` state and retain
the same semantic facts; they are fallbacks, not a second award path.

## 9. Restart, empty, and completed states

- **No expedition:** `status = "no_expedition"`, no mountain progress or
  tracking CTA; offer expedition selection.
- **Active/no progress:** render 0%, all stages current/locked/upcoming as
  ordered, and `Start Next Stage`.
- **Active/in progress:** render persisted simulated progress and the first
  incomplete stage; never reset on reload.
- **Tracking recovery:** restore the local checkpoint and launch snapshot, or
  show an explicit unavailable/degraded state without discarding saved facts.
- **Completed:** `status = "completed"`, 100% bounded progress, no next-stage
  CTA, replay/reopen is safe, and completion is not awarded again.
- **Missing/corrupt data:** preserve local activity data, expose an actionable
  recovery state, and never invent identity, route, elevation, or coordinates.

## 10. Boundaries and implementation sequence

This specification authorizes only additive, default-safe work:

1. implement the pure typed selector and tests;
2. feed compact Basecamp and expanded Progress from it;
3. refine completion facts and consequence status;
4. prove idempotent summit/replay and reduced-motion fallback.

No production DB/schema change, destructive migration, SDE identity mutation,
auth/payment/privacy change, mobile release, or PA-A2 action is required or
authorized. Native-device offline and reduced-motion QA remain release
requirements.