# Stage 3 Navigation and UX Map

**Result:** S3-R01 COMPLETE
**Scope:** Read-only audit of the current mobile navigation, shell state, mode handoffs, and shared activity surfaces. No runtime behavior was changed.

## Current navigation graph

```text
Root Stack (_layout.tsx)
├─ /(auth) → sign-in/sign-up → /
├─ /(tabs) [Training shell]
│  ├─ dashboard (Home)
│  ├─ plan
│  ├─ challenges
│  ├─ trails (Track)
│  ├─ hills (My Hills)
│  └─ account (You/Profile)
├─ /(expedition) [Expedition shell]
│  ├─ base-camp (Home)
│  ├─ mountains (Explore)
│  ├─ track (Track)
│  ├─ route
│  ├─ progress
│  └─ profile (You/Profile)
└─ shared/root screens
   ├─ hike-tracking, completion, route/mountain details
   ├─ community/custom routes
   ├─ hidden compatibility routes (explore, log, hikes, virtual, v-*)
   └─ onboarding-demo and utility/account screens
```

`app/index.tsx` is the canonical Home resolver: it restores an active hike first, then sends an authenticated user to Expedition Base Camp or Mountains when `activeExpeditionId` is present, otherwise to Training Dashboard. The auth layout repeats part of this destination logic. The two shell layouts also contain mode-dependent redirects, so direct links can have more than one redirect owner.

## Canonical shell state and context

`AppContext.tsx` owns `shellMode`, `activeExpeditionId`, and separate Training/Expedition goal state. Mode changes persist user-scoped state before publishing React state. `ModeTogglePill` is shared by both shells and routes to the appropriate Home.

The intended state model is sound:

- `training` means a real target mountain, readiness, and preparation.
- `virtual`/Expedition means a simulated mountain adventure using local stages.
- Free Hike/Explore is an activity origin/context, not a third shell mode.

The main risk is navigation history, not state storage: both shells remain represented in the root stack and a mode switch can leave stale prior-shell routes available to Back. `ModeTogglePill` also captures the active expedition before its async persistence completes. C02 should harden the boundary without replacing the existing state model.

## Duplicated or conflicting navigation

- Training and Expedition each implement a complete tab shell rather than sharing the requested Home/Explore/Track/Community/You surface.
- Both layouts render their own mode toggle and own redirect logic.
- Root Home resolution and auth-layout Home resolution overlap.
- Legacy hidden routes remain registered alongside current shell routes; this preserves compatibility but makes route ownership unclear.
- Expedition has separate `mountains`, `route`, and `track` surfaces while Training has `trails`, `hills`, and root route/detail screens; several launch paths assemble similar route parameters independently.

## Ambiguous contexts

- Shared `hike-tracking.tsx` accepts Free Hike, Training, and Expedition route parameters, but the visible entry context is not always retained in the header or completion copy.
- Expedition simulated elevation, local route ascent, and real mountain altitude are adjacent concepts and require explicit labels.
- Training `trails`/`hills`, Expedition `mountains`/`route`, and Community routes can all launch tracking without one shared activity-context contract.
- “Save Route” is used for more than route saving, including ordinary activity completion.
- Expedition Track exposes resume affordances; the Training shell does not visibly surface the same restored active hike.

## Dead ends and lifecycle concerns

- Normal completion often routes into hidden `/hikes`, leaving no clear success/history destination.
- Expedition completion can remain on the completion UI when saving or expedition patching fails, with no retry-specific state.
- “Discard” uses `router.back()` after the checkpoint is cleared, which can return to an unexpected launch screen.
- A finished offline activity can be queued correctly, but Community/save completion does not consistently expose queue status or retry.
- A valid restored active hike is deliberately protected when a new launch has different route context, but only Expedition Track visibly offers resume.

## Header, Back, deep-link, and onboarding inconsistencies

- Shell headers differ between the two layouts and root-level detail screens; back behavior is therefore route-dependent.
- Root-stack retention can make Back return to the previous shell after a mode switch.
- Auth completion redirects to `/` through `ExpoLinking.createURL("/")`; intended deep-link destinations are not visibly preserved.
- `app/index.tsx`, auth layout redirects, and shell-layout redirects can compete when a direct link arrives during hydration.
- Production onboarding (`mode-select` → questionnaire/setup) and `/onboarding-demo` are parallel systems. The demo bypasses Clerk/AppProvider for normalized web paths and its Back action pushes the demo root, growing history.
- Clerk loading timeout can look like an auth failure while offline instead of explaining the protected/offline boundary.

## Shared versus mode-specific surfaces

### Shared surfaces to converge

- Home resolver and shell frame/header primitives.
- Explore/discovery entry and mountain/route detail presentation.
- Track launch context, active-session resume banner, start guard, and completion handoff.
- Community and You/Profile page-header, loading, empty, error, and card primitives.
- A typed activity context (`free_hike`, `training_session`, `expedition_stage`) passed into tracking and completion.

### Must remain mode-specific

- Training Home: target mountain/date, readiness, Today’s Mission, weekly preparation.
- Expedition Home/Base Camp: expedition hero, simulated progress, next stage, stage list, and protected Progress Mountain.
- Training plan/session calculations and Expedition stage/progress calculations.
- Summit completion/cinematic/live-3D behavior and all Summit Data Engine identity/data.

## Reuse opportunities

- `ModeTogglePill` and `setShellMode` as the single mode-switch boundary.
- `app/index.tsx` Home resolver as the only redirect owner after hydration.
- Existing `MountainHero`, route cards, mountain cards, Progress Mountain, achievement/stat cards, and page-header patterns.
- `activeHikeSession.ts`, `pendingHikeSelection.ts`, and `syncOutbox.ts` for a shared resume/queue-status surface.
- A typed track-launch builder used by Base Camp, Expedition Track, Training Trails, Community, and restore flows.
- A shared post-save policy that routes Training to history/plan context and Expedition to completion/Base Camp without duplicating the physical activity.

## Protected and offline boundaries

- Do not alter the proven Start → Track → Pause → Resume → Finish → Save engine, local UUID/checkpoint ownership, or authenticated outbox retry behavior.
- Starting tracking must not await network, reverse geocoding, route names, or map tiles.
- Summit Data Engine remains the authority for canonical mountain identity; no replacement catalogue or copied identity model.
- Progress Mountain elevation fill and summit → cinematic/live-3D transition are protected implementation boundaries.
- Community discovery may be network-dependent, but an already selected local activity must remain startable offline.
- Stage 2 migration `0002_stage2_activity_ledgers.sql` remains unapplied; Stage 3 must not introduce a production schema dependency.

## Low-risk direction for C02–C07

1. **C02 — Shared shell boundary:** introduce shared shell/context primitives and one post-hydration Home resolver; retain existing route groups and deep links while migrating incrementally. Add accessibility labels and safe-area-aware headers. Do not redesign onboarding.
2. **C03 — Training Home:** reorder existing dashboard content around target/date, readiness, Today’s Mission, and weekly progress. Preserve all readiness and training-plan calculations; remove only redundant visual nesting.
3. **C04 — Expedition Home:** reorder existing Base Camp content around expedition context, simulated progress, next stage, and Progress Mountain. Clarify simulated elevation labels without changing stage rules or protected transition code.
4. **C05 — Explore cohesion:** add shared discovery/context entry points that reuse existing mountain, route, local-hill, and Expedition data. Pass explicit context into existing detail/tracking screens; do not rebuild the Route Engine or duplicate SDE data.
5. **C06 — Track handoff:** build a shared Track launch surface and typed context payload around the existing tracker. Add duplicate-start protection, resume/queue status, and one completion policy while leaving offline persistence and default-off canonical adapters unchanged.
6. **C07 — Community/You:** reuse page headers, tokens, cards, and state components across existing Community and Profile surfaces. Show only released content; do not activate public competitive/privacy behavior.

## Audit files

- `artifacts/summit-ready/app/_layout.tsx`
- `artifacts/summit-ready/app/index.tsx`
- `artifacts/summit-ready/app/(tabs)/_layout.tsx`
- `artifacts/summit-ready/app/(expedition)/_layout.tsx`
- `artifacts/summit-ready/context/AppContext.tsx`
- `artifacts/summit-ready/components/ModeTogglePill.tsx`
- `artifacts/summit-ready/app/hike-tracking.tsx`
- `artifacts/summit-ready/utils/activeHikeSession.ts`
- `artifacts/summit-ready/utils/syncOutbox.ts`
