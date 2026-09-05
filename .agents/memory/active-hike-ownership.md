---
name: Active hike ownership
description: Safety rule for restoring an interrupted GPS hike after authentication or account changes.
---

An active-hike checkpoint may trigger automatic cold-start routing only when it contains the same authenticated user ID as the current Clerk session. Legacy or mismatched checkpoints must be discarded rather than migrated implicitly.

**Why:** The active hike is a device-global recovery record. Without an ownership field, a persisted checkpoint from an older account or build can force another account into the native GPS route on every launch, creating a crash loop and crossing account boundaries.

**How to apply:** Save the current authenticated user ID with every checkpoint, wait for Clerk identity before evaluating restoration, and reject records with a missing or different owner before routing to hike tracking.