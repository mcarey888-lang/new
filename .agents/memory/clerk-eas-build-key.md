---
name: Clerk production bundle alignment
description: Keep Clerk configuration aligned across EAS builds and Replit-hosted native bundles.
---

## Rule
Every native production bundle path must inject the same reachable production Clerk instance. Do not let the hosted bundle inherit a workspace development key while direct EAS builds use a separate production key.

The owner stated on 2026-10-26 that the app has zero real users, only test
accounts, and is happy with a clean authentication slate. Preserving those test
accounts is not a requirement when choosing how to resolve the binding issue.
The owner reconfirmed this on 2026-10-27 and prioritizes a clean, stable setup
as the app grows over preserving disposable tester accounts.

**Why:** Earlier workaround advice prioritized preserving account identities;
the owner explicitly removed that constraint before implementation.

**How to apply:** Consider a clean authentication setup instead of extra
credential-override complexity. This is not permission to erase the app database,
route catalogue, artwork or other product data. Explain the chosen reset and its
effects before deletion, and update/rebuild affected native clients as needed.
Reassess this constraint if real users have joined since the statement.

The owner accepts sending a new mobile build for the auth fix, but requires
preserving all existing product work, including workspace changes not yet
published.

**Why:** Willingness to start fresh applies to test authentication accounts,
not the app, its content, or unreleased development.

**How to apply:** Base any auth changes and release on the intended current
workspace snapshot. Do not restore an older production version, reset the
repository, or erase product databases as part of the authentication reset.

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

**How to apply:** Privately verify the backend key pair belongs to the chosen
instance before cutover. An explicitly approved tester-only authentication
reset may change account namespaces; never do so silently, relax JWT
verification, or assume a workspace secret update has changed the deployment.

The owner supplied support correspondence confirming that the managed Users &
Auth integration was re-injecting production credentials for the wrong instance,
even before publishing. Support escalated the binding issue and stated there was
no self-service binding refresh available. Removing a manually entered workspace
live secret did not resolve the mismatch in the owner's subsequent report.

**Why:** Repeatedly replacing standard production secrets cannot be assumed to
persist when the integration remains their authoritative source. Workspace
management detection has also reported external despite this managed-binding
history; that result alone does not prove the production binding is repaired.

**How to apply:** Do not keep retrying managed-secret overrides. The owner now
permits a tester-only authentication reset, so preserving those identities must
not force a permanent workaround. A separately named credential path remains a
workaround requiring owner consent and verification, not a repair to the binding.
Use one authoritative configuration for the chosen long-term setup.

Replit's public Clerk Auth documentation explicitly says **Delete Clerk app**
removes the managed tenant and releases its associated domains. It is not
documented as a non-destructive disconnect.

**Why:** A later support reply recommended deleting the integration to stop key
overwrites without explaining tenant deletion. The public documentation resolves
the action's general semantics, but cannot identify which mismatched tenant a
specific project's deletion control would target.

**How to apply:** If retaining the current tenant, do not delete it. For an
owner-approved clean reset, identify which tenant the deletion targets and
prepare the domain/credential cutover first. Permission to reset tester auth is
not permission to erase product databases or shared catalogue/artwork. Configure
backend API clients as well as JWT middleware against the same chosen instance.

The owner already has Clerk dashboard access and has shown the intended
production instance. Do not ask them to create another account or assume a new
application is necessary before establishing whether that existing app is usable.

**Why:** Dashboard access was established in the support correspondence, but
independent application ownership and the managed deletion target were not.

**How to apply:** Reuse the known context. If additional evidence is necessary,
ask specifically for the missing application overview, not whether they have
a Clerk account. Dashboard access alone is not proof of independent ownership.
