# Stage 7 — Mountains, Routes & Mountain DNA

**Authority:** Product owner has authorized Stage 7 development.  
**Branch:** `virtual-expeditions-mode`  
**Stage 6 baseline:** `67c8db5b26f2698297c9e7af77d4cf7dadf92684`

## Objective

Turn SummitReady's existing mountain data into a trusted route intelligence layer that powers Explore, Training and Expeditions without duplicating mountains, inventing geography, or disturbing the working GPS/offline tracker.

Stage 7 should make SummitReady able to answer:

> What mountain/route is this, how trustworthy is the route data, and how closely does this local route match the mountain I am preparing for?

The user-facing differentiator is **Mountain DNA**: an explainable route-to-route similarity model using verified deterministic route facts.

## Product model

One canonical mountain may have multiple routes. A route is not a recorded activity.

```text
SUMMIT DATA ENGINE MOUNTAIN
  → ROUTE IDENTITY
    → VERSIONED ROUTE DEFINITION / FACTS
      → ROUTE GEOMETRY + ELEVATION PROFILE
        → MOUNTAIN DNA

PHYSICAL ACTIVITY
  → recorded GPS trace/evidence
  → may reference canonical mountain/route
  → never overwrites canonical route geometry
```

Training, Expedition and Explore consume this shared mountain/route intelligence; they do not create competing mountain catalogues.

## Protected boundaries

### Summit Data Engine — PROTECTED
The existing curated catalogue (21k+ mountains) is the canonical summit asset. Integrate with it; do not replace, copy, destructively migrate, fuzzy-merge, or discard it.

Use stable identities:
- `sde:mountain:<mountains.id>`
- `sde:route:<route_identities.identity_key>@<version>`

Do not use display names, slugs, app serial IDs, or spreadsheet row numbers as cross-catalog identity.

Preserve provenance, verification status, source hashes, licences/attribution and versioning. AI must not invent coordinates, geometry, elevation facts, route names, or verification.

### GPS/offline tracker — PROTECTED
The existing tracking infrastructure is working and is now a protected subsystem.

Stage 7 may consume activity/route evidence and pass stable route context into the existing tracker. It must NOT redesign, replace, or materially alter the GPS engine, active-session lifecycle, offline checkpoints, pause/resume/finish/save flow, outbox/sync semantics, or canonical physical-activity identity unless a concrete blocker is documented and approval is obtained.

### Progress Mountain / cinematic — PROTECTED
Do not replace, remove, substantially redesign or regress the Stage 6 compact→expanded Progress Mountain or protected summit/cinematic/live-3D completion sequence.

### Production — FROZEN
PA-A2 remains parked. Replit Support has proposed a separate workaround involving four production unique indexes, but that is NOT part of Stage 7.

No production SQL/schema migration, production flags, backfill, reconciliation, consumer switch, deployment, mobile/store release, auth/payment/privacy change, or destructive data operation is authorized.

## Route trust lifecycle

Keep route trust explicit:

```text
Generated / Planned
→ Recorded
→ Community-confirmed
→ SummitReady Verified
```

A single user's GPS recording does **not** automatically make a route SummitReady Verified.

Canonical route geometry and actual walked GPS trace remain separate objects.

Where existing SDE verification terminology differs, audit it first and map rather than silently renaming persisted states.

## Mountain DNA principles

Mountain DNA compares a candidate/local route against a target route using deterministic, provenance-backed facts. It is not an AI opinion.

Initial explainable dimensions should be audited against available data before final weights are fixed. Expected dimensions include:

- elevation/ascent demand;
- distance;
- steepness/grade profile;
- terrain/technical character where genuinely sourced;
- optionally altitude/exposure/profile shape only where trustworthy data exists.

Example presentation only:

```text
96% MOUNTAIN DNA MATCH
Elevation   100%
Distance     94%
Steepness    98%
Terrain      87%

Why this route?
```

Do not manufacture a dimension when the source data is missing. Return explicit unknown/degraded confidence instead. Overall score must not imply precision unsupported by evidence.

Mountain DNA is route-to-route matching first. Mountain-level matching may select a documented representative/default route only when that relationship is explicit and stable.

## Data sources

Prefer existing SDE provenance and verified route facts. Existing OSM/Copernicus DEM pipeline may be reused where licensed/provenance-safe. Any route generation must be deterministic and separately labelled from verified routes.

No AI-generated geographic facts.

## Command protocol

Every response is `S7-Rxx`, explicitly states the previous result reviewed, lists implementation/files/tests/risks/commit, and ends with exactly one status:

`COMPLETE`, `PARTIAL`, `BLOCKED`, `FAILED`, or `APPROVAL REQUIRED`.

Commit and push each meaningful checkpoint. Continue autonomously through GREEN commands. Stop at S7-C10 or sooner if an AMBER/RED decision is required.

### S7-C01 — Mountain/route architecture audit

Audit, do not redesign yet.

Map:
- SDE mountain, route identity, route definition/facts, geometry, elevation profile and provenance models;
- existing app `canonical_hills`, `canonical_hill_routes`, Training routes, Expedition routes and Explore route surfaces;
- every current mountain/route lookup and stable-ID boundary;
- route verification/trust states and evidence;
- OSM/Copernicus/DEM pipeline and existing Tryfan review outputs;
- route metrics already available vs missing;
- activity→route linking;
- map/offline route caching;
- duplicate/dead/legacy route stores;
- exact protected tracker boundaries;
- production/schema implications.

Identify the lowest-risk integration path that makes SDE canonical without destructive migration.

Create `docs/STAGE_7_MOUNTAIN_ROUTE_AUDIT.md`.

### S7-C02 — Canonical route intelligence specification

Define the typed contracts and lifecycle for:
- Mountain;
- RouteIdentity + version;
- RouteDefinition/Facts;
- RouteGeometry;
- RouteElevationProfile;
- provenance/attribution;
- trust/verification state;
- activity route reference;
- Training target route;
- Expedition local-stage route;
- Explore route.

Define exact behavior for missing/ambiguous/unverified data and version changes. No fuzzy identity.

Create `docs/STAGE_7_ROUTE_INTELLIGENCE_MODEL.md`.

If implementation requires destructive SDE changes, a new production migration, weakening provenance, or tracker redesign: **APPROVAL REQUIRED**.

### S7-C03 — Shared read-only route intelligence layer

Implement the minimum typed read/select layer needed for app consumers.

Requirements:
- stable SDE IDs/versioned route IDs;
- provenance and verification exposed;
- deterministic missing/degraded states;
- no duplicate summit catalogue;
- no production activation;
- compatibility adapters only where necessary;
- focused tests.

This layer should allow Explore/Training/Expedition to refer to the same canonical mountain/route facts without changing their separate journey state.

### S7-C04 — Deterministic Mountain DNA engine

Implement a pure, versioned Mountain DNA evaluator.

Requirements:
- deterministic;
- route-to-route;
- uses only trustworthy available facts;
- dimension scores + overall score + evidence/confidence/degraded state;
- explicit missing dimensions;
- no AI geography;
- no network/clock/randomness inside evaluator;
- version identifier in result;
- tests for exact match, partial match, missing data, unverified data, extreme values and deterministic repeatability.

Document formula/weights/rationale. Do not tune scores merely to make examples look impressive.

### S7-C05 — Route matching service

Build bounded candidate matching around Mountain DNA.

Requirements:
- stable target route identity;
- candidate routes filtered by valid provenance/geometry/facts before scoring;
- deterministic ordering/tie handling;
- explain why each route matched;
- never fuzzy-merge mountain identity;
- unknown data lowers confidence rather than being invented;
- allow future geographic/radius filters without coupling them to scoring;
- no production switch.

### S7-C06 — Mountain/route detail UX

Create/refine the shared mountain/route detail experience so a user can understand:
- mountain identity and key facts;
- available routes;
- verification/trust label;
- distance/ascent and supported route characteristics;
- source/attribution where appropriate;
- Mountain DNA when viewed in Training/target context;
- clear `Why this route?` explanation;
- Track action that launches the **existing protected tracker** with stable route context.

Use the established premium outdoor visual language. Avoid SaaS-dashboard clutter.

### S7-C07 — Training + Explore integration

Wire the shared route intelligence into Training and Explore without merging their journeys.

Training:
- target mountain/route is explicit;
- local route recommendations use Mountain DNA;
- explain the match;
- Readiness 2.0 remains authoritative and unchanged except consuming already-approved route demand facts through its stable boundary.

Explore:
- browse/discover canonical mountains/routes;
- route trust visible;
- Track uses existing tracker;
- a completed activity may reference the canonical route but does not alter route geometry or verification automatically.

### S7-C08 — Expedition integration

Use the same route intelligence for Expedition local stages.

Requirements:
- Expedition simulated progress semantics remain unchanged;
- selected local stage has stable canonical route reference where available;
- Mountain DNA may explain why a local stage is a good analogue;
- one physical activity remains one activity;
- Stage 6 selected-stage contribution and summit completion authority remain unchanged;
- compact/expanded Progress Mountain and cinematic untouched.

### S7-C09 — Regression and protected-boundary review

Run bounded then full relevant regression.

Verify:
- GPS/offline tracker behavior has not been redesigned/regressed;
- canonical activity identity/dedupe;
- Stage 5 Readiness 2.0;
- Stage 6 Expedition progress/contribution/summit authority;
- Elevation Bank real-vs-simulated semantics;
- Training/Expedition mode isolation;
- SDE provenance/stable identities;
- Mountain DNA determinism and degraded states;
- route geometry vs GPS trace separation;
- protected Progress Mountain/cinematic;
- auth/payment/privacy;
- production default-safe;
- PA-A2 remains isolated.

Run relevant package tests, API tests, typechecks/build and diff safety. Native-device QA remains a release gate and does not block Stage 7 completion unless Stage 7 materially changed protected tracking behavior.

Create `docs/STAGE_7_REGRESSION_REVIEW.md`.

### S7-C10 — Completion gate

Create `docs/STAGE_7_COMPLETION_REPORT.md` and update `docs/AI_HANDOFF.md` + `docs/AI_CHANGELOG.md`.

Stage 7 is complete only if:
- one stable canonical mountain/route intelligence model is used across consumers;
- SDE is integrated, not duplicated/replaced;
- route provenance/trust is explicit;
- Mountain DNA is deterministic/explainable and honest about missing data;
- Training/Explore/Expedition consume shared route intelligence without losing mode separation;
- activities never overwrite canonical route geometry;
- existing GPS/offline tracker remains protected;
- Stage 6 Progress Mountain/cinematic remains protected;
- production is unchanged;
- tests/regressions pass or limitations are explicitly documented.

Report native-device QA status separately.

**STOP after S7-R10. Do not start Stage 8.**

## Authorization

### GREEN — proceed autonomously
Audits, documentation, typed contracts, pure evaluators, read-only/adaptor services, additive UI/refactoring, tests, non-production development work that preserves all protected boundaries.

### AMBER — stop and request review
Substantial new navigation, material changes to Mountain DNA product semantics after audit, significant persistent model redesign, or changes that alter existing released user behavior beyond the scope above.

### RED — explicit product-owner approval required
Production DB/schema/SQL, backfill/reconciliation, production flags/activation, release/publishing, payments/pricing, auth/privacy, destructive SDE changes, canonical identity migration, GPS/offline tracker redesign, Progress Mountain/cinematic replacement/substantial redesign.

## Completion discipline

Do not use Stage 7 as permission to clean up unrelated systems. Prefer narrow changes and existing infrastructure. If existing working code already satisfies a requirement, document and reuse it rather than rewriting it.
