---
name: Hill verification DB build step
description: How to rebuild lib/db declarations after adding new schema tables, given the broken integrations-openai-ai-server lib
---

When adding new tables to `lib/db/src/schema/`:

1. Create the schema file and export from `lib/db/src/schema/index.ts`
2. Run `pnpm --filter @workspace/db run push` to push schema to Postgres
3. Run `cd lib/db && pnpm exec tsc --build` to rebuild declarations
4. Do NOT use `pnpm run typecheck:libs` — it fails on pre-existing errors in `lib/integrations-openai-ai-server`

**Why:** `tsc --build` at the root is blocked by TS errors in `integrations-openai-ai-server` (missing `@types/node`, `p-retry.AbortError`, etc). These are pre-existing and unrelated. Building `lib/db` directly works fine.

**How to apply:** Any time new schema exports don't appear in `@workspace/db/schema` during API server typecheck.
