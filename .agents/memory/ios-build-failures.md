---
name: iOS pod install failures — useFrameworks + New Architecture
description: Root causes and fixes for recurring pod install failures on Expo/RN iOS builds.
---

## CORRECTED: useFrameworks: "static" IS required

Earlier diagnosis was wrong. The last known-successful iOS build log explicitly showed
"Framework build type is static framework". All failing builds show "static library" instead.

`useFrameworks: "static"` in expo-build-properties sets `use_frameworks! :linkage => :static`
in the Podfile, producing static frameworks (.framework). Without it, CocoaPods uses static
libraries (.a) — a different linking mode that breaks Clerk's native modules.

**The original pod install crashes (builds #19–23) were NOT caused by useFrameworks:static.**
They were caused by `expo-build-properties ^56.0.16` (wrong version for SDK 54) generating
incompatible Podfile hooks. Once expo-build-properties was corrected to `~1.0.10`, 
`useFrameworks: "static"` + `newArchEnabled: true` works fine together in RN 0.73+.

**Current state:** `useFrameworks: "static"` restored in app.json `expo-build-properties` ios block.
Build #26: `3ef76954-203e-4d07-869c-32db190bed87`

## Third issue — @clerk/expo 3.5.0+ uses spm_dependency() in podspec

`@clerk/expo 3.5.0+` changed `ClerkExpo.podspec` to use `spm_dependency()` for
`ClerkKit`/`ClerkKitUI`, with an explicit `raise 'ClerkExpo requires React Native 0.75 or newer'`.
Expo SDK 54 = RN 0.73.x — crashes at pod install.

- 3.5.0+: spm_dependency() in podspec → ✗ pod install crashes
- 3.7.0: identical SPM podspec → ✗ same crash

## Fourth issue — @clerk/expo 3.3.1 and 3.4.7 inject Swift importing ClerkKit (no SPM)

3.3.1 and 3.4.7 have no SPM in podspec (pod install passes), BUT the config plugin
injects `ClerkNativeBridge.swift` into the app target, which `import ClerkKit` — unavailable
because no SPM was set up. Result: Xcode compile error "no such module ClerkKit".

## @clerk/expo 3.3.0 — correct version (build #25)

3.3.0's `app.plugin.js` does three things on iOS:
1. **Adds SPM at Xcode project level** via `withXcodeProject` — `XCRemoteSwiftPackageReference`
   for `https://github.com/clerk/clerk-ios.git @ 1.0.0`. CocoaPods never sees it; Xcode resolves natively.
2. **Injects `ClerkViewFactory.swift`** into app target (imports ClerkKit — now available via #1).
3. **Runs `xcodebuild -resolvePackageDependencies`** in a Podfile `at_exit` hook.

Pod install passes (no spm_dependency() in podspec). Xcode resolves clerk-ios SPM natively.

**WARNING:** Earlier tarball inspection was wrong — it looked at `build/plugins/withClerkExpo.js`
instead of the actual `app.plugin.js` at the package root. Always check `app.plugin.js`.

## Version boundary table (verified against installed packages)

| Version | Pod install | Plugin injects | SPM how | Xcode |
|---------|-------------|----------------|---------|-------|
| **3.3.0** | ✓ | ClerkViewFactory.swift + SPM via xcodeproj | withXcodeProject | Expected ✓ |
| 3.3.1 | ✓ | ClerkNativeBridge.swift (no SPM) | none | ✗ no such module |
| 3.4.7 | ✓ | ClerkNativeBridge.swift (no SPM) | none | ✗ no such module |
| 3.5.0+ | ✗ crash | — | spm_dependency() in podspec | — |

Current pin: `"3.3.0"` exact. Build #25: `2d5ef770-3ba7-44b0-8be0-14d33a0f0a21`

**Long-term:** Upgrade to Expo SDK 55+ (RN 0.75) to properly support SPM and unblock @clerk/expo ≥ 3.5.

## Other notes

- `ClerkExpo.podspec` is a LOCAL PATH pod inside the npm package — cannot override with extraPods.
- `expo-build-properties` SDK 54 → `~0.14.0`; SDK 55 → `~55.0.x`; SDK 56 → `~56.0.x`.
- `EAS_NO_VCS=1` prefix required for all eas commands.
- Dead packages removed earlier: `expo-glass-effect ~0.1.4`, `expo-av ^16.0.8`.
- `react-native-worklets` must stay — required peer for `react-native-reanimated 4.x`.
