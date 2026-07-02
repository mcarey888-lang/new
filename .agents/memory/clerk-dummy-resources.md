---
name: Clerk dummy resources root cause
description: Why "undefined is not a function" occurs on auth screens when Clerk uses dummy resources before FAPI loads
---

# Root Cause: Clerk Dummy Resources

**Symptom:** "undefined is not a function" when tapping "Create account" or "Sign in". No network calls reach the Clerk proxy.

**Why it happens:**
`@clerk/expo`'s `createClerkInstance` has an `__internal_getCachedResources` function. On first install (no AsyncStorage cache), it returns `DUMMY_CLERK_CLIENT_RESOURCE` with `signUp: {}` and `signIn: {}` — plain empty objects. Clerk marks `isLoaded = true` with these dummy objects, then schedules a FAPI retry 3 seconds later.

The auth screens checked `if (!signUp)` — but `{}` is truthy, so the guard passed. Then `signUp.create({...})` = `undefined({...})` → "undefined is not a function".

No network calls because the crash is synchronous before `_basePost` is ever reached.

**The fix (sign-up.tsx and sign-in.tsx):**
```tsx
// Destructure isLoaded
const { signUp, setActive, isLoaded: clerkLoaded } = useSignUp() as any;

// Guard checks BOTH isLoaded AND that .create is actually a function
if (!clerkLoaded || typeof signUp?.create !== "function") {
  setError("Authentication service is still loading — please wait a moment.");
  return;
}

// Button disabled state includes !clerkLoaded
disabled={!clerkLoaded || emailLoading || ...}
```

**Why:** `typeof signUp?.create !== 'function'` catches the dummy object case where `isLoaded` is true but methods are missing — can't rely on `isLoaded` alone.

**How to apply:** Any auth screen that calls Clerk methods must use this two-part guard: `isLoaded` (from `useSignUp`/`useSignIn`) AND `typeof method === 'function'`.
