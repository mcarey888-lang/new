# SummitReady three-tier membership — development implementation

**Follow-up audit, 27 October 2026:** see
[three-tier-completion-audit.md](./three-tier-completion-audit.md) for the three
specific starter candidates and checked source records, exact existing/proposed
store identifiers and package assignments, the completed mobile cache bound,
152 passing automated checks, and remaining native/store/content blockers.
That audit supersedes the earlier verification counts and incomplete checklist
below. No live billing, route content or release changes were made.

## Status and release boundaries

This is a development change, not a release approval. No live price, product,
entitlement, offer, user account, production schema or published build was changed.
No destructive migration or data reset was performed.

The new middle-tier offering does not yet exist in RevenueCat. The app reports
it as unavailable; it does not silently sell a Pro product as Expeditions.
The existing default offering still returns its real store prices.

## Intended UK pricing — not live purchase prices

| Tier | Monthly target | Annual target |
|---|---:|---:|
| Explore | Free | Free |
| Expeditions | £4.99 | £34.99, billed annually |
| SummitReady Pro | £9.99 | £69.99, billed annually |

Pro's target is a **14-day eligible introductory trial**, not a separate local
countdown. The UI only describes that trial when the selected store product
has it and eligible native offer information is available. Browser/unknown
eligibility does not promise a trial. Expeditions has no introductory trial.

Prices come from RevenueCat's selected package `product.priceString`; billing
periods come from the store product/package metadata. Annual totals are shown.
Neither this document nor the targets above override store-returned prices.

## Implemented feature policy

| Capability | Explore | Expeditions | Pro / preserved legacy |
|---|---|---|---|
| Summit information and nearby hill discovery | Yes | Yes | Yes |
| Ordinary GPS hike recording, including offline recording | Unlimited | Unlimited | Unlimited |
| Own activity history, ordinary stats and general hiking achievements | Yes | Yes | Yes |
| Browse/preview expedition collection | Yes | Yes | Yes |
| Complete and replay the designated starter | Policy supports it; **content not enabled** | Yes once designated | Yes once designated |
| Start/resume other expeditions | No | Yes | Yes |
| Existing expedition stages, substitutions, progress and celebrations | Starter only once enabled | Full collection | Full collection |
| Generate personalised training plans/sessions | No | No | Yes |
| New personalised readiness calculations | No | No | Yes |
| Adaptive plans and personalised coaching | No | No | Yes |
| Previously recorded activities and retained historical plans | Retained | Retained | Retained |

Readiness is an estimate of training preparedness. It is not certification
of safety, technical climbing competence or altitude acclimatisation.

Ordinary recording routes, local activity identities, checkpoints, recovery,
sync outbox and actual recorded activity storage have not been made paid.
Subscription expiry does not delete them or interrupt saving a recording.

## Starter expedition — deliberately unresolved

**No starter has been selected.** The central starter identity remains `null`.
The existing expedition route requirements audit contains unverified route
facts/source leads; it is not proof that a complete expedition is verified.
An approved image or a map that looks right does not verify the route content.

The smallest next content step is to verify both stages of one suitable
beginner-friendly existing expedition, including intended start/finish,
distance/ascent and reuse permission. If none is suitable, propose a small
two-outing starter built from verified tracks before creating new content.
Do not invent a new route, silently promote a source-only candidate, or restart
the paused commercial route-database acquisition work.

After verification, configure its catalogue challenge identity in
`lib/membership/src/index.ts`, rebuild both app and API, and test its complete
start, stage, substitution, final celebration and replay journeys.

The policy is identity-based, never “one active expedition free.” An arbitrary
client `free` flag or a different expedition ID cannot obtain starter access.
The existing progress mountain, stage markers, zoom/3D experience and celebration
components were not rewritten or simplified.

## Main implementation locations

- `lib/membership`: shared tier, legacy, starter, offering and coaching policy.
- `artifacts/summit-ready/lib/revenuecat.tsx`: account-scoped verified SDK
  entitlement mapping, offering selection, eligible trial metadata and purchase/
  restore handling. SDK entitlement listeners remain account-scoped.
- `lib/membershipActions.ts`: preflight authorisation of new paid actions.
- `components/MembershipGate.tsx`: prevents unpaid training children from
  mounting; shows upgrade/free-explore options and retained historical summaries.
- `app/paywall.tsx`, `app/subscription.tsx`, `app/mode-select.tsx`: contextual
  tier offers, comparison, pricing states, intention routing and store management.
- `app/questionnaire.tsx`, `setup.tsx`, `readiness-detail.tsx`,
  `session-detail.tsx`, `(tabs)/plan.tsx`, `(tabs)/dashboard.tsx`: training gates.
- `context/AppContext.tsx`: plan generation, adaptation, progression and
  completion checks without restricting ordinary activity saving; retained
  training data and owner-scoped historical readiness snapshots.
- `hooks/useReadinessV2.ts`, expedition previews: no new free readiness projection.
- `artifacts/api-server/src/services/membershipAccess.ts`: authenticated-owner
  access verified directly with RevenueCat, not a client-paid flag.
- API `requireMembership` middleware: protects coaching, plan adjustment,
  alpine training assessment and custom virtual expedition generation.
- `/api/membership/access` and `/api/membership/authorize`: authenticated,
  no-store access/preflight responses, including exact starter identity checking.
- OpenAPI client/Zod generation updated together. An explicit post-generation step and
  regression check preserve the existing raw community-photo upload transport.
  Use the package `codegen` command; raw Orval invocation alone skips that step.

## Backend/offline boundary

The server maps RevenueCat entitlement IDs to lookup keys, intersects active
entitlements with subscriptions from the correct sandbox/production environment,
and honours RevenueCat's `gives_access` authority. Cancellation alone is not expiry.
Verified revocation replaces old cache entries; network failure can retain
previously verified access only until its known end, with a bounded cache lifetime.
Another account cannot inherit that cached access.

The mobile SDK's known entitlement expiry is rechecked while the app is open.
Cached CustomerInfo also has a 24-hour maximum measured from its original
requestDate, including entitlements without an explicit end. Reading the SDK
cache or retrying a failed verification never renews that deadline.
New paid actions require the relevant local permission and server preflight
when online. Existing verified local access supports an offline action without
turning a temporary outage into a destructive downgrade. The protected API
endpoints still independently verify paid access and fail closed when unverified.

Existing expedition progression is primarily local state, not a newly created
canonical server progression ledger. Its supported mutation paths now check
the shared policy. This is **not** a claim of tamper-proof local storage or a new
server-authoritative expedition ledger. Ordinary activity sync is not a source
of paid entitlements. Native grace/offline expiry behaviour still needs sandbox
and real-device verification.

On expiry the app retains saved goals, plans, activities, expedition records
and earned progress. Paid screens offer membership to resume; historical
readiness snapshots are labelled historical, not current estimates. It cannot
recover historical scores that older app versions never persisted.

## Existing subscribers and upgrades

The read-only RevenueCat audit found:

- Existing entitlement: `premium`, displayed as Premium Access.
- Existing current offering: `default`.
- Existing monthly/annual product identifiers:
  `summit_ready_premium_monthly`, `summit_ready_premium_annual`.
- Existing Play variants:
  `summit_ready_premium_monthly:monthly-base`,
  `summit_ready_premium_annual:annual-base`.
- No `expeditions` or `pro` entitlement/offering yet; inspected existing store
  products did not advertise a configured trial.

`premium` retains **full Pro**, never the new middle tier. Existing identifiers
and restoration remain supported. Do not reprice existing subscribers simply
to make their prices match the new-customer targets.

New mappings are `expeditions` → full expeditions, and `pro` → training plus
full expeditions. A new `pro` offering is preferred; the existing `default`
offering is the explicit legacy fallback, not a package-position guess.

Native replacement code is prepared: StoreKit uses the same subscription group;
Play is passed the old product identifier rather than purchasing independently.
It is **disabled by default** through `nativeUpgradesVerified` until grouping,
offers and replacement are configured and verified. Until then paid-to-paid
changes are sent to store management, and the app does not initiate a second
overlapping purchase. This does **not** establish that a functioning direct
cross-product upgrade is already available in either live store.

## Coaching cost/allowance audit

The inspected coach and plan-adjustment endpoints use `gpt-4o-mini`; coach
assessment has a bounded completion budget, and endpoints also have existing
request/rate controls. These are not a monthly per-subscriber cost budget.
Automatic dashboard refreshes and user questions can both consume AI calls.
No measured per-subscriber usage/cost baseline was supplied, so a reliable
monthly currency cost should not be invented.

Central proposal: **30 personalised coaching requests per Pro billing month**,
including automatic assessments and explicit questions, with cached responses
reused and a clear remaining-usage message. A verified trial would share an
explicit, non-resettable introductory allowance rather than unlimited requests.
Plan adaptation should either count against the same allowance or have a
separate documented cap before launch.

This is a **proposal**, not an enforced monthly quota. It has not silently
changed existing subscriber benefits. No UI promises unlimited AI. A durable
server-side usage ledger and approved trial/legacy allowance would be needed
before enabling the quota.

## Analytics

Uses the existing analytics transport, not a new marketing service.
Added/retained intention/onboarding, first ordinary hike, starter start/
completion, paid expedition preview, training preview, contextual paywall,
verified purchase/tier, verified trial, upgrade and first Pro session signals.
Starter signals are conditional on the configured identity.

Milestone/receipt deduplication is owner-scoped in local storage. Purchase
outcomes are based on store-returned CustomerInfo/entitlements, not a tap.
No precise GPS, questionnaire answers or authenticated owner IDs are included
in the new marketing properties.

Renewal/refund/server-expiration webhook analytics are **not implemented by this
change**: no verified RevenueCat webhook pipeline is configured. Do not treat
restore, a changed SDK cache or a purchase-button tap as those lifecycle events.
Cross-device deduplication of local milestones is also not a server guarantee.

## Precise external configuration checklist — do not apply automatically

1. Resolve the separate Clerk production-instance binding before releasing
   authenticated purchases; consistently use the same stable account ID in
   Clerk, RevenueCat SDK and backend. This work did not alter Clerk.
2. In RevenueCat's existing project, create entitlements `expeditions` and `pro`.
   Keep `premium` and its attached products intact.
3. In App Store Connect, add new monthly/yearly products for each new-customer
   tier with the UK targets above. Use the correct **same subscription group**
   for replacement/upgrade; Pro must be the higher service level. Verify the
   existing legacy group's compatibility instead of deleting or moving products
   blindly. Preserve existing subscribers' price treatment.
4. Configure Pro's 14-day introductory offer and Apple's eligibility rules.
   Do not add an Expeditions trial. Set availability/UK prices as intended;
   review tax/store-localised prices in the actual purchase sheet.
5. In Google Play Console, configure Expeditions and Pro subscriptions and
   monthly/yearly auto-renewing base plans, at the target UK prices. Configure
   Pro's eligible 14-day introductory offer, grace/account-hold rules and
   supported replacement behaviour. Do not cancel/rebuy or promise a refund.
6. Import the real store products/base plans into the correct RevenueCat apps.
   Attach all new Expeditions products to `expeditions`; all new Pro products to
   `pro`. Do not detach existing legacy products from `premium`.
7. Create offerings with exact lookup keys `expeditions` and `pro`, each with
   standard `$rc_monthly` and `$rc_annual` package assignments. Keep `default`
   available for legacy fallback. Package mappings, not arbitrary product-array
   order, select the tiers.
8. Confirm public SDK keys target that same project/app. The backend needs the
   configured RevenueCat project ID and a working installed connector authorised
   to read project entitlements and customer subscriptions/active entitlements.
   Use the project environment-variable/secrets UI; do not paste keys into code.
9. Test both stores' sandboxes: eligible/ineligible trial, cancellation, pending
   payment, restore, legacy access, real upgrade/replacement, expiry, grace,
   network outage, account switch and an in-progress recording crossing expiry.
10. Only after replacement is proven, enable `nativeUpgradesVerified` in the
    shared development configuration and revalidate the prepared native path.
11. Verify/designate the starter content as described above and run its full
    native progression/celebration/replay test.
12. Build a new mobile version and deploy the matching backend separately.
    Recheck actual prices/offers in native store purchase sheets before release.

Product identifiers for the *new* products are chosen in the store consoles;
the app does not require invented identifiers or reusing a legacy identifier
for a different feature tier. The exact required offering/entitlement keys
are specified above.

## Verification record

Read-only configuration probe successfully reached RevenueCat and returned
Explore for a non-existent diagnostic owner; no customer or purchase was created.
Automated policy/middleware/service tests cover tier separation, legacy access,
starter identity, expiry, revocation, environment isolation, owner isolation and
transient failure. The auth-return test covers preserved tier/goal intent.

One browser pass at 402×874 verified Expeditions unavailable/no fake price or
trial, the comparison, direct questionnaire/setup gates, and working Free exits.
It did not perform a purchase or AI generation. SDK/store lookups were noticeably
slow in the browser preview; no shared-package resolution error was observed.

Final automated checks:

- API-server and mobile TypeScript checks: passed.
- Membership policy/service/middleware: 22 tests passed.
- Raw generated image transport: 1 regression test passed.
- Paywall sign-in/intent return handling: 4 tests passed.
- Recording, elevation, recovery, outbox, reliability, saved-route following and
  recording outcomes: 72 existing regression tests passed.
- Total: **99 passing automated tests**, plus the browser journey and read-only
  RevenueCat probe described above. These are not native purchase tests.

Native purchase, trial, restore and replacement outcomes are **not yet verified**.
The starter completion/replay journey is blocked by content designation. Native
3D/progress and expiry-during-recording tests remain device checks, not claims
based on a signed-out browser screenshot.

## Release outputs required

- New mobile build: **yes**, for changed app policy/UI/native purchase paths.
- Matching backend deployment: **yes**, for server-side enforcement.
- Additive database migration: **none introduced by this development change**.
- Live store/RevenueCat configuration: **required, not performed**.
- Publishing/production migration/data reset in this session: **none**.
