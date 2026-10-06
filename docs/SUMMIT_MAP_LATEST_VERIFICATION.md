# Latest summit map — browser verification

Checked 2026-10-06 after importing the six newest commits from
`origin/claude/route-map-server`, through `f3bc483`. Application integration
ends at local commit `6bdfad9`.

**The delayed-response race and tiny-pan refetch from the previous report are
fixed in this browser check.** One drawing/card interaction remains reproducible.
Three existing camera/drawing unit tests also fail because of an incomplete
document mock. No author-owned implementation was patched after import.

## Integration

- Kept the existing mobile test list, adding only
  `utils/exploreMapCard.test.ts` and `utils/summitToMountain.test.ts`.
- Besides the expected package conflict, the route-planner message handler
  conflicted. Kept the local ready/routeChanged/routeLoaded handling, including
  saved-route ownership checks, while adding the author's openMountain handler.
- The summit-layer, map-controls, summit endpoint and summit-pin service files
  match the shared branch exactly.
- The route-map page change consists only of importing and invoking the new
  controls module. Globe, terrain and pitch implementation was not replaced.
- Offline download remains disabled. Nothing was deployed or published.

## Browser method and limits

Used real Chromium with software WebGL, actual MapLibre rendering, real HTTP
summit responses and mouse clicks on rendered markers/buttons. Page:
`http://localhost:8080/api/route-map`, desktop viewport 1280 × 900.

An observation-only `ReactNativeWebView.postMessage` bridge recorded the page's
actual outbound messages. This confirms the requested message contract, not
end-to-end navigation on an authenticated mobile device. The app-side
navigation tests passed; installed-app navigation and the Explore card gesture
were not independently exercised in this browser session.

The standard capture browser cannot render this map's WebGL context here.
Its black-map capture is not the evidence used below. Both the proxy and the
direct server return HTML containing the new controls and summit card.
Screenshots below come from the working Chromium instance. This was development
verification, not a check of the published deployment.

## 1. Snowdonia → Ben Nevis → Snowdonia

- Snowdonia centre: longitude −3.977048, latitude 53.064063, zoom 14.
- Before leaving: source contained 10 summit records; two markers were visible:
  **Clogwyn Bwlch-y-maen** and **Carnedd y Cribau**.
- Panned to Ben Nevis and intercepted the real response at the browser's
  response stage. It had **HTTP 200 and 16 summits**.
- Returned to Snowdonia before releasing that response; held it for **2485 ms**.
- Returning cancelled the Ben Nevis request: **`net::ERR_ABORTED`, cancelled true**.
  The debugger's subsequent attempt to release it returned
  **`Invalid InterceptionId.`**, because the interception had already been
  cancelled. That is test-control feedback, not an application exception.
- After returning and waiting, the source still contained the **same 10 IDs**,
  its coverage still described Snowdonia, and the same **two Snowdonia markers
  remained visible**. No blank map and no Ben Nevis data accepted over Snowdonia.

Evidence: [returned map](verification/summit-latest/race-return-snowdonia.jpg)
and [observations/network](verification/summit-latest/results.json).

### Tiny pan

Panned **0.001° east and 0.001° north**, then waited 1100 ms, longer than the
220 ms debounce. **Zero new summit requests.** The map retained the server's
wider, non-truncated coverage rectangle:

```text
longitude: -4.037792208716763 to -3.916297791283237
latitude:   53.03246          to 53.095670000000005
```

## 2. Summit cards — actual displayed text

**Snowdon**

```text
Snowdon
Yr Wyddfa
1085 m · Gwynedd, Wales
Tap for routes and detail
Plan a route from here
```

No classification was displayed, as requested. No ascent/climbing line.

**Ben Nevis**

```text
Ben Nevis
Beinn Nibheis
Munro · 1345 m · Highland, Scotland
Tap for routes and detail
Plan a route from here
```

No ascent/climbing line. Both names, alternatives and metadata were actually
visible, not just present in response JSON.

Evidence: [Snowdon](verification/summit-latest/snowdon-card.jpg),
[Ben Nevis](verification/summit-latest/ben-nevis-card.jpg).

**Source-level qualification:** the imported `summitAscentLine` still permits
`N m of climbing` or `N m of climbing via ROUTE` for known-ascent records.
That conflicts with the stated blanket requirement of no ascent/climbing on
any card, although neither tested card exercised it. A truncated Britain-wide
sample contained no known-ascent records; that is not proof none exist.
This conditional was left untouched for the author to decide.

## 3. Three-icon rail and drawing controls

- Three round top-right buttons: **Map layers**, **Show my location** and
  **Plan a route**. Each measured 44 × 44 px with a 22 px radius.
- Layers panel showed **2D, 3D, OS Outdoor, OpenStreetMap, Satellite,
  Satellite + Labels**. All four base-map choices were present.
- Old `.panel` had **`display: none`**, including while drawing and after Done.
  It was not visible beneath the new controls.
- Pencil revealed **Follow paths, Undo, Clear, Done**. Follow paths was toggled
  off through the real button for the drawing checks.
- With no route, Save and GPX were hidden.
- With a multi-point route, Save and GPX appeared. Undo reduced the anchor
  count by one; Clear removed all anchors and hid Save/GPX; Done hid the draw
  bar and disabled drawing.
- The location icon was present; obtaining real device location was not tested.
- Save/GPX visibility was checked, but saving to an authenticated account and
  completing a GPX download were not part of this run.

Evidence: [layer menu](verification/summit-latest/layers-rail.jpg),
[empty drawing](verification/summit-latest/drawing-empty.jpg),
[route drawing](verification/summit-latest/drawing-route.jpg).

### Reproducible integration bug: selecting a summit while drawing

With drawing off, selecting Snowdon left zero anchors. Pressing its route
button then added exactly one anchor and kept Save/GPX hidden.

With drawing **already on** and an empty route:

1. Clicking Snowdon's marker opened the card **and added an anchor**.
2. The card still said **“Plan a route from here”**.
3. Pressing the button added essentially the same summit again.
4. Two points, only **0.0764515258 metres apart**, enabled Save and GPX.

This is an observed interaction bug, not a console exception. It was not
corrected locally. Evidence:
[screenshot](verification/summit-latest/duplicate-anchor-drawing.jpg),
[coordinates and lengths](verification/summit-latest/drawing-check.json).

## 4. Card-body navigation and route-button labels

Clicked each card's body rather than its route button. Actual emitted messages:

```json
{"type":"openMountain","catalogueId":"d2e4f6b3-d992-4ed4-9622-4ab05c6ef1dd","name":"Snowdon","region":"Gwynedd","country":"Wales"}
{"type":"openMountain","catalogueId":"c72f54a6-7022-4569-8573-0cb476b24a50","name":"Ben Nevis","region":"Highland","country":"Scotland"}
```

The page also emitted summitSelected messages carrying the observed names and
heights, including Snowdon 1085 and Ben Nevis 1345.

Observed button labels: **“Plan a route from here”** with an empty route;
**“Add to your route”** with an existing route.
Evidence: [existing-route card](verification/summit-latest/add-to-route-card.jpg).

## Protected globe/terrain/pitch behaviour

Confirmed through the real layers UI and camera transitions:

| State | Projection | Pitch | Terrain |
|---|---|---:|---|
| 3D, zoom 14 | globe | 60° | on |
| 3D, zoom 5 | globe | 0° | off |
| Back to zoom 14 | globe | 60° | on |
| Switch to 2D | mercator | 0° | off |

## Automated checks and exact errors

API tests: **193 passed, 3 failed** across nine files. Mobile tests:
**48 passed** across four files, including both newly imported navigation tests.

All three failures are in the existing `routeMapDrawing.test.ts` camera harness:
the terrain/globe transition, the 25 m minimum tap tolerance, and the 45 px
zoomed-out tap tolerance tests. Their document stub has querySelectorAll but
no querySelector; loading the full new page now invokes buildControls:

```text
TypeError: document.querySelector is not a function
    at buildControls (evalmachine.<anonymous>:853:20)
    at evalmachine.<anonymous>:1130:1
    at cameraHarness (src/__tests__/routeMapDrawing.test.ts:49:5)
```

No uncaught application exceptions were observed in the working browser.
Recorded console output:

```text
/favicon.ico: Failed to load resource: the server responded with a status of 404 (Not Found)
You are using the same source for a hillshade layer and for 3D terrain. Please consider using two separate sources to improve rendering quality.
performance warning: READ-usage buffer was written, then fenced, but written again before being read back. This discarded the shadow copy that was created to accelerate readback.
```

The first is the missing favicon, the second is a terrain/hillshade warning,
and the third is a software-rendering performance warning. None blocked the
observed map interactions. All were left unchanged.
