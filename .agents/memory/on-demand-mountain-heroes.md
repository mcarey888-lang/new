---
name: On-demand mountain heroes
description: Product distinction between automatic first-open images and manual artwork review.
---

Opening a canonically identified catalogue mountain can request one shared AI hero on demand. The resulting image may become visible automatically as a fallback, clearly identified as AI-generated; manually requested admin generations remain review candidates until explicitly approved. Reviewed/approved artwork always takes priority over automatic imagery.

For remaining obscure catalogue hills, show a shared replaceable trig-point placeholder until a generated image is ready, not automatic photo searches or satellite imagery. Do not replace the already approved AI artwork for major popular summits.

**Why:** The user explicitly protected approved popular-summit artwork and requested first-open generation only for the remaining obscure hills, with later visitors immediately reusing the saved result.

**How to apply:** Preserve approval priority; select shared artwork by canonical hill identity and revalidate mutable artwork rather than caching a placeholder or satellite result for days.

Approved artwork metadata is environment-specific application data. Sharing the generated image objects between development and production does not share their approval records, and publishing a schema change does not promote those records.

For approved-library transfers, offer an explicit owner approval in Artwork Admin rather than requiring pgAdmin. Do not import automatically at server startup or as an unannounced side effect of publishing.

**Why:** The user does not want pgAdmin and requested an approval trigger while preserving the existing approved images and mountain identities.

**How to apply:** Preview the target environment and changes, retain owner-only mutation permissions, preserve existing target decisions and require deliberate approval before writing metadata.

**Why:** The development library retained the user's reviewed collection while production had no corresponding approvals; a generated image could be downloaded from both environments, yet production's normal image selection still returned a fallback.

**How to apply:** Check approval metadata and referenced image availability in the target environment before claiming the collection is live. Any promotion must be explicitly scoped to the existing approved records, preserve newer target approvals/rejections, and never copy the whole development database.

**Why:** The user wants the image library to grow on demand rather than pre-generating the whole catalogue. They subsequently extended first-view generation from detail pages to cards and list thumbnails too. Manually initiated review candidates must still not publish themselves.

**How to apply:** Authenticated mountain slots on details, dashboards and lists may request generation only after obtaining a verified canonical identity. Legacy name-only slots must resolve uniquely in the catalogue; noncatalogued or ambiguous hills retain placeholders. Keep general image GETs read-only, reuse the existing authenticated request flow and unchanged per-user/per-IP/concurrency limits, and preserve approved-art priority. Reuse results across users and label AI images; a rejected image must cease being served.

The public mountain review queue may expose that an unapproved generated candidate exists for filtering, but must not expose its image URL or bytes.

**Why:** List reads are public; review-detail and generation-status reads are admin-guarded. Publishing a pending candidate URL in the list would bypass the manual review boundary.

**How to apply:** Keep list filters to IDs/status metadata. Load the actual candidate only through protected review endpoints.

Prompt-only mountain generation cannot browse the web merely because the prompt says "look online." Dramatic lighting instructions can still produce a generic, geographically wrong silhouette.

**Why:** In a two-prompt mountain comparison, both outputs looked polished but differed substantially from an identified real photograph when no vetted reference image reached the image model.

**How to apply:** Check actual reference availability before claiming geographic fidelity. For stronger likeness, supply verified exact-match image bytes to the generation call, and compare draft geometry with a real photograph before approving.

When a user approves a named mountain's hero for use across the app, use that mountain image on surfaces representing the mountain itself. An identifiable expedition with its own approved artwork is a separate subject: its exact expedition composition takes precedence over the inspirational mountain on expedition cards, detail, Basecamp and completion.

**Why:** The user approved the named mountain collection, but subsequently showed that the Welsh Mont Blanc expedition was incorrectly using a generic Mont Blanc image instead of the expedition composition approved in their artwork generator. The later clarification distinguishes mountain identity from expedition identity.

**How to apply:** For a known expedition ID, select only that expedition's currently approved artwork first. Do not select another regional expedition merely because it shares the target mountain. Use mountain art as fallback when no approved expedition composition exists. Keep ordinary mountain pages on identity-checked canonical mountain artwork; do not treat an AI illustration as proof of geographic accuracy.