# SummitReady OS day-map plumbing

## Release status

The plumbing is implemented, but **offline maps are not release-verified**.
`CAPABILITIES.routeOfflineDownload` remains false. No real iPhone or Android
device was available for testing. Native JavaScript compilation is not device proof.
No migrations, schema changes or capability-enabling commit were made.
Pushing this work for review does not enable offline maps.

## Implemented

- Imported the three supplied decision modules unchanged, preserving their
  22-hour cache window and the union of test-script filenames.
- Added SDK 54-compatible expo-file-system and NetInfo dependencies.
- Added a server-only OS Outdoor_3857 tile proxy with grid validation, bounded
  request budgets, PNG validation, no-store responses and key-safe error handling.
  A live development request returned HTTP 200 and 114,578 image bytes.
- Added document-directory downloads and persisted original fetched-at timestamps.
  Route coverage and missing downloads use the supplied helpers. Renderer writes
  and modified file dates never renew downloaded-tile ages.
- Added actual-byte checks, deduplication, cancellation checks, bounded storage,
  crash-orphan cleanup and startup/foreground/active-app expiry sweeps.
- Added disposable native UrlTile render directories, early display expiry,
  background removal and clock-jump handling. Deletion failure rejects map preparation.
  No tileCacheMaxAge-based licence enforcement is used.
- Added an inline development-only download/preview on eligible canonical route
  details, using the supplied readiness message unchanged before Start. No tile
  counts are shown and Start never waits for map work.
- Added the layer to the existing native map components; iOS uses the default
  Apple provider. Production rendering remains disabled while the capability is false.

OS Outdoor is the Web Mercator layer supported by this renderer. It is **not**
Explorer/Leisure, whose British National Grid tile scheme is incompatible with
this simple native XYZ setup. No permanent OpenStreetMap offline fallback exists.
Apple/Google basemaps must not be represented as such a fallback.

## Review fixes

- Increased the paid-proxy limits to **6,000 requests per IP per minute** and
  **24,000 globally per minute**. Tests cover a 4,000-tile route with browsing
  headroom and three concurrent maximum-sized routes. Rejected requests do not
  consume the remaining global allowance.
- Local 429 responses report the actual remaining window in `Retry-After`.
  Upstream 429 delays are forwarded when valid; missing delays default to 60 seconds.
  The OpenAPI response documents the header.
- Native downloads honour seconds and HTTP-date delays, wait cancellably and
  retry the same tile, keeping previously downloaded files and original ages.
  Five attempts per tile is the bound; persistent throttling reports an explicit
  error and preserves partial progress for a later resume. Other failures are not
  silently retried. Native cancellation is drained before removing partial files;
  timestamped interrupted staging files are also swept.
- Startup prefers a complete, validated pending manifest, then falls back to an
  intact main manifest if pending JSON is torn. Real-file tests simulate a crash
  after removing the main manifest and verify recovery with unchanged timestamps.
  This does not assume that Expo's cross-platform overwrite is atomic.
- The existing application already sets `trust proxy: 1`. Mock HTTP requests with
  different forwarded addresses resolve separately under that setting. This is
  **not proof of the published deployment's actual forwarding chain**; that remains
  an explicit verification gap. No real client addresses were added to logs.
- Development builds log `OS day-map display prepared` with `elapsedMs` and
  `copiedBytes`. Elapsed time includes the serialized wait and display preparation,
  not just file copies. These are measurement hooks, **not handset timing results**.
  Real-phone foreground performance and peak disk usage remain unmeasured.

## Verification

| Check | Result |
| --- | --- |
| Supplied decision-module tests | 90 passed |
| Real-temporary-filesystem tests | 17 passed |
| Retry/delay/cancellation tests | 7 passed |
| OS proxy and rate-budget tests using mocked upstream responses | 15 passed |
| Mobile TypeScript | Passed |
| Native JavaScript/Hermes export | iOS and Android passed |
| API production build | Passed |
| Live OS proxy request | HTTP 200, PNG bytes |
| Full mobile npm test after follow-up cleanup | 875 passed, 2 failed |
| Real-device download/sweep/drawing | Not tested |

The filesystem tests advance an **injected clock** by the full cache window and
assert the actual temporary tile files have been deleted. They also cover future
timestamps after clock rollback, restart cleanup, renderer isolation, a late native
callback's recreated directory, failed deletion, empty/missing files, fetch failure,
offline/aborted downloads and NetInfo mapping. The review adds mid-download 429
recovery, bounded throttling with cheap resume, pending-manifest crash recovery,
torn-manifest fallback and expired staging cleanup. This is not a phone clock-change test.

The accidental elevationProfileLive filename has been removed from scripts.test
as requested. Its source-scanning tests target a live chart marker on the other
branch, not offline maps; no chart implementation commit was cherry-picked.
The only remaining failures are:

- utils/exploreJourneyShell.test.ts > Explore > uses the shell's shared mode toggle rather than a screen-local copy
- utils/journey1Correction.test.ts > the mode toggle has one shared position > screen headers do not create another toggle

Missing pure prerequisite modules/tests were imported, not older recorder/profile
changes. The mobile typecheck still passes. API typecheck errors are confirmed
pre-existing by the branch author and have been left untouched.

OpenAPI generation completed. Its workspace-wide typecheck still fails on
shared-library typing issues. API-wide TypeScript also reports errors outside
the OS proxy files; no OS proxy/test-file diagnostics remain. Neither check is
reported as passing. Regeneration's change to the existing binary community-photo
upload was removed so it still sends raw bytes, not JSON.

## Known gap: the shared recorder

The existing shared hike recorder uses its own embedded web map. It has not been
converted to the native UrlTile view and does not consume this native day cache.
Opening its standalone page without recorder GPS messages correctly waits for GPS;
that screenshot is not a successful offline-map test.

The user explicitly left the web recorder out of this job. Do not claim it is
covered by the native cache or require its conversion as part of this work.
Any future integration must preserve the existing GPS, recovery, activity and
evidence systems.

## Real-device release checklist

1. Rebuild/install compatible native clients with the new native dependencies.
2. On a real iPhone with Apple Maps and a real Android device, select an eligible
   mapped GB route. Confirm actual downloads and a repeat download reuses fresh bytes.
3. Disable connectivity. Pan/zoom across the downloaded route and verify actual
   OS pixels, alignment, attribution, cache paths and gaps without network requests.
4. Advance each phone's clock beyond 22 hours, foreground the app and inspect disk.
   Expired authoritative and render bytes must be removed, and no expired OS layer
   may remain drawable. Repeat while the app stays awake and across background/resume.
5. Roll the clock backwards. Future timestamps must not create a fresh cache.
6. Simulate partial connectivity and storage/deletion failure. Confirm accurate
   readiness text and no stale drawing. Confirm Start and GPS recording remain immediate.
7. Document exactly which native views were verified; do not describe the web
   recorder as offline-supported. Its integration is outside this job.
8. Download a real long route on good wifi. Force a 429, confirm its entire
   Retry-After interval is observed, then automatic resume without refetching
   already completed tiles. Cancel during the wait and check immediate cancellation.
9. On each phone, record foreground `elapsedMs` and `copiedBytes` for a roughly
   1,000-tile route and inspect peak disk while render leases coexist. Verify the
   iPhone actually reads the Apple Maps UrlTile cache offline.
10. Verify the published proxy chain attributes different clients correctly
    without exposing keys or logging raw client IPs. The current one-hop trust
    setting must match the actual deployment topology.
11. Only after recording the evidence, enable the capability in its own commit.
   Until then, retain the development label and false release flag.