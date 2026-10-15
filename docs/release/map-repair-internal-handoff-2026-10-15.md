# SummitReady map repair and internal-build handoff

## Verdict

**Ready for backend rollout review. Not yet cleared for a new internal build.**

No publish, EAS build, submission, credential change, production mutation,
canonical flag change or historical credit recomputation was performed.

## Candidate and scope

- Branch: `replit/readiness-followup-20261014`.
- Starting revision: `4ef08d2e52dde57a6a86b44e15df2d3e6b63ef91`, clean working tree.
- Existing zoom/truncation repair:
  `f464d6c99baef95e000e5903301c9741a47ecf5a` (two map source/test files).
- This handoff commit adds catalogue retry UI, its overlay positioning, regression
  tests and this report. Its exact full SHA is supplied in the delivery message
  and independently verified against the GitHub branch.
- Earlier unpublished history includes memory documentation and a Publish
  checkpoint. Those pre-existing changes are preserved, not folded into the new
  map patch. No other Claude-branch commits were merged during this work.

New implementation changes are limited to:

- `artifacts/api-server/src/routes/summit-layer-script.ts`: click/Enter/Space retry
  for catalogue failures, honest loading/error/partial-result states, and notice
  positioning above the measured attribution and host inset.
- `artifacts/api-server/src/routes/recording-script.ts`: one guarded call to
  reposition that notice when the host inset changes. Recorder data paths,
  location callbacks, timers and activity state are untouched.
- `artifacts/api-server/src/__tests__/summitStaleResponse.test.ts`: retry,
  keyboard recovery, positioning and partial-result regression coverage.

## Verification

### Automated

- API: `pnpm --filter @workspace/api-server run test`:
  **998 passed, 8 skipped**, 76 passing files and one skipped integration file.
- The skipped file is `canonicalActivityIntegration.test.ts`, gated by
  `RUN_DB_INTEGRATION_TESTS=1`. It was not enabled. This is not authenticated
  production acceptance.
- Targeted stale-response/retry suite: **16 passed**.
- API type check: passed.
- Mobile package's configured suite: **1,078 passed**.
- Full mobile discovery, `pnpm --filter @workspace/summit-ready exec vitest run`:
  **1,329 passed in 116 files**.
- Mobile type check: passed.
- Diff whitespace checks: passed.

### Development browser

Verified in a fresh, cache-disabled mobile-size Chromium page with software WebGL,
using the actual development `/api/route-map?host=shared-track`:

- Initial viewport: HTTP 200, 14 real catalogue features and visible clustered
  markers. Cluster click expanded zoom 13 to 14; mouse dragging changed the view.
- Fractional zooms 9.6, 11.6 and 12.6 produced the expected prominence bands
  150 m, 100 m and 30 m respectively, with visible markers.
- Panning away toward Ben Nevis and back retained the correct Snowdonia results.
  Controlled late-response rejection is covered by regression tests, including
  browsers without AbortController.
- Clicking Tryfan opened its own card: 918 m, Conwy, Wales.
- “Plan a route to here” entered drawing with zero initial anchors, emitted the
  correct `planRouteTo` identity and retained all six parking markers.
- Drawing from a separate start point and using the visible Done control left
  two anchors, with the last at Tryfan, emitted `routeFinishedAt` for Tryfan and
  enabled Save. **Save was not clicked.**
- Read-only development path snapping and route-profile requests returned 200.
- A browser-intercepted 503 (not a changed server/database setting) displayed
  the retry action. With a simulated 180 px host inset and measured 44 px
  attribution, the notice ended at y=514 in a 750 px viewport, clear of both.
  Enter retried the real endpoint, restored markers and cleared the notice.
- A browser-intercepted `truncated: true` flag on a real catalogue payload left
  eight features and two visible markers, with the “zoom in” explanation.
  This exercised partial-response rendering, not a claimed real server-cap event.
- Browser verification initially needed corrections to the test driver for the
  route array's name and an anonymous Done button. The corrected completion
  check passed; no application change was required for those driver errors.

Curated engine queries remain the only source for summit viewport/search.
No invented hill or AI fallback was added. The read-only engine pool is unchanged.

## Current production and delivery requirements

Deployment metadata reports the public production URL as `https://summitready.uk`
with a successful current build. It does not identify the deployed Git SHA.

Read-only production probes:

- `/api/route-map?host=shared-track`: 200, `Cache-Control: no-cache`, ETag present.
- Conditional request using that ETag: **304**.
- Tryfan search: **200, six results**.
- Tryfan viewport: **200, fourteen results**.
- Unauthenticated `/api/recorded-hikes`: **401 JSON**, not a homepage redirect.
- Production HTML still contains `Math.round(zoom)` and lacks the current
  truncated-response guard and explicit retry UI. It is not the repaired map
  candidate, even though its catalogue connection now works.

**A backend republish is required to deliver these map repairs.**
The native Track map component loads a hosted page through WebView; web uses an
iframe. The URL is built from `activityApiBase` and ends in `/route-map`.
These changes are not bundled map UI, so an existing compatible installed app
can receive them when the hosted page is republished and reloaded.

**No mobile rebuild is required solely for this map patch.** A rebuild is required
to deliver other mobile source changes not present in an installed binary.
Those earlier repairs must not be confused with this server-only map diff.

**This map patch requires no schema migration.** No schema, migration or SQL
definition was changed. This does not re-certify unrelated release migrations.
Review Publish's generated schema diff separately; do not accept destructive
changes or Overwrite production data for a map rollout.

## Internal-build preparation — no build started

Proposed source: the exact final commit on the branch supplied in the delivery
message, not an unspecified later workspace snapshot.

Resolved configuration was checked in `eas.json`, `app.json`,
`utils/activityServiceOrigin.ts` and `components/track/TrackMap.tsx`.
Read-only EAS environment listings reported no production project or account
variables, so no remote `EXPO_PUBLIC_MAP_BASE` override was listed.

| Item | Verified configuration / proposal |
|---|---|
| Store testing through Play internal testing and TestFlight | `production` profile; Android AAB and iOS store distribution; remote auto-increment enabled |
| Direct APK / ad-hoc device installation instead | `preview` profile; internal distribution; Android APK; preview does not enable auto-increment |
| EAS environment, both profiles | `production` |
| API origin, both profiles | `https://summitready.uk/api` |
| Hosted map, both profiles | `https://summitready.uk/api/route-map?host=shared-track` |
| Frontend authentication, both profiles | Live Clerk publishable configuration for `clerk.auth.summitready.uk`; no key reproduced here |
| EAS Update channel | No explicit channel configured; do not claim a separate staging channel |
| Marketing version, Expo and committed native iOS | `1.0.8` |
| Current remote Android / iOS counters | `88` / `69`, obtained with read-only `eas build:version:get` |
| Proposed next store-testing counters | Android `89`, iOS `70`, subject to no intervening builds; not allocated or written |

For the existing store-testing workflow, use `production` without auto-submit
when a build is separately authorised. Confirm the target App Store train can
accept version 1.0.8; if a marketing bump is required, update Expo/native versions
in a separate reviewed commit and identify a new source SHA.
For direct `preview` distribution, choose an explicit build-number policy first:
it does not currently auto-increment, and iOS ad-hoc distribution also requires
appropriate registered-device provisioning.

**Neither profile is isolated staging:** both target the live backend and live
Clerk frontend. Preview also enables the RevenueCat test-store switch; this
does not isolate activities, routes or community content from the live API.

## Explicitly pending / blocked

- Owner-authorised backend rollout, followed by production rechecks of the
  candidate's zoom, truncation, retry UI, catalogue endpoints and cache behaviour.
- Authenticated production acceptance using an authorised isolated test account:
  backup/restore, edits, tombstones, planned-route saves and sharing permissions.
  No authorised session was supplied for this pass. Public/401 probes are not a
  substitute for this acceptance.
- Frontend/backend live Clerk instance alignment through an authenticated
  round-trip. Frontend configuration alone does not prove backend key alignment.
- Installed iPhone/Android Track-host bridge and overlay behaviour, app resume,
  offline recording/recovery, raw GPS/elevation evidence, saved hikes, personal
  route following and reconnect sync. Browser and unit checks do not verify GPS.
- Real-device regression of Training/Expedition behaviour, the progress mountain
  and summit celebration. These protected systems were not edited.
- Historical production credit recomputation/requalification remains out of scope.

The backend rollout review can proceed with this candidate. Do not interpret
this report as permission to publish, enable canonical flags, create an EAS build
or submit an app.
