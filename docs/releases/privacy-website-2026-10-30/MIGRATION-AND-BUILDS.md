# Separate consent/deletion rollout and test-build readiness

## Source and scope

The pushed backup `a1cac298e693ec44daf7068f581811b99c5b0d28` preserves the prepared
consent/deletion implementation and the current training/paywall, pricing,
mountain-fill and celebration code. It is a candidate **test source**, not the
four-file website release and not blanket approval of all unrelated changes.
Use a dedicated reviewed native/API release ref when approving the full rollout.
Never build a new binary from the older policy-only branch.

## Production schema gate

Read-only production inspection on 30 October 2026 found neither
`public.privacy_deletion_jobs` nor `public.route_contributions.owner_user_id`.
The enhanced erasure/write-fence code must not be activated before that schema.

This app uses Replit-managed `DATABASE_URL` tables for these records. The supported
production migration route is the reviewed **Publish development-to-production
schema diff**, not executing custom SQL, a startup migration or an EAS build hook.
`lib/db/migrations/20261030_privacy_deletion_jobs.sql` is an existing additive
schema reference; **do not run it directly against managed production**.

Approve only the expected new deletion-job table (UUID ID/default, unique owner,
JSONB state and timestamps) and nullable author-owner column on contributions.
Do not infer historical authors, backfill guessed owners, delete rows, drop
constraints or promote development customer data. Check required unique indexes
and constraint ordering in the actual generated diff. If unrelated schema
changes appear, stop and isolate/review them rather than approving them here.

After the separately approved migration, verify metadata read-only before API
activation:

    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name = 'privacy_deletion_jobs'
        OR (table_name = 'route_contributions' AND column_name = 'owner_user_id'))
    ORDER BY table_name, ordinal_position;

Also verify the deletion-job owner unique constraint/index. The current test
database already supports synthetic tests; no production DDL was run here.

## Provider operations / owner decisions

- Verify controller/service-provider terms and the health-data lawful condition.
- Approve provider/log/backup/erasure-ledger retention and review procedures;
  no period has been invented or implemented by this preparation.
- Assign an operator for Clerk/RevenueCat failures, Firebase, Reddit, AI/support
  records, backups and historical contributions without reliable authorship.
- Use the existing read-only-by-default `privacyErasure.ts` request inspector.
  Retrying/resolving a production request needs explicit per-request approval.
  Mark provider deletion only with actual provider evidence. Any lawful retained
  record needs a verified basis, opaque case reference and next-review date.
- Purchase cancellation stays in Apple/Google. App-account removal does not
  guarantee deletion of store financial records or automatically cancel billing.

## Next iOS and Android test builds

1. Select and push an exact reviewed native/API source ref. Keep the preserved
   training/paywall changes deliberately, not accidentally from a moving branch.
2. For development deletion tests, use an explicitly verified development API,
   matching Clerk environment and isolated synthetic accounts. The existing
   development profile's API hostname must be reviewed: do not assume a
   "development" or "preview" profile necessarily points at the development API.
   Never exercise cleanup on real customer accounts.
3. For real store-product testing use the existing `production` EAS profile with
   store sandbox/license-test accounts. The existing `preview` profile enables
   RevenueCat Test Store and is **not proof of Apple/Google purchase behaviour**.
4. Request **build-only** iOS/Android jobs for the exact source. Do not enable
   automatic submission. EAS uses remote versioning and production auto-increment;
   obtain the next numbers from EAS rather than guessing 74/95 or overwriting them.
   Check signing and store-upload credentials separately; never commit a key.
5. Record EAS build IDs, source commit, profile/environment, platform/version and
   artifact checksums. Inspect final merged Android permissions (no AD_ID/SSAID
   collection flags), generated iOS privacy manifest and disabled advertising IDs.
6. Device-test first launch/no choice, decline, separate Android advertising
   opt-in, analytics opt-in, withdrawal/relaunch and upgrade from old versions.
   Observe network traffic, not just toggle state. Confirm sign-in, actual store
   purchase/restore, recording and preserved progress/celebrations without consent.
7. Test deletion success and failure/retry/provider-pending outcomes using only
   synthetic accounts against the new migrated API. A new binary connected to
   the old live API cannot prove the enhanced server erasure behaviour.
8. Reconcile Apple/Google forms against final binaries and **all active artifacts**.
   Intended next-build AD_ID declaration is No only after binary verification;
   old Android 94 has the permission/enabled Firebase collection defaults.

No native jobs, store uploads, production migrations or provider erasures were
started during this preparation. Owner/device proof and rollout approval remain.
