---
name: Firebase iOS GoogleService-Info.plist required for prebuild
description: The @react-native-firebase/app config plugin requires ios.googleServicesFile in app.json even when Firebase is Android-only. Missing it causes prebuild to exit with code 1.
---

The `@react-native-firebase/app` Expo config plugin always runs for both
platforms during `expo prebuild`. For iOS it requires:
1. `expo.ios.googleServicesFile` set in `app.json` pointing to a plist file
2. That file to physically exist at that path

**Without this, prebuild fails immediately** with:
> `[ios.xcodeproj]: withIosXcodeprojBaseMod: Path to GoogleService-Info.plist
> is not defined.`

**Why:** The plugin validates the field at plugin execution time, before any
native code is compiled. This means even an Android-only Firebase setup
breaks iOS builds.

**How to apply:**
- If Firebase is Android-only: create a placeholder `GoogleService-Info.plist`
  with dummy values (IS_ANALYTICS_ENABLED=false, placeholder strings) and
  reference it in `app.json` under `ios.googleServicesFile`. The build
  succeeds; Firebase simply won't connect on iOS at runtime.
- When adding real iOS Firebase later: replace the placeholder plist with the
  real one from Firebase console — no other code changes needed.
- The placeholder plist lives at `artifacts/summit-ready/GoogleService-Info.plist`.
