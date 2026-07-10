---
name: Sign in with Apple via Clerk on Expo
description: How to add Apple SSO to an Expo app already using Clerk web-based OAuth (no native module needed), and the app.json requirement.
---

For an Expo app that already implements Google (or other) OAuth via Clerk's
`useSSO().startSSOFlow({ strategy: "oauth_google", redirectUrl })` pattern
(no `expo-auth-session`/native SDK), add Apple the same way:
`startSSOFlow({ strategy: "oauth_apple", redirectUrl })`. Do not install
`expo-apple-authentication` — it's unnecessary extra native surface when the
web-based flow already works for every other provider.

Gate the Apple button to `Platform.OS === "ios"` (Apple's HIG / App Store
guidelines expect Sign in with Apple only on iOS; Android/web keep Google).

**app.json still needs `"usesAppleSignIn": true` under `ios`, even with zero
native Apple modules.** This isn't for the native SDK — it's because Apple
guideline 4.8 requires offering Sign in with Apple wherever other
third-party/social logins (Google, Facebook, etc.) are offered, and
`usesAppleSignIn` is the flag Apple/Expo use to signal that the capability
entitlement is present in the build. No plugin entry is required since no
native package is used; it's inert until the next EAS build picks it up.

**Why:** without this, App Store review can reject the app for offering
Google sign-in without an equivalent Apple option, even though the technical
implementation (web-based SSO) doesn't require any native Apple package.

**Dashboard/portal setup (separate from code, doesn't block writing the
button):** Apple Developer portal needs "Sign In with Apple" capability on
the App ID, a Services ID, and a SIWA key (.p8 + Key ID). Clerk Dashboard
needs Apple enabled as an SSO connection in **both** dev and prod instances
separately — dev can use Clerk's shared/shared-development Apple credentials,
but prod requires the app's own Services ID/Team ID/Key ID/.p8 and the
Clerk-provided Return URL registered in the Services ID's Return URLs.
Until that's done, the Apple button will surface a Clerk "strategy not
enabled" error — this is expected and not a code bug.
