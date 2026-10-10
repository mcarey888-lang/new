---
name: Embedded map touch layout
description: Keep recorder host overlays from covering or intercepting the embedded map controls.
---

Give the recording map its own viewport below the measured app header, including
the device safe area. Decorative gradients and read-only header labels must be
explicitly touch transparent; the back button remains interactive.

**Why:** The recorder's header occupied the same pixels as the embedded map's
Layers, Follow paths and Done controls. Controls could be visible yet untappable.
Raising a button inside an iframe or WebView cannot fix a covering host overlay.

**How to apply:** Check host header and map bounds together, not just the
standalone map page. Account for header measurement, large text and rotation.
Do not hide or rewrite working map controls to work around host hit testing, and
do not change recording, GPS, saving or pause/resume behavior for a layout fix.
