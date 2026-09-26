---
name: Publish composite foreign keys
description: Why publishing owner-scoped ledger foreign keys can fail despite a working development schema
---

Replit's development-to-production schema diff can omit composite unique indexes containing an already-primary-key column, even though PostgreSQL requires the exact composite uniqueness for an owner-scoped foreign key. Express such keys as unique constraints in the schema source instead of trusting a redundant-looking unique index to be included.

**Why:** A disposable production-fork validation failed while development already had the composite unique index. Adding an explicit unique constraint caused the diff to include it, but a constraint added to an *existing* table was placed after the new foreign keys that require it. This still fails validation.

**How to apply:** Inspect the full generated diff, including statement order, before telling anyone to publish. New tables can carry required unique constraints inline. For existing referenced tables, the prerequisite constraint may require a staged Publish through the normal flow before the dependent foreign keys; never apply DDL to production or add deployment-time migrations. Development schema pushes may propose unrelated table deletion when another managed schema shares the database; do not approve those prompts. Make only targeted additive development changes instead.