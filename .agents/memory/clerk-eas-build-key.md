---
name: Clerk production bundle alignment
description: Keep Clerk configuration aligned across EAS builds and Replit-hosted native bundles.
---

## Rule
Every native production bundle path must inject the same reachable production Clerk instance. Do not let the hosted bundle inherit a workspace development key while direct EAS builds use a separate production key.

**Why:** EAS builds run in a clean environment, while the Replit-hosted native bundle has its own build script and environment. A missing key can crash at launch; a live key whose encoded frontend hostname has broken TLS leaves Clerk loading forever and makes every sign-in time out.

**How to apply:** Keep the publishable key explicit in every EAS profile and make the hosted production bundle read the production profile as its source of truth. Before release, inspect the generated bundle without printing the key, decode only its frontend hostname, and confirm its Clerk environment endpoint responds over HTTPS.

Production-backed localhost QA must deliberately use the intended live Clerk
instance and its accounts, separately from the ordinary development preview.
An active development session is not authentication for the production API.

**Why:** A local QA export inherited the workspace development publishable key
while the production profile specified a different live instance. Production
requests with Bearer tokens were rejected as `jwk-kid-mismatch`; allowing
localhost through CORS did not establish signing-key compatibility.

**How to apply:** Before adding origin exceptions, inspect the actual Clerk
verification reason. Compare only public token issuer/key-ID metadata with
the intended instance. Never share JWTs or relax signature verification to
make development accounts work against production. A real authenticated
success requires a fresh session from the matching instance.

Two keys labelled live are not proof of alignment. Compare the installed
profile's decoded frontend hostname with the deployed backend's safe
diagnostics and investigate `jwk-kid-mismatch` before changing route code.

**Why:** A production Android build used the reachable `clerk.auth.summitready.uk`
frontend while the published API reported `clerk.summitready.uk` and rejected
Bearer-authenticated route saves. Merely checking live/test prefixes missed it.

**How to apply:** Privately verify the backend key pair belongs to the intended
existing-account instance before any replacement. Never change account
namespaces, relax JWT verification, or assume a workspace secret update has
changed the running deployment.
