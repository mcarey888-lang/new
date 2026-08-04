---
name: ExpeditionMountainProgress component
description: Production expedition centrepiece — MountainProgress SVG route + image positioning.
---

## Image positioning — left + bottom aligned (current approach)

The mountain PNG (`mountain-bg.png`, 406×366) and the route SVG (`master-route.svg`, viewBox "0 0 380 344") were **authored together** at the same coordinate scale. No pixel analysis is needed. Simply scale both by `W/380` and align left+bottom.

```js
const VB_W = 380;   // SVG viewBox width
const VB_H = 344;   // SVG viewBox height
const PNG_W = 406;  // mountain-bg.png natural width
const PNG_H = 366;  // mountain-bg.png natural height

const scale  = width / VB_W;          // 1 SVG unit → this many px
const imgW   = PNG_W * scale;          // 406/380 × W — slightly wider (right clipped)
const imgH   = PNG_H * scale;          // 366/380 × W — slightly taller (top clipped)
const height = VB_H * scale;           // component height = 344/380 × W
const imgLeft = 0;
const imgTop  = height - imgH;         // bottom-aligned (slightly negative)
```

**Why:** The PNG extends 26px right and 22px above the SVG viewBox at the same scale. Left+bottom alignment is exact because both files share a coordinate origin.

**How to apply:** If the PNG or SVG ever changes, update `PNG_W/PNG_H/VB_W/VB_H` to match the new file dimensions. No pixel analysis needed.

## Route path

- ROUTE_PATH copied verbatim from `master-route.svg` (viewBox "0 0 380 344")
- Path: M2 342 → … → 378 2 (bottom-left to top-right, 27 segments)
- `mountainPath.ts` SEGS must be kept in sync with ROUTE_PATH

## SVG aspect ratio

With `height = VB_H * scale = VB_H * (width/VB_W)`, the SVG pixel scale is **uniform** (same px/unit in x and y). No distortion. Component is 380×344 ratio ≈ 1.105:1 (slightly wider than tall).

## Stage markers

Numbered circles only (no SVG text labels on mountain). Summit badge at `getPointAtFraction(1.0)` = (378, 2) — flag hangs **downward** (poleBot = py + 9) since summit is near top of viewBox.

## Y-axis labels

Label positions derived from `getPointAtFraction(t).y / VB_H` for t = 0, 0.33, 0.66, 1.0. This makes them span the full mountain height (summit to base). Implemented in `ExpeditionMountainProgress.tsx`.

## What NOT to do

- Do not hardcode a height multiplier. Use `height = VB_H * scale`.
- Do not pixel-analyse the PNG. The files were authored to align.
- Do not attempt web preview — Reanimated + SVG is native only.
- Do not re-use the old RIDGE_SPAN_FRAC / IMG_PEAK_COL approach — it's been removed.
