# Isolated website privacy release — 30 October 2026

## Exact reviewed source

- Production URL: https://summitready.uk (confirmed through deployment metadata).
- Released baseline: `714a5bc2c6626825776a500af5d60d58a41c2ac7`.
- Evidence: `live-evidence.json`, read from both JSON hosted-mobile manifests;
  clean source and creation date 28 October 2026. This identifies the hosted
  bundle's workspace source, not independently every website/API artifact or
  the binary currently installed from either store.
- Release branch: `release/policy-website-20261030`.
- Release commit: `78b3ba9be33603a58a8c8924d7b18a49d9c23054`.
- Parent: exactly the released baseline above.
- Pre-existing complete workspace backup:
  `backup/before-policy-release-20261030`,
  commit `a1cac298e693ec44daf7068f581811b99c5b0d28`.
- Both refs were pushed atomically to GitHub and confirmed by `git ls-remote`.
  No shared development branch was replaced, reset or checked out.
- Review diff:
  https://github.com/mcarey888-lang/new/compare/714a5bc2c6626825776a500af5d60d58a41c2ac7...78b3ba9be33603a58a8c8924d7b18a49d9c23054

`review.json` pins all four file hashes and the patch hash. `POLICY.txt` is the
readable reviewed policy, not a claim that publication happened. The Git commit,
patch and refs are durable; temporary build/checkouts can be discarded.

## Exactly four production-source changes

1. `artifacts/summit-landing/src/pages/Privacy.tsx`
2. `artifacts/summit-landing/src/components/WebsitePrivacy.tsx`
3. `artifacts/summit-landing/src/main.tsx`
4. `artifacts/summit-landing/index.html`

The release changes the policy and website analytics choice. There are **no**
native, API, database, training/paywall, pricing, progress-fill or celebration
source changes relative to its parent. No server-side consent enforcement,
enhanced deletion or new native control is deployed by these four files.

The policy explicitly distinguishes existing Android measurement, uncertain
automatic iOS SDK collection, and prepared-but-not-deployed native/server
controls. It describes known deletion gaps and provider review; it does not
guarantee erasure, invent a retention period, or claim all analytics is anonymous.
When the full privacy release really goes live, revise the rollout notice only
after deployment and device evidence, not simply after building a binary.

## Read-only verification

    node scripts/checkPrivacyRelease.mjs --remote
    git diff --stat 714a5bc2c6626825776a500af5d60d58a41c2ac7 78b3ba9be33603a58a8c8924d7b18a49d9c23054

The check verifies pinned content, backup, remote refs, rollout qualifications,
and no changes to the pre-existing native/API/database sources in development.
The baseline landing package manifest and dependency lock match development.
See `CHECKS.md` for build and test results and their limits.

## Safe publication route — approval still required

**Do not use normal Publish from the current development workspace.** It contains
the newer consent/deletion implementation, training flow and other work.

1. Use a dedicated publication checkout of the exact release commit, separate
   from this development working tree. Review the four-file GitHub diff and the
   full policy. Do not cherry-pick the entire current development branch.
2. Immediately before publication, reconfirm live manifests and independently
   the current landing/API artifact versions. If anything has advanced beyond
   the baseline, stop: rebase the *four-file change only* onto that newly
   verified released source and repeat review. Do not roll production backwards.
3. Build and preview that checkout with the pinned lockfile and reviewed
   deployment routing. Test website no choice/decline/accept/withdraw.
4. Replit Publish snapshots its publication workspace, not a branch selected by
   this report. A separate checkout alone does not reconfigure the existing
   deployment. An owner-approved publication workspace/handoff targeting the
   existing deployment is still required; none was activated here.
5. **Database gate:** reject every schema/data change for this policy-only
   release. Merely checking out old source does not remove newer development
   database changes from Replit's promotion diff. If the existing publication
   route cannot exclude those changes, do not use it for this website release.
   A genuinely separate static website publication can avoid database promotion,
   but domain/API routing needs separate approval; do not replace the existing
   multi-service deployment with a static site.
6. Only after owner approval publish the reviewed website source; then verify
   `/privacy`, website consent and unchanged API/hosted-mobile source fingerprints.
   This preparation does not publish, submit to stores or start native builds.

## Rollback

Keep both pushed refs and the exact release commit. Before any approved
publication record the actual preceding deployment/build ID and source versions.
For an incident, prefer a reviewed forward correction preserving website consent.
Rolling back all four files to the baseline also restores its older automatic
website analytics behaviour and July policy; that consequence needs approval.
Do not roll back the whole development branch, change customer data or undo
database changes to reverse this website-only release. After any rollback
recheck privacy text, consent, API and hosted mobile fingerprints.

## Full privacy release / next builds

Read `MIGRATION-AND-BUILDS.md`. Neither a website release nor a new store binary
applies the production schema or resolves provider-erasure decisions.
