---
name: Summit Data Engine production schema
description: Schema placement rule for publishing deterministic mountain data through Replit's managed production database flow.
---

Keep Summit Data Engine data tables, enums, and runtime database objects in PostgreSQL `public`. Retain the legacy schema only as the Alembic revision-chain anchor, and preserve existing `summit_data_engine.*` provenance labels returned by APIs.

**Why:** Replit's production database recreation copied public application tables but omitted the custom Summit Data Engine schema, leaving the published API without mountain aliases or canonical data.

**How to apply:** New engine migrations and ORM mappings target public. API SQL reads public tables. Treat provenance labels as stable external metadata rather than physical schema names.