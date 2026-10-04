---
name: Planner globe intent
description: Why global browsing belongs in the planner's 3D mode while its 2D mode stays flat.
---

Keep globe zoom-out in the route planner's 3D mode, with 2D remaining a genuinely flat map.

**Why:** The user supplied a zoomed-out screenshot with 3D selected and asked for a globe instead of a tilted flat world map. Keeping 2D flat preserves the meaning of the existing mode choices.

**How to apply:** Use an adaptive globe projection for world browsing and precise local mapping when zoomed in. Changing the view must preserve the drawn route, its surveyed/unsurveyed distinction and the selected map layers; it is not permission to replace the planning or recording workflow.

**Verification constraint:** A browser reporting `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled` and `Failed to initialize WebGL` cannot verify this surface. The black canvas is then a graphics-disabled test-environment blocker, not evidence of a CDN delay. Do not claim a visual pass or remove globe support to accommodate that browser.

Preserve the globe and adaptive terrain behavior when importing route-drawing fixes
from another branch. Apply conflicting changes narrowly rather than replacing the
whole map page with an older upstream copy.

**Why:** The user explicitly prohibited overwriting the globe work when requesting
snapping fixes; the other branch lacks that behavior.

**How to apply:** Inspect incoming diffs before applying them and retain projection,
pitch restoration, terrain boundaries and existing route state.