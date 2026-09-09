---
name: Virtual expedition trust boundary
description: Durable sourcing, fallback, route-selection, and identity rules for custom and virtual expeditions.
---

Verified canonical mountain identity is resolved first. When multiple fully verified target routes exist, the user must choose one; no caller may silently select a route or substitute an unrelated profile. A verified route profile contains only verified source facts plus clearly labelled deterministic calculations.

Last-resort target-profile fallback is allowed only after verified route facts and reusable cache data are unavailable. AI-derived or legacy AI-cache facts must remain explicitly unverified and retain their origin even on a cache hit. AI must never create local hill identity, coordinates, route metrics, or route selection.

The default custom-expedition style is summit-first: discover canonical-trusted summits, then named OSM peaks only when canonical coverage is genuinely unavailable. Generic cached/seeded route rows never become the summit pool or suppress named-peak discovery. DoBIH imports are canonical-trusted only when their source record is from the exact DoBIH dataset, both trust statuses are `trusted_source`, and QA is `pass` or informational `info`; never broaden this exception to other imported sources.

Match target-route total ascent and distance using the smallest valid number of distinct principal summits: normal tolerances are ±15% ascent and ±20% distance, widened fallback is ±30% and ±35%, and only then may the closest safe two-axis approximation be used. Requested days are a maximum, with no repeats or filler. Within the first valid cardinality, prefer summit elevation, prominence, established route evidence, numeric fit, Route DNA, then stable identity. Near-coincident subsidiary tops do not count separately.

Difficulty labels are ranking preferences, not automatic proof that a Moderate user cannot scramble. For a strongly technical target, known technical-route evidence may be required when available; Moderate can retain target-compatible high/severe objectives, while Easy is an explicit veto. Nontechnical target DNA still excludes incompatible hazards.

Canonical DoBIH summits without verified route facts retain canonical identity and prominence but receive clearly labelled `terrain_calculated` estimates at canonical coordinates. Such estimates never become verified route facts or borrow a specific route name such as “North Face.”

Some legacy seeded trail catalogues use coarse estimates and lack summit linkage. Report generic Ways, valley walks, coast paths, and sightseeing routes as excluded diagnostics only. OSM terrain route estimates must be bounded local planning circuits derived from summit terrain, never the user's distance to the summit, and must not imply a verified trailhead.

Every new local route carries a stable public geographic identity through recommendations, plans, tracking, hill details, and completion. Older saved expeditions without an identity continue using the visible route name as a compatibility fallback.

**Why:** Route-first arithmetic previously allowed generic Ways and filler outings to displace genuine summits; highest-first selection then ignored materially different target route profiles. Imported DoBIH identities were also hidden by mountain status and by treating an informational QA flag as failure. Target routes can differ materially, legacy cache facts may originate from AI, and summit altitude must never be mistaken for route ascent.

**How to apply:** Preserve per-field provenance, require explicit target-route selection, evaluate every combination at each cardinality before moving to the next, and expose target/planned ascent, distance, percentages, tolerance mode, and mismatch reason. Keep GPS directions separate: open coordinates only for a verified trailhead; otherwise search by route name plus catalogue area.