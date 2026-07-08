---
name: Expo dev domain preview routing quirk (SummitReady workspace)
description: REPLIT_EXPO_DEV_DOMAIN root path sometimes serves the wrong artifact's content via the screenshot tool; verify against the local Metro port instead.
---

In this workspace, screenshotting the Expo artifact (`screenshot` tool, `type=app_preview`, `artifact_dir_name` set to the Expo/mobile artifact) at path `/` reproducibly rendered the unrelated `summit-landing` web artifact's marketing page instead of the actual Expo app's `index.tsx`. Hitting `/mobile/` (the artifact's configured `BASE_PATH`) on the same domain returned the app's own not-found screen instead of the index route.

**Why:** Likely a routing/DNS quirk between the external `*.expo.spock.replit.dev` domain and the shared reverse proxy's default vhost — not a bug in app code. Confirmed by curling the Metro dev server's local port directly (`http://localhost:<expoPort>/` and `/sign-in`), which both returned HTTP 200 with the correct app HTML shell and no bundling errors, proving the app and its routes work correctly.

**How to apply:** Don't trust the `screenshot`/`app_preview` tool's rendered content for Expo apps at face value if it looks like the wrong app — cross-check by curling the artifact's local port (see its `artifact.toml` `localPort`) directly from the shell. Prefer that local-port curl check (or the `runTest` skill against the correct local path) over the external Expo domain screenshot when verifying Expo route behavior in this project.
