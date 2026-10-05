---
name: Summit query review boundary
description: Ownership and verification scope for the externally authored summit-pin query.
---

Treat externally supplied summit-pin SQL as author-owned. Bring across the supplied
patches and verify them against real data; report errors, query plans and presentation
discrepancies instead of silently maintaining a corrected local query.

**Why:** The author cannot access this database and explicitly prefers correcting
their own query over having two independently changed versions.

**How to apply:** Use the existing read-only engine pool for diagnostics and live
endpoint checks. Make only requested integration resolutions. Obtain explicit
permission before changing the author's SQL or correcting discovered behavior.