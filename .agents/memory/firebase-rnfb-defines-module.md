---
name: Firebase RNFB non-modular headers fix
description: How to fix "non-modular header inside framework module 'RNFBApp.*'" when building react-native-firebase with use_frameworks!:static on RN 0.79+/Xcode 15
---

## The rule

In `post_install`, set `DEFINES_MODULE = NO` for every target whose name starts with `RNFB`:

```ruby
installer.pods_project.targets.each do |target|
  if target.name.start_with?('RNFB')
    target.build_configurations.each do |build_config|
      build_config.build_settings['DEFINES_MODULE'] = 'NO'
    end
  end
end
```

The plugin lives at `artifacts/summit-ready/plugins/allowNonModularIncludes.js` and is registered in `app.json` plugins list. The guard string is `RNFB_DEFINES_MODULE_OFF`.

**Why:** `use_frameworks! :linkage => :static` (required for Firebase pod install) sets `DEFINES_MODULE=YES` for ALL pods, making them strict "framework modules". In RN 0.81.5, `React-Core` is declared WITHOUT `:modular_headers => true`, so when RNFBApp (a framework module) does `#import <React/RCTConvert.h>`, Clang rejects it as a non-modular include inside a framework module. Setting `DEFINES_MODULE=NO` for RNFB* pods removes the "framework module" designation, lifting the restriction. The pods remain compiled as static frameworks (required for linking), they just don't have a module map.

**How to apply:** Whenever react-native-firebase pods fail to compile with "non-modular header inside framework module 'RNFBApp.*'", check that this plugin is in `app.json`. If a new RNFB* pod is added (e.g. RNFBCrashlytics), it is automatically covered since the fix targets all `RNFB*`-prefixed targets.

## What does NOT work (Xcode 15 + RN 0.81.5)

- `ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` in post_install — tried 4+ builds, setting appears ignored or removed in Xcode 15.
- `OTHER_CFLAGS = $(inherited) -Wno-non-modular-include-in-framework-module` — suppresses the original error but exposes new errors: "declaration of 'RCTBridgeModule' must be imported from module 'RNFBApp.RNFBAppModule'" and "-Wimplicit-int". Not the right fix.
- Removing `useFrameworks: static` — pod install fails with "Unknown error" consistently (Firebase binary pods require framework linkage).

## Stack context

- Expo SDK 54.0.34, React Native 0.81.5, @react-native-firebase/app + analytics 25.1.0
- `newArchEnabled: true` in app.json
- EAS production builds targeting iOS
