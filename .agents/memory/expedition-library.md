---
name: Expedition Library Architecture
description: SavedExpedition data model, dual-write pattern, and library actions in AppContext
---

## The pattern

`summitGoal` remains the **live working copy** for the active expedition — all existing screens (dashboard, plan, virtual.tsx progress view) continue reading from it unchanged.

`expeditions: SavedExpedition[]` + `activeExpeditionId: string | null` is the **permanent library** — persisted to `summitready_expeditions_${uid}` and `summitready_active_expedition_id_${uid}`.

These are kept in sync automatically:
- `patchGoal(updates)` — if `activeExpeditionId` is set, auto-syncs the expedition-specific fields (`virtualHills`, `expeditionPlan`, `simulationScore`, `simulationScoreBreakdown`, `targetMountain`, `virtualHikeProgress`, `completedRoutes`) back to the matching `expeditions[]` entry.
- `patchExpedition(id, updates)` — patches the library entry AND syncs to `summitGoal` if patching the active expedition.

## Key API

```typescript
startExpedition(data)        // creates library entry, sets active, updates summitGoal WITHOUT resetting sessions
setActiveExpedition(id)      // switches active, syncs summitGoal fields from selected entry
patchExpedition(id, updates) // updates library entry + keeps summitGoal in sync
completeExpedition(id, stats) // marks complete, clears activeExpeditionId
activeExpedition             // derived: expeditions.find(e => e.id === activeExpeditionId) ?? null
```

## Critical: startExpedition vs setSummitGoal

**`startExpedition` does NOT reset sessions or training plan.** This is intentional — the user's activity log persists across expedition switches. Use `startExpedition` for ALL expedition starts. `setSummitGoal` still used for training-mode goal changes (it resets sessions by design).

## Migration

On first load, if `expeditions[]` is absent but `summitGoal.mode === "virtual"` exists, auto-migrates to a library entry with `id = exp_migrated_${Date.now()}`. Persists immediately so it only runs once.

## SigChallenge field name

`SigChallenge.challengeId` (not `.id`) — pass as `challengeId` field when calling `startExpedition`.

## Base Camp "My Expedition" (task #110)

- `completedRoutes` drives stage dots and progress ring (not elevation math)
- `routePct = completedStages / stages.length * 100` — shown on ring
- `nextHill = virtualHills.find(h => !completedRoutes.includes(h.name))` — first incomplete
- Quick Start button on hero → `/hike-tracking?hillName=nextHill.name`
- Expedition concept text from `(summitGoal as any)?.expeditionPlan?.concept`

## Post-tracking route completion prompt (task #111)

- In `hike-tracking.tsx`, after `handleSave` succeeds:
  - If `summitGoal?.mode === "virtual" && activeExpeditionId` → show `showExpeditionPrompt` modal
  - Else → navigate to `/(tabs)/hikes` as before
- Modal shows next incomplete expedition hill name
- "Yes" → `patchExpedition(id, { completedRoutes: [...existing, toMark] })` → navigate to `/(expedition)/base-camp`
- "Not quite" → navigate to `/(expedition)/base-camp`

## Why

Single summitGoal was overwritten on expedition switch, destroying progress. Library model preserves all progress; switching is safe and instant.
