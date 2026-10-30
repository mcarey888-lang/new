# SummitReady privacy release preparation — 30 October 2026

## Release boundary

Prepared in the existing project. Nothing has been published, submitted to
stores or built natively by this work. Only additive development schema changes
were applied. Production customer data was not cleaned up or tested destructively.
Older installed iOS 73 / Android 94 do not acquire these controls from a policy
publication. Both platforms need new binaries and device verification.

## Final prepared collection / disclosure matrix

All app-owned Apple categories below are declared linked to identity and not
used for Apple's cross-app tracking. Optional Firebase identifiers/events are
pseudonymous, not anonymous. Source inspection and mock SDK tests are not a
release-device network capture or provider-dashboard audit.

| Apple category | Purposes | Essential/requested or optional |
|---|---|---|
| Name | App Functionality | Account and chosen community identity |
| Email Address | App Functionality | Sign-in and requested support |
| User ID | App Functionality, Analytics | Account/RevenueCat customer and purchase dashboard |
| Fitness | App Functionality, Product Personalization | Requested hikes/training/readiness/coaching |
| Precise Location | App Functionality | Optional location permissions; requested recording/navigation and saved GPS |
| Coarse Location | App Functionality | Requested approximate location/planning |
| Photos or Videos | App Functionality | Chosen photos/covers; no video recording feature |
| Other User Content | App Functionality, Product Personalization | Chosen community content, notes, questions/coaching |
| Purchase History | App Functionality, Analytics | Optional subscription purchases, verification/RevenueCat reporting |
| Product Interaction | App Functionality, Analytics | Saved likes/follows/state; optional Firebase usage events |
| Device ID | Analytics | Optional Firebase app-instance identifier |
| Customer Support | App Functionality | Submitted enquiries |
| Other Diagnostic Data | App Functionality | Proportionate server/security diagnostics |

### iOS

Firebase Analytics defaults off in native configuration and the committed
Info.plist. It can run only after an explicit analytics choice. Firebase IDFA
support is excluded; IDFV collection and Google advertising consent signals are
disabled. No Reddit relay on iOS. Apple form now needs **13 categories**, adding
Device ID to the prior 12-category source matrix and Analytics to Product
Interaction. Store forms are not changed by editing the manifest.

### Android / Google Play Data safety

Essential/requested: personal info (name/email/user IDs), fitness, precise/coarse
location, photos, other user-generated content, purchase history, support and
necessary diagnostics. These are account-linked where saved. Third-party
processors provide authentication, hosting/storage, billing, mapping/weather and
requested AI processing. Do not assume that every processor transfer is exempt
from Google's sharing definition without checking the provider arrangement.

Optional usage: Firebase app interactions, sign-in method, permitted purchase
metadata and app-instance/device information. No location names, numerical
readiness scores, fitness-level values or coaching text are sent by the wrapper.
Google Advertising ID and SSAID collection are disabled and AD_ID / AdServices
permissions blocked in the new configuration. This does not change build 94,
whose inspected binary has AD_ID and Firebase ad-ID collection enabled.

Optional advertising: a separate Android Reddit choice shares an installation
UUID, IP, user-agent, event/conversion IDs/time, and purchase plan/value/currency
when valid. Readiness event names indicate feature usage, not scores. Data safety
must account for **Device or other IDs**, app interactions, approximate/network
location as applicable to IP processing, and optionally shared purchase history
for Advertising or marketing. Do not describe this as anonymous or no sharing.
No Google Advertising ID is needed by this relay.

After the new binary's merged manifest and runtime are verified, the intended
Advertising ID declaration is **No**, unlike existing build 94's **Yes**.
Review every active artifact before changing the app-wide declaration.

### Website and browser app

Marketing GA is not downloaded before consent; decline is persisted. Acceptance
loads the tag with advertising storage/user-data/personalisation and Google
Signals disabled. Withdrawal sets the GA disable flag, removes the tag, clears
GA cookies and persists an opt-out marker. Website consent is distinct from app
consent. Browser app does not invoke native Firebase/Reddit.

### Essential services remain independent

Consent is never a membership/access gate. Clerk, RevenueCat entitlement/
purchase/restore, GPS recording, progress and requested community/AI operations
remain available without optional measurement. Essential RevenueCat purchase
processing/dashboard records are not switched off as optional Firebase analytics.
No price, tier, mountain fill or summit celebration implementation was changed.

## Erasure behaviour and operator procedure

- Authenticated DELETE /api/user/me creates a durable restricted job before
  storage enumeration. The response distinguishes failure, app-account removal
  with pending review (202), and fully resolved deletion (200).
- Uploaded photos/covers including account-prefixed orphan uploads are enumerated
  and checkpointed. A failed deletion is not swallowed. Missing objects are
  idempotently successful.
- Owned plans/backups/community records, activity ledgers and canonical records
  are erased transactionally. Legacy tracked sessions are removed **before**
  canonical FK SET NULL could orphan the ownership link.
- New route contributions retain their server-authoritative author. Historical
  contributions with no author are not guessed or mass-deleted; they have an
  explicit ownership-review item.
- Shared advisory write fences let existing authenticated writes finish before
  the erasure inventory; new writes for that deleting owner are rejected. A
  separate bounded lock pool prevents CRUD-pool deadlocks. Other accounts are
  not selected by erasure predicates.
- Clerk identity removal follows live data/media cleanup. The workflow attempts
  RevenueCat customer deletion, invalidates entitlement cache, and records any
  provider refusal/failure for review. No subscription cancellation is claimed.
- Firebase, Reddit, AI/support logs/backups and legacy unattributed rows remain
  explicit restricted review items. Existing device measurement identifiers,
  where available, are supplied for erasure only; provider matching requires
  ownership verification. Never claim that unavailable historical pseudonymous
  identifiers have been erased by deleting the Clerk account.
- Apple/Google financial or fraud/accounting records may need lawful retention.
  Do not invent a retention period or record all providers as deleted. A retained
  outcome requires a verified basis, case reference and next-review date.
- Local erasure withdraws measurement, discards the active hike checkpoint,
  removes account-containing storage keys, logs out RevenueCat/Clerk and reports
  any local cleanup failure. Other devices/downloaded copies require separate
  handling.

Operator tool (defaults to read-only), run in the API server's normal environment:

    pnpm --filter @workspace/api-server exec tsx src/scripts/privacyErasure.ts --request UUID

Retry only one reviewed request with `--retry --execute`. A production operation
additionally requires `--approved-production-request`; none was run here.
Provider resolution uses `--resolve-provider NAME --status deleted --case CASE_REF
--execute`, or `--status retained_lawfully --basis BASIS --review-after ISO_DATE`.
Use opaque case references, never credentials or customer content. Verify actual
provider results before resolving; retained decisions are not complete erasure.
Identifiers are removed from the ledger after all review items are resolved.
Agree a ledger/provider/log/backup retention schedule before operational rollout.

## Controlled policy-only release

The earlier temporary-only copy is superseded by the durable release at
`release/policy-website-20261030`, commit
`78b3ba9be33603a58a8c8924d7b18a49d9c23054`. Its exact parent is the live hosted
source `714a5bc2c6626825776a500af5d60d58a41c2ac7`, reconfirmed in both hosted
mobile JSON manifests. It overlays exactly:

1. `artifacts/summit-landing/src/pages/Privacy.tsx`
2. `artifacts/summit-landing/src/components/WebsitePrivacy.tsx`
3. the consent-only changes to baseline `src/main.tsx`
4. removal of the automatic GA tag from baseline `index.html`

Its Git diff and hash review reject any other changed file. Both the release and
pre-existing complete-work backup `backup/before-policy-release-20261030`
(`a1cac298e693ec44daf7068f581811b99c5b0d28`) were pushed and remotely confirmed.
No current workspace checkout/reset was performed. See
`docs/releases/privacy-website-2026-10-30/README.md`, `review.json`,
`POLICY.txt`, `policy-only.patch` and `CHECKS.md`.

The policy was corrected again: current Android measurement and deletion gaps
are explicit; iOS automatic SDK collection remains uncertain; native/server
improvements are prominently **prepared, not yet deployed**. There is no blanket
claim that the live relay enforces consent or that provider erasure is guaranteed.
The website choice is scoped to the website serving this policy revision.

Do not normal-Publish the development workspace. A separate approved publication
checkout/handoff and inspection of the actual database diff are still required.
Hosted-mobile provenance does not independently certify every backend/website
artifact. Reconfirm artifact sources immediately before publication.

Source isolation is not approval of a database promotion. Review the publish
database diff separately and reject any unapproved schema/data operation; this
policy-only snapshot does not require a database migration.

Read-only production inspection still found the deletion-job table and
contribution-owner column absent. For the later full release, use the reviewed
Replit-managed **Publish schema diff before API activation**. The existing SQL
file `lib/db/migrations/20261030_privacy_deletion_jobs.sql` is a schema reference,
not a custom script to execute against managed production. No production
migration or erasure was performed. It is not part of the isolated website
release. The detailed migration, provider-decision and test-build gates are in
`docs/releases/privacy-website-2026-10-30/MIGRATION-AND-BUILDS.md`.

## Remaining release decisions / proof

1. Owner approval of lawful fitness/health processing, controller/provider
   arrangements, retention periods and reviewed provider-erasure operations.
2. New iOS/Android binaries: inspect final native manifests and verify consent
   off/on/withdrawal on real devices, including an upgrade from old versions.
   No new binaries were started here.
3. Reconcile Apple/Google forms and the Google Advertising ID declaration against
   all still-active bundles, not just the next release.
4. Publish only an explicitly approved reviewed snapshot; current public policy
   remains the July version until publication.

## Completed checks

- Database, API, mobile and landing TypeScript checks passed.
- 29 mobile tests passed: consent policy/runtime, recording outcome/recovery and
  expedition contribution behaviour.
- 50 API tests passed: deletion failures/retries, owner-scoped synthetic database
  erasure, canonical activity contracts, protected writes and membership access.
  Synthetic GPS sessions, plans and backups were removed; a different synthetic
  owner's rows remained unchanged. Fixtures were cleaned up. No real account or
  provider deletion was invoked.
- Native privacy validation passed: 13 unique linked/non-tracking categories,
  correct purposes, and exact agreement of generated plist and Expo source.
- Browser verification passed for no choice, decline, accepted analytics,
  withdrawal, persistence/reload and continued navigation. Google requests were
  intercepted before navigation; no real analytics was emitted in that test.
- Running preview Reddit endpoint rejected a request without consent with 403
  before any forwarding. No opted-in server test event was sent.
- API, Expo and landing workflows restarted and came up. The phone-width
  privacy page/consent panel rendered correctly. A pre-existing homepage
  horizontal overflow was reported separately; it does not affect this panel.
- Policy-only preparation produced a baseline snapshot whose changed-file list
  contains exactly the four allowed website files. No publication occurred.
- Mountain fill and expedition celebration source files remained unchanged.

Not verified here: new native binary runtime/network behaviour, Apple/Google
form publication, production migration/promotion, real provider erasure or store
payments on devices. Owner device testing is still required.
