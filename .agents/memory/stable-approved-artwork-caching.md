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