# SummitReady Explore — Restore Full Discovery Architecture

**Command:** EX3-C01
**Authority:** ChatGPT lead product/design/architecture
**Baseline:** 2d6b36cb12a5706b74100e11b1f237e0a7a8ce1d
**Priority:** Capability restoration before further visual polish
**Stage 9:** PAUSED / NOT AUTHORIZED

## Objective

Keep the new Explore V2 premium visual direction, but restore the depth of SummitReady discovery. The V2 redesign must not reduce Explore to the small local `CURATED_HILLS` demo/route set.

Explore should present one coherent discovery experience over:
1. the Summit Data Engine canonical mountain catalogue;
2. curated/verified route data where available;
3. the existing AI mountain lookup/fallback capability where canonical data is unavailable or insufficient.

Do not create a new mountain database or duplicate existing systems.

## EX3-C01 — Audit before editing

Trace the pre-existing mountain discovery/search/AI lookup implementation across the repository and document:
- existing UI/routes/components;
- API endpoints/services;
- Summit Data Engine search/catalogue access;
- AI fallback behavior and provider;
- provenance/verification flags;
- route linking;
- any functionality hidden or disconnected by Explore V2.

Use code as source of truth. Do not assume the old `CURATED_HILLS` screen was the complete prior system.

## EX3-C02 — Restore canonical catalogue discovery

Connect premium Explore search/browse to the existing Summit Data Engine rather than limiting discovery to `CURATED_HILLS`.

Requirements:
- canonical mountain identity remains `mountains.id`;
- preserve SDE provenance and classifications;
- search should expose the full appropriate published/searchable catalogue available through the existing SDE implementation;
- do not load tens of thousands of records into the client at once;
- use existing server-side search/pagination/query patterns where available;
- curated routes remain useful enrichment, not the catalogue boundary;
- route cards/detail links must preserve existing route identity/version semantics.

The small curated set may still be used for editorial Featured content if appropriate.

## EX3-C03 — Restore AI lookup/fallback

Find and reconnect the existing AI mountain lookup/fallback path.

Expected behavior:
- canonical/SDE results are primary;
- if a user searches for a mountain with no adequate canonical result, expose the existing AI lookup/fallback affordance;
- AI-derived geographic/mountain information must be clearly labelled as AI-derived/unverified according to the established product rule;
- do not silently promote AI output into trusted canonical SDE data;
- do not auto-merge AI results with canonical mountains by name;
- retain provenance;
- if the prior AI lookup requires explicit user action, preserve that safety pattern.

If the prior capability no longer exists in runnable form, STOP before inventing a replacement. Report exactly what existed and what is missing.

## EX3-C04 — Premium UI integration

Do not revert the Explore V2 visual redesign.

Integrate the restored content architecture into the premium visual system:
- Featured Mountains = editorial/curated discovery;
- search = full mountain discovery;
- results clearly distinguish mountain catalogue results from routes where useful;
- verified/curated information receives appropriate trust treatment;
- AI fallback appears naturally only when needed;
- retain cinematic photography and rich mountain surfaces;
- avoid turning Explore back into a dense database/list UI.

The supplied Explore mock-up remains the visual specification.

## EX3-C05 — Search states

Verify at minimum:
1. known SDE mountain with curated route(s);
2. known SDE mountain without curated route;
3. search returning multiple mountains;
4. no canonical result → AI lookup affordance;
5. AI result state with clear provenance;
6. loading;
7. offline/network failure;
8. empty/error;
9. long mountain names;
10. pagination/load-more where applicable.

Offline/network failure must not misrepresent remote search as “no mountains exist.”

## EX3-C06 — Preserve boundaries

Do not:
- modify or replace the Summit Data Engine schema;
- run production migrations;
- create a second summit table/catalogue;
- change canonical IDs;
- publish AI-generated geographic data into trusted SDE records;
- modify Readiness algorithms;
- modify tracking/activity architecture;
- modify protected Progress Mountain/cinematic files;
- change payments/auth;
- begin Track/Expeditions/You redesign;
- begin Stage 9.

No destructive work.

## EX3-C07 — Regression rule

Add/document a regression principle:

> Visual redesigns must preserve existing product capability unless removal is explicitly authorized.

Add targeted tests that would have caught the V2 regression: Explore must not be bounded to the small `CURATED_HILLS` collection when canonical catalogue search is available, and the existing AI fallback path must remain reachable under its intended conditions.

## EX3-C08 — Visual QA

Render the restored Explore experience at phone dimensions. Inspect:
- premium V2 appearance retained;
- canonical search does not visually overwhelm the screen;
- full catalogue feels discoverable;
- AI fallback is obvious but secondary;
- provenance is understandable;
- route/mountain distinctions are clear;
- no fake data.

Do at least one self-correction pass if integration damages the visual hierarchy.

If browser PNG persistence remains unavailable, record capture IDs and continue; product owner will perform final visual acceptance.

## EX3-C09 — Verification

Run targeted tests, TypeScript, bounded regression and relevant Expo exports.

Create:
`docs/EXPLORE_DISCOVERY_RESTORATION_REPORT.md`

Report:
- exact prior capability discovered;
- root cause of V2 capability loss/disconnection;
- canonical SDE endpoint/data path now used;
- AI fallback path/provider and provenance behavior;
- files changed;
- tests;
- visual QA evidence;
- any remaining limitations.

Update AI_HANDOFF and AI_CHANGELOG.

Commit/push and STOP. Do not perform the cosmetic Explore polish pass yet.

End with exactly one status:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
