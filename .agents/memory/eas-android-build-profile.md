---
name: EAS Android build profile convention
description: Which EAS profile to use for Android Play Store builds vs sideload APKs
---

Always use `--profile production` for Android builds destined for the Play Store internal testing track.

The `production` profile produces an AAB (`buildType: app-bundle`) without `distribution: internal`, so EAS labels them "Android Play Store build" — the label the user is familiar with.

The `preview` profile has `distribution: internal` which labels builds "Android internal distribution build" — this confused the user. `preview` produces APKs for direct sideloading only.

**Why:** User asked specifically to keep the familiar "Android Play Store build" label. The difference is solely the `distribution` field on the profile.

**How to apply:** Any time the user asks for an Android build to submit to the Play Store (even internal testing track), use `--profile production`. Only use `--profile preview` when they want an APK to sideload directly.

Command to use:
```
cd artifacts/summit-ready && EAS_NO_VCS=1 pnpm dlx eas-cli@21.7.0 build --platform android --profile production --non-interactive
```
