---
name: Canonical activity foundation
description: Non-obvious compatibility boundary for owner-scoped canonical identities and legacy tracked activity IDs.
---

Canonical activity idempotency is always scoped by authenticated owner, source type, and source ID. The legacy tracked-hill table's global activity-ID uniqueness remains a compatibility boundary until a separately approved production migration changes it.

**Why:** Released clients rely on the legacy table, while unscoped IDs can collide across users. The safe bridge reports cross-owner legacy collisions without returning another owner's row; canonical storage remains owner-scoped.

**How to apply:** Derive ownership only from Clerk, keep raw GPS evidence private and separate, reject same-owner payload conflicts without overwriting, and prefer disabling the bridge over dropping additive schema.