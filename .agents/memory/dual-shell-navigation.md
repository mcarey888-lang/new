---
name: Dual-shell navigation
description: Training and Expedition shells — how they are structured, how the persistent pill switches between them, and how shell mode is persisted.
---

## Rule
The app has two completely separate Expo Router tab groups:
- `(tabs)` — Training shell (green accent, `T.green`)
- `(expedition)` — Expedition shell (blue accent, `T.blue`)

These are siblings under the root `<Stack>` in `app/_layout.tsx`. Switching between them uses `router.replace()` inside `ModeTogglePill`.

## Shell persistence
`shellMode: "training" | "expedition"` is stored in `AppContext` and persisted to AsyncStorage with key `summitready_shell_mode` (flat) or `summitready_shell_mode_<uid>` (per-user). The `app/index.tsx` routing reads the flat key to decide whether to `/(expedition)/base-camp` or `/(tabs)/dashboard` on launch.

## Goal isolation

Training and Expedition must persist separate goal snapshots. The public `summitGoal` is only the snapshot for the currently active shell; switching shells swaps it atomically.

**Why:** A single shared goal caused the selected expedition to appear as the Training summit, and asynchronous goal enrichment could overwrite the other shell after a switch.

**How to apply:** Scope every goal mutation, background response, migration, and clear/reset action to its owning shell. Only update the shared active snapshot when that shell is still selected.

`shellMode` is the only behavioral shell selector. Legacy `summitGoal.mode` may be inspected only while migrating old stored data; screens, layouts, deep links, and mutations must never use or write it to choose a shell. Both route-group layouts enforce this boundary.

**Why:** Duplicate Dashboard/Account controls used `setSummitGoal` as a mode switch, which regenerated Training state and allowed hidden Virtual deep links to mix both shells.

**How to apply:** New navigation must call `setShellMode`, and legacy Virtual routes must redirect one-way into Expedition-owned screens rather than being re-exported by those screens.

## ModeTogglePill placement
`ModeTogglePill` is an absolutely-positioned overlay rendered as a sibling of `<Tabs>` inside BOTH `(tabs)/_layout.tsx` AND `(expedition)/_layout.tsx`. It sits at `top = safeAreaInsets.top + 4` — within the OS status-bar zone that screens already leave empty (screens pad by `insets.top + PILL_OFFSET` where `PILL_OFFSET = 52`). Uses `BlurView` on iOS, plain dark background on Android/web.

## Legacy Virtual routes
The hidden Training `virtual` and `v-*` routes are compatibility redirects only. Expedition screens must use Expedition-owned components; never re-export a legacy redirect route or it can create a self-redirect loop.

## Cross-shell utility screens
Never navigate from Expedition directly into a `(tabs)` route. The Training layout guard will redirect it to Base Camp while `shellMode === "expedition"`. Shared utility screens must be exposed through a hidden Expedition route or a root Stack route.

**Why:** Expedition Profile's Account Settings link targeted `(tabs)/account`, so the Training shell guard immediately sent users back to Base Camp.

**How to apply:** Keep shell-owned tab links within their current route group. For shared screens, reuse the implementation behind a shell-local hidden route and link to that route.

## Expedition tab screens
- `base-camp.tsx` — expedition home, hero image + simulation score ring + hills list + target profile
- `mountains.tsx` — Expedition-owned mountain browse and selection screen
- `track.tsx` — re-exports `(tabs)/trails.tsx`
- `route.tsx` — new screen: elevation progress bar + recommended hills breakdown
- `progress.tsx` — active-Expedition progress and linked activity totals
- `profile.tsx` — re-exports `(tabs)/account.tsx`

**Why:** Keeps code DRY for shared screens (track, profile) while giving expedition-specific screens (base-camp, route) their own dedicated implementation.

## TargetMountain type fields (important)
Use `summitElevation` (not `elevation`), `totalElevationGain` (not `elevationGain`), `difficulty` (not `terrain`), `estimatedDays: 1|2` (not `typicalDuration`), `notes` (not `description`).

## ProgressRing prop
The component uses `score` (not `progress`) as the primary prop name.
