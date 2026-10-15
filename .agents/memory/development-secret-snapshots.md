---
name: Development secret snapshots
description: Distinguish an existing Shell's inherited settings from the running development API after secret updates.
---

An already-open workspace Shell can retain an older engine connection setting while the restarted development API has the corrected setting. Do not infer the API's effective credentials from a Shell-only diagnostic.

**Why:** Owner-side diagnostics confirmed that the API startup connection matched the intended target and working reader password while the existing Shell still held old settings. Subsequent browser requests to the development API succeeded.

**How to apply:** Verify the actual preview request and the running API separately from an existing Shell. Keep credential diagnostics limited to non-secret metadata and match flags; never expose passwords or full connection strings. Do not reset a working reader password merely because a Shell uses stale settings.
