---
name: Expedition startup isolation
description: Why Expedition routes must defer native-heavy feature modules and send empty accounts to Mountains.
---

When Expedition mode is persisted but the account has no active expedition, launch and shell-switch routing must enter the Mountains browser rather than Base Camp. Native-heavy, browser-only, capture, analytics, subscription, and cinematic modules must be loaded only after the root React tree is established or when their feature is invoked.

**Why:** Expo Router production route discovery can initialize static import graphs before normal screen interaction. A synchronous native module failure can therefore happen before React's error boundary and global JavaScript handler can observe it.

**How to apply:** Choose startup destinations based on whether an active expedition exists, use deferred imports for non-essential native modules, and never block initial routing on analytics or subscription startup.