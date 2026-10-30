# Candidate checks — 30 October 2026

## Passed against this candidate

- 46 mobile tests: optional-consent/runtime, Android/iOS/browser separation,
  malformed legacy choice, failed withdrawal persistence and restart,
  training draft/unlock, paywall return, recording outcomes/recovery and
  expedition contribution handling.
- 40 further mobile regression tests: summit completion transition, Basecamp
  mountain layout, freely selectable stage ordering, expired-membership
  recording, raw GPS elevation and expedition catalogue/signature contracts.
- 48 API unit/HTTP tests: deletion orchestration, media/database/identity/provider
  failures, lawful retention reporting, protected writes, membership, canonical
  contracts, consented Reddit metadata, no-consent legacy rejection and provider
  failure. Relay HTTP tests use a mocked external service; nothing sent to Reddit.
- One explicitly enabled synthetic development database erasure/isolation test:
  owned canonical activities, legacy GPS rows, backups and plans removed;
  another synthetic owner's rows untouched; repeat safe; fixtures cleaned.
  No real user records or external identities were deleted.
- Mobile, landing and API TypeScript checks.
- API and website production compilation. These are not deployed.
- Apple privacy declaration validator: 13 unique linked/non-tracking data types,
  purposes and canonical/native plist agreement.
- Fresh isolated browser journey on the policy page at phone width: no choice,
  decline/reload, allow, withdrawal/reload. Google script requests intercepted
  before navigation and stubbed, not sent to Google. Disable flag, script
  presence, stored choice and decline cookie checked. Accurate prepared/not-live
  policy notice visible; screenshot evidence retained by the testing run.
- Source diff check: no whitespace errors; current app work never replaced by
  a prior source snapshot.
- Managed production schema diff reviewed: exactly new privacy-deletion ledger
  and nullable contribution-owner column, with no destructive operation.

## Build configuration and deliberately unverified

Production profile explicitly sets RevenueCat Test Store false to prevent a
project environment default from turning store-distribution builds into Test
Store builds. Development/preview configurations and public product prices stay
unchanged. Build calls must explicitly set autoSubmit false.

No new production schema/API/website deployment or store submission is performed.
No final compiled AAB/IPA inspection or device network test is claimed before
build completion. No claim of store upload follows from EAS FINISHED.
Owner handles real-device tests, including legacy upgrade, correct store prices,
trial eligibility, purchase/restore, GPS/mountain/celebration and synthetic-only
deletion against the later migrated API.

The existing provider operational decisions remain unresolved; successful
app-account deletion is not provider-erasure proof. New binaries initially
connect to the old production API until a separately approved rollout.
