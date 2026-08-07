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

## ModeTogglePill placement
`ModeTogglePill` is an absolutely-positioned overlay rendered as a sibling of `<Tabs>` inside BOTH `(tabs)/_layout.tsx` AND `(expedition)/_layout.tsx`. It sits at `top = safeAreaInsets.top + 4` — within the OS status-bar zone that screens already leave empty (screens pad by `insets.top + PILL_OFFSET` where `PILL_OFFSET = 52`). Uses `BlurView` on iOS, plain dark background on Android/web.

## Virtual tab hidden in Training shell
The `virtual` tab in `(tabs)/_layout.tsx` is set to `href: null` — its content is now served by `(expedition)/mountains.tsx` (a re-export). The old `v-home`, `v-mountain`, `v-hills`, `v-progress` screens are similarly hidden via `href: null` but kept for potential deep links.

## Expedition tab screens
- `base-camp.tsx` — expedition home, hero image + simulation score ring + hills list + target profile
- `mountains.tsx` — re-exports `(tabs)/virtual.tsx`
- `track.tsx` — re-exports `(tabs)/trails.tsx`
- `route.tsx` — new screen: elevation progress bar + recommended hills breakdown
- `progress.tsx` — re-exports `(tabs)/v-progress.tsx`
- `profile.tsx` — re-exports `(tabs)/account.tsx`

**Why:** Keeps code DRY for shared screens (track, profile) while giving expedition-specific screens (base-camp, route) their own dedicated implementation.

## TargetMountain type fields (important)
Use `summitElevation` (not `elevation`), `totalElevationGain` (not `elevationGain`), `difficulty` (not `terrain`), `estimatedDays: 1|2` (not `typicalDuration`), `notes` (not `description`).

## ProgressRing prop
The component uses `score` (not `progress`) as the primary prop name.
