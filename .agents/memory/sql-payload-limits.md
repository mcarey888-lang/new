---
name: SQL callback payload limits
description: Large metadata snapshots can exceed the SQL callback's subprocess argument limit.
---

Large SQL scripts can fail in the database callback with `spawn E2BIG` before PostgreSQL executes them. Encoding a whole metadata snapshot as hex increases this risk, especially if repeated in the same batch.

**Why:** An artwork-only promotion validation containing the same snapshot several times exceeded the callback's argument limit. Validation succeeded when a development-only PostgreSQL client loaded the SQL from a file and used an isolated temporary table in a rolled-back transaction.

**How to apply:** Keep callback queries bounded. For large development validations, read SQL from a file using the existing development client and verify the target before executing. Production callback access remains read-only; prepare an owner-reviewed data import rather than obtaining owner credentials or circumventing that boundary. Do not split atomic transactions between callback calls: they do not share a session.
