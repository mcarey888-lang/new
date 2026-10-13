# SummitReady — independent review resolution

13 October 2026 · branch `replit/repair-candidate-20261013`

## Verdict

I agree with the independent review of
`20cb180374edc98ab951c0285330fd5b5880f2e3`. Its reproductions exposed genuine
gaps that the previous passing suites did not cover. In particular, the earlier
F04 “fixed” classification was premature, and the manual ACK, canonical ACK,
training upload and saved-quality paths were incomplete.

This update fixes R01–R04, R06 and R07 in source and behavioural regressions.
R05's **coverage/classification defect is fixed**; its separate requirement
for an atomic historical qualified-credit/expedition correction remains pending
through the protected canonical pipeline. It is not implemented by changing a
device estimate or uploading its private backup.

No deployment, publishing, production migration, production setting change,
EAS build or store submission was performed. Community sharing remains enabled
by explicit audience consent; protected processing flags were not enabled.

## R01–R07 evidence

| Review finding | Result | Change and executed evidence |
|---|---|---|
| R01 — Canonical ACK parsed twice | Fixed in source/tests | `syncOutbox.ts` parses each successful response once and validates acknowledgements by upload kind. Canonical created/deduplicated/reused/ingested responses require an ID; known identity, source/owner echoes when supplied, and queue identity are checked. Disabled/conflict/wrong identity are not success. Tests use genuine one-shot Fetch Response bodies; private success remains independent of disabled canonical processing. Existing server duplicate protection and credit flags are unchanged. |
| R02 — Different create/edit/retry/delete origins | Fixed in source/tests | Neutral `activityServiceOrigin.ts` resolves the explicit MAP/activity service before the general DOMAIN. AppContext edits/deletions and the manual backup operation use it. Owned recording, preference and canonical queued retries also retarget obsolete DOMAIN-only URLs to this same service. Behavioural tests deliberately configure service A and a different domain B and assert create, updated audience snapshot, preference and deletion requests reach A only. General AI/app services were not indiscriminately moved. Real installed/production origin acceptance remains open. |
| R03 — Parser on plural training route | Fixed in source/tests | The application's shared parser installer mounts 48 MiB at `/api/hill-session`, not `/api/hill-sessions`. The real SaveTracked schema bounds raw track and profile arrays at 100,000 without truncation. HTTP admission tests use the application's actual installer and validator for 1,800 and 43,201 fixes on `/api/hill-session/save-tracked`; both return 200 and retain every point. Unrelated endpoints retain smaller limits and an actionable JSON413. These are admission tests, not database/credit acceptance. A >100 KiB anonymous request to the actual restarted development endpoint returned JSON401, not the old parser413; no training row was created. |
| R04 — Manual ACK causes another revision | Fixed in source/tests | Manual backup reads the current owner-scoped recording inside the library write lock, rather than uploading a stale panel snapshot. Automatic and manual paths call the same durable receipt-only reconciler. ACK R leaves current/backed-up revision R and does not requeue evidence. Behavioural tests cover a newer audience/evidence edit during the request, failed metadata persistence/recovery and account switching. A pending/failed explicit retry is not presented as a success merely because a cached receipt exists. |
| R05 — Saved elevation quality lacks coverage | Coverage defect fixed; protected correction pending | Exact active recording seconds and recording events feed the same duration-aware helper at live, finish, save, owned detail/restore, private backup and canonical upload. Unknown duration is not full coverage; sparse endpoints do not prove intervening readings. Accepted raw evidence can supply stationary coverage; rejected fixes remain untouched. A cached reliable badge is recomputed, not trusted. Tests cover sparse six-hour activity, unknown duration, long gaps, deliberate pauses, stationary fixes, poor accuracy and JSON restore/upload classification. Qualified-credit/expedition correction transactions and real-phone GPS validation remain open; the confirmation explicitly states the device/backup-only boundary. |
| R06 — Backup falsely promises no community visibility | Fixed in source | The panel now says account backup and explains that community access follows the selected audience: Only me stays private; Public/Followers become available to that audience after sync. No publication or access-control feature was removed. |
| R07 — Identical later post reuses a previous key | Fixed in source/tests | Request identity is an owner/draft attempt, not text equality. The composer has an explicit draft/revision ID; changed kind/content/photo/audience is a new revision. Unchanged ambiguous retries retain the attempt. Durably acknowledged text/photo/visibility operations clear the request key, so a later intentionally identical post is new. Tests cover ambiguous retry, second identical submission after ACK, new draft, stale old acknowledgement and account switch. |

## Checks executed

- `pnpm run typecheck` — PASS: libraries, all artifacts and scripts.
- `pnpm --filter @workspace/summit-ready exec vitest run` — PASS:
  **114 files, 1,305 tests**.
- `pnpm --filter @workspace/api-server exec vitest run` — PASS:
  **76 files passed, 1 skipped; 990 tests passed, 4 skipped**.
- `git diff --check` — PASS.
- Development API and Expo workflows restarted successfully. Metro bundled
  the app and returned HTTP200; API is listening on 8080.
- `/api/route-map` returned HTTP200 with `Cache-Control: no-cache` and its
  unchanged entity tag. No map/summit/3D-renderer source was changed.
- The standalone map screenshot showed controls but no visible tiles.
  **Tile rendering was not verified by that capture.** It does not establish
  that a signed-in host screen renders correctly on a phone.
- Existing web-console nested-button/transform-origin and dependency warnings
  remain. No new startup crash was observed; this update does not claim those
  unrelated presentation warnings were resolved.
- No authenticated browser or real-phone journey was run this turn. Prior
  Clerk helper redirect failure is not counted as a passing acceptance test.
- No production DB query was rerun this turn. The earlier production table
  inventory remains earlier evidence, not a fresh claim.

The new tests exercise actual client utilities, genuine Fetch bodies and
the real parser/validator definitions. They still do not prove PostgreSQL
permissions, deployed schema, two-account privacy or native GPS/OS durability.

## Changed source and test files

API:

- `artifacts/api-server/src/app.ts`
- `artifacts/api-server/src/lib/requestBodyParsers.ts`
- `artifacts/api-server/src/routes/hill-session.ts`
- `artifacts/api-server/src/routes/hill-session-contract.ts`
- `artifacts/api-server/src/__tests__/requestBodyParsers.test.ts`
- `artifacts/api-server/src/__tests__/canonicalActivityContract.test.ts`

Mobile/shared client:

- `artifacts/summit-ready/app/hike-tracking.tsx`
- `artifacts/summit-ready/app/hike-detail.tsx`
- `artifacts/summit-ready/context/AppContext.tsx`
- `artifacts/summit-ready/components/track/RecordedHikeRecoveryPanel.tsx`
- `artifacts/summit-ready/components/profile/CommunityHub.tsx`
- `artifacts/summit-ready/hooks/useCommunity.ts`
- `artifacts/summit-ready/utils/activityAudience.ts`
- `artifacts/summit-ready/utils/activityServiceOrigin.ts`
- `artifacts/summit-ready/utils/activityServiceOrigin.test.ts`
- `artifacts/summit-ready/utils/syncOutbox.ts`
- `artifacts/summit-ready/utils/syncOutbox.test.ts`
- `artifacts/summit-ready/utils/recordedHikeBackupActions.ts`
- `artifacts/summit-ready/utils/recordedHikeBackupActions.test.ts`
- `artifacts/summit-ready/utils/recordedHikeRecovery.ts`
- `artifacts/summit-ready/utils/recordedHikeSync.ts`
- `artifacts/summit-ready/utils/recordedHikeSyncCoverage.test.ts`
- `artifacts/summit-ready/utils/elevationQuality.ts`
- `artifacts/summit-ready/utils/elevationQuality.test.ts`
- `artifacts/summit-ready/utils/communityDraftAttempt.ts`
- `artifacts/summit-ready/utils/communityDraftAttempt.test.ts`

The commit also contains this report, its downloadable HTML and the durable
coverage lesson in `.agents/memory/recorded-elevation-integrity.md`.

## F01–F22 disposition after this update

These are source/check classifications, not store-build release approval.

| Finding | Current disposition |
|---|---|
| F01 | Implemented; account/media/privacy/native acceptance pending. R06 wording corrected. |
| F02 | Source/tests fixed; real offline personal-route following pending. |
| F03 | Source/tests fixed; touch/name/save journey pending. |
| F04 | Source/tests fixed by R02; configured installed/deployed origin acceptance pending. |
| F05 | Pending production schema/engine/permission verification and separately approved rollout. |
| F06 | Source/tests fixed by R04; offline/reconnect/relaunch acceptance pending. |
| F07 | Canonical client ACK fixed by R01; protected canonical credit and second-device acceptance pending. |
| F08 | Private and training upload source/admission regressions fixed; full-day phone/storage/backend acceptance pending. |
| F09 | Coverage/classification fixed by R05; real GPS validation and historical protected-credit correction still pending. |
| F10 | Source/tests fixed; OS storage-failure/kill acceptance pending. |
| F11 | Source/tests fixed; old recovery/reboot/account-switch acceptance pending. |
| F12 | Source/tests fixed; native intent/context acceptance pending. |
| F13 | Implemented; profile/media permission and persistence acceptance pending. |
| F14 | Implemented; native GPX/share/recipient links pending. |
| F15 | Source/tests fixed by R07; real post/photo retry acceptance pending. |
| F16 | Source/tests fixed; signed-in composer/visibility acceptance pending. |
| F17 | Implemented; token expiry/media/account-switch acceptance pending. |
| F18 | Source/tests fixed; runtime error/retry/discovery withdrawal acceptance pending. |
| F19 | Source/tests fixed; native permissions/double taps/finish-save-discard pending. |
| F20 | Source/tests fixed; offline native reopening/large-trace acceptance pending. |
| F21 | Source/tests fixed; no change to reference geometry or catalogue promotion. |
| F22 | Pending release parity, native/multi-account/production acceptance and skipped checks. Existing/new automated suites pass. |

## Boundaries preserved and next decisions

The release elevation accumulator/filter was not changed. Raw fixes, original
saved totals, permanent activity UUIDs, owner-scoped checkpoints, offline
finish/save, saved-hike library and personal/stage context remain intact.
Personal/community reference geometry stays separate from actual recorded GPS
and does not mint credit by being saved or followed. Engine/application pools,
catalogue data source, protected processing flags, mountain-progress,
summit/3D-climber work and purchase/auth configuration were not replaced.

Keep F05/F07/F22 open. Native field tests, isolated-account privacy/restore
tests, historical qualified-credit corrections, production migrations and
installed-backend/store parity require their own demonstrated acceptance.
Activity-linked galleries and canonically approved trail promotion remain
outside what is verified here. No deployment or mobile build is authorised by
this report.
