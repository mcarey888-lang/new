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

## Secondary issue found (also fixed)

`expo-build-properties` version should match Expo SDK:
- SDK 54 → `~0.14.0`  
- SDK 55 → `~55.0.x`
- SDK 56 → `~56.0.x`

Having `^56.0.x` with SDK 54 generates incompatible Podfile hooks for RN 0.81.x.

## Dead packages that were removed

- `expo-glass-effect ~0.1.4` — pre-release broken podspec, never imported
- `expo-av ^16.0.8` — never imported, redundant with `expo-audio`

`react-native-worklets` must stay — required peer dep for `react-native-reanimated 4.x` and `react-native-keyboard-controller`.
