---
name: Expedition tab redesign
description: All 6 expedition shell tabs replaced with dedicated screens matching the reference design image.
---

## What was built

All 6 `artifacts/summit-ready/app/(expedition)/` screens rewritten as dedicated files (no longer simple re-exports of training screens):

- **base-camp.tsx** — full-bleed hero + "Current Expedition" pill, 72% progress ring card, Next Mission card (first virtualHill + hike-tracking link), weekly leaderboard (real sessions data + 3 static club members), Community Highlights, Suggested For You
- **mountains.tsx** — unchanged re-export of `(tabs)/virtual.tsx` (already a good mountain browse)
- **track.tsx** — dedicated activity hub: GPS pill, lifetime stats (distance/elevation/pace from sessions), large "Start Activity" CTA → `/hike-tracking`, recent sessions list, secondary buttons (Log Hill / Find Hills)
- **route.tsx** — mountain photo hero, Route Overview / Local Adventure tabs, stats row (summit/sections/dist/days), expedition concept text, timeline-style sections list from `expeditionPlan.days[].routes` with graceful fallback to `virtualHills`
- **progress.tsx** — big centered progress ring, elevation progress bar (sessions total vs goal), 8-week bar chart, completed sections list (derived from cumulative elevation vs trained), next-up card, 2×2 stats grid (hikes/distance/elevation/time)
- **profile.tsx** — avatar + initials from Clerk, Pro badge, stats row (expeditions/summits/elevation from sessions), achievements grid (from `unlockedAchievements` + ACHIEVEMENTS constants), recent activity feed, My Routes from virtualHills, Account Settings link

**Why:** entries are not re-exports of training tabs so each can show expedition-specific context without polluting the training shell.

## Data sources used

- `summitGoal.virtualHills` — hills list for Next Mission, Route sections, My Routes
- `summitGoal.simulationScore` — ring percentage
- `summitGoal.targetMountain` — summit elevation, total elevation goal, estimated days
- `(summitGoal as any).expeditionPlan` — AI expedition title/concept/days/routes
- `sessions[]` — elevation/distance/duration for progress ring, chart, stats
- `unlockedAchievements[]` + `ACHIEVEMENTS` — profile achievements
- `completedGoals[]` — expedition count on profile
