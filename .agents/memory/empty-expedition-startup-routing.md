---
name: Expedition startup isolation
description: Why Expedition routes must defer native-heavy feature modules and send empty accounts to Mountains.
---

When Expedition mode is persisted but the account has no active expedition, launch and shell-switch routing must enter the Mountains browser rather than Base Camp. Native-heavy, browser-only, capture, and cinematic modules used by Expedition routes must be loaded only when their feature is rendered or invoked.

**Why:** Expo Router production route discovery can initialize a route's static import graph before normal screen interaction. Loading Base Camp's capture and cinematic dependencies turned a route-specific fatal into a repeatable startup crash after Expedition mode was persisted.

**How to apply:** Choose startup destinations based on whether an active expedition exists, and use deferred imports for feature modules that are unnecessary for initial route construction.