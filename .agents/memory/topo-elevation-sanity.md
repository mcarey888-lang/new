---
name: Topo elevation sanity check bounds
description: OpenTopoData sanity check must guard both ends — too small AND too large — or misplaced AI coordinates produce understated gains that slip through.
---

## Rule
In `applyTerrainElevation` / `applyTerrainElevationBatch` (hills-unified.ts), the sanity check must reject topo-verified gains that are **either too large OR too small** relative to the AI estimate:

```
if (verifiedGain <= 0 || verifiedGain < hill.elevation * 0.50 || verifiedGain > hill.elevation * 4) return applyKnownGain(hill);
```

**Why:** The original check only had the upper bound (`> 4× AI`). AI trailhead coordinates are often placed too high on the mountain, causing OpenTopoData to return understated gains (e.g. Tryfan returned 311m instead of 617m — 46% of expected, which passed the old 25% bound). Raised to 50% so "half the mountain" errors are caught. The KNOWN_GAINS table is the primary override — applyKnownGain always wins.

**How to apply:** Any time this function is modified, keep both bounds. The KNOWN_GAINS table (hardcoded verified figures for ~50 UK/Irish peaks) is the primary source of truth; topo verification is a secondary cross-check. When a new peak shows a wrong figure, add it to KNOWN_GAINS first, then check if the bounds need tightening.

## KNOWN_GAINS table coverage (as of Jun 2026)
Peak District, Yorkshire Dales, Lake District, Wales (incl. Tryfan, Glyders, Carneddau, Snowdon variants), Scotland (incl. Ben Macdui, Braeriach, Cairn Toul), Ireland (Croagh Patrick, Carrauntoohil), Lancashire/West Pennines.
