---
name: Virtual expedition trust boundary
description: Durable sourcing, fallback, route-selection, and identity rules for custom and virtual expeditions.
---

Verified canonical mountain identity is resolved first. When multiple fully verified target routes exist, the user must choose one; no caller may silently select a route or substitute an unrelated profile. A verified route profile contains only verified source facts plus clearly labelled deterministic calculations.

Last-resort target-profile fallback is allowed only after verified route facts and reusable cache data are unavailable. AI-derived or legacy AI-cache facts must remain explicitly unverified and retain their origin even on a cache hit. AI must never create local hill identity, coordinates, route metrics, or route selection.

Local candidates come from public/database route records first, then bounded OSM/terrain enrichment only when the deterministic matcher cannot form a safe 90–110% combination. Seeded OSM estimates must be labelled as estimates, and user-owned tracked routes must never be reused globally. Seeded route coordinates may be relation centres or representative points: they may support identity/matching, but must never be presented as verified trailheads, parking, or driving destinations.

Some legacy seeded trail catalogues use a coarse fixed ascent-density estimate and do not link routes to summit altitude. Treat those rows as estimates: require complete route facts and structured mountain terrain, then use generic summit-objective wording only as corroboration. Generic Ways, valley walks, coast paths, and sightseeing routes must not qualify merely because their aggregate ascent helps a plan reach the target band.

Every new local route carries a stable public geographic identity through recommendations, plans, tracking, hill details, and completion. Older saved expeditions without an identity continue using the visible route name as a compatibility fallback.

**Why:** Target routes can differ materially, legacy cache facts may originate from AI, same-named local routes can be geographically distinct, summit altitude must never be mistaken for route ascent, and an OSM relation centre can resolve to an unrelated building rather than the public route start.

**How to apply:** Preserve per-field provenance, require explicit target-route selection, use deterministic bounded matching with feasibility checks, and treat missing optional route IDs as absent rather than as empty completion keys. Open coordinate-based directions only for an explicitly verified trailhead; otherwise search by route name plus its catalogue area.