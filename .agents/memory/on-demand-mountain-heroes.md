---
name: On-demand mountain heroes
description: Product distinction between automatic first-open images and manual artwork review.
---

Opening a canonically identified catalogue mountain can request one shared AI hero on demand. The resulting image may become visible automatically as a fallback, clearly identified as AI-generated; manually requested admin generations remain review candidates until explicitly approved. Reviewed/approved artwork always takes priority over automatic imagery.

**Why:** The user wants the image library to grow only as climbers actually open mountains, rather than pre-generating the whole catalogue. Requiring manual approval for every first-open result would defeat that experience, while letting admin-initiated review candidates publish themselves would violate the earlier explicit-review requirement.

**How to apply:** Trigger a paid generation only from a mountain-detail selection backed by canonical catalogue identity, never from list thumbnails or image reads. Reuse the result across users, use an identity-matched photographic reference where trustworthy, and label AI images because photorealism does not prove geographic accuracy. A rejected image must cease being served.

The public mountain review queue may expose that an unapproved generated candidate exists for filtering, but must not expose its image URL or bytes.

**Why:** List reads are public; review-detail and generation-status reads are admin-guarded. Publishing a pending candidate URL in the list would bypass the manual review boundary.

**How to apply:** Keep list filters to IDs/status metadata. Load the actual candidate only through protected review endpoints.