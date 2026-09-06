---
name: Expo dev domain preview routing quirk (SummitReady workspace)
description: The external Expo preview domain can route browser and Android manifest requests to sibling artifacts even while local Metro is healthy.
---

In this workspace, the external Expo preview domain can misroute by request type: web bundle URLs resolve on the normal web domain and receive landing-page HTML (`Unexpected token '<'`), while Expo Go Android manifest requests reach the API server and return 404. The same manifest sent directly to Metro returns valid Expo JSON.

**Why:** This is a static routing issue between the preview domains and the multi-artifact reverse proxy, not an app bundle failure. Stopping the landing and API workflows changes the erroneous responses from their content/404 to 502 rather than falling through to Metro, proving the domains remain assigned to those services.

**How to apply:** Compare an Android manifest request against the local Metro port and external domains. Cache clears and workflow restarts cannot repair this mapping; after one compute restart, stop changing app code and treat persistent misrouting as a Replit preview-router issue.

For the editor's web simulation, keep the mobile artifact preview wrapper at `/mobile-preview.html`; using `/mobile/` makes Expo Router interpret `mobile` as an app route and show its not-found screen. Avoid runtime `import()` for web startup services in this workspace: Metro lazy chunks resolve against the normal web domain and can receive landing-page HTML. Use a `.web.ts` statically bundled loader while retaining deferred imports in the native `.ts` implementation.
