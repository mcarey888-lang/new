---
name: Artwork admin request budgets
description: Prevent gallery image fan-out from appearing to invalidate an admin session.
---

Protect gallery image reads without letting their fan-out exhaust the same rate-limit budget as admin manifest reads and actions. Treat throttling and unavailable services differently from a rejected admin key in user-facing errors.

**Why:** Rendering many protected image variants consumed the shared API request budget. The manifest then returned 429, but the UI told the user to verify the key even though the saved key was still present.

**How to apply:** When changing Artwork Admin galleries, polling, or API throttling, check both image and control-request budgets, preserve auth on image endpoints, and reserve “key rejected” for actual authorization failures.

Public expedition catalogue reads also need a workload-specific budget, separate
from background traffic and paid generation. Keep rate limiting enabled; do not
fix a browsing failure by weakening AI cost protection.

**Why:** A normal expedition detail tap was blocked by the general API budget,
and its UI showed only an unexplained HTTP 429.

**How to apply:** When changing API workloads, check that background fan-out cannot
starve user-initiated detail reads. Honour Retry-After in retry UI, expose that
header to cross-origin web previews, and never turn a failed read into generation.