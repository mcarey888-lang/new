---
name: Summit Data Engine production schema
description: Schema placement rule for publishing deterministic mountain data through Replit's managed production database flow.
---

Keep Summit Data Engine data tables, enums, and runtime database objects in PostgreSQL `public`. Retain the legacy schema only as the Alembic revision-chain anchor, and preserve existing `summit_data_engine.*` provenance labels returned by APIs.

**Why:** Replit's production database recreation copied public application tables but omitted the custom Summit Data Engine schema, leaving the published API without mountain aliases or canonical data.

**How to apply:** New engine migrations and ORM mappings target public. API SQL reads public tables. Treat provenance labels as stable external metadata rather than physical schema names.

Do not approve a broad Drizzle `push` when it proposes deleting Summit Data Engine tables that are outside Drizzle's schema. Apply additive development changes with narrowly scoped SQL instead; production remains managed by the Publish schema diff.

**Why:** Drizzle sees the independently managed engine tables as extraneous and offers to delete them even when the requested application change is only an additive column or index.

**How to apply:** Inspect every generated schema diff. Abort on unrelated table deletions, then apply only the intended additive DDL to development. Never add startup-time or deploy-time production DDL.