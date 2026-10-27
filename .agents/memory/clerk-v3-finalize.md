---
name: Clerk v3 finalize navigation
description: How to correctly navigate after signIn.finalize() / signUp.finalize() in Expo web without using decorateUrl
---

## Rule
Never pass a `navigate` callback to `signIn.finalize()` or `signUp.finalize()` in Expo web. Call `finalize()` with no args, then navigate manually with `router.replace("/(tabs)/dashboard")`.

**Why:** `decorateUrl("/")` returns an absolute URL (e.g. `https://...replit.dev/?__clerk_db_jwt=...`). Expo Router's `router.replace()` cannot handle absolute URLs — it silently fails, leaving the user stuck on the auth screen with no error.

**How to apply:**
```typescript
const { error } = await signIn.finalize();   // no navigate param
if (error) { setError(error.message); return; }
router.replace("/(tabs)/dashboard");
```

Also always wrap the whole sign-in/sign-up handler in `try/catch` extracting `err?.errors?.[0]?.longMessage` for user-visible errors — Clerk throws `ClerkAPIResponseError` objects, not plain Errors.

## Google SSO / useSSO navigation on Android (native)

**Problem:** After `startSSOFlow`, the `(auth)/_layout.tsx` was redirecting to `"/"` (the get-started/index screen) when `isSignedIn` became true. index.tsx then re-forwarded to dashboard via `useEffect`, but there was a timing race — if `isSignedIn` wasn't yet propagated when index.tsx mounted, the user got stuck on the get-started screen.

**Fix:** `(auth)/_layout.tsx` redirect target changed from `"/"` to `"/(tabs)/dashboard"` — eliminates the extra hop entirely.

**Also:** `startSSOFlow` can return `signIn.createdSessionId` instead of the top-level `createdSessionId` for existing accounts (transfer path). Always fall back:
```typescript
const sessionId = createdSessionId ?? (ssoSignIn?.createdSessionId as string | null | undefined);
if (sessionId && ssoSetActive) {
  await ssoSetActive({ session: sessionId });
  router.replace("/(tabs)/dashboard" as any);
}
```

## SignIn status values for @clerk/expo v3
- `"complete"` — sign-in done, call finalize
- `"needs_second_factor"` — MFA required.
- `"needs_client_trust"` — valid in the installed SDK: new-device verification
  required. Send and verify the email code through `signIn.mfa`, as for the
  email second-factor flow; never finalize until the status is `complete`.
- `"needs_identifier"`, `"needs_first_factor"`, `"needs_new_password"`.

**Why:** An earlier note incorrectly excluded `needs_client_trust`. The
installed Clerk type definitions explicitly support it. Treating it as an
unknown failure can strand an existing account after a successful password
check, while registration still reports that the email is already used.

**How to apply:** Check the installed SDK's status definitions rather than
assuming this list is exhaustive. Preserve device-trust protection instead of
disabling it or deleting accounts. A `needs_new_password` state should direct
the user to the existing password reset flow, not account creation.

## SignUp verification check
Check `signUp.unverifiedFields.includes("email_address") && signUp.missingFields.length === 0` to detect when email OTP screen is needed (instead of checking `signUp.status === "missing_requirements"` alone).
