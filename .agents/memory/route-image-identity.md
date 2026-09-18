---
name: Route image identity
description: Accuracy rules for selecting imagery for named mountain routes.
---

Route-level image requests must preserve the full route subject and use stable route or summit identity plus verified coordinates whenever available. For an identified route, an exact route photo is acceptable; otherwise use the verified coordinate fallback rather than broad location-only or related-place imagery.

**Why:** Simplifying route names and searching by the surrounding region can return attractive but incorrect nearby scenery, which then becomes persistent in the shared image cache.

**How to apply:** Keep mountain-level hero lookup separate from route-level lookup. Key route caches by identity, require route-defining words in photo candidates, and invalidate the image-cache version whenever matching rules change.