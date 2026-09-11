---
name: iOS marketing version source
description: Prevent TestFlight updates from being hidden by a stale native marketing version.
---

When the native iOS directory is committed, EAS uses the native `CFBundleShortVersionString` rather than relying on the Expo app version. Keep both marketing-version declarations aligned and ensure the new version is higher than every version already available to testers.

**Why:** A build with a higher build number but a lower marketing version is not offered as an update to testers who already have the newer marketing version.

**How to apply:** Before every production iOS build, compare the Expo version with the native iOS marketing version and check that it advances beyond the current TestFlight version.