# SummitReady privacy review — 29 October 2026

## Scope and release boundary

Privacy-only source changes. No production deployment, database/customer-data
mutation, store submission, native build, SDK enable/disable, consent-flow,
product entitlement, price or recording change was authorised or performed.
The preview policy is a prepared notice, not a certification of legal compliance.
The live policy linked from installed apps remains unchanged until separately published.

## Prepared iOS data declaration

Both Expo's canonical `app.json` and the existing generated
`ios/SummitReady/PrivacyInfo.xcprivacy` now describe the following app/service
collection. Every row is linked to identity and marked **not used for tracking**
in the app-owned iOS declaration. This deliberately does not label an entire
user account anonymous merely because one request omits an email address.

| Apple category | Actual feature/data | Purposes |
| --- | --- | --- |
| Name | Account/display name, community attribution | App functionality |
| Email Address | Authentication and contact | App functionality |
| User ID | Clerk owner IDs, RevenueCat customer identity, ownership | App functionality; analytics (RevenueCat dashboard) |
| Fitness | Training/readiness, hike metrics, progress and submitted coaching context | App functionality; product personalisation |
| Precise Location | Uploaded account-owned GPS points/routes and precise location requests | App functionality |
| Coarse Location | Approximate location and location-based search/service requests | App functionality |
| Photos or Videos | User-selected photos, profile covers and sign-in profile imagery; no video recorder added | App functionality |
| Other User Content | Posts, captions, comments, activity notes, reports and coach questions | App functionality; product personalisation |
| Purchase History | Expeditions/Pro receipts, transaction/status/trial/entitlement information | App functionality; analytics (RevenueCat dashboard) |
| Product Interaction | Account-associated likes, follows, saved selections and feature state | App functionality |
| Customer Support | Enquiries and supplied contact/context | App functionality |
| Other Diagnostic Data | Server errors/request metadata that can be attributable to an account | App functionality |

The app is not collecting payment-card details, address-book contents, biometric
templates, microphone recordings or imported HealthKit medical records through the
features inspected. A permission in a bundle alone does not prove collection.
Device-only information is not automatically server-collected; the rows above
cover relevant uploaded/submitted records. Free text can contain medical or other
sensitive information supplied by a person; there is no structured medical-record
import in these paths. Assess the legal condition for health-revealing fitness
and any deliberately solicited medical information before launch.

### iOS tracking and SDK limits

* Custom Firebase events and the Reddit conversion wrapper return without
  sending on iOS. No first-party IDFA collection, ATT prompt or ad-attribution
  payload was found in these paths. App-owned tracking remains `false`.
* Firebase is nevertheless compiled/configured through native AppDelegate and
  the Expo plugins. `IS_ANALYTICS_ENABLED=false` and `IS_ADS_ENABLED=false` exist
  in the supplied Firebase plist; there is no verified runtime capture proving
  that these alone suppress native automatic analytics. Do not certify SDK-wide
  zero collection from the JavaScript platform guard.
* RevenueCat receives the account ID through `Purchases.logIn(userId)`.
  Its documentation requires purchase history and custom User ID declarations,
  including Analytics for its dashboard and App Functionality for entitlements.
  RevenueCat does not inherently turn that data into advertising tracking.
* SDK manifests, provider-dashboard integrations and an actual release's network
  behaviour were not independently audited. Additional native identifier/usage
  collection, if verified, needs appropriate App Store disclosure. The source
  manifest is not an automatic update to App Store Connect's App Privacy form.

## Android: categories, purposes, linkage and tracking

The same account/service categories in the table above apply to equivalent
Android features, with the same owner linkage and functionality/personalisation
purposes. There is **additional analytics and advertising measurement**:

| Flow | Categories/payload | Linkage | Purpose / tracking status |
| --- | --- | --- | --- |
| Firebase Analytics | Screen views, sign-in method, mountain/challenge selection, session/hike metrics, readiness scores, AI-feature use, subscription/purchase events; SDK app/device/installation information | No explicit account ID/name/email attached by our wrapper; SDK identifiers make it pseudonymous, not anonymous | Analytics. Any advertising-ID, Google Signals or ads-personalisation configuration needs runtime/dashboard verification |
| Reddit CAPI | Installation UUID, event/conversion ID and time, request IP and user-agent; purchase product/plan, value, currency where supplied | Persistent per-install identifier; relay adds network identifiers. Not the Clerk account ID | Third-party advertising conversion measurement; treat matching as tracking/advertising sharing, not anonymous analytics |

Reddit's readiness events send their **event names**, not numerical readiness
scores. They disclose that the readiness feature was used. No GPS tracks, account
names/emails, coaching questions or photos are in that conversion payload.
Subscription/trial events accept a plan field, but the current event builder
includes product/plan metadata only in a purchase with valid value/currency.

Five supported event names: `first_open`, `readiness_test_completed`,
`readiness_score_viewed`, `subscription_started`, `purchase`.
First-open delivery is attempted from root initialisation on Android; failures
are retried on a later attempt. Other named helpers call the relay from the
corresponding feature/purchase paths. The unauthenticated API route forwards
validated inputs; it does not require a Clerk session.

**Activation evidence:** production secret-existence checks found both required
Reddit settings present, the router is mounted, and client calls are wired.
No credential values were read or printed. No conversion/test event was emitted
in this review. Successful current delivery/Reddit attribution is therefore
unverified. Android's built advertising-ID permissions and Firebase ads settings
were not established by inspecting a release AAB.

## Web

* The browser app uses the same account, subscription-test-store, community,
  upload, GPS-when-supported and AI APIs as its supported features request.
  Local browser storage is distinct from server-owned data.
* The marketing website's `index.html` loads Google Analytics (`gtag`) immediately.
  It can process page views, cookies/browser identifiers and device/network data.
  It is not covered by the Android-only wrapper; no explicit account-ID mapping
  was found in that tag. Do not describe it as anonymous or consent-gated.
* Website/provider consent-mode, Google Signals, retention and ad-linking console
  settings remain unknown.

## Services and policy changes

The revised existing `/privacy` page is dated 29 October 2026 and covers Explore
Free, Expeditions and Pro without changing price/trial terms. It now explains:

* Account names/email/IDs and owner-linked saved location, fitness and hike data.
* Private-by-default community content and explicit members sharing; reactions,
  comments, uploaded photos/covers, moderation and copies made by recipients.
* OpenAI questions and mountain/fitness/readiness/activity context through the
  hosting integration; no unsupported anonymity or model-training promise.
* Clerk authentication; RevenueCat subscriptions; Apple/Google native payments;
  Replit/cloud storage; OpenAI; Firebase/Google Analytics; Reddit; mapping,
  routing and weather providers (OS, OSM services, Mapbox, openrouteservice,
  WeatherAPI and external Apple/Google directions, depending on the feature).
* Advertising measurement and identifiers rather than a blanket "anonymous
  analytics" or "no advertising data sharing" statement.
* Permissions versus separate analytics consent, local versus uploaded data,
  retention limitations, rights and international-transfer arrangements needing
  provider/controller confirmation rather than invented audited safeguards.

### Retention and deletion findings

The existing in-app path is **You → Account → Delete account**. A verified-owner
email request is also described at `/privacy#account-deletion`; the support
contact already used by the product is retained.

The current authenticated API deletes account-owned hike backups, community
posts/reactions/reports, covers/preferences, owned shared routes, canonical
activity records, demo data and the Clerk user. The client discards the active
hike, logs out of RevenueCat and removes account-suffixed AsyncStorage entries.

This is **not** a verified universal erasure guarantee:

* Legacy tracked-hill rows can survive canonical deletion with their link
  cleared; do not assume that makes them anonymised.
* Uploaded post-photo deletion failures are caught/logged without a durable
  retry queue. Cover failure can interrupt deletion. Steps are not one atomic
  transaction across database, object storage and Clerk.
* No automated RevenueCat customer erasure, analytics install-ID/event erasure,
  provider-wide deletion, backup expiry or all-device wipe is invoked.
* No complete retention schedule or routine inactivity purge was found.
* Store subscription cancellation is separate from account deletion.

The unsupported all-data-within-30-days promise is removed. The notice accurately
describes the automated scope, possible residuals, contact path and normal
one-calendar-month rights-response period, not a newly implemented deletion SLA.

## Owner decisions before launch

1. **Analytics/advertising consent:** Android Firebase/Reddit and website Google
   Analytics run without an inspected consent gate or withdrawal setting. Decide
   whether to authorise a consent/withdrawal implementation or disable optional
   measurement pending that work. This privacy-only task does neither.
   Review readiness-feature conversion events, given their fitness context.
2. **Retention and erasure:** agree operational provider/log/backup retention and
   a verified end-to-end erasure procedure, including legacy rows, media failures,
   provider records and support handling. Policy text is not an erasure fix.
3. **Controller/legal arrangements:** confirm controller legal identity/contact
   address, appropriate fitness/health processing condition, provider agreements
   and international-transfer safeguards. Existing under-13 wording is retained;
   age-appropriate design/age checks were not audited.
4. **Release/privacy forms:** confirm iOS native Firebase collection and optional
   advertising integrations using a release-device/network check; reconcile SDK
   manifests, App Store privacy answers and Android Data Safety. Changes to
   collection require separate approval, not merely a broader disclosure.

## Latest iOS source evidence

Read-only EAS build listing returned the latest iOS store build as:

* Version **1.0.8 (72)**, production profile, completed **27 October 2026 21:09 UTC**.
* Build ID `dbcd54ed-90c3-4bca-8c84-f4d3f3950c7e`.
* Reported source commit `9ad4a024fbaf93894fe5202c5d5cf1a821775c76`.
* That commit's Expo privacy config declares precise/coarse location **unlinked**.
  The generated native plist is not in that commit's tracked tree.
* Build metadata identifies a source ref, not a forensic inventory of the IPA or
  any later externally delivered JavaScript. No IPA or OTA inspection was done.
  These newly prepared native declarations cannot be present in that old build.
  No new build was started.

## Verification and references

* Landing and mobile TypeScript checks passed.
* Read-only declaration check confirms 12 unique categories, identity linkage,
  tracking flags, purposes, preserved required-reason APIs, and exact equality
  of generated plist and canonical Expo declarations.
* Compared old/new Expo config with privacy manifests removed: no other
  configuration, version, billing or product setting changed.
* Policy coverage check rejects the obsolete anonymous/July/30-day claims.
* Preview rendering is checked separately; no destructive account deletion,
  store purchase, advertising event, customer-data query or native build is
  necessary for this copy/declaration update.

Primary code evidence: `artifacts/summit-ready/lib/analytics.ts`,
`lib/revenuecat.tsx`, `app/_layout.tsx`, `app/(tabs)/account.tsx`, `app.json`;
`artifacts/api-server/src/services/redditConversions.ts`,
`routes/reddit-conversions.ts`, `routes/community.ts`, `routes/coach.ts`,
`routes/user.ts`, `app.ts`; and `artifacts/summit-landing/index.html`.

Public documentation checked:

* https://developer.apple.com/support/app-privacy-on-the-app-store
* https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype
* https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy
* https://rnfirebase.io/analytics/usage
* https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-the-rules-apply-to-online-advertising/
