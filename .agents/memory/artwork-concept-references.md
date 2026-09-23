---
name: Artwork concept references
description: Separate exploratory canvas concepts from generated and approved UI artwork.
---

Treat design directions from the canvas as read-only concept references. Do not insert them as generated candidates or approved assets without going through the normal creation and review workflow.

**Why:** Four directions each for Ranks, Achievements, and Editorial images were designed as React mockups, not individual production artwork. The canvas preview service is development-only, so an admin view that depends on its live URLs would break in published builds.

**How to apply:** When showing exploratory concepts in the UI Asset System, include stable visual snapshots for published builds and label them as mockups. Keep candidate status and approval tied to actual generated artwork and its provenance.