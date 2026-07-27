---
name: Plan tab redesign — Expedition Dashboard
description: Architecture of the redesigned Plan tab and session-detail screen; patterns to maintain for future work.
---

## The redesign

The Plan tab (`app/(tabs)/plan.tsx`) is a single unified ScrollView with three zones:
1. **Expedition Dashboard** — mountain `ImageBackground` hero + phase chip + progress bar; stats row (readiness / elevation trained / days to go); TODAY'S FOCUS featured session card; THIS WEEK tappable session list.
2. **Full Plan** — all `WeekCard` accordions. Session rows inside are now simplified tappable chips (checkbox for quick-complete + type icon + label + duration + pencil/swap icons + ↑elevation + chevron).
3. Modals/pickers unchanged.

## WeekCard props — what was removed

`assignedHills`, `nearbyHills`, `sessionReps`, `summitGoal`, `onAssignHill`, `onSetReps` were **removed** from WeekCard's props. `onSessionPress: (sessionIdx: number) => void` was **added**. Inline trackers (GymTracker, HillActionCard, RepStepper, FlightsLogger, ElevationLogger) are no longer rendered inside WeekCard — they live in `session-detail.tsx` only.

**Why:** The session detail lives at Level 3 (session-detail screen). WeekCard is Level 2 — compact chips that navigate there.

## session-detail screen

`app/session-detail.tsx` — reads `weekNum` and `sessionIdx` from Expo Router params. Renders full session detail with GPS CTA, manual completion with inline trackers, and submit-week button.

## availableDays pattern

`availableDays?: number[]` is an additive-only field on `SummitGoal`. Pure client-side — no backend changes. Day-picker UI exists in both `setup.tsx` (edit flow) and `questionnaire.tsx` (step 7, `StepAvailableDays` component). Cap is `trainingDays`. Graceful fallback for users without it.

## PlanScreen useApp() destructuring

As of this redesign, `assignedHills` and `sessionReps` are **not** destructured in PlanScreen (they were only forwarded to WeekCard). Still needed: `nearbyHills` (HillPickerModal), `sessionEfforts` + `setSessionEffort` (Edit modal), `assignHillToSession` (hill picker callback), `setSessionReps` (kept in context but removed from PlanScreen).

## Theme note

`T.blueDim` exists in `constants/theme.ts` as `rgba(74,159,245,0.12)` — confirmed.
