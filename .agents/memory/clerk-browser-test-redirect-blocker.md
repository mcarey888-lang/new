---
name: Clerk browser-test redirect blocker
description: Environment-specific blocker for programmatic Clerk sign-in during automated browser tests.
---

Programmatic Clerk sign-in for the Expo web preview can return a 422 redirect URL allowlist error before the authenticated app is reached. Treat this as a test-environment blocker, not evidence that the screen under test is broken.

**Why:** The browser tester could load the public app but could not create an authenticated session because Clerk rejected its generated redirect URL.

**How to apply:** When an authenticated Expo flow is otherwise unreachable, report the browser test as unable and rely on compile, Metro, and device checks until the preview redirect URL is allowlisted.