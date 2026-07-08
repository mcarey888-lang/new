---
name: App Store screenshot fake status bar
description: Why marketing/App-Store screenshot generators must never draw a simulated iOS status bar, and what triggers Apple's 2.3.10 rejection.
---

Programmatic App Store screenshot generators (e.g. canvas-based scripts that composite an iPhone mockup frame around app UI) must not draw their own fake status bar text (e.g. `"9:41"` clock + `"WiFi 100%"` label) inside the mockup screen content.

**Why:** Apple's App Review (Guideline 2.3.10, Accurate Metadata) flags screenshots containing non-native status/menu bar imagery — a hand-drawn "WiFi 100%" text label is not how iOS actually renders the status bar (iOS shows icons, not a wifi percentage string), so it reads as fake/non-iOS chrome and causes a rejection even though the app itself is fine.

**How to apply:** When building or reviewing an App Store screenshot generator, grep for literal status-bar strings (`"9:41"`, `"WiFi"`, battery/signal text) inside per-screen drawing functions and remove them — just start the screen content (header, etc.) at the top of the mockup's screen area. App Store Connect's Media Manager / the review pipeline expects raw app screen content in the mockup, not a simulated status bar. Also: if `ios.supportsTablet` is `false` (iPhone-only app), iPad-sized screenshots are not required for submission — only the iPhone sizes matter.
