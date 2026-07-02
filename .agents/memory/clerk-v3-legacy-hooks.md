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

**Correct fix**:
- Custom `clerkTokenCache` (`utils/clerkTokenCache.ts`) tracks all SecureStore
  keys Clerk uses and exposes `clearAll()`. On `ClerkLoadedOrTimeout` timeout,
  call `clearAll()` — this clears the stale token for the NEXT launch.
- Do NOT remount `<ClerkProvider>` — remounting destroys the Expo Router Stack
  navigation state, causing a frozen/blank screen that looks like a spinner.
- Do NOT add an `!isLoaded` spinner to sign-in/sign-up screens. Show the form
  immediately. If Clerk isn't ready, `signIn`/`signUp` will be null/undefined —
  guard with `if (!signIn) { setError("..."); return; }` for inline feedback.
- Loading spinners only inside submit buttons (when an operation is in progress).
- `ClerkLoadedOrTimeout` still blocks the root tree for up to 5s so signed-in
  users auto-redirect; after timeout it just renders children (no remount).

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

## Auth operations — use as any (v3.6.x API)

`useSignIn()` returns `SignInSignalValue`. Most methods need `as any` casts.

**The v3 API is completely different from v2.** Key renames:

| v2 (WRONG — throws "not a function") | v3 (correct) |
|---|---|
| `signIn.create({ identifier, password })` | `signIn.password({ emailAddress, password })` |
| `signIn.prepareSecondFactor({ strategy: "email_code" })` | `signIn.mfa.sendEmailCode()` |
| `signIn.attemptSecondFactor({ strategy: "email_code", code })` | `signIn.mfa.verifyEmailCode({ code })` |
| `signUp.create({ emailAddress, password })` | `signUp.password({ emailAddress, password })` |
| `signUp.prepareEmailAddressVerification({ strategy: "email_code" })` | `signUp.verifications.sendEmailCode()` |
| `signUp.attemptEmailAddressVerification({ code })` | `signUp.verifications.verifyEmailCode({ code })` |

NOTE: `signIn.create()` appears to still work at runtime (user confirmed sign-in works) but the v3 canonical method is `signIn.password()`. `signUp.create()` / `prepareEmailAddressVerification()` do NOT exist.

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { signIn } = useSignIn() as any;

// Email+password sign-in — v3 pattern
const { error: signInErr } = await signIn.password({ emailAddress: email, password });
if (signInErr) { setError(signInErr.message); return; }
if (signIn.status === "complete") {
  const { error } = await signIn.finalize(); // finalize() IS typed, no cast needed
  if (!error) router.replace("/");
} else if (signIn.status === "needs_second_factor") {
  await signIn.mfa.sendEmailCode();
  // show MFA UI
}

// MFA second factor — v3 pattern
await signIn.mfa.verifyEmailCode({ code });
if (signIn.status === "complete") {
  const { error } = await signIn.finalize();
  if (!error) router.replace("/");
}
```

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { signUp } = useSignUp() as any;

// Email+password sign-up — v3 pattern
const { error: createErr } = await signUp.password({ emailAddress: email, password });
if (createErr) { setError(createErr.message); return; }
await signUp.verifications.sendEmailCode();
// show verification UI

// Verify — v3 pattern
await signUp.verifications.verifyEmailCode({ code });
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
