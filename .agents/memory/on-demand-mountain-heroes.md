---
name: On-demand mountain heroes
description: Product distinction between automatic first-open images and manual artwork review.
---

Opening a canonically identified catalogue mountain can request one shared AI hero on demand. The resulting image may become visible automatically as a fallback, clearly identified as AI-generated; manually requested admin generations remain review candidates until explicitly approved. Reviewed/approved artwork always takes priority over automatic imagery.

For remaining obscure catalogue hills, show a shared replaceable trig-point placeholder until a generated image is ready, not automatic photo searches or satellite imagery. Do not replace the already approved AI artwork for major popular summits.

**Why:** The user explicitly protected approved popular-summit artwork and requested first-open generation only for the remaining obscure hills, with later visitors immediately reusing the saved result.

**How to apply:** Preserve approval priority; select shared artwork by canonical hill identity and revalidate mutable artwork rather than caching a placeholder or satellite result for days.

Approved artwork metadata is environment-specific application data. Sharing the generated image objects between development and production does not share their approval records, and publishing a schema change does not promote those records.

**Why:** The development library retained the user's reviewed collection while production had no corresponding approvals; a generated image could be downloaded from both environments, yet production's normal image selection still returned a fallback.

**How to apply:** Check approval metadata and referenced image availability in the target environment before claiming the collection is live. Any promotion must be explicitly scoped to the existing approved records, preserve newer target approvals/rejections, and never copy the whole development database.

**Why:** The user wants the image library to grow only as climbers actually open mountains, rather than pre-generating the whole catalogue. Requiring manual approval for every first-open result would defeat that experience, while letting admin-initiated review candidates publish themselves would violate the earlier explicit-review requirement.

**How to apply:** Trigger a paid generation only from a mountain-detail selection backed by canonical catalogue identity, never from list thumbnails or image reads. Reuse the result across users, use an identity-matched photographic reference where trustworthy, and label AI images because photorealism does not prove geographic accuracy. A rejected image must cease being served.

The public mountain review queue may expose that an unapproved generated candidate exists for filtering, but must not expose its image URL or bytes.

**Why:** List reads are public; review-detail and generation-status reads are admin-guarded. Publishing a pending candidate URL in the list would bypass the manual review boundary.

**How to apply:** Keep list filters to IDs/status metadata. Load the actual candidate only through protected review endpoints.

Prompt-only mountain generation cannot browse the web merely because the prompt says "look online." Dramatic lighting instructions can still produce a generic, geographically wrong silhouette.

**Why:** In a two-prompt mountain comparison, both outputs looked polished but differed substantially from an identified real photograph when no vetted reference image reached the image model.

**How to apply:** Check actual reference availability before claiming geographic fidelity. For stronger likeness, supply verified exact-match image bytes to the generation call, and compare draft geometry with a real photograph before approving.

When a user approves a named mountain's hero for use across the app, that mountain image takes precedence over older challenge artwork on cards and heroes representing that same named mountain. Do not apply this to generic banners, exercise illustrations, or routes involving several different mountains.

**Why:** The user explicitly approved the named collection and asked for those images wherever those mountains appear; an approval restricted to the admin library would leave existing challenge art visible in the app.

**How to apply:** Use an identity-checked canonical mountain match, including deliberate aliases and single-mountain route labels, before overriding challenge art. Do not use loose substring matches or silently treat an AI illustration as proof of geographic accuracy.