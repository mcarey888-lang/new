---
name: Clerk iOS startup order
description: Prevent native SDK startup and Keychain access from blocking Clerk initialization on iOS.
---

## Rule
Let Clerk finish its initial load before starting nonessential native SDKs such as subscriptions or analytics. Put a short timeout around Clerk token-cache Keychain operations, and version the storage key when moving between Clerk instances.

**Why:** On iOS with the new React Native architecture, an early native/TurboModule call can delay the JS event loop that Clerk needs to process its initial response. SecureStore can also retain stale values after an app is deleted and can occasionally stall, leaving `isLoaded` false even when the Clerk endpoint itself is healthy.

**How to apply:** Keep subscription and analytics initialization below the Clerk loading gate. Token-cache reads, writes, and deletes must settle quickly with a safe in-memory or signed-out fallback. When a production Clerk instance changes, use a new storage-key namespace so old client JWTs are never reused.

## SummitReady authentication client
SummitReady's custom email, Google, and Apple screens use Clerk's JavaScript client. Keep the additional native Clerk session synchronization disabled while this architecture remains in place.

**Why:** Running the JS and native Clerk clients against the same session introduced a native initialization/session race: iOS remained unloaded and Android could terminate immediately after sign-in. The native client adds no required capability to the custom flows.

**How to apply:** Preserve the pinned dependency patch that disables native configure, event, and session-sync paths. Re-evaluate it only if SummitReady intentionally adopts Clerk's native auth views; that change requires a fresh native build and device testing on both platforms.