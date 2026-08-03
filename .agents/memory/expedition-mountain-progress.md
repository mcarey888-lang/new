---
name: ExpeditionMountainProgress component
description: Production expedition centrepiece — MountainProgress SVG route + layout details, path alignment rules.
---

**Rule:** Stage markers are numbered circles only (no SVG text labels on mountain); progress bubble follows marker via RN View overlay.

**Path alignment:** The ROUTE_PATH in `MountainProgress.tsx` and the SEGS array in `mountainPath.ts` must always be identical — they are the visual path and the arc-length lookup table for the animated marker respectively. If they diverge, the green marker will not follow the drawn line.

**Summit coordinate:** The route endpoint (and therefore the summit flag position) must correspond to the actual mountain peak in `mountain-bg.png` (860×800). The peak is at approximately 73% across and 31.5% from the top of the image — SVG coordinate (262, 85) in the 360×270 viewBox. Do NOT use the top-right corner (357.5, 2) — that is blank sky, not the summit.

**Mountain size:** height multiplier is 1.90× the base 3:4 aspect ratio (i.e. `width × 0.75 × 1.9 = width × 1.425`). Anything below 1.7× looks too small and the mountain fails to dominate the card.

**Elevation units:** always metres (never km) throughout `MountainProgress.tsx`, `ExpeditionMountainProgress.tsx`, and `base-camp.tsx`.

**Why:** The route was originally traced to end at the SVG top-right corner (357.5, 2) — matching the image's absolute edge, not the visual summit. This caused the progress line to appear to float above the mountain. Corrected by redesigning the upper path segment to terminate at the actual peak.

**How to apply:** Any future path changes must update BOTH `ROUTE_PATH` (in `MountainProgress.tsx`) AND `SEGS` (in `mountainPath.ts`) in lockstep. The last segment in SEGS is `cb((241.5,122.5),(249,111),(257,97),(262,85))` — the summit approach.
