---
name: Sign in with Apple via Clerk on Expo (native token flow)
description: How to implement native Sign in with Apple using expo-apple-authentication + Clerk's lower-level signIn.create() token strategy, without upgrading @clerk/expo.
---

## The constraint
`@clerk/expo` is pinned to 3.3.0 to avoid a Swift Package Manager / ClerkKit
bug that breaks iOS builds on later versions. **Do not upgrade this pin.**

## Implementation approach
Use `expo-apple-authentication` (native OS sheet) + Clerk's lower-level
`signIn.create({ strategy: "oauth_token_apple", token: identityToken })`
instead of `startSSOFlow({ strategy: "oauth_apple" })`. The native flow
avoids any browser redirect and does not require Clerk's Apple SSO connection
to be set up in the Clerk dashboard.

### Flow (both sign-in and sign-up screens share this pattern)
1. `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })`
   → returns `credential.identityToken`
2. `signIn.create({ strategy: "oauth_token_apple", token: identityToken })`
   - `status === "complete"` → `signIn.finalize()` → navigate
   - `status === "needs_transfer"` → user has no Clerk account yet →
     `signUp.create({ transfer: true })` → `signUp.finalize()` → navigate
3. Catch `err.code === "ERR_REQUEST_CANCELED"` and return silently (user
   cancelled the native sheet — never show an error for this).

Both screens need BOTH `useSignIn` and `useSignUp` hooks because the
`needs_transfer` path from sign-in screen uses `signUp`, and the sign-in
path from sign-up screen uses `signIn`.

## Button
Use `AppleAuthentication.AppleAuthenticationButton` (the HIG-native
component) — not a custom `TouchableOpacity`. Set `style={{ height: 52 }}`
(must be explicit; defaults to zero). Use `SIGN_IN` type on the sign-in
screen, `SIGN_UP` type on the sign-up screen. Black style. Gate the whole
block to `Platform.OS === "ios"`. For the loading state, render a plain
dark `View` + `ActivityIndicator` in place of the button.

## app.json
`"usesAppleSignIn": true` under `ios` is required so the Sign in with Apple
entitlement is included in the EAS build. No Expo plugin entry needed.

**Why:** Apple guideline 4.8 requires offering Sign in with Apple wherever
other third-party logins exist. `usesAppleSignIn` controls the entitlement;
without it the native API call throws at runtime on a real device.

## expo-crypto
Already installed at `~15.0.9`. Not needed for this flow (no nonce used with
the current implementation) but available if a nonce is added later.
