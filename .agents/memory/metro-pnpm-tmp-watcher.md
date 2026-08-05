---
name: Metro pnpm _tmp watcher crash
description: Metro FallbackWatcher crashes with ENOENT when pnpm installs new native packages, because pnpm creates and immediately removes _tmp_NNN directories that Metro tries to watch.
---

# Metro FallbackWatcher crash after pnpm install of native packages

## The Rule
After installing any native Expo/RN package via pnpm, the Expo dev workflow will crash with:
```
Error: ENOENT: no such file or directory, watch '…/node_modules/.pnpm/<pkg>/node_modules/<pkg>_tmp_NNN/…'
```

## Why
pnpm creates short-lived `_tmp_NNN` directories during package extraction then removes them. Metro's FallbackWatcher scans for watch targets after install but before pnpm cleans up — the directory vanishes mid-scan causing a fatal ENOENT.

## How to apply
The fix lives in `artifacts/summit-ready/metro.config.js`. Add a blockList regex before returning the config:

```js
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);

config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules\/\.pnpm\/.*_tmp_\d+\/.*/,
];

module.exports = config;
```

This is already applied. Any future native package install that triggers this crash just needs a workflow restart — the blockList is already in place.
