# SummitReady — repair candidate evidence, 13 October 2026

## Verdict

The follow-up audit examined an older GitHub release, not the locally repaired
workspace. Its concerns were valid for that snapshot. The workspace repairs
have now been made available on `replit/repair-candidate-20261013`, starting
with `a084bd391a75a369165542649c18f559dd4518e8`. The final pushed SHA is
provided with this report in chat; the report itself is included in that commit.

This is a **repair candidate, not a release approval**. Source fixes and
automated checks do not constitute phone, production or two-account acceptance.
The original package's full acceptance remains incomplete for the open items below.
No publishing, deployment, EAS build or store submission was requested by this
agent. Only development services were restarted and development migrations applied.

## Verification actually performed

- `pnpm run typecheck`: PASS across libraries, all artifact typechecks and scripts.
- `pnpm --filter @workspace/summit-ready exec vitest run`: 110 files,
  1,279 passing tests.
- `pnpm --filter @workspace/api-server exec vitest run`: 75 passing files,
  1 skipped file; 985 passing and 4 skipped tests. Skips are not passes.
- `git diff --check`: PASS.
- The full-day backup HTTP regression sends 43,201 fixes (24 hours at two-second
  intervals), plus independent raw GPS evidence. Its JSON exceeds 12 MiB and
  fits the bounded 48 MiB parser; every point is retained, with an exact backup
  acknowledgement. This uses a test database double, not a production write.
- Deletion regression refuses both older and newer uploads after an owner
  deletion and returns a tombstone, without exposing its former trace.
- The community-map JavaScript harness exercises exact owner/recording identity,
  invalid-coordinate rejection and clearing withdrawn/account-reset pins.
- Privileged review HTTP tests require an admin key, notes and the exact current
  evidence revision; invalid/deleted/stale transitions return 409. Approval
  changes an app-owned candidate only, never the engine catalogue.
- API, Expo and Artwork Admin development services restart successfully.
  Metro serves HTTP 200 and bundles the application. API is listening on 8080.
- `/api/route-map`: HTTP 200, `Cache-Control: no-cache`, entity tag retained.
  A second request with `If-None-Match` returned HTTP 304. The application page
  remains distinct from cacheable tiles.
- Development `/api/summits/search?q=Tryfan`: HTTP 200 with canonical identity
  and coordinates. This does not prove the production engine connection.
- Anonymous `/api/recorded-hikes`: JSON 401, not a sign-in redirect.
- Activity Review navigation/page was captured in the preview. Its unauthenticated
  API calls return 401 as intended; a real privileged review was not performed.
- One targeted browser acceptance run was attempted. Clerk rejected the
  programmatic preview redirect with HTTP 422 before sign-in. The tester stopped
  without bypassing authentication or changing any account/data. **No signed-in
  sharing, map-pin, save/follow or two-account journey was verified by that run.**
- Production inspection was read-only. The queried main production schema
  contains `canonical_activities` and `planned_routes`, but none of
  `recorded_hike_backups`, `activity_publications`, `activity_preferences`,
  `activity_follows`, `activity_bookmarks`, `activity_trail_suggestions`.
  No production migration or connection setting was changed.

## F01–F22

“Fixed” below means the workspace implementation and listed checks address the
finding. It does not mean the installed store build or published backend has it.
“Needing device testing” means the implementation is present but the relevant
runtime acceptance is not demonstrated. “Pending” names an outstanding gate,
not a successful fix.

| Finding | Status | Evidence and remaining limit |
|---|---|---|
| F01 — Consent and AllTrails-style sharing | Needing device testing | `activityAudience.ts`, `ActivityAudiencePicker`, `recorded-hikes.ts`, `activity-community.ts`, `activityReview.test.ts`, `CommunityRecordingLibrary`, `community-route.tsx`, Activity Review page. First-use Public/Followers/Only me choice; future-recording default, per-recording override, legacy-private policy; Public is signed-in members only. Server follower/owner checks; search, nearby and map discovery; actual route/profile, saved references, follow/share/report and version-guarded suggestion review. Posts/photos remain separate consent. Two-account withdrawal, follower access and full journey are not browser-verified. Production schema is absent. |
| F02 — Personal routes versus community IDs | Needing device testing | `personalRouteHandoff.ts`, `usePersonalRouteTracking.ts`, `SharedTrackScreen`, shared `TrackMap`; personal handoff, ownership/freshness and route-progress tests pass. Planned geometry remains navigation-only; recording creates separate activity evidence. Offline selected-route following still needs native acceptance. |
| F03 — Save a drawn plan from Track | Fixed | Shared Track handles `saveRequested` through the personal-route save/name flow, with server errors retained; planner API/save contract regression tests pass. It does not save a plan as a recording or publish it. |
| F04 — API origin consistency | Fixed | Shared `activityApiBase` is used for map, planned routes, recording backups, sharing, legacy community reads and cloud restore. Typed client code was regenerated and workspace typecheck passes. Installed/production configuration is still a separate rollout check. |
| F05 — Main database / engine / migrations | Pending | Engine connection boundary and read-only pool remain unchanged; no fallback to the main pool or map-source swap. App-owned backup/sharing/review migrations are development-only. Production lacks the queried new tables; production engine runtime/permissions and rollout need separate approval and verification. |
| F06 — Acknowledged sync state | Needing device testing | Exact private-hike identity/revision receipt, durable owner-scoped outbox, generation-fenced retry merge and `backupReceiptReconciliation.test.ts`. A matching ACK persists local backup metadata without advancing the evidence revision or enqueuing another upload. A private backup ACK does not claim canonical Elevation Bank credit. Offline/reconnect/relaunch acceptance remains open. |
| F07 — Owned activity ingestion/restoration | Pending | Every recorded hike can have an owner-private backup and paginated restore; deletion tombstones block resurrection. Local library and actual geometry remain available without sync. Protected canonical ingestion/credit flags were not enabled as a workaround. End-to-end canonical consequences and two-device restore/deletion need verification and production schema rollout. |
| F08 — Full-day upload limits | Needing device testing | `app.ts` bounds the backup parser at 48 MiB, other routes retain their smaller limits; backup schemas bound both derived and raw arrays at 100,000 entries. Full-day HTTP payload regression passes without truncation. Oversized uploads stay actionable failures. Native storage, memory and full-day outbox replay still require testing. |
| F09 — Elevation integrity | Needing device testing | Release `recordedElevation.ts` conservative filter remains in use, including altitude accuracy, median filtering, reversal thresholds, gap reset and pause continuity. `recordingEvidence.ts` additionally retains rejected/out-of-order raw fixes without adding them to the filtered line or ascent. Quality is not silently replaced by route targets or summit height. A Musbury Tor-style real recording is still needed; the historic 1,670 m figure was not silently rewritten. |
| F10 — Durable checkpoints | Needing device testing | `saveActiveSession` returns success/failure, shows a retryable storage warning, and gates first-start success. Background batches are acknowledged only after their raw evidence has a durable checkpoint. Persistence errors do not imply successful recovery. OS write failures/termination still need injection on a phone. |
| F11 — Old paused/finished recovery | Needing device testing | Owner-scoped checkpoint and active-hike recovery tests pass; no blanket 24-hour deletion. Paused/finished recovery and background batches preserve evidence. Force-close, reboot, older checkpoint and account-switch scenarios remain native tests. |
| F12 — Free-hike attribution | Fixed | `trackContext.ts` and `trackingLaunchContext.ts` retain explicit session/stage intent rather than inferring it solely from the active shell. Context/isolation tests pass; free recording does not automatically complete an expedition stage. |
| F13 — Profile editing | Needing device testing | `edit-profile.tsx`, profile entry controls and owner-private cover API provide name/avatar/cover editing and crop/permission/error handling. Sharing defaults are restored from the server without overwriting a pending offline local choice. Persistent edits/media rendering need signed-in and second-device acceptance. |
| F14 — Recorded-route sharing/export | Needing device testing | Own hike detail has a recorded GPX export, audience override and member-access-checked route link; shared detail shows actual trace, notes, quality and altitude profile. Export does not substitute planned geometry. Native share sheet and recipient access remain unverified. |
| F15 — Durable community posts | Fixed | `community.ts` and community-policy/idempotency tests retain the committed post even if optional author enrichment fails, avoid duplicate creations and isolate visibility. Production schema/runtime acceptance still must be checked before rollout. |
| F16 — Private post success feedback | Fixed | Community Hub reflects the selected private/member audience after create rather than making a successful private post seem missing; source/policy regressions pass. Full signed-in UI acceptance was blocked by the Clerk tester redirect. |
| F17 — Photo expiry/account isolation | Needing device testing | Community photo/token hooks and media-read policy tests cover fresh tokens, owner/member access and account-isolated media state. Actual token expiry, media upload and account switching still need runtime acceptance. |
| F18 — API error versus empty route library | Fixed | Shared Track/library flows preserve actionable failure and retry rather than converting request failures to an empty successful list; route/library regression tests pass. Community discovery clears stale pins/data on failures and foreground/account changes. |
| F19 — One recording launch and honest finish review | Needing device testing | Track/Explore/session/personal/community launches use the same recorder/map and launch-context contract. Start is guarded; first checkpoint failure is visible; finish leads to review before durable save. Release recording sheet/sparkline changes are retained. Double taps, permission failures and native Finish/Save/Discard remain acceptance tests. |
| F20 — Offline recorded detail | Needing device testing | `RecordedTracePreview` provides a bounded, native/web, tile-free trace overview; owned history/recordings remain separate from personal plans and shared references. Online basemap is optional and preserves the saved line. No-signal, process-death and device library reopening need native testing. |
| F21 — Contribution geometry integrity | Fixed | `tracked-routes.ts` stores a contribution separately; the reference geometry remains unchanged. No new anonymous averaging/promotion pipeline was introduced. Permission/integrity regressions pass. Old helper/comment remnants do not cause reference mutation. |
| F22 — Release provenance and gates | Pending | Candidate is reviewable on GitHub; workspace typecheck, mobile and API suites pass, four tests remain skipped. Authenticated browser acceptance was blocked and native/production acceptance is outstanding. Published-backend and installed-store revision parity is not proven. No store build or deployment was created. |

## Protected release behavior

- Elevation filtering stays separate from raw GPS evidence and map presentation.
- Saved-hike history is not replaced by personal plans or shared community copies.
- Personal-route following preserves its owner-scoped selection and offline line;
  actual GPS remains separate and is what gets saved as activity evidence.
- Background queues/checkpoints stay owner-scoped; rejected fixes are retained
  for diagnosis, not counted as distance/elevation merely because they exist.
- Original timestamped pause/resume/finish events are retained with the activity.
- Claude's shared map, summit-to-route direction, attribution clearance, readiness
  inset handshake, no-cache application page, parking retention and recording
  sheet improvements remain integrated.
- Review approval, community saving and route following do not mint canonical
  mountain identities, trail verification, completion or elevation credit.
- Engine pool configuration/data source, auth, purchases and expedition
  mountain-progress/celebration systems were not replaced.

## Open acceptance / rollout work

1. Run a real Android and iPhone hike, including inaccurate altitude, pauses,
   app backgrounding, no signal, storage failure, force-close and restart.
   Confirm raw evidence, conservative derived ascent and recoverable local save.
2. With authenticated isolated accounts, verify Public, Followers and Only me;
   save/follow a reference, withdraw access, report, review a suggestion, restore
   private backups on a second device and prevent deleted-record resurrection.
3. Approve production schema and environment rollout separately. Then verify
   the deployed engine/catalogue read boundary and private-recording endpoints,
   followed by installed-build/backend revision parity.
4. Canonical ingestion and credit must be inspected through the existing
   protected pipeline rather than enabled or replaced merely to clear a
   pending badge. This report does not claim that final credit ingestion works.
5. This candidate implements the central AllTrails-style route-sharing journey,
   not an assertion that every enhancement or optional media presentation in
   the package is release-ready. Activity-linked photo galleries and the
   completed approved-trail catalogue promotion journey are not verified here;
   photo posts remain independently opt-in and approved suggestions remain
   reviewed candidates, not canonically verified trails.
