---
name: Artwork fallback presentation parity
description: Decorative heroes must retain their visual boundaries across source changes and RN Web intrinsic image sizing.
---

Approved remote tab artwork and a bundled fallback must occupy the same approved visual footprint. A fallback must not turn a header photo into a full-page background or change the surrounding content treatment.

**Why:** Explore appeared to have different background artwork when its bundled fallback kept its intrinsic dimensions and extended beneath search and result cards. A normal development load with approved remote artwork concealed that failure path.

**How to apply:** Check both resolved artwork and unavailable/offline fallback states when changing decorative heroes. Preserve each screen's intended containment, crop and fade independently of image dimensions. Do not apply this as permission to replace identity-specific mountain or route imagery with generic artwork.

For React Native Web image backdrops, absolute edge offsets alone do not
override the asset's intrinsic width and height. Give the image explicit
container-relative dimensions and clip its bounded backdrop.

**Why:** A bundled landscape image expanded a phone onboarding document to its
original asset width. Chrome could then zoom out to the overflowing artwork,
leaving the actual onboarding small in one corner with a white area below.

**How to apply:** Check document scroll width against client width after the
image has loaded, at narrow widths and after rotation. Preserve browser zoom
accessibility; constrain the image rather than disabling zoom.
