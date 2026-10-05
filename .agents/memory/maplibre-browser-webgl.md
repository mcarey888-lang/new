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
