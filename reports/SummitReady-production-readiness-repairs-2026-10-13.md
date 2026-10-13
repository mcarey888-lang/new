# SummitReady production-readiness repairs — 13 October 2026

## Decision: not ready for a new testing build

Preparation is complete where agent tools allow it. Production rollout is **blocked**, not completed. No production writes, backup creation, publishing, mobile build or submission occurred. No production test records were created. Existing users, recordings, routes, progress and curated catalogue data were not modified.

## What changed in this pass

- `artifacts/summit-ready/eas.json`: preview explicitly selects EAS's production environment and the same live Clerk frontend as the production profile. Production now also selects its environment explicitly. Preview remains an internal Android APK and retains its existing RevenueCat test-store setting. It is **an internal client of the real production backend**, not an isolated staging environment.
- `scripts/verify-summit-release-profiles.mjs`: checks explicit environment, common API domain/live Clerk frontend, and absence of a conflicting profile-level map origin. Does not read secrets. Remote EAS overrides must also be checked through resolved configuration.
- `scripts/check-summit-public-readiness.mjs`: repeatable read-only health, ETag/revalidation, real summit response and anonymous JSON-auth checks. Does not pretend to authenticate or verify phone behaviour.
- `reports/verify-production-repair-schema.sql`: read-only verification of all 30 affected columns, their nullability/defaults, seven exact primary keys and valid backing indexes, and the exact cascading composite foreign key. Inventories all CHECK definitions and indexes for review.
- Evidence saved in `production-readiness-schema-evidence.json`, `production-public-readiness-evidence.json`, and `development-public-readiness-evidence.json`.

No recording, elevation filtering, offline recovery, personal-route following, progress mountain, celebration, Training or Expedition runtime code changed. The backend's existing JSON-auth and map-cache repairs were already present in the candidate; they were not duplicated.

## 1. Migrations 0006–0008

**Inspected:** all three source SQL files, the actual development schema, actual production schema and Replit's generated development-to-production migration diff.

**Partial application check:** none of the seven repair tables exists in production; `tracked_routes.audience` is also absent. There is no partly present repair table to repair or overwrite.

**Development verification: PASS**

- All 30 column/type/nullability/default checks passed.
- All seven ordered primary keys and valid unique backing indexes passed.
- Publication `(owner,hike_id)` references backup `(owner_user_id,hike_id)`, with delete cascade and no-action update: passed.
- All 11 constraints are validated: seven primary keys, two permitted-audience CHECKs, one non-self-follow CHECK, one composite foreign key.
- All seven required indexes are present.

**Production verification: FAIL / migration pending**

- All 30 affected-column checks fail because the new schema is absent.
- All seven required primary-key/index checks and the foreign-key check fail.
- No repair-table constraints or indexes are present.

**Publish diff:** nine additive statements: seven CREATE TABLEs, one ADD COLUMN and one ADD FOREIGN KEY. Referenced backup table/primary key precedes the foreign-key statement. No table/column/schema removal, truncation or structural data loss is proposed. The resulting schema incorporates 0006–0008; managed publishing need not execute those files verbatim or record their filenames.

**Backup: NOT taken or verified.** Agent has no supported production backup/restore callback or production DDL access. Do not publish until a recoverable restore point is confirmed.

Supported recovery procedure, from Replit's actual documentation:

1. Open Database → production database → Settings.
2. Confirm point-in-time restore coverage and record the pre-change UTC timestamp inside the retained window.
3. Under Advanced → Scheduled backups → View all backups, confirm an available restore point. Enabling the schedule alone is not evidence that a backup exists; documented scheduled backups occur daily.
4. Keep the matching code revision as well: restoring the database does not restore deployed code.

Use Publishing's isolated deployment preview to validate the additive migration before approving production publication. Never select “Overwrite production data” or copy development data into the existing production database. Recheck the diff at approval time because the workspace may have changed.

## 2. Backend publication

Verified production target: **https://summitready.uk/api**; deployment is public autoscale. Candidate backend build passed. Development API restarted cleanly.

| Check | Development candidate | Current production |
|---|---|---|
| Health | 200 | 200 |
| `/route-map` | 200, `Cache-Control: no-cache` | 200, `private, max-age=3600` |
| Conditional GET with ETag | 304 | 304, but cache policy remains wrong |
| Anonymous backups | JSON 401, no redirect | 302 redirect |
| Anonymous planned routes | JSON 401, no redirect | 302 redirect |
| Anonymous sharing preferences | JSON 401, no redirect | 302 redirect |
| Anonymous activities/history | JSON 401, no redirect | 302 redirect |

**Publication: pending user action.** Agent can suggest publishing but cannot perform it. No startup migration or alternate publishing mechanism was introduced to bypass this restriction.

## 3. Summit Data Engine

- Live search and Snowdonia map-pin requests both return 503 `summit_catalogue_unavailable`.
- Production logs contain the safe diagnostic **`database_dns_unavailable`** (DNS lookup failure), not a missing-variable diagnostic.
- The production engine secret exists; its value was not accessed or displayed.
- Managed production reads confirm real Tryfan catalogue records exist in `public.mountains` (including Tryfan at 917.5 m). This does not prove the deployed restricted engine login can reach them.
- Development engine search returns six catalogue results; the test viewport returns 40 summit pins.

**Repair pending:** confirm/update the production-specific `ENGINE_DATABASE_URL` in Secrets using the dedicated catalogue-only reader on the reachable main production database host. Do not paste credentials into chat. Secret presence alone does not establish its host, credentials or reachability; the observed DNS category does not prove a database was deleted.

The dedicated bounded engine pool, session-level read-only configuration and source selection are unchanged. No DATABASE_URL fallback, invented AI catalogue data, catalogue promotion or catalogue write was added. Updated production secrets enter the live app through the separately approved publication.

## 4. Clerk alignment

Resolved with EAS CLI, without building:

| Profile/platform checked | Environment | API domain | Clerk |
|---|---|---|---|
| preview / Android | production | summitready.uk | live: clerk.auth.summitready.uk |
| production / iOS | production | summitready.uk | live: clerk.auth.summitready.uk |

Neither resolved profile has an `EXPO_PUBLIC_MAP_BASE` override.

**Frontend pairing: fixed in the workspace.** Production `CLERK_SECRET_KEY` exists. Clerk reports an external tenant, with no managed dashboard access for this agent. Secret existence and frontend hostname do **not** prove the server secret belongs to that live instance.

**Backend instance proof and authenticated round-trip: unverified.** Require an authorised live test session after rollout. Do not manufacture a user ID, bypass authentication or infer success from an anonymous response. Production authentication, backups and sharing must all pass with the real session before a testing build is approved.

## 5. Canonical flags and compatibility

`CANONICAL_ACTIVITY_BRIDGE_ENABLED` and `CANONICAL_EXPLORE_HIKE_ADAPTER_ENABLED` remain unset/disabled.

- Private backup/restore/edit/delete and activity sharing do not require these flags.
- Canonical activity ingestion and Explore-hike canonicalisation do require their corresponding activation paths. Disabled canonical acknowledgement must remain pending, not falsely become a successful sync or credit award.
- The five actual canonical storage tables are present in production, but table presence alone is not dependency, backfill, qualification or compatibility validation.
- Four canonical database integration tests remain skipped. Existing-account progress compatibility and authenticated end-to-end canonical processing are not verified.

**Decision:** do not enable either flag during this repair rollout. Preserve the released progress paths. Canonical ingestion/qualified-credit activation is a separate outstanding gate; do not describe private backup success as confirmed readiness or expedition credit.

## 6. Acceptance evidence

Local targeted suite: **91 tests passed, four integration tests skipped** across nine passing files and one skipped file. Coverage includes JSON auth, private backup identity/isolation/revisions/tombstones, sharing policy, moderation, planned-route input, safe summit diagnostics and summit-card routing. Candidate production build passed; profile assertions and diff whitespace checks passed.

These are **candidate tests**, not authenticated production acceptance.

A malformed bearer token also receives JSON 401 from the candidate planned-routes endpoint. A managed-browser screenshot of the candidate map showed controls but no rendered map tiles, with a 404 resource error. Successful summit API responses are therefore not proof of interactive map rendering; that check remains open.

| Production acceptance item | Result |
|---|---|
| Health | Passed |
| Additive schema applied and fully verified | Pending; current schema fails |
| Backup restore point before migration | Unverified; user action required |
| Correct map cache/revalidation policy | Failed: one-hour caching |
| Appropriate anonymous JSON status/no redirects | Failed: 302 |
| Real summit search and map pins | Failed: 503 |
| Clerk authenticated round-trip | Unverified |
| Authenticated private backup and fresh-device restore | Unverified |
| Activity edits and revision race handling | Unverified |
| Delete/tombstone stale-device resurrection refusal | Unverified |
| Authenticated planned-route save/read/delete | Unverified |
| Owner/member/follower/stranger sharing isolation | Unverified |
| Interactive route planning and parking-marker behaviour | Unverified |
| Existing Training/Expedition/progress/celebration compatibility | Unverified on devices |
| Installed-phone, offline/background GPS behaviour | Not tested; backend tests cannot verify it |

### Safe authenticated acceptance after publication

Use separately authorised owner, follower and non-follower test accounts. Create only new tagged test activity/route UUIDs; never edit a real member's recording or preferences.

1. Save a private recording and verify the exact durable receipt, list/read and restoration.
2. Edit with a later revision; verify it survives fresh reads and reject stale updates.
3. Verify private invisibility, signed-in-member Public access, follower-only access, and immediate revocation after unfollow/audience change.
4. Save/read/delete a new planned route and exercise actual route planning on the map.
5. Delete the test recording; verify it is absent and both stale and newer offline retries cannot recreate its UUID.
6. Clean up test publications, follows and planned routes and remove test accounts using supported administration. Retain the minimal deletion tombstone required by the test instead of deleting it to make the database look empty.

No production acceptance records were created before schema and authentication gates could be met.

## Required next actions

1. User confirms an available recoverable production backup/PITR point.
2. User corrects the production engine connection securely and confirms the live backend Clerk secret belongs to the intended instance.
3. User validates the isolated deployment preview and approves the reviewed additive Publish migration; no data-overwrite option.
4. Agent reruns production schema/public checks and authorised authenticated acceptance.
5. Only after those gates pass, reconsider a new testing build. No mobile build or submission is authorised by this report.

References:
- https://docs.replit.com/features/data-and-storage/data-recovery
- https://docs.replit.com/features/data-and-storage/development-and-production
