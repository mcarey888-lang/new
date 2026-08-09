---
name: metro-config package missing in EAS builds
description: require("metro-config") crashes the Metro bundler step in EAS cloud builds because metro-config is a transitive dependency not present in the clean install environment.
---

## Rule
Never `require("metro-config")` directly in `metro.config.js`. Use plain `RegExp` for `blockList` instead — Metro accepts both `RegExp` and `BlockList` instances, and a bare regex is simpler and environment-safe.

**Why:** EAS cloud builds run `pnpm install --frozen-lockfile` in a clean container. `metro-config` is a transitive dependency of `metro` but is not resolvable as a standalone module from the project root. The bundler step (`createBundleReleaseJsAndAssets`) crashes with `Cannot find module 'metro-config'` even though `pnpm exec expo start` works fine locally (local Metro resolves it via its own node_modules).

**How to apply:**
```js
// WRONG — crashes in EAS builds
const { BlockList } = require("metro-config");
config.resolver.blockList = new BlockList([pattern]);

// CORRECT — works everywhere
const existing = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existing)
  ? [...existing, pattern]
  : existing ? [existing, pattern] : pattern;
```
