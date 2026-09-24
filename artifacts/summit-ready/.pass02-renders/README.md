# Journey 1 visual correction — pass 02 renders

Screenshots of the **real production React Native screen modules**, not of a
recreation and not of an HTML prototype. Each was produced by bundling the
module itself (`app/(tabs)/plan.tsx`, `app/session-detail.tsx`,
`app/hike-tracking.tsx`, `components/track/ActivityCompleteView.tsx`,
`app/(tabs)/dashboard.tsx`) against real engine output, and driving it through
its own production paths — the Track states restore through
`readActiveHike` / `shouldRestoreCheckpoint`, and offline is decided by the
screen's own connectivity probe.

| file | screen | notes |
| --- | --- | --- |
| 01 | Training Plan — Schedule | APPROVED composition, unchanged this pass |
| 02 | Training Plan — Full plan | corrected |
| 03 | Training Session — hill | corrected |
| 04 | Training Session — gym | corrected; exercise artwork now contained |
| 05 | Track Ready — free hike | corrected |
| 06 | Track Ready — training session | corrected |
| 07 | Track Recording | corrected |
| 08 | Track Recording — offline | corrected |
| 09 | Track Paused | corrected |
| 10 | Activity Complete / Activity Details | one screen, corrected |
| 11 | Training Basecamp | APPROVED composition, unchanged this pass |
| 12–13 | Full plan at 320 / 430 | responsive check |

## Known limitation

The Track map is a `WebView` (native) or DOM container (web) fed by
`${API_BASE}/hike-map`. The render environment has no network, so the map
region shows its production container with no tiles — the dark band behind the
sheet. Map **dominance and layout** were verified; tile rendering was not.

Images are 1x. Mountain imagery is served by the production image service in
the app; in these renders a single repository asset stands in for every
`mountain-image` request, so the same photograph repeats.

## Follow-up engineering issues (outside Pass 02)

- `getCurrentWeek(plan)` falls back to the first week when today's date matches
  no plan week, even if none is flagged `isCurrentWeek`. Review how plans outside
  their scheduled range should select or label a current week.
- `targetDateDisplay(summitDate)` constructs a local-noon date by appending
  `T12:00:00` to the input. A full ISO timestamp would produce an invalid date;
  decide and enforce the accepted summit-date input format separately.

Neither issue is changed by this visual integration.
