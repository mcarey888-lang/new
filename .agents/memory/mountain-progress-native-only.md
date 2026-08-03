---
name: MountainProgress — native only
description: MountainProgress uses Reanimated + react-native-svg and must never be adapted for web preview.
---

**Rule:** MountainProgress is a native-only component. Do not create `.web.tsx` platform variants, inline `Platform.OS` splits, or attempt to screenshot it in a browser proxy.

**Why:** Reanimated's `useAnimatedProps` does not support `react-native-svg` components on web. Any attempt to use DOM SVG elements or split the component causes Metro module-evaluation failures that manifest as "This screen doesn't exist" in Expo Router (not a render error — a route registration failure). The `.web.tsx` platform file approach also failed silently in this pnpm monorepo: Metro's cache ignored the file and continued bundling the native version.

**How to apply:** Test MountainProgress only on native (Android/iOS device or emulator). The mountain-demo screen is accessible via the 5-tap trigger on the Profile tab "Profile" heading (inside authenticated app) or the pre-auth logo. Never attempt a browser screenshot of mountain-demo.
