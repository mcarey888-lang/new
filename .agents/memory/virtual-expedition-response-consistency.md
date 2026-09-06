---
name: Virtual expedition response consistency
description: Keeps narrative expedition days aligned with route recommendations after ascent matching changes the selected hills.
---

The narrative day plan and the final recommended hill list must contain the same canonical route set and order after pruning, gap filling, deduplication, or repetition adjustment.

**Why:** The Route screen prefers the narrative day plan when present. Returning raw AI days after post-processing recommendations can resurrect a removed summit or hide an added best-fit route.

**How to apply:** Whenever recommendation post-processing changes route membership, reconcile every route-bearing response field to the final set before responding. Regression checks should compare flattened day route names directly with recommendation names.