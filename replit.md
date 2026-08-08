# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Admin Access

All admin-protected endpoints verify credentials server-side on every request.

### How it works

- The `ADMIN_API_KEY` Replit Secret is the access key for all admin tools.
- `POST /api/admin/login` verifies the key server-side and returns a session token.
- Admin UI frontends (Hill Verification, Atlas Media Studio, Artwork Admin) show a password prompt that calls this endpoint — the key is never compiled into the bundle.
- Sessions live in browser `sessionStorage` (cleared when the tab closes).
- `GET /api/admin/me` can validate an existing token (used by the UI guards on mount).

### Granting admin access via Clerk JWT

For Clerk-authenticated users (e.g. future mobile admin features), grant access by inserting a row:

```sql
INSERT INTO users (clerk_user_id, is_admin)
VALUES ('user_XXXXXXXXXXXXXXXXXXXXXXXX', true)
ON CONFLICT (clerk_user_id) DO UPDATE SET is_admin = true;
```

To revoke:

```sql
UPDATE users SET is_admin = false WHERE clerk_user_id = 'user_XXXXXXXXXXXXXXXXXXXXXXXX';
```

### Dev bypass (local only)

Set `ADMIN_AUTH_DEV_BYPASS=true` in your local `.env` to skip all admin auth checks.
**Never set this in staging or production.**

### Audit log

Every privileged action (approve/reject artwork, approve/reject hill session, atlas asset mutations, GitHub publish) is recorded in the `admin_audit_log` table with identity, action, resource ID, and timestamp.
