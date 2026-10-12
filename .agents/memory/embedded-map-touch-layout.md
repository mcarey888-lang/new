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

The Track landing sheet must sit above the full absolute-positioned primary
navigation footprint, including its native safe area. Include both sheet and
navigation height when lifting the map attribution.

**Why:** Padding for the home indicator alone did not reserve the navigation
bar; it covered the Start hike button despite that button being rendered.

**How to apply:** Share the navigation height calculation rather than maintaining
separate offsets. Do not add the native bottom safe area twice.

Summit cards and attribution must also remain clear of each other, not just the
host panel. Moving both upward by the same bottom inset does not guarantee this.

**Why:** A software-rendered mobile map showed a readable raised summit card
overlapping the raised attribution box, hiding the licensed OS text.

**How to apply:** Check actual card and attribution bounds together with the
host overlays. Reserve attribution space separately and preserve the author's
map implementation boundary when requesting a correction.

Embedded map HTML must revalidate as application code, retaining conditional
ETag responses rather than being cached like artwork or tiles.

**Why:** The author confirmed a phone kept the previous map for an hour after
new code was imported; Explore's obsolete route-button wording exposed the stale
page and made the repaired Track layout appear broken.

**How to apply:** Check response headers and a conditional second request.
Distinguish an old cached page from a lost host measurement before changing
layout logic.

Combine imported host-inset handshakes with existing navigation clearance and
selected-route replay; never choose one branch's entire handler over the other.

**Why:** The author's map changes and local host corrections contain
complementary responsibilities. Replacing either wholesale loses an independent
fix even when the imported server page is correct.

**How to apply:** Retain measurements before map load, replay them on the map's
request, and preserve ready-triggered route geometry and the full navigation
footprint when resolving future imports.
