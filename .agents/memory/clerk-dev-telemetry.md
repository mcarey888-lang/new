---
name: Clerk dev telemetry message
description: The api-server shows a Clerk telemetry warning on startup — what actually triggers it and what it does NOT mean.
---

## Rule

The Clerk "connected to development instances" telemetry message is controlled entirely by `NODE_ENV`, not by the secret key prefix.

From `@clerk/shared/dist/utils/runtimeEnvironment.js`:
```js
const isDevelopmentEnvironment = () => {
    try { return process.env.NODE_ENV === "development"; } catch {}
    return false;
};
```

**Why:** The api-server dev workflow runs `export NODE_ENV=development && ...`, so this message appears on every dev startup regardless of whether `CLERK_SECRET_KEY` is `sk_live_` or `sk_test_`.

**How to apply:** Do NOT use the presence of this telemetry line to conclude the key is wrong or points at a dev Clerk instance. To verify the actual key type, check `requireAuth.ts` which does `secretKey?.startsWith("sk_live_")` — that is the real production enforcement guard. The telemetry message can be suppressed by setting `CLERK_TELEMETRY_DISABLED=1` if it's causing confusion.
