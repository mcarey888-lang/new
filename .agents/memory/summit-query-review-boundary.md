---
name: Summit map review boundary
description: Ownership and integration scope for externally authored summit-map work.
---

Treat externally supplied summit-map SQL, pin logic and clustering as author-owned.
Bring across the supplied patches and verify them against real data and browser
behaviour; report failures instead of silently maintaining a corrected local version.

**Why:** The author cannot access this database and explicitly prefers correcting
their own query over having two independently changed versions.

**How to apply:** Use the existing read-only engine pool for diagnostics and live
endpoint checks. Make only requested integration resolutions. Obtain explicit
permission before changing the author's logic or correcting discovered behavior.

Keep shared-branch summit integration additive to the existing route-map page;
preserve globe projection, terrain transitions, pitch behaviour and OS tile setup.
Stop and report any patch that would overwrite that work.

**Why:** The page is maintained on two branches simultaneously; the summit module
was deliberately separated to avoid colliding with local globe and terrain work.

**How to apply:** Review the incoming page diff before importing. Keep integration
to module wiring and notice UI, and leave offline download disabled unless the user
explicitly authorizes enabling it.