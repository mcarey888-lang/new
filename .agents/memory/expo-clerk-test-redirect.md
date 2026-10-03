---
name: Expo Clerk test redirect mismatch
description: Programmatic browser test login can fail on the shared development host even while the local Expo screen renders.
---

In this workspace, programmatic Clerk test login may choose the shared development host as its redirect even when the browser is testing local Metro. A rejected `redirect_url` prevents the helper from creating a session; it does not establish that the app's normal sign-in is broken.

**Why:** A protected-route browser check was blocked by the helper's HTTP 422 redirect validation, while local Metro rendered the changed screen normally.

**How to apply:** Distinguish helper authentication failures from app failures. Report signed-in flows as unverified when blocked, and do not change app authentication or service configuration solely to make a test helper work.