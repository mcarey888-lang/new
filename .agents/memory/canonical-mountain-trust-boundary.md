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