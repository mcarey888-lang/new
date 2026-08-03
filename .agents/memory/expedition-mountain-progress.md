---
name: ExpeditionMountainProgress component
description: Production expedition centrepiece — MountainProgress SVG route + analytically derived image positioning.
---

## Image positioning — analytical approach

The mountain image (mountain-bg.png, 860×800) is positioned by **pure maths from pixel analysis**, not manual scaling. Never adjust the height multiplier or offset by eye — recalculate instead.

### Key constants (from `identify` + Python brightness scan)
```
IMG_W = 860, IMG_H = 800
IMG_RIDGE_COL  = 171   // leftmost visible ridge column
IMG_PEAK_COL   = 717   // summit column
IMG_PEAK_ROW   = 253   // summit row
RIDGE_SPAN_FRAC = (717 - 171) / 860 = 0.6349
```

### SVG path endpoint (must stay in sync with ROUTE_PATH + SEGS)
```
SUMMIT_SVG_X = 262
SUMMIT_SVG_Y = 85
```

### Derived transform (given component `width` in px)
```js
imgW   = (SUMMIT_SVG_X / VB_W) * width / RIDGE_SPAN_FRAC   // 1.1463 × width
imgH   = imgW * (IMG_H / IMG_W)                             // natural aspect ratio
height = imgH * (1 - IMG_PEAK_ROW/IMG_H) / (1 - SUMMIT_SVG_Y/VB_H)  // ≈ 1.064 × width
imgLeft = -(IMG_RIDGE_COL / IMG_W) * imgW                  // ≈ -0.228 × width
imgTop  = (SUMMIT_SVG_Y/VB_H)*height - (IMG_PEAK_ROW/IMG_H)*imgH    // ≈ 0
```

**Why:** This guarantees (a) ridge left aligns with x=0, (b) the summit pixel aligns exactly with the SVG path endpoint (262,85), and (c) the mountain base fills the component bottom. No guesswork.

## Route path rules

- **ROUTE_PATH** (in `MountainProgress.tsx`) and **SEGS** (in `mountainPath.ts`) must be kept identical — visual path and arc-length lookup table.
- Path endpoint: (262, 85) — the actual mountain summit at 83.4% across, 31.6% down in the image.
- Path starts at M-10,268 (horizontal lead-in, clipped by overflow:hidden).

## Stage markers

Numbered circles only (no SVG text labels on mountain). Leader lines use dashes for upcoming stages. Completed stages show ✓. Summit badge is a planted flag at `getPointAtFraction(1.0)`.

## What NOT to do

- Do not hardcode a height multiplier (e.g. `1.3×`, `1.9×`). Use the analytical formula.
- Do not manually adjust `imgLeft` or `imgTop`. They are mathematically derived.
- Do not attempt web preview — Reanimated + SVG is native only.
- Do not re-run the pixel analysis without updating ALL five constants consistently.
