---
name: Virtual expedition trust boundary
description: Durable sourcing, fallback, route-selection, and identity rules for custom and virtual expeditions.
---

Verified canonical mountain identity is resolved first. When multiple fully verified target routes exist, the user must choose one; no caller may silently select a route or substitute an unrelated profile. A verified route profile contains only verified source facts plus clearly labelled deterministic calculations.

Last-resort target-profile fallback is allowed only after verified route facts and reusable cache data are unavailable. AI-derived or legacy AI-cache facts must remain explicitly unverified and retain their origin even on a cache hit. AI must never create local hill identity, coordinates, route metrics, or route selection.

The default custom-expedition style is summit-first: discover canonical-trusted summits, then named OSM peaks only when canonical coverage is genuinely unavailable. Generic cached/seeded route rows never become the summit pool or suppress named-peak discovery. DoBIH imports are canonical-trusted only when their source record is from the exact DoBIH dataset, both trust statuses are `trusted_source`, and QA is `pass` or informational `info`; never broaden this exception to other imported sources.

Match target-route total ascent and distance using the smallest valid number of distinct principal summits: normal tolerances are ±15% ascent and ±20% distance, widened fallback is ±30% and ±35%, and only then may the closest safe two-axis approximation be used. Requested days are a maximum, with no repeats or filler. Within the first valid cardinality, prefer summit elevation, prominence, established route evidence, numeric fit, Route DNA, then stable identity. Near-coincident subsidiary tops do not count separately.

The headline match score is the equal-weight average of symmetric gain and distance proximity, so both under- and overshooting reduce the score. Summit altitude and consecutive days are informational only; technical suitability is secondary and scheduling is shown separately.

When an automatic plan remains below normal tolerance, an optional extra summit may be recommended from the already eligible local pool only. It must strictly reduce combined normalized gain/distance error, preserve canonical identity/provenance and safety exclusions, and never be added automatically. A duration increase requires explicit confirmation.

Summit and route identity are separate: objective cards, GPS completion, and saved expeditions use the canonical summit ID, name, and coordinates. An attached route keeps its own ID, name, metrics, geometry, and provenance and is displayed as secondary “via” information. Deduplicate alternatives by summit, not route.

Same-day scheduling requires trusted combined-route identity or reliable route-boundary/trailhead compatibility. Summit coordinates are never substitutes for trailheads. Without reliable geometry, keep objectives separate, mark scheduling estimated, recommend another day, and never add transition distance to route totals.

Difficulty labels are ranking preferences, not automatic proof that a Moderate user cannot scramble. For a strongly technical target, known technical-route evidence may be required when available; Moderate can retain target-compatible high/severe objectives, while Easy is an explicit veto. Nontechnical target DNA still excludes incompatible hazards.

Canonical DoBIH summits without verified route facts retain canonical identity and prominence but receive clearly labelled `terrain_calculated` estimates at canonical coordinates. Such estimates never become verified route facts or borrow a specific route name such as “North Face.”

Some legacy seeded trail catalogues use coarse estimates and lack summit linkage. Report generic Ways, valley walks, coast paths, and sightseeing routes as excluded diagnostics only. OSM terrain route estimates must be bounded local planning circuits derived from summit terrain, never the user's distance to the summit, and must not imply a verified trailhead.

Every new local route carries a stable public geographic identity through recommendations, plans, tracking, hill details, and completion. Older saved expeditions without an identity continue using the visible route name as a compatibility fallback.

**Why:** Route-first arithmetic previously allowed generic Ways, route features, and filler outings to displace genuine summits. Separate identities prevent routes from masquerading as mountains; explicit schedule evidence prevents disconnected outings from being presented as one continuous walk.

**How to apply:** Preserve per-field provenance, require explicit target-route selection, evaluate every combination at each cardinality before moving to the next, and expose target/planned/projected ascent, distance, percentages, tolerance mode, and mismatch reason. Exclude known sub-30m-prominence subsidiary tops from principal objectives. Keep GPS directions separate: open coordinates only for a verified trailhead; otherwise search by route name plus catalogue area.