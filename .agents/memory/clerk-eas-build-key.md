---
name: Clerk key missing from EAS builds
description: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be explicitly set in eas.json env for every build profile or the app crashes on launch.
---

## Rule
Always include `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in the `env` block of every EAS build profile (development, preview, production).

**Why:** EAS builds run in a clean environment with no access to local `.env` files or shell environment. If the key is absent, `process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is `undefined` at bundle time, Clerk initializes with an invalid key, and the app crashes instantly on launch with no visible error to the user.

**How to apply:** Before any EAS build, verify `eas.json` has `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in all three profile `env` sections. The current key (test) is `pk_test_YWJzb2x1dGUtdGFycG9uLTYxLmNsZXJrLmFjY291bnRzLmRldiQ`. Switch to a `pk_live_` key before App Store public release.
