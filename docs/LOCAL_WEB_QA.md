# Local web QA against a deployed API

## Loopback CORS is deliberately opt-in

The API accepts `http` and `https` origins on exactly `localhost` and
`127.0.0.1` in development, as before. A production-mode API accepts those
same loopback origins **only** when its owner explicitly sets
`CORS_ALLOW_LOOPBACK=true`. Missing, empty, `false`, `TRUE` and `1` do not
enable the production exception.

This does not permit LAN IPs, arbitrary websites, lookalike hosts, paths or
credentials in an Origin header. It does not change `NODE_ENV`, API
authentication, ownership checks, subscription permissions, or the normal
production/preview allow-list.

An owner who needs this QA mode must explicitly set the flag in the target
backend's environment and restart or republish that backend through the
normal release process. Setting it only on a locally exported client cannot
change a deployed server's CORS policy. No production flag was enabled as
part of this code repair.

Use dedicated test accounts and private test records: permitting a local
origin does not make production data a sandbox. Disable the production
exception when that QA session ends.

## Questionnaire/free-plan path

Completing `/questionnaire` saves its answers locally and offers **Continue
to goal setup** after the baseline explanation. `/setup` consumes those
answers, lets the user confirm the real target/route and remaining fields,
and saves the goal before navigating to the training dashboard. A purchase
is not required for this path. Leaving the questionnaire before completing
setup saves a draft, not an active training goal.

The paywall also has **Continue without Pro**, independent of store
availability. Questionnaire-origin paywalls return to setup; other
paywalls go back, or to the dashboard if no back route exists.

## Expedition artwork

Expedition cards request `/api/mountain-image` using the exact goal name
with `fallback=illustration` and a new artwork URL revision. Existing
approved artwork remains highest priority. If photography is unavailable,
the endpoint returns a non-cacheable illustrative placeholder instead of
a labelled satellite tile from geocoding. If an external photo URL fails
to download, the same non-map fallback applies.

This repairs presentation, not summit catalogue coordinates. No curated
catalogue records or approved image files are modified. A network trace of
the old cached tile was not available, so its original geocoding result
cannot be attributed with certainty.

## Repair verification

- App: `pnpm --filter @workspace/summit-ready exec tsc --noEmit --pretty false`
  passed; its full Vitest suite passed 1,341 tests in 117 files.
- API: `pnpm --filter @workspace/api-server run typecheck` passed; its full
  Vitest suite passed 1,054 tests, with eight database integration tests
  skipped because `RUN_DB_INTEGRATION_TESTS` was not enabled.
- Browser, isolated guest at 390×844: nine-step questionnaire, accessible
  selected “No”, corrected step-seven copy, one baseline notice, transfer
  to setup including available days, goal creation, dashboard, and reload
  persistence passed. Pro widgets remained gated without blocking the plan.
- Tryfan lookup returned HTTP 409. The browser test used explicit manual
  fixture inputs, not verified route facts. Canonical route availability
  remains a separate issue; no catalogue data was changed.
- Browser with external RevenueCat offerings requests deliberately failed:
  the no-plans error appeared, close had its accessible name, and
  **Continue without Pro** still reached setup. Web legal copy did not
  claim a charge to the user's Apple ID. No purchase/restore was attempted.
- Fresh development Kilimanjaro artwork request: HTTP 200, PNG,
  `Cache-Control: no-store`, `X-Mountain-Artwork: illustrative-placeholder`.
  This confirms removal of the wrong map tile, not availability of a new
  verified Kilimanjaro photograph.
- Development `/api/route-map`: HTTP 200, `Cache-Control: no-cache`.
  A localhost Origin received the matching allowed-origin and credentials
  headers in development. Production opt-in/default-denial are covered by
  HTTP and policy tests, not by changing the production server.
- Both managed development workflows were restarted and running. No
  publishing, production configuration/database changes, or mobile build.
- Native-store purchasing, signed-in cross-device goal persistence,
  physical-phone behaviour and the eight skipped database integration
  tests are not certified by these guest web checks. Existing browser
  nested-button/CSP styling warnings were observed and not expanded into
  this repair scope.

## Second QA batch: recording, manual entries and shared artwork (2026-10-16)

### Repairs

- The Track sheet clears the full navigation height plus 8px. The map receives
  that same measured bottom inset. The screen is constrained to its parent;
  exported web now gets the preview wrapper's dynamic viewport CSS.
- Denied location no longer replaces the recorder with a permission-only page.
  Elapsed-time recording starts after its initial checkpoint and before optional
  background permission prompts. Native denied permission skips GPS watchers;
  the UI explicitly explains time-only recording and offers optional settings.
  No GPS points, distance or ascent are fabricated.
- Manual entry saves one ExploreHike with a stable manual retry identity and
  an explicit readiness-contribution setting, not another completed workout.
  Its opt-out is respected by both readiness paths and retained in private
  backups. New manual evidence is not labelled tracked GPS. No arbitrary plan
  week is completed. Linked legacy copies are deduplicated in activity totals
  and history presentation without rewriting stored activities or progress.
- Sample-year failures have friendly load/save messages. Story network errors
  no longer prescribe signing in again.
- Shared mountain-artwork URLs used by Basecamp session thumbnails now request
  illustrations instead of geocoded satellite fallback, with a new URL revision.
  The artwork endpoint also defaults to illustration unless satellite fallback
  is explicitly requested. Approved mountain artwork still takes precedence;
  no approved image, mountain identity or catalogue record was replaced.

### Evidence

- Both application and API typechecks passed.
- API full suite: **1,055 passed, 8 skipped** across 82 files. The eight
  database-integration tests remain a gap; they were not enabled against a
  shared database.
- App full suite: 1,349 passed; two old exact-string layout assertions needed
  the new 8px inset, and an unrelated offline-cache filesystem test timed out
  under concurrent load. After correcting those assertions, all **85 tests**
  in the four affected/recheck files passed, including the entire offline-cache
  file. The final 11 new regression tests and typecheck also passed.
- Local web export succeeded with `expo export --platform web`. This was not
  an EAS/native build and nothing was published.
- Browser checks used real pointer clicks and denied geolocation, not injected
  coordinates. Start hike worked; elapsed time advanced with zero measured
  distance/ascent, and Pause, Resume, Finish and confirmed Discard worked.
  The test recording was discarded.
- Saving one manual hike with Summit contribution checked and reloading
  `/sessions` showed **1 session, 5.0km, 200m**, with Week 1 still **0/4**.
  The only saved QA hike belongs to the isolated guest browser context.
- At 375x812, Start hike was y648–704 and the navigation bar began y732.
  At 390x1000, it was y836–892 and navigation began y920. Safe-interior
  hit-testing reached the button at both sizes. The exported app was checked
  separately with all API requests blocked before navigation: it filled both
  viewports and maintained the same clearance. The map itself was intentionally
  unavailable during that layout-only check.
- The current development build did not reproduce the original overlap or
  fixed-height gap before changes either, so their old exported-build cause
  is not proven. The added guards and final layout were verified; this is not
  a claim to have reproduced the old failure.
- A development Kilimanjaro thumbnail request returned HTTP200, PNG,
  `Cache-Control: no-store`, `X-Mountain-Artwork: illustrative-placeholder`.
  This is honest fallback artwork, not a newly verified summit photograph.

### Remaining limitations

- The shared Expo-domain screenshot capture failed with an HTTP-response error.
  Direct browser checks against both local Metro and the exported app succeeded.
- Tryfan setup lookup still returns HTTP409 because it matches two catalogue
  identities. This is already recorded as a separate follow-up.
- Setup/dashboard QA unexpectedly made three automatic coach-assessment
  requests (HTTP200). No AI button or purchase was pressed; provider billing
  was not established. Further dashboard testing stopped. The exported layout
  check blocked every API request before page load to prevent this side effect.
- The manual contribution checkbox now explicitly supplies `aria-checked` as
  well as native accessibility state; that final accessibility-only adjustment
  was typechecked and regression-checked, not re-certified by a screen reader.
- Signed-in cross-device restore/backup, production CORS configuration,
  native permission prompts/background/offline GPS and real-phone touch
  behaviour are not certified by these isolated guest web checks.
- No production settings, canonical flags, database migrations, historical
  production activities, releases or native build counters were changed.
- Final whitespace check `git --no-optional-locks diff --check` was blocked
  by the workspace's Git/index-lock security guard. No override was attempted.

## Production loopback configuration follow-up (2026-10-17)

The project-variable API reported production `CORS_ALLOW_LOOPBACK=true`, but
live `OPTIONS /api/elevation-bank` with origin `http://localhost:8081` still
returned HTTP403 `{"error":"origin_not_allowed"}` after the owner published.
That read-back did not prove which environment the running deployment received.
The available tools do not expose its actual injected deployment-secret list.

The API artifact's explicit `[services.production.run.env]` now includes
`CORS_ALLOW_LOOPBACK = "true"`, added through the validated artifact-config
workflow. This is a non-secret QA switch. NODE_ENV remains production, and the
development run configuration, databases, credentials and origin policy are
unchanged.

The 19 CORS tests and API typecheck passed, including a real local HTTP
preflight using the opted-in production-mode policy. That preflight returns
HTTP204 with `Access-Control-Allow-Origin: http://localhost:8081` and
`Access-Control-Allow-Credentials: true`; HTTP200 is not the middleware default.

The initial post-change public curl still returned HTTP403. A subsequent
fresh public check on 2026-10-17 now returns **HTTP204**, with
`Access-Control-Allow-Origin: http://localhost:8081` and
`Access-Control-Allow-Credentials: true`. The disguised origin
`http://localhost.evil.test:8081` still returns HTTP403
`{"error":"origin_not_allowed"}`.

Production localhost CORS is now verified through the live HTTP response.
No additional configuration change or publishing was performed during this
successful recheck. The actual injected deployment-secret list remains
inaccessible through the available tools, so this verifies runtime behaviour,
not which settings store supplied the flag. This does not close the wider
release audit.

## Private diagnostics for localhost authentication failures

The live Clerk rejection was `jwk-kid-mismatch`, not an authorized-party error.
An earlier QA export contained a development Clerk publishable key, whereas
the production EAS profile selects a different live instance. This is a
configuration mismatch to investigate; it is not permission to accept
development tokens on production.

Rejected JSON API requests now include a private `qaAuthDiagnostics` log
object only when `CORS_ALLOW_LOOPBACK` is exactly `true` and the request Origin
matches the existing localhost/127.0.0.1 policy. It contains selected **unverified**
issuer/authorized-party origins and public signing-key IDs, the configured
publishable-key origin, live/test key modes and whether a local JWT verification
key is configured. When Clerk's error supplies its available verifier key IDs,
only those bounded public IDs are retained, never the raw error message.

These fields do not appear in API responses. JWTs, signatures, user IDs,
emails, full keys, cookies and URL credentials are not included. Malformed or
oversized diagnostic input produces empty metadata rather than throwing.
Authentication still relies exclusively on Clerk's verified user identity:
no authorized-party list, signature verification or key configuration changed.

After the owner publishes this diagnostic change, retry the authenticated
request from the signed-in localhost QA browser, then inspect Publishing logs
for `route API authentication rejected` and its `qaAuthDiagnostics` object.
Compare the observed issuer and signing-key ID against the intended live
instance. A development token needs a production-aligned QA frontend and a
dedicated live QA login, not a production authentication bypass. A live token
rejected against different verifier keys instead needs private verification
of the production backend's Clerk configuration.

Publishing these diagnostics alone does **not** establish an authenticated
HTTP200 or repair a signing-key mismatch. Those require a real matching session
and a subsequent production acceptance request.
