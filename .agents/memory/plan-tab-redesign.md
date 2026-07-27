---
name: Plan tab redesign — Expedition Dashboard
description: Training Plan redesign state: Levels 1-3 + fix status.
---

## Completed work (TypeScript-clean, all implemented)

### Level 1 — Expedition Dashboard (`app/(tabs)/plan.tsx`)
- Hero image, phase chip, progress bar, stats row, TODAY'S FOCUS card, THIS WEEK list
- Dashboard section uses `dashStyles` stylesheet; WeekCard sessions are tappable chips → `session-detail`
- DayStrip now wired inside the THIS WEEK card (see Level 2 below)

### Level 2 — Compact editable day strip (`components/DayStrip.tsx`)
- Mon–Sun columns rendered above the session chip list in the THIS WEEK card
- Session type icons with completion state (check/colour/dot)
- Tap a session dot → select it; tap any empty day → place it there (or tap the reassign row day buttons)
- Overrides persisted in AppContext as `sessionDayOverrides: Record<string, number>` keyed `"${weekNum}-${sessionIdx}"`
- `setSessionDayOverride(weekNum, sessionIdx, dow)` callback in AppContext, stored with AsyncStorage key `summitready_session_day_overrides{_uid}`
- Uses `assignSessionsToDays()` from `utils/dayAssignment.ts` for auto-assignment baseline

### Level 3 — Workout Detail screen (`app/session-detail.tsx`)
- Hero image, phase/week/type chips, stats row, coaching notes
- GPS CTA (hill/bigDay only), manual-complete toggle, inline trackers (RepLog, MeterLog), submit-week
- "Change hill" button on assigned-hill row; "Assign hill" prompt when none set
- HillPickerModal imported from `components/HillPickerModal.tsx` (shared component)

### Shared components created
- `components/HillPickerModal.tsx` — full picker with search, online lookup, section labels
- `components/DayStrip.tsx` — 7-day strip with reassign interaction

### Fix: Hill rotation (`utils/planGenerator.ts`)
- `createHillSession` → `hills[weekNum % hills.length]`
- `createBigDaySession` → `hills[(weekNum + 1) % hills.length]`
- `createTaperLightHillSession` → added `weekNum` param; `hills[weekNum % hills.length]`; call site in `createSessions` updated

### Fix: GPS-to-plan completion (`app/hike-tracking.tsx`)
- `handleSave` parses `hillMeta.sessionKey`, calls `togglePlanSession` if not already completed

### Other features
- `questionnaire.tsx` — StepAvailableDays (step 7) for picking training days
- `setup.tsx` — day-preference chip picker
- `context/AppContext.tsx` — `availableDays?: number[]` on SummitGoal

## Key invariants
- `availableDays` is optional; existing users without it fall back gracefully in `assignSessionsToDays`
- Do not touch plan generation math (elevation targets, rep counts, phase structure)
- Pre-existing `hooks/useColors.ts` TS2352 error — always ignore
- plan.tsx still has its own inline HillPickerModal function (unused but harmless); session-detail imports from the shared component file
