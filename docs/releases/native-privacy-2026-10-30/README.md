# SummitReady full privacy release candidate — 30 October 2026

## Status and exact source

This is a **prepared full-app/API/website candidate**, not a publication or store
submission. The immutable release ref is `release/native-privacy-20261030`.
Record its resolved commit with the EAS build receipts; build that exact commit,
not a moving development branch. The preceding complete workspace is preserved
by `backup/before-native-privacy-20261030` at
`c413b57` (resolve the pushed ref for its full hash).

The latest previously observed store binaries are iOS 1.0.8 (73) and Android
1.0.8 (94), both EAS source `979716293b39abeb34da256fddfc641203f0c5e0`.
Their EAS FINISHED state is not proof of store upload or approval.

The candidate deliberately includes all current intended product source,
including the new fitness-questionnaire-before-Pro-unlock journey, expeditions,
ordinary hike recording, existing mountain progress fill, summit celebrations,
and GBP price work. No older source checkout or policy-only branch replaces it.
The first three curated expeditions and subsequent catalogue work are preserved.
UK targets remain Pro £9.99/month or £69.99/year (eligible 14-day trial),
Expeditions £4.99/month or £34.99/year (no trial). Native store product pricing
and verified eligibility remain authoritative; this preparation changes neither.

Review exact complete scope:

    git diff --stat 979716293b39abeb34da256fddfc641203f0c5e0 release/native-privacy-20261030
    git diff --name-status backup/before-native-privacy-20261030 release/native-privacy-20261030

The latter incremental diff contains tests, explicit retained-provider deletion
reporting, and this release documentation. The former also contains the already
prepared privacy, training and price work. The isolated four-file policy branch
`release/policy-website-20261030` remains unchanged and independently reviewable.

## Reviewed production database plan — NOT EXECUTED

`reviewed-publish-schema.sql` is the actual two-statement Publish schema diff
returned on 30 October, not permission to execute SQL directly.
The review reported no structural data loss, no backwards-incompatibility
warning, and no dropped/truncated tables, columns or schemas.

- Create the deletion-job ledger, including owner uniqueness and JSONB state.
- Add a nullable author-owner column to route contributions.
- No customer-data overwrite, guessed historical ownership, backfill or deletion.

Use the managed Publish migration review. Immediately before the later approved
rollout, recompute the diff and compare it with this file. Stop if it differs;
do not approve unrelated database changes. Do not run this SQL through a custom
migration, EAS job or startup hook.

Required order: approve the additive migration; verify the production table,
columns, defaults and unique-owner constraint; activate the matching API; smoke
check sign-in, essential reads/writes and unconsented relay rejection; then
release new clients after device testing. Website-only publication must have a
zero schema/data diff and must not claim to activate the API.

## Compatibility and release checks

- New Reddit requests include affirmative advertising consent; old clients
  without that field receive 403 from the candidate API. Measurement is
  best-effort: rejection cannot change membership or hiking outcomes.
- The existing DELETE `/api/user/me` URL/method remains. A legacy empty request
  body is accepted. Success still uses a 2xx response; new clients distinguish
  app-account removal from unresolved providers and lawful retained records.
- New fields are additive. Existing reads and customer records are not migrated.
  The deletion fence rejects writes only for an owner with a deletion request.
- Stored privacy choices that are absent or malformed grant nothing. No queued
  pre-consent conversion is replayed after opt-in. Older binaries' automatic
  Firebase behaviour cannot be switched off by a new website or server.
- Media failures precede record removal; database cleanup is transactional;
  failures remain retryable. Identity removal is not proof of provider erasure.
  A lawful retention decision is explicitly distinguished from erased data.
- Isolated synthetic tests exercise cleanup and non-owner isolation; no real
  customer account, purchase, media or provider deletion is used for testing.

Automated checks and build receipts are recorded separately. Device testing is
the owner's next step, not claimed complete by unit or mocked-browser tests.

## Build-only instructions

Use the pushed candidate commit, `baseDirectory: artifacts/summit-ready`,
`buildProfile: production`, and `autoSubmit: false` for each platform.
Production uses real store SDK configuration, unlike the Test Store preview
profile. Remote versioning supplies the next actual build numbers.

No source checkout, production migration, public rollout or store submission is
part of a build job. New binaries still connect to the existing production API;
do not claim the new server workflow works there before migration/API rollout.
Only synthetic test accounts may be deleted during subsequent device checks.

## Rollback and preservation

Record the actual previous production deployment ID before any later rollout;
none is fabricated here. Keep the additive table/column during rollback: do not
drop the request ledger or destroy pending erasure evidence. Prefer a corrective
API release retaining deletion fences. Rolling back to an old API while erasure
requests exist can allow writes to resume: that is not a safe automatic rollback.
Do not resurrect deleted customer records from a backup.

Build-only failures require no production rollback. To repair a candidate,
create a new pinned ref/build; preserve this ref and its receipts.
The backup preserves all intended pre-existing development work; never reset the
working tree or replace the shared development branch to publish this candidate.

## Owner/operational decisions (not fabricated technical guarantees)

- Approve the later production migration/API/website rollout separately.
- Device-test fresh install, upgrade from 73/94, no choice, decline, separate
  Android advertising choice, opt-in, withdrawal/relaunch, sign-in, subscriptions
  and restore, recording, mountain fill and summit celebrations.
- Designate a provider-erasure operator and approve actual lawful retention,
  provider agreements and health-data processing basis. No period is invented.
- Review final Apple/Google forms against compiled binaries and every active
  release, not just this candidate.
