---
name: Clerk Expo Auth
description: Clerk auth Phase 1 for SummitReady Expo app — patterns, gotchas, and what's done vs pending.
---

## What's done (Phase 1)

- `setupClerkWhitelabelAuth()` called — keys auto-provisioned (CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY)
- `ClerkProvider` + `ClerkLoaded` wrapping root `_layout.tsx`; `tokenCache` from `@clerk/expo/token-cache`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` prepended to dev script in package.json
- `app/(auth)/sign-in.tsx` — email+password + Google OAuth (useSignIn, useSSO)
- `app/(auth)/sign-up.tsx` — email+password + Google OAuth (useSignUp, useSSO)
- `app/(auth)/_layout.tsx` — redirects signed-in users back to `/`
- `app/index.tsx` — auth-gated redirect: only auto-routes to dashboard/questionnaire if `isSignedIn`; CTAs changed to sign-up/sign-in

## CRITICAL: production builds need EXPO_PUBLIC_CLERK_PROXY_URL

The pk_live_ publishable key encodes `clerk.summitready.uk` as the Clerk FAPI
domain. That subdomain has NO DNS records — every Clerk API call from the
production app (signIn.create, setActive, etc.) silently times out.

Fix: add Clerk proxy middleware to the API server + set EXPO_PUBLIC_CLERK_PROXY_URL
in eas.json production env so the app routes all Clerk calls through
`https://summitready.uk/api/__clerk` instead.

Files: `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` (copied
from skill template), `artifacts/api-server/src/app.ts` (proxy mounted before
body parsers), `artifacts/summit-ready/eas.json` (EXPO_PUBLIC_CLERK_PROXY_URL
added to production env), `artifacts/summit-ready/app/_layout.tsx`
(`proxyUrl={clerkProxyUrl}` on ClerkProvider).

Dev builds unaffected — proxy middleware no-ops when NODE_ENV !== production,
and pk_test_ key points to absolute-tarpon-61.clerk.accounts.dev (working DNS).

## CRITICAL: group layouts block before screens render

`app/(auth)/_layout.tsx` is the layout for the ENTIRE auth group. It runs
**before** any individual screen (sign-in, sign-up) can mount. If it has an
`!isLoaded` spinner guard, ALL auth screens are indefinitely blocked whenever
Clerk is slow — even if the individual screens have no loading guards at all.

**Rule**: never put `!isLoaded` spinners in group layouts. Only redirect when
BOTH `isLoaded && isSignedIn`. Everything else should fall through to render
the Stack immediately.

## Key patterns

- All routes within `(auth)` group need `as any` cast for `router.push("/(auth)/sign-in")` — expo-router type generation doesn't pick up new groups immediately.
- OAuth redirect scheme: `AuthSession.makeRedirectUri({ scheme: "summit-ready" })` — matches `app.json` scheme.
- `WebBrowser.maybeCompleteAuthSession()` must be at module top-level in both sign-in and sign-up.
- Core v3 API: `useSignIn()` returns `{ signIn, errors, fetchStatus }` — NOT `{ isLoaded, signIn }` from v2. Same for `useSignUp()`.
- `signIn.finalize({ navigate })` / `signUp.finalize({ navigate })` — not `setActive`.

**Why:** Core v3 broke from v2 patterns. Prior knowledge will cause runtime errors.

## Phase 2 pending

- Wire `setAuthTokenGetter` in `(tabs)/_layout.tsx` so API calls send Bearer tokens
- Key AsyncStorage data to Clerk user ID for cross-device persistence
- Set up API server `clerkMiddleware` + `requireAuth` for protected routes
- Data sync / backend storage for leaderboards

## API server Clerk setup (when needed)

1. `cp .local/skills/clerk-auth/templates/api-server/src/middlewares/clerkProxyMiddleware.ts artifacts/api-server/src/middlewares/`
2. `pnpm --filter @workspace/api-server add http-proxy-middleware @clerk/express @clerk/shared`
3. Wire into `app.ts` per setup-and-customization.md — proxy before body parsers, `clerkMiddleware` after CORS.
