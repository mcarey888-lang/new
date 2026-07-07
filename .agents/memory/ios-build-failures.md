---
name: iOS pod install failures — useFrameworks + New Architecture
description: Root causes and fixes for recurring pod install failures on Expo/RN iOS builds.
---

## The core incompatibility

`newArchEnabled: true` (in `app.json`) + `useFrameworks: "static"` (in `expo-build-properties` iOS config) are **mutually exclusive** in React Native 0.73+.

Having both causes `react_native_post_install` to crash with a Ruby exception inside CocoaPods post-install. The build log shows a stack trace ending at `Podfile:56:in 'react_native_post_install'` and `pod install exited with non-zero code: 1`.

**Fix:** Remove `useFrameworks: "static"` from the `expo-build-properties` iOS config in `app.json`.

**Why `useFrameworks: static` is NOT needed:**
- Clerk v3 (@clerk/expo ≥ 3.x) ships as an XCFramework binary — does not require `use_frameworks!`
- RN 0.70+ configures Hermes automatically — does not need `use_frameworks!`
- RevenueCat iOS SDK also ships as binary XCFramework

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
