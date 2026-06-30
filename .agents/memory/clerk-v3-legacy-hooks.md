---
name: Clerk v3 auth hooks — correct patterns for Expo/React Native
description: useAuth().isLoaded is the reliable Clerk ready check. useSignIn/useSignUp from @clerk/expo/legacy do NOT work in React Native (isLoaded stays false indefinitely). Use @clerk/expo with as-any casts and signIn.finalize() for completion.
---

## The rule

**Do NOT use `@clerk/expo/legacy`** for `useSignIn`/`useSignUp` in React Native/Expo.
`@clerk/react/legacy` (which it re-exports) is web-only — in React Native, `isLoaded` stays
`false` indefinitely, causing infinite spinners.

**Do NOT use `useSignIn().isLoaded`** — the Clerk v3 signal-based hook (`SignInSignalValue`)
doesn't have `isLoaded` at all. It will be `undefined`, not `false` or `true`.

**Use `useAuth().isLoaded`** — this is the correct, reliable ready signal in `@clerk/expo`.
It is already used this way in `_layout.tsx` for `ClerkLoadedOrTimeout`. Use it the same
way in any auth screen.

## Correct import pattern

```typescript
import { useAuth, useSignIn, useSSO } from "@clerk/expo"; // all from main package
// useAuth for isLoaded check
// useSignIn/useSignUp for auth operations (cast to any)
// useSSO for Google/OAuth
```

## Stale session token — fix via ClerkProvider remount

After several days without opening the app, BOTH the Clerk session token AND
refresh token expire. Clerk hangs trying to validate the stale SecureStore entry —
`isLoaded` stays `false` permanently, regardless of network connectivity.

**Root fix** (`_layout.tsx` + `app/utils/clerkTokenCache.ts`):
- Use a custom `clerkTokenCache` (wraps expo-secure-store, tracks all keys Clerk
  writes, exposes `clearAll()`).
- Pass `onTimeout` to `ClerkLoadedOrTimeout`. On first 4-second timeout:
  `clearAll()` wipes the stale SecureStore entries, then incrementing `clerkKey`
  remounts `<ClerkProvider>`. With no cached token, Clerk initialises as
  unauthenticated in milliseconds.
- `hasRemounted` ref prevents infinite remount loops; second failure falls back
  to rendering children via the local `timedOut` state.

**Second line of defence** (sign-in/sign-up screens):
- 8-second `clerkTimedOut` timeout renders the form unconditionally.
- Yellow banner warns "Connection slow — you can still try signing in."
- Do NOT use a Retry button that resets the timer — it loops back to the spinner.

## Loading guard — must have a timeout that shows the form

`useAuth().isLoaded` can stay `false` if Clerk fails to initialise (network, config, etc).
Always pair a `!isLoaded` spinner with an 8-second timeout:

```typescript
const { isLoaded } = useAuth();
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

## Auth operations — use as any

`useSignIn()` returns `SignInSignalValue` with `signIn` typed as `SignInFutureResource`.
Most methods need `as any` casts; only `finalize()` is properly typed:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { signIn } = useSignIn() as any;

// Email+password sign-in
await signIn.create({ identifier: email, password });
if (signIn.status === "complete") {
  const { error } = await signIn.finalize(); // finalize() IS typed, no cast needed
  if (!error) router.replace("/");
}

// MFA second factor
await signIn.prepareSecondFactor({ strategy: "email_code" });
await signIn.attemptSecondFactor({ strategy: "email_code", code });
if (signIn.status === "complete") {
  const { error } = await signIn.finalize();
  if (!error) router.replace("/");
}
```

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { signUp } = useSignUp() as any;

// Email+password sign-up
await signUp.create({ emailAddress: email, password });
await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

// Verify
await signUp.attemptEmailAddressVerification({ code });
if (signUp.status === "complete") {
  const { error } = await signUp.finalize();
  if (!error) router.replace("/");
}
```

## Loading state — always local

`fetchStatus` does NOT exist on any Clerk v3 hook return. Always track loading with local state:

```typescript
const [emailLoading, setEmailLoading] = useState(false);
// wrap every async auth op: setEmailLoading(true) → try/catch/finally setEmailLoading(false)
```

## Google SSO — 30-second timeout

```typescript
const timeout = setTimeout(() => { setGoogleLoading(false); setError("Timed out."); }, 30000);
try {
  const { createdSessionId, setActive } = await startSSOFlow({ strategy: "oauth_google", ... });
  if (createdSessionId && setActive) { await setActive({ session: createdSessionId }); router.replace("/"); }
} finally { clearTimeout(timeout); setGoogleLoading(false); }
```
