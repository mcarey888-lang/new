---
name: Stable approved artwork caching
description: Cache policy for stable artwork URLs that always represent the current approved version.
---

Stable approved-media URLs must use `no-store` or mandatory revalidation. Only
immutable URLs containing an explicit version may use a fixed cache lifetime.

**Why:** A stable URL does not change when a newer version becomes current. A
positive cache lifetime can therefore keep serving an older approval after the
manifest changes, violating the current-approved-only contract.

**How to apply:** Any endpoint whose identity means “the current approved
asset” must re-check approval/currentness on every request. Keep review history,
master assets, and version identifiers behind separate development-only routes.

Changing an endpoint to `no-store` does not evict an older response already
cached under the same URL on a user's device. During an approval rollout,
give affected image requests a new stable URL once, then let the new
`no-store` policy handle later replacements.

**Why:** Existing Explore cards kept showing the old Wikimedia photos even
after the server returned the approved images, because those identical
request URLs had previously been cacheable for 30 days.

**How to apply:** Version the client request URL for the affected approved
subjects while preserving the original identity, location, and route
parameters. Do not use random cache-busters on every render.