---
name: Virtual expedition trust boundary
description: Durable sourcing, fallback, route-selection, and identity rules for custom and virtual expeditions.
---

Verified canonical mountain identity is resolved first. When multiple fully verified target routes exist, the user must choose one; no caller may silently select a route or substitute an unrelated profile. A verified route profile contains only verified source facts plus clearly labelled deterministic calculations.

Last-resort target-profile fallback is allowed only after verified route facts and reusable cache data are unavailable. AI-derived or legacy AI-cache facts must remain explicitly unverified and retain their origin even on a cache hit. AI must never create local hill identity, coordinates, route metrics, or route selection.

The default custom-expedition style is summit-first: discover verified canonical summits, then named OSM peaks, and only then attach the best available route to each summit. Generic cached/seeded route rows never become the summit pool or suppress named-peak discovery. If summit evidence is depleted, return an honest insufficient-summits result rather than reverting to route-first matching.

Summit elevation and prominence determine objective order; Route DNA selects among attached routes. Requested days are a hard cap on distinct principal summits, with no repeats or filler. Ascent and distance ratios are advisory. Near-coincident subsidiary tops do not count as separate principal objectives. An explicit difficulty preference is an ability ceiling for both route grade and hazard; with no preference, retain target-DNA safety behavior.

Some legacy seeded trail catalogues use coarse estimates and lack summit linkage. Report generic Ways, valley walks, coast paths, and sightseeing routes as excluded diagnostics only. OSM terrain route estimates must be bounded local planning circuits derived from summit terrain, never the user's distance to the summit, and must not imply a verified trailhead.

Every new local route carries a stable public geographic identity through recommendations, plans, tracking, hill details, and completion. Older saved expeditions without an identity continue using the visible route name as a compatibility fallback.

**Why:** Route-first ascent arithmetic previously allowed generic Ways and filler outings to displace genuine high summits. Target routes can differ materially, legacy cache facts may originate from AI, summit altitude must never be mistaken for route ascent, and an OSM relation centre can resolve to an unrelated building rather than the public route start.

**How to apply:** Preserve per-field provenance, require explicit target-route selection, shortlist genuine summits before route scoring, enforce day/capability limits inside the selector, and treat missing optional route IDs as absent rather than as empty completion keys. Open coordinate-based directions only for an explicitly verified trailhead; otherwise search by route name plus its catalogue area.