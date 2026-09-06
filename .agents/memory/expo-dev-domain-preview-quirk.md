---
name: Expo dev domain preview routing quirk (SummitReady workspace)
description: The external Expo preview domain can route browser and Android manifest requests to sibling artifacts even while local Metro is healthy.
---

In this workspace, the external Expo preview domain can misroute by request type: browser requests render the unrelated landing artifact, while Expo Go Android manifest requests reach the API server and return 404. The same Android manifest request sent directly to Metro's local port returns a valid Expo manifest.

**Why:** This is a routing issue between the external Expo domain and the multi-artifact reverse proxy, not an app bundle failure. Metro can be healthy and all Expo checks can pass while the editor emulator shows Expo Go's generic error.

**How to apply:** Compare an Android manifest request against the local Metro port and the external Expo domain. If local returns Expo JSON while external returns 404 and the API logs the request, clear Metro once; then use Replit's Restart compute action because restarting only the Expo workflow cannot repair the proxy mapping.
