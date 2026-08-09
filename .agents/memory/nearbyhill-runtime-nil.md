---
name: NearbyHill elevation nil at runtime
description: The virtual-expedition API does not always include `elevation` in returned hills — only `totalElevation` is reliable. Any code that calls `.elevation` without a nil guard crashes at runtime even though the TypeScript type marks it required.
---

## Rule
Never call `hill.elevation` directly on a `NearbyHill` object. Always use:

```ts
h.totalElevation ?? h.elevation ?? 0
```

This pattern is already established in `ExpeditionMountainProgress` and should be used consistently everywhere else.

**Why:** The `/virtual-expedition` API returns `recommendedHills` where individual hills may omit `elevation` even though `NearbyHill.elevation: number` is marked required in TypeScript. JSON.parse doesn't validate types, so the mismatch is invisible at compile time.

**How to apply:** Whenever displaying or computing from a `NearbyHill.elevation` field (in render, callbacks, navigation params), use the triple-fallback pattern. The TypeScript type is aspirational, not a runtime guarantee for data that passed through AsyncStorage or the API.
