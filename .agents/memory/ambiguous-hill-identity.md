---
name: Ambiguous hill identity
description: Rules for preventing common hill names from resolving to another region or country.
---

Hill identity must include trusted coordinates and location context; a normalized name alone is not a safe identifier. Carry the expedition's local location and summit coordinates into hill-detail generation, cache keys, and map actions. Keep per-climb elevation separate from repeated-route total gain.

**Why:** Common names such as Bull Hill and Dry Hill can resolve to unrelated US or UK locations. Name-only caches and text-based map searches can preserve the wrong identity, while passing repeated total gain as one climb makes a correct 316m hill appear to exceed 900m.

**How to apply:** Prefer verified coordinates for pins and directions, reject cached coordinates far from the requested location, scope ambiguous known-gain overrides by coordinates, and never present an AI-provided postcode or car-park name as verified without an independent location check.