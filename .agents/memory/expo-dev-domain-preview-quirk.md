---
name: Expo dev domain preview routing quirk (SummitReady workspace)
description: The external Expo preview domain can route browser and Android manifest requests to sibling artifacts even while local Metro is healthy.
---

In this workspace, the external Expo preview domain can misroute by request type: web bundle URLs resolve on the normal web domain and receive landing-page HTML (`Unexpected token '<'`), while Expo Go Android manifest requests reach the API server and return 404. The same manifest sent directly to Metro returns valid Expo JSON.

**Why:** This is a static routing issue between the preview domains and the multi-artifact reverse proxy, not an app bundle failure. Stopping the landing and API workflows changes the erroneous responses from their content/404 to 502 rather than falling through to Metro, proving the domains remain assigned to those services.

**How to apply:** Compare an Android manifest request against the local Metro port and external domains. Cache clears and workflow restarts cannot repair this mapping; after one compute restart, stop changing app code and treat persistent misrouting as a Replit preview-router issue.

For deterministic web screenshots, bypass the preview proxy and drive Chromium
against the local Metro port through CDP. Set an explicit device-metrics
viewport before capture. React Native Web `ScrollView` uses an internal
`overflow-y: auto` element, so scroll that element rather than `window` when
capturing content below the fold.

The managed browser tester can reach local Metro and expose inspectable screenshot
IDs, but it may not provide the image bytes for committing into the workspace.
Do not treat those IDs as substitutes when a contract explicitly requires PNG
files at repository paths.

For the editor's web simulation, keep the mobile artifact preview wrapper at `/mobile-preview.html`; using `/mobile/` makes Expo Router interpret `mobile` as an app route and show its not-found screen. The wrapper is served by the root landing artifact, not Metro, so regenerate its pnpm-resolved Expo Router entry whenever the mobile workflow starts. Use `lazy=false`: Metro lazy chunks resolve against the normal web domain and can receive landing-page HTML.

Share the wrapper entry point for onboarding review, then use the app's
Get started control. Do not share the resulting `/onboarding` address as if it
were a working hard-load URL, or infer a working route from HTTP 200 alone.

**Why:** The wrapper loaded the actual welcome screen and client navigation
opened the real onboarding, while direct external onboarding URLs rendered
either the sibling website's 404 or Expo Router's not-found screen. The same
onboarding loaded correctly directly from local Metro.

**How to apply:** Verify the rendered destination through the wrapper. Use a
fresh private browser window to review the signed-out new-user flow without
signing out or resetting the existing account. Keep screenshots labelled as
browser renders of current code, not evidence of the uploaded native binary.

The managed editor artifact workflow must use Expo LAN mode, not forced tunnel mode: Replit already exposes Metro through its Expo development domain, while an ngrok session closure exits the whole workflow and shows an artifact-crashed screen. If a physical device specifically needs a remote native tunnel, run that as a separate interactive preview rather than making the managed web artifact depend on ngrok.
