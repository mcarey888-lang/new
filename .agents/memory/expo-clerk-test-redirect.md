---

The test helper can also lack `CLERK_SECRET_KEY` when the API workflow exports
that name from a development-only secret at process startup. Root helper
environment and workflow environment are not necessarily identical.

**Why:** A browser QA attempt could not create a test session even though the
API's normal authenticated middleware was configured. This is not evidence
that customer sign-in is broken.

**How to apply:** Report the QA limitation and use scoped authenticated API
integration tests where appropriate. Do not rotate credentials, change Clerk
instances or bypass application authentication to make a helper pass.
name: Expo Clerk test redirect mismatch
description: Programmatic browser test login can fail on the shared development host even while the local Expo screen renders.
---

In this workspace, programmatic Clerk test login may choose the shared development host as its redirect even when the browser is testing local Metro. A rejected `redirect_url` prevents the helper from creating a session; it does not establish that the app's normal sign-in is broken.

**Why:** A protected-route browser check was blocked by the helper's HTTP 422 redirect validation, while local Metro rendered the changed screen normally.

**How to apply:** Distinguish helper authentication failures from app failures. Report signed-in flows as unverified when blocked, and do not change app authentication or service configuration solely to make a test helper work.

The test helper's documented `basePath` is relative to the shared development hostname, not an override for the separate Expo hostname. Navigating the browser to the Expo origin does not necessarily change the helper's redirect target.

**Why:** Retrying the helper on the correct Expo page still produced a marketing-host redirect rejected by Clerk. This does not justify adding that unrelated origin to Clerk's allowlist.

**How to apply:** Confirm the generated redirect's origin before retrying. If the helper cannot target Expo and no supported secure ticket handoff is available, stop authentication retries and report the tooling boundary; never pass sign-in tokens through chat, logs or files.

The helper can also fail before redirect because it requires the root
`CLERK_SECRET_KEY`, even when the managed development API successfully exports its
separate development key inside its workflow.

**Why:** A training onboarding check hit this helper-only prerequisite while
ordinary welcome/onboarding screens loaded.

**How to apply:** Do not change application authentication, expose a credential,
or create an auth bypass to unblock QA. Use isolated logic tests and clearly
report the signed-in browser verification limitation.