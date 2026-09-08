---
name: Canonical mountain trust boundary
description: Product trust rules for canonical mountain aliases and routes.
---

Only aliases with verified status may establish a canonical mountain match. For a canonical match, return only routes whose identity, definition, and facts are all verified; never enrich canonical routes from the legacy cache or AI. A verified mountain without verified routes returns an empty list marked unavailable.

**Why:** Canonical responses are presented as trusted catalogue data. Review-state aliases and generated or cached route suggestions have not crossed the same verification boundary and must not inherit canonical trust.

**How to apply:** Keep legacy cache and AI fallback only for complete canonical misses. Clients must branch on canonical provenance and handle an empty verified route list through manual entry rather than interpreting canonical route facts as legacy suggestions.