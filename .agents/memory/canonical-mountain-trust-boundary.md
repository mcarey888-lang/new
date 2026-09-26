---
name: Canonical mountain trust boundary
description: Product trust rules for canonical mountain aliases and routes.
---

Only aliases with verified status may establish a canonical mountain match. For a canonical match, return only routes whose identity, definition, and facts are all verified; never enrich canonical routes from the legacy cache or AI. A verified mountain without verified routes returns an empty list marked unavailable.

**Why:** Canonical responses are presented as trusted catalogue data. Review-state aliases and generated or cached route suggestions have not crossed the same verification boundary and must not inherit canonical trust.

**How to apply:** Keep legacy cache and AI suggestions separate from canonical matches. They can remain browse-only after a genuine miss or during an explicitly labelled catalogue outage; neither case can grant verified identity. Clients must handle a verified mountain with no routes through manual entry rather than using legacy suggestions as canonical facts.

Curated Explore region labels are display categories, not verified catalogue regions. Do not pass them as exact region filters when resolving a mountain by name; ambiguous results must remain ambiguous rather than be resolved by an untrusted display label.

**Why:** Exact region matching can turn a known mountain into a false miss when the curated label (such as a national park) differs from the catalogue's administrative region.

**How to apply:** Keep authoritative country/region context for genuinely ambiguous identity resolution; omit broad discovery labels from exact canonical-name lookups.

Directions to a route start require a selected, navigable route with trusted geometry and a known route direction. A verified summit pin, place-name search, or narrative guide is not evidence of a trailhead or parking.

**Why:** A summit and a trailhead can be far apart, and a mapped route start is not necessarily accessible by car. Sending someone to a guessed start could be unsafe.

Operator-published car parks are access options, not verified route starts. A six-figure OS grid reference identifies roughly a 100-metre square, not an exact vehicle entrance.

**Why:** Several approaches to the same mountain use different valleys. An official car park listing proves a car park exists but cannot prove that any particular walking route starts there or that its grid reference is safe for turn-by-turn driving.

**How to apply:** Present sourced alternatives with their approach and source link. Let users search the named listing in Maps; do not transform a coarse grid reference or AI suggestion into a verified driving pin. Route-to-parking matching and precise entrance navigation require their own validation.

**How to apply:** Offer walking/driving directions only to the mapped start of a qualifying route. Describe driving as directions *near* the start, not to verified parking. Otherwise offer an explicitly labelled search for access points that the user must check locally.