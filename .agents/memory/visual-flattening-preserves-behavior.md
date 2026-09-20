---
name: Visual flattening preserves behavior
description: Guardrail for editorial Basecamp refinements that reduce card density.
---

Premium Basecamp work may replace rounded containers with typography,
whitespace, dividers, and flatter rows, but it must retain every existing
functional affordance and semantic state.

**Why:** A visual-only flattening pass once looked correct and passed TypeScript
and broad tests while accidentally changing the next-session route and removing
week-progress accessibility, achievement notifications, AI Coach controls, and
baseline meaning.

**How to apply:** Compare interaction and accessibility behavior against the
pre-change screen, not just screenshots. Explicitly verify session navigation,
week progress, Readiness meaning, Elevation Bank destination, achievements,
coach refresh/retry/tips/disclaimer/Q&A, reduced motion, and fixture-specific
artwork gating.