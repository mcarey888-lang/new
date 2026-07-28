---
name: Virtual Expeditions Stage 3 — mode toggle + UI
description: Key architectural decisions for the mode toggle pill, VirtualExpeditionView component, patchGoal, and shared confirmation helper.
---

## Mode toggle placement (dashboard.tsx)
The pill floats **absolutely** over the hero image as a sibling to the ScrollView inside LinearGradient, not inside the ScrollView. This avoids breaking the full-bleed hero.

`topInset` passed to `MountainHero` is increased by 44px (`insets.top + 44` vs the previous `insets.top`) to push hero content (logo, mountain name) down so it doesn't overlap the pill.

Use `style={{ pointerEvents: "box-none" } as any}` on the floating container so scroll events pass through to the ScrollView. Avoid the deprecated `pointerEvents` prop.

**Why:** Direct placement inside ScrollView would break the hero image going edge-to-edge; absolute positioning keeps the existing design intact.

## patchGoal — field-only goal update
Added `patchGoal(updates: Partial<SummitGoal>)` to AppContext. Updates summitGoal state + AsyncStorage without regenerating the plan or resetting sessions.

Used by VirtualExpeditionView to cache `targetMountain`, `simulationScore`, `simulationScoreBreakdown`, `virtualHills` after a successful API call, so the endpoint is only hit once (or on manual refresh).

**How to apply:** Always use `patchGoal` for Virtual Expedition result caching. Never use `setSummitGoal` (full reset) or `changeSummit` (regenerates plan) for this purpose.

## VirtualExpeditionView (components/VirtualExpeditionView.tsx)
- Checks `summitGoal.simulationScore && summitGoal.targetMountain && summitGoal.simulationScoreBreakdown` to decide if cached data exists.
- Auto-fetches on mount if no cache; `fetchExpedition(true)` forces a refresh.
- Altitude context note shown when `breakdown.altitude < 50 && target.summitElevation > 1500`.
- Weekend pairing inferred from `virtualHills.length >= 2` (1-day: 1 hill + reps; 2-day: Sat/Sun split).

## Shared confirmModeSwitch (utils/modeSwitch.ts)
Imported by both `dashboard.tsx` and `account.tsx`. Shows Alert.alert on native, `window.confirm` on web. When switching to Expedition, strips Virtual cache fields (`targetMountain`, `simulationScore`, etc.) so a fresh fetch happens on next Virtual load.

## plan.tsx virtual branch
Early return added BEFORE the `trainingPlan.length === 0` guard but AFTER the `!summitGoal` guard:
```tsx
if (summitGoal.mode === "virtual") {
  return <VirtualExpeditionView summitGoal={summitGoal} patchGoal={patchGoal} insets={insets} />;
}
```
VirtualExpeditionView manages its own LinearGradient + ScrollView. The entire existing Expedition rendering path is untouched.
