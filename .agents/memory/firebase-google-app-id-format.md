---
name: Firebase GOOGLE_APP_ID format crash
description: Invalid GOOGLE_APP_ID in GoogleService-Info.plist throws NSException at iOS launch before JS starts
---

## Rule
`GOOGLE_APP_ID` in `GoogleService-Info.plist` must match `1:\d+:ios:[0-9a-fA-F]+`. The fingerprint segment (4th part) must be a valid hex string. Non-hex values (e.g. `placeholder-not-configured`) cause an uncaught NSException.

**Why:** `@react-native-firebase/app` AppDelegate swizzling calls `[FIRApp configure]` unconditionally during `application:didFinishLaunchingWithOptions:`, before any JS runs. Firebase validates `GOOGLE_APP_ID` locally against its regex. A non-hex fingerprint throws `NSException` → `abort()` via `objc_exception_throw` → instant launch crash. This is distinct from an entitlement mismatch (which is a silent SIGKILL, not an exception throw).

**How to apply:** For Android-only Firebase setups where a placeholder iOS plist is needed, use:
```xml
<key>GOOGLE_APP_ID</key>
<string>1:000000000000:ios:0000000000000000</string>
```
The 16-char hex dummy passes format validation. Firebase does NOT make network calls at launch to verify the project exists — validation is purely local. With `IS_ANALYTICS_ENABLED=false` in the plist, no data goes anywhere.

Both copies of the plist must be fixed:
- `artifacts/summit-ready/GoogleService-Info.plist` (project root, referenced in app.json)
- `artifacts/summit-ready/ios/SummitReady/GoogleService-Info.plist` (copied into bundle by config plugin)
