---
name: Clerk production bundle alignment
description: Keep Clerk configuration aligned across EAS builds and Replit-hosted native bundles.
---

## Rule
Every native production bundle path must inject the same reachable production Clerk instance. Do not let the hosted bundle inherit a workspace development key while direct EAS builds use a separate production key.

**Why:** EAS builds run in a clean environment, while the Replit-hosted native bundle has its own build script and environment. A missing key can crash at launch; a live key whose encoded frontend hostname has broken TLS leaves Clerk loading forever and makes every sign-in time out.

**How to apply:** Keep the publishable key explicit in every EAS profile and make the hosted production bundle read the production profile as its source of truth. Before release, inspect the generated bundle without printing the key, decode only its frontend hostname, and confirm its Clerk environment endpoint responds over HTTPS.
