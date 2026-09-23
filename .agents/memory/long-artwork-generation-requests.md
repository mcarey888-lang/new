---
name: Long artwork generation requests
description: Durable request and recovery rules for paid image-generation workflows that can exceed proxy timeouts.
---

Artwork generation that can exceed the request proxy timeout must first persist a `GENERATING` history entry, then return `202 Accepted` and continue as a background job. Clients should poll the manifest while any run is active.

**Why:** A four-candidate image run exceeded the two-minute HTTP request window. The browser request was aborted while the server-side workflow remained ambiguous, leaving history stuck at `GENERATING` and blocking a safe retry.

**How to apply:** Keep generation serialized under the object-storage lease. Serialize every lease renewal through one in-flight promise; timer renewal and explicit ownership checks must never write the same lock generation concurrently. Mark success, partial failure, or failure in durable history. A reader may repair an orphaned `GENERATING` entry only after it can acquire the generation lock, which proves no active worker still owns the run.