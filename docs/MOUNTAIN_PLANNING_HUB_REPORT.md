# SummitReady existing mountain page — implementation report

## Scope and status

The existing mountain page has been extended, not replaced. The existing GPS recorder, canonical route reader, route eligibility rules, saved routes and map planner remain the underlying systems.

**Not fully implemented:** automatic route discovery/building, shared persisted provisional parking candidates, licensed offline map packs and correction reporting. There is no configured runtime route-building or offline-tile service in the audited project. The UI states these limitations instead of inventing jobs, geometry, download completion or Verified status.

Ben Nevis currently returns three stored **route guides**, not eligible canonical mapped records. The page preserves those guides, labels their mapping limitation and offers free recording/manual planning. It does not claim those guides are navigable.

## 1. Audit/reuse map and data flow

| Capability | Existing implementation reused | Change/boundary |
| --- | --- | --- |
| Explore → mountain | Existing Explore navigation and `app/mountain.tsx` | Original mountain screen and request identity retained |
| Mountain identity/facts | `POST /api/mountain-lookup`, canonical catalogue, mountain presentation helpers | Known facts displayed; missing facts hidden |
| Hero artwork | Existing approved/canonical mountain artwork and fallbacks | No new artwork system |
| Route definitions | Existing canonical route-record reader and versioned selection | Selection still expands inline; only exact eligible records enable navigation |
| Route trust | `routeIntelligence`, `routeEligibility`, immutable tracker handoffs | No weakening of geometry, rights, identity/version or verification checks |
| Parking | Existing operator listings and `/api/directions/lookup` | Explicit lookup; provisional candidates are map-only; confirmed coordinates can get directions |
| Shared GPS tracking | `app/hike-tracking.tsx`, owned active checkpoint storage | Guarded launch/resume; mountain-only metadata does not imply route navigation |
| Manual planning | Existing `app/route-planner.tsx` and embedded route-map message protocol | Focus near mountain; only an explicitly selected access point seeds a start |
| Saved routes | Existing `/trails-saved` library | Opened from Track mountain choices |
| Safety evidence | Existing canonical `SourcedValue` route facts | Route-specific notes retain publisher, valid source URL and retrieval date; no invented severity or verification |
| Offline information | Existing AsyncStorage | New exact-request public page cache and owner-scoped immutable route-data snapshots |
| Offline maps | Existing capability flag remains false | No tile caching, unsupported provider promise or fake package |

Data flow: original page parameters → existing mountain lookup → presented mountain/routes → selected exact canonical record → existing eligibility evaluation → immutable owner-scoped handoff → existing tracker. Cache fallback never substitutes a different mountain or route version.

## 2. Exact modified files

Paths below are relative to `artifacts/summit-ready/`, except the API path:

- `app/mountain.tsx` — section order, action grid, track choices, guarded launches, cache fallback, access lookup, safety/source sections, route-package controls.
- `app/hike-tracking.tsx` — mountain association for free recording, checkpoint restoration and local completed-hike metadata; no second recording lifecycle.
- `app/route-planner.tsx` — contextual focus/access start and exact private route-snapshot display, with source attribution and online-basemap notice.
- `components/mountain/RouteCard.tsx` — route-guide/mapped presentation, no prominent contribution badge.
- `components/mountain/SelectedRoute.tsx` — known facts, no unavailable DNA panel, walking-only route-start directions, real route-data/map actions.
- `utils/mountainDetailPresentation.ts` — deduplicate canonical aliases by identity/version, not by names of different route variants.
- `utils/hikeReliability.ts` — separate free-recording mountain association in the existing checkpoint type.
- `utils/openMaps.ts` — validated coordinate directions, Android navigation/Apple Maps/browser fallback and visible total failure.
- `utils/exploreJourneyShell.test.ts` — inline route selection remains required; explicit tracker/planner/library actions are allowed.
- `artifacts/api-server/src/routes/directions.ts` — additive `placeId`, OpenStreetMap source URL and actual lookup/confirmation timestamp.

## 3. New files and why

- `hooks/useMountainHub.ts` — reuse the existing recorder with owned active-activity and double-launch guards; manage private route packages without account-change leaks.
- `components/mountain/HubActions.tsx` — accessible primary action grid and track-choice sheet.
- `components/mountain/ParkingSection.tsx` — source/trust-aware parking and start controls.
- `components/mountain/InfoSections.tsx` — focused safety, about, facts, downloads, sources and unavailable-correction presentation.
- `utils/mountainHubStorage.ts` — exact-context offline page information and immutable owner/route/mountain/version-scoped route data; serialized save/remove.
- `utils/mountainAccess.ts` — validate and present the existing parking lookup without treating summit coordinates or provisional parking as driving destinations.
- `utils/mountainSafety.ts` — retain real evidence with route-specific notes; plain generated hazard text is not an evidence record.
- `utils/mountainHubStorage.test.ts` — cache identity, snapshot eligibility/immutability, account/version isolation, deletion ordering, parking trust and route alias coverage.
- `utils/openMapsDirections.test.ts` — native scheme, browser fallback, invalid coordinates and visible failure checks.
- `utils/mountainSafety.test.ts` — reject unsupported hazard strings and preserve evidence without creating severity or Verified status.
- This report — audit, limitations, verification and native manual checklist.

## 4. Database and deployment

**No migrations, schema push, production database writes, dependency upgrades, new recorder, publishing or Git push.**

The parking confirmation table is reused without schema changes. A provisional mapped lookup is not inserted into the GPS-confirmed table. Shared provisional candidate persistence and reusable build-job infrastructure remain unimplemented, rather than misusing existing evidence tables.

Route packages and page caches are local, not a new cloud database or cross-device synchronization system. A downloaded route record is a snapshot as of its saved date, not proof that conditions or approval have remained current.

## 5. APIs

No endpoint added. Existing request shapes and routes retained.

`POST /api/directions/lookup` has additive source/identity/time fields. Its `gps_confirmed`/`internet_lookup` meanings are unchanged. Existing mountain, route-record, directions verification and tracker APIs are not replaced.

## 6. Sources, rights and providers

- Mountain facts/route identities: existing Summit Data Engine records and provenance. No claim that legacy cached/AI guides are canonical.
- Parking candidates: existing OpenStreetMap lookup, source feature links and ODbL attribution. Coordinates indicate a mapped feature, not legal parking, suitable access or an entrance guarantee.
- Confirmed parking: existing server-side place resolution and GPS-confirmation boundary. GPS proves arrival, not access rights/opening hours.
- Operator listings: existing National Trust listings and grid references; no entrance coordinate is invented.
- Route shape: only canonical records whose existing eligibility checks accept explicit reusable geometry rights. Full original provenance is retained in saved packages and source attribution is shown in the map viewer.
- Safety: only structured evidence-backed facts. Missing source URLs/dates are not fabricated; missing severity is explicitly unassessed.
- Basemap providers: existing renderer/providers unchanged. Their online rendering does not grant offline redistribution rights.

## 7. Deliberate feature boundaries

- **Automatic route generation:** unavailable. Find routes refreshes the existing library and reports the unavailable discovery boundary. It creates no fake build and cannot award Verified.
- **Parking discovery:** existing OSM lookup connected for verified mountain coordinates. Provisional results have source/map actions and caveats, not driving directions. Operator listings remain search/source links. Shared provisional result persistence is not added.
- **Offline route data:** actual local save/update/remove of eligible exact canonical records, with size/saved date. Route DATA is separate from map tiles and Add to Plan.
- **Offline map packs:** unavailable; flag remains false, recording remains available.
- **Correction reporting:** unavailable text, not a dead submission button.
- **New-version notification:** no server/index-based update monitor is added. Updating a selected saved snapshot is real; automatic notification of a newly published route version is not claimed.
- **Weather/current notices/hazard enrichment:** no new external service. Evidence notes are not a complete safety assessment.

Hidden when unavailable: unknown mountain facts, Start/navigation for guides or review-required geometry, driving directions without confirmed access coordinates, missing DNA comparison and map-tile download actions.

## 8. Verification

- 19 new helper tests pass: page/cache/package/parking/alias, native linking and hazard evidence.
- Existing mountain presentation, eligibility, active-hike ownership/reliability and Training/Expedition/Track shell checks were run alongside the additions.
- Existing API mountain/directions checks: **23 pass**.
- Mobile TypeScript check: **passes**.
- API runtime bundle: **builds and starts**, serving port 8080.
- Expo web bundle: **builds and serves**; relevant workflows restarted once after the implementation batch.
- API whole-project typecheck: blocked by unrelated errors in activity-link/artwork tests and existing service code; changed directions code produces no reported error.
- Full pre-existing mobile test command initially reported 751 pass / 3 fail. One obsolete mountain-navigation assertion was updated for the required explicit planner/library actions. The two unrelated Explore mode-toggle assertions remain outside this change; do not interpret the full project as green.
- No lint command is configured for this Expo artifact; no lint tool was installed.
- Signed-in/native GPS, background recovery, real OS directions and real tile failure require the device checklist below. Browser verification does not prove those.

Browser journey **passed** at 402px: public Ben Nevis → Track choices → existing free-hike ready screen with the correct mountain name. No recording was started/saved. Blocking mountain-lookup and hill-detail still allowed the saved page and Track choices to load. Guide navigation gates, missing-fact hiding, no-coordinate parking and unsourced-hazard/offline-map notices were also verified.

The screenshot capture proxy resolves the Expo host to the unrelated landing app in this workspace. Use the tester's actual local-Metro screenshots as evidence, not the proxy's 404 screenshot. Signed-in recovery and native directions remain device-only checks.

## 9. Native/manual checklist

Run with a test account on **both iOS and Android**, without deleting existing activities:

1. **Ben Nevis stored guides:** original Explore result opens this page; hero/name, three guides and 2×2 actions appear. No guide Start/navigation or unsupported Verified badge; no missing-fact table.
2. **Canonical mountain with no routes:** explicit library refresh/discovery-unavailable explanation; manual planning and free recording still work.
3. **No parking / no summit location:** no invented pin or driving action; nearby map search remains available.
4. **GPS-confirmed parking:** source/name/check time visible; Get directions uses parking coordinates, never summit coordinates.
5. **Provisional mapped parking:** map/source/caveat only; no Get directions.
6. **Selected route start:** walking-only directions; text says not confirmed parking. Explicit access start seeds personal planner; ordinary mountain focus does not seed the summit as a start.
7. **High-risk/review-required scrambling record:** evidence/Needs review may be read; no automatic Verified or Start from candidate geometry.
8. **Airplane mode:** previously opened mountain information remains; exact previously saved eligible route record can be read; free GPS recording remains independent of tiles. Record-data download is not labelled an offline map.
9. **Map provider failure:** page facts/routes/access notices remain available; free recorder is not blocked by basemap failure.
10. **Route-build unavailable/failure:** no synthetic progress/job, guessed geometry or fake success; manual/free alternatives remain.
11. **Free hike:** shared recorder receives name and optional mountain association, not canonical route-navigation intent; real GPS points/timer/pause/save still operate.
12. **Mapped route:** exact immutable context reaches the same recorder; planned geometry is separate from recorded GPS and evidence.
13. **Active activity:** tracking, paused and pending-finish owned checkpoints resume rather than compete; repeated taps do not launch twice. Existing recovery expiry policy remains unchanged.
14. **Route-data package:** save, inspect actual size/date, relaunch/read, update and remove; reject wrong owner/mountain/version and missing/unclear-rights geometry.
15. **Account switch:** no previous owner's route snapshot/package or active checkpoint appears under the next account.
16. **Android/iOS links:** correct native app opens; without it, browser fallback opens the same exact destination; with both unavailable, failure is visible.
17. **Sources/safety:** publisher/URL/date retained where supplied; no invented last checked, confidence, severity or verified hazard.
18. **Existing modes:** Training and Expedition completion/history/credit paths remain their original shared recorder behavior.