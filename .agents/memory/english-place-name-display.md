---
name: English place-name display
description: Naming policy for Welsh mountains and regions that have established English equivalents.
---

Use established English equivalents in user-facing route and region names: Snowdon rather than Yr Wyddfa, Snowdonia rather than Eryri, and Brecon Beacons rather than Bannau Brycheiniog. Keep Welsh names that do not have a recognised English equivalent unchanged.

**Why:** The product owner requested English display names for places with established English alternatives.

**How to apply:** Normalise names at API boundaries for newly generated data and at display boundaries for older persisted records. Do not translate Welsh names such as Glyder Fawr, Tryfan, or Pen y Fan when there is no standard English alternative.