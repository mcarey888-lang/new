# Build-only receipts — 30 October 2026

## Verified source and preservation

- Candidate commit: `70ee31cacf863aa127f1d5667d108f5f0441ae76`
- Pushed immutable ref: `release/native-privacy-20261030`
- Pushed preceding-work backup: `backup/before-native-privacy-20261030`
- Backup commit: `c413b5735989eabfe6960d18ae9500c24472bb97`
- Existing policy-only ref remains `release/policy-website-20261030` at
  `78b3ba9be33603a58a8c8924d7b18a49d9c23054`.

## Jobs accepted by Expo

Both requests explicitly used `autoSubmit: false`, production profile,
`artifacts/summit-ready` base directory and the candidate's full commit hash.
Both subsequent build-info records confirmed that exact source, STORE
distribution and production profile.

| Platform | Build ID | Creation time (UTC) | First observed state |
|---|---|---|---|
| iOS | `1b0d1523-20d7-430b-9e75-246342abbd2e` | 2026-10-30 15:48:01 | IN_QUEUE |
| Android | `062e4e0e-ca7c-4c49-ac6d-d62a8411cd74` | 2026-10-30 15:48:05 | IN_PROGRESS |

On the subsequent check, both jobs were **IN_PROGRESS**. Android had allocated
**1.0.8 (95)**; iOS had not yet returned its version/build number.
Do not guess the iOS number, and do not mistake job acceptance for completed native
compilation, final manifest verification, artifact availability, store upload,
TestFlight/Play processing or public rollout.

Track:
- https://expo.dev/accounts/careyappss-organization/projects/summitready/builds/1b0d1523-20d7-430b-9e75-246342abbd2e
- https://expo.dev/accounts/careyappss-organization/projects/summitready/builds/062e4e0e-ca7c-4c49-ac6d-d62a8411cd74

The Expo project UUID is `433cf0ca-b8a7-4472-a5bf-7adadc9c38ef`; the IDs above
are authoritative if a dashboard slug changes.

## Not performed

No automatic/manual store submission, production deployment, production
migration, customer-data cleanup or real provider erasure. New jobs are not
evidence that the live policy/API or older installed apps have changed.
Real-device testing and final compiled-manifest/SDK verification remain after
successful compilation; provider operational decisions remain in DISCLOSURES.md.
