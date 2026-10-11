---
name: Local hill search trust
description: UK training hill discovery must be source-grounded; preserve global fallback policy separately.
---

UK training searches must establish a mapped peak before offering its location or climb data. Do not pad a short result list with AI hills, and do not accept a nearby legacy cache row as proof that a named hill exists.

**Why:** A user received Brook's Hill with an unsupported 668 m climb and Alpine terrain; name-based map lookup led to a street. Public peak-provider failures were being treated as empty results, making AI substitution particularly misleading.

**How to apply:** Prefer nearby mapped candidates for training. Distinguish a genuinely empty search from a provider failure, and show a retryable error for the latter. Legacy assignments need fresh source-backed details before their climb figures are reused. Terrain sampling is an estimate, not a surveyed walking route; label it accordingly.

Keep the existing non-UK/alpine fallback policy separate from this UK restriction. Known route-access gain calibrations remain stronger than generic radial terrain estimates; preserve their coordinate-scoped identity checks.

**Why:** Radial sampling has insufficient coverage in some alpine regions, while established route-access calibrations correct misleading summit-to-valley differences.

**How to apply:** Do not silently remove global fallback behavior when tightening UK training discovery, or promote a terrain estimate to verified route ascent.

Explore and Change hill should use the same nearby-search behavior and results, not independent postcode-search policies.

**Why:** The user could find hills for the same postcode in Explore while the session picker failed. They explicitly requested the Explore search for changing session hills.

**How to apply:** Keep postcode normalization, search radius and successful-result reuse shared across both entry points. Preserve source identities and estimated-climb labels when assigning a result to a session.
