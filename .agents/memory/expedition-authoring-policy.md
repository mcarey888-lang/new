---
name: Expedition authoring policy
description: Owner's external-AI expedition authoring workflow and trust constraints.
---

The owner wants to create expedition content in Claude and ChatGPT and bulk
import it into the existing SummitReady expedition library, not replace the
library or rebuild users' saved expeditions.

The owner also wants app-like expedition generation in the admin panel, using
the **same creation engine as custom expeditions**, rather than needing JSON
for every new catalogue addition. Keep both authoring paths.

**Why:** The owner requested an easier way to add new expeditions using the
creation workflow already available in the app.

**How to apply:** Reuse the engine rather than maintaining a divergent admin
matcher. Results are editable drafts; saving, owner review and artwork approval
remain deliberate separate actions. This does not resume paid route acquisition
or turn generated estimates into verified route facts.

**Why:** The older curated library was imported separately from the summit
catalogue; the owner requested reusable database-backed additions and bulk imports.

**How to apply:** Keep the downloadable template and AI prompt aligned with the
accepted import contract. Preview errors before saving, use create-only draft
imports, and require deliberate owner review before making content available.
Catalogue summit selection establishes identity/location only; route ascent,
walking distance, access and hazards need their own evidence. Do not silently
rewrite started expeditions, user activity or approved artwork.

Prioritize a small, reviewed UK route collection covering the existing
expedition stages before acquiring a large generic route catalogue.

**Why:** The owner agreed to keep the current expeditions and improve their data,
while keeping provider costs low. A summit record alone does not establish a
named walking route or its geometry.

**How to apply:** Audit existing route coverage first, then stage source-specific
candidates with explicit commercial reuse rights. Public availability of GPX/KMZ
downloads is not permission to redistribute them in SummitReady. In particular,
personal-use downloads need separate permission; keep ODbL attribution and
applicable share-alike obligations explicit for OSM-derived route data. A failed
source request is unavailable evidence, never proof that a route does not exist.
