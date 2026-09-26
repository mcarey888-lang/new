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

## bank/

The Elevation Bank hero card (`components/elevation/ElevationBankHero.tsx`),
rendered from the real module against the approved mockup.

| file | width | shows |
| --- | --- | --- |
| `wide-1000.png` | 1000 pt | the mockup's landscape composition |
| `phone-390.png` | 390 pt | the stacked layout the app actually uses |
| `phone-320.png` | 320 pt | narrowest supported width |

The figures in these renders are harness demo values, not production data. The
card itself computes nothing — every number is a prop, and `12,420` is one of
the forbidden hard-codes, so it exists only in `/tmp/harness/bankhero.jsx`.

Type renders as a serif here because the harness does not load Inter; the app
does.
