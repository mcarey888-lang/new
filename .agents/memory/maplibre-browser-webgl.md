---
name: MapLibre browser WebGL
description: Distinguish managed-runner WebGL failures from application failures during map verification.
---

A managed browser's failed WebGL initialization is not evidence that the map
application is broken. Verify graphics capability before judging map behaviour.

**Why:** Managed automation and capture browsers reported disabled GL and a
black route map, but the supplied local Chromium ran the actual map successfully
with software rendering.

**How to apply:** A local Chromium launch with `--use-gl=angle`,
`--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`,
`--headless` and `--no-sandbox` can provide a working test context without app
changes. If standard automation cannot attach, the browser can be driven over
raw DevTools Protocol. First verify actual MapLibre initialization, not just a
generic canvas context, before reporting any interaction as passed.

Check OS tile rendering from the actual published origin, not localhost.

**Why:** The summit-map author confirms OS tile CORS rejection on localhost is
expected and does not establish a production-layer failure.

**How to apply:** Observe tile statuses and visible contours/paths in a browser
on the published map page, and verify the active OS attribution. A redirect to
a landing page blocks verification; it is not a tile failure.

Use the public, asynchronous GeoJSON source `getData()` for browser assertions,
not a presumed shape of the private `_data` property.

**Why:** `_data` can be an object without a FeatureCollection's `features`, even
while the live source renders correctly; private-field checks produced false
harness failures.

**How to apply:** Await `getData()` when comparing the actual source's summit IDs
before and after a race. Keep automation errors separate from page exceptions.

Verify that the browser reference is an actual MapLibre instance before inspecting
its sources; `typeof map === "object"` is not enough.

**Why:** A DOM element named `map` can appear as a browser global while the real
map instance remains inside a closure. Inspection then fails in the automation
without indicating an application failure.

**How to apply:** Confirm the public map methods exist on the inspected instance,
then read source data through `getData()`. Do not report harness exceptions as
page errors.

Verify permission refusal in a fresh page session after a successful geolocation
test; changing the automation permission alone may leave a cached successful fix.

**Why:** The browser returned another successful emulated fix after a permission
override, but a fresh page with permission denied produced the actual refusal.

**How to apply:** Check the page's real PermissionStatus and the actual callback
result before claiming the refusal path ran. Distinguish a posted error message
from a visible explanation to the person using the map.

Return small, plain results from raw DevTools evaluations, never a MapLibre
instance or a method's fluent return value.

**Why:** Serializing the live map by value can fail with "Object reference chain
is too long" even though the evaluated action succeeded.

**How to apply:** Use `void` for map actions and extract primitive fields for
assertions; treat serialization failures as harness errors, not app failures.
