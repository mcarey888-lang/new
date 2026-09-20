---
name: Expo web API CORS origin
description: Why Expo web fetches need a distinct development origin in the API allowlist.
---

Expo web runs at the Replit Expo development domain, whose origin is distinct
from the normal Replit development domain used as the API target. The API CORS
allowlist must explicitly include the Expo origin.

**Why:** Approved artwork resolution once failed CORS while the subsequent
cross-origin image fallback still rendered. This made a cold mountain fallback
look like successful approved-media consumption.

**How to apply:** For browser-based Expo QA, verify both the resolver fetch and
the final image request in the network trace. Keep a development source
diagnostic, and never infer approved-media success merely because an image is
visible.