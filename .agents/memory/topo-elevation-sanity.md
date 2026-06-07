---
name: Topo elevation sanity check bounds
description: OpenTopoData sanity check must guard both ends — too small AND too large — or misplaced AI coordinates produce tiny gains that slip through.
---

## Rule
In `applyTerrainElevation` / `applyTerrainElevationBatch` (hills-unified.ts), the sanity check must reject topo-verified gains that are **either too large OR too small** relative to the AI estimate:

```
if (verifiedGain <= 0 || verifiedGain < hill.elevation * 0.25 || verifiedGain > hill.elevation * 4) return hill;
```

**Why:** The original check only had the upper bound (`> 4× AI`). When the AI provides slightly misplaced trailhead coordinates, OpenTopoData returns near-zero gains (e.g. 37–53m for hills that should be 237–316m). These small values pass the old check (>0 and <4×) and overwrite the correct AI/calibration value. The 0.25 lower bound means: if topo gives less than 25% of what the AI said, the coordinates were wrong — keep the AI value.

**How to apply:** Any time this function is modified, keep both bounds. The calibration table in the prompt (`ELEVATION_CALIBRATION`) is the primary source of truth for UK hills; topo verification is a secondary cross-check, not an override.
