---
name: Hill picker ascent targets
description: Area search and repetition semantics for changing a training hill.
---

When changing a training hill, treat town, postcode, and region searches as area lookups that list candidates; keep an explicit exact-name lookup for a specific hill. The choice list shows each hill's per-climb ascent, not the hill data provider's default repeat count. After choosing, the training session computes the minimum number of full climbs to meet or exceed its existing ascent target; it does not replace that target with the rounded-up total.

**Why:** The user saw only one hill for an area because the picker sent every query through the single-name lookup. The provider's ×3 next to a candidate looked like a prescription and changing hills could silently change a 456 m session target to the rounded total for the new hill.

**How to apply:** Keep area and exact-name intents distinct in future hill search surfaces. Preserve the session's ascent objective through hill changes, then display any calculated repeats in the plan/session prescription rather than on candidate rows. A full climb may exceed the target; describe planned gain separately from target gain.