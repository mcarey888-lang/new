# Route drawing snapping fix

## Changes

- Applied the two requested commits in order: rejected-snap response handling and
  independent map-browsing limits, then approved-origin port matching and JSON
  CORS refusals. Did not import the conflicting radius commit or replace the map file.
- Applied the radius change by hand: 45 pixels, with a minimum of 25 metres.
  Added runtime tests for detailed and zoomed-out tolerances.
- Preserved MapLibre 5, globe switching, local terrain/pitch handling and the
  zoom-12 terrain boundary.
- OS Outdoor requests bypass the new 1,500/minute browsing limiter because they
  already enforce independent 6,000/IP/minute and 24,000/global/minute limits.
  Otherwise the incoming commit would undo the maximum-route download fix.
- The snapping endpoint, path network source and snapping algorithm are unchanged.
  No mobile files, offline capability, schema or existing typecheck errors changed.

## Verification

- Drawing and CORS tests: **40 passed**, including the two additional radius tests.
- OS proxy/budget regressions: **15 passed**.
- API build passed; workflow restarted and serving requests.
- API TypeScript still reports the same 18 pre-existing errors, with none in the
  changed application, map or test files. This is not a passing API-wide typecheck.
- Live approved HTTPS host with `:8080`: **200**, correct allow-origin header.
- Wrong scheme and unknown host: **403**, `{"error":"origin_not_allowed"}`.
- Invalid OS tile request: **400**, no outer browsing limiter headers.
- Invalid satellite tile request: **400**, separate 1,500/minute limiter headers.

## Actual route check and remaining gap

The test browser loaded the route-map page but reported **GL_VENDOR/GL_RENDERER
Disabled** and **Failed to initialize WebGL**. The map was blank. No actual route
could be drawn, so there is **no post-draw HUD readout to report**. Both HUD text
nodes were empty and the HUD remained hidden. This is a graphics-disabled test
environment blocker, not a verified application-rendering failure.

Real, unmocked API requests from the browser origin did work:

- Near the Llanberis Path, `path-snap`: **HTTP 200**, `outcome: routed`, 45 path
  points, 508 m routed length, 401 m direct length and detour factor 1.27.
- Profiling those returned points: **HTTP 200**, `outcome: profiled`, 18 samples.

A separate live snap request over a different area, with the approved port-bearing
Origin, returned **HTTP 200 / unavailable** because upstream path data timed out.
That demonstrates the handler is reached rather than CORS returning an HTML 500;
it also shows that live upstream availability can vary. No engine change was made.

The visual acceptance check still needs a graphics-enabled browser or handset:
draw over a mapped footpath and record the exact readout, snap/profile status and
outcome, and console errors. Do not replace the globe renderer to accommodate the
disabled test browser, or report API success as proof of a visible snapped route.