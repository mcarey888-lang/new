---
name: Android MergeJavaResWorkAction fix
description: Two separate native module conflicts caused Android Gradle builds to fail with MergeJavaResWorkAction errors.
---

## Conflicts fixed

### 1. async-storage version clash
`@clerk/expo@3.3.0` pulled in `@react-native-async-storage/async-storage@1.24.0` alongside the project's `2.2.0`, causing duplicate native classes.

**Fix:** Added pnpm override in `pnpm-workspace.yaml`:
```yaml
overrides:
  "@react-native-async-storage/async-storage": "2.2.0"
```

### 2. META-INF MANIFEST.MF clash
`org.jspecify:jspecify:1.0.0` and `com.squareup.okhttp3:logging-interceptor:5.3.2` both contain `META-INF/versions/9/OSGI-INF/MANIFEST.MF`.

**Fix:** Installed `expo-build-properties` and added to `app.json` plugins:
```json
["expo-build-properties", {
  "android": {
    "packagingOptions": {
      "pickFirst": ["META-INF/versions/9/OSGI-INF/MANIFEST.MF"]
    }
  }
}]
```

**Why:** Both are EAS_BUILD_UNKNOWN_GRADLE_ERROR — the generic label hides the real cause. Must decompress the brotli log (Node.js `zlib.brotliDecompress`) and look for `MergeJavaResWorkAction` lines to find the specific conflicting files.
