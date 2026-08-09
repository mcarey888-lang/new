---
name: EAS CLI pnpm Expo resolution
description: Why the globally installed EAS CLI fails before submission and which invocation works in this pnpm workspace.
---

Use a current EAS CLI through `pnpm dlx`, rather than the globally installed EAS 19, when building the Expo app in this pnpm workspace.

**Why:** EAS 19 resolves and executes `expo/bin/cli` directly. Under pnpm, that entry point cannot resolve `@expo/cli` unless the generated `.bin/expo` wrapper has first supplied its custom `NODE_PATH`, so `expo config --json` exits silently. EAS 21 handles this workspace correctly. `EXPO_BINARY_PATH` is not consulted by EAS 19 and does not solve the failure.

**How to apply:** From the Expo artifact directory, run `EAS_NO_VCS=1 pnpm dlx eas-cli@21.7.0 build ...`. The equivalent `build:configure` and `build:list` commands have been confirmed to work. Do not add `EXPO_BINARY_PATH`.