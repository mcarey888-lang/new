---
name: Clerk v3 auth hooks — legacy import required
description: useSignIn/useSignUp from @clerk/expo re-export the signal-based @clerk/react API (SignInSignalValue) which has no isLoaded, no fetchStatus, no finalize(). Use @clerk/expo/legacy instead for the traditional API.
---

## The rule

Always import `useSignIn` and `useSignUp` from `@clerk/expo/legacy`, not from `@clerk/expo`.

```typescript
import { useSignIn } from "@clerk/expo/legacy";
import { useSignUp } from "@clerk/expo/legacy";
import { useSSO, useAuth, ClerkProvider } from "@clerk/expo"; // everything else from main
```

**Why:** `@clerk/expo` re-exports `useSignIn`/`useSignUp` from `@clerk/react` which in v3 uses a signal-based API (`SignInSignalValue`, `SignInFutureResource`). This type has no `isLoaded`, no `fetchStatus`, no `finalize()`, and different method signatures. The legacy path re-exports from `@clerk/react/legacy` which gives the traditional `{ isLoaded, signIn, setActive }` API with `SignInResource` — which IS the full API.

**How to apply:** Any time you write an auth screen that uses `useSignIn()` or `useSignUp()`, always use the `/legacy` import path.

## Correct patterns with legacy API

```typescript
const { isLoaded, signIn, setActive } = useSignIn(); // from @clerk/expo/legacy
const { isLoaded, signUp, setActive } = useSignUp(); // from @clerk/expo/legacy
```

### Loading state

`fetchStatus` does NOT exist — always use a local state:
```typescript
const [emailLoading, setEmailLoading] = useState(false);
// wrap every async op in try/catch/finally { setEmailLoading(false) }
```

### isLoaded guard — must have a timeout + retry

```typescript
const [clerkTimedOut, setClerkTimedOut] = useState(false);
useEffect(() => {
  if (isLoaded) return;
  const t = setTimeout(() => setClerkTimedOut(true), 8000);
  return () => clearTimeout(t);
}, [isLoaded]);

if (!isLoaded && clerkTimedOut) { /* show retry UI */ }
if (!isLoaded) { /* show spinner */ }
// NEVER show a spinner with no timeout — Clerk can fail to init silently
```

### Session activation (replaces finalize())

```typescript
// signIn.finalize() does NOT exist on SignInResource
// Instead:
const result = await signIn.create({ identifier: email, password });
if (result.status === "complete") {
  await setActive?.({ session: result.createdSessionId });
  router.replace("/");
}
```

### Password sign-in
```typescript
signIn.create({ identifier: email, password }) // NOT signIn.password()
```

### Email verification (sign-up)
```typescript
await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
const result = await signUp.attemptEmailAddressVerification({ code });
if (result.status === "complete") {
  await setActive?.({ session: result.createdSessionId });
}
```
