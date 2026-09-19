# Stage 7 Mountain and Route Architecture Audit

**Checkpoint:** S7-C01 / S7-R01  
**Scope:** audit only; no product, protected tracker, SDE schema, production, or
consumer changes were made.

## Status

**PARTIAL**

The repository contains a strong, independently managed Summit Data Engine
model and several app route pipelines, but it does not yet have one read-only
SDE adapter consumed by the app. The lowest-risk next step is an additive
server-side read boundary. Destructive consolidation, identity migration,
production schema work, and tracker changes remain outside Stage 7
authorization.

## 1. Canonical SDE model and identity

The standalone `summit-data-engine` is the authoritative curated catalogue.
Its README explicitly separates its database (`ENGINE_DATABASE_URL`) and
migration ownership from SummitReady. The domain and persistence contracts are
in:

- `summit-data-engine/src/summit_data_engine/models/domain.py`;
- `summit-data-engine/src/summit_data_engine/db/models.py`;
- `summit-data-engine/alembic/versions/0002_evidence_rights_and_versioned_routes.py`.

The model includes:

- mountain/source-bundle records and release source facts;
- `RouteIdentity` with `identity_key`, `version`, `mountain_key`, canonical
  name, aliases, and status;
- versioned `RouteDefinition` and its evidence;
- versioned `RouteFact`;
- `RouteGeometry` with ordered source members, direction, derivation method,
  and PostGIS LINESTRING/SRID 4326 representation;
- elevation profiles and DEM tile/profile source joins;
- mountain verification, evidence sources, QA, source hashes, licence,
  attribution, retrieval metadata, and rights classification.

Identity/version constraints are unique at each layer: identity
`(identity_key, version)`, definition by route identity/version, geometry by
definition/version, and facts by definition/version. Immutable triggers protect
identity, status, definitions, geometry, source, and DEM metadata.

The Stage 7 cross-catalog forms are:

```text
sde:mountain:<mountains.id>
sde:route:<route_identities.identity_key>@<version>
```

Display names, slugs, app serial IDs, spreadsheet rows, or GPS activity IDs
must not be substituted for these identifiers. Existing app keys such as
`route:v1:osm:*` and `route:<slug>` are compatibility identifiers until an
explicit mapping exists; they are not automatically SDE identities.

## 2. Trust, provenance, and lifecycle mapping

The engine currently persists `VerificationStatus` values:

```text
imported | processed | needs_review | verified | rejected
```

It also persists rights classifications such as
`factual_identity_only`, `reusable_geometry`, and `unclear`. These are engine
storage terms and must not be renamed or overwritten.

The Stage 7 product lifecycle is a presentation/integration mapping:

| Stage 7 lifecycle | Existing evidence/state interpretation |
| --- | --- |
| Generated / Planned | Imported or planned/generated candidate with identity or route intent; not trusted geometry |
| Recorded | A physical activity or route trace references a route; it is evidence, not canonical verification |
| Community-confirmed | Community evidence may support review, but remains `needs_review` until the engine’s evidence and QA gates pass |
| SummitReady Verified | A route is eligible only after the engine’s processed/verified publication gates, rights checks, topology, provenance, and QA succeed |

`processed` is an engine publication/processing state and is not silently
renamed to `verified`. `needs_review` and `rejected` remain explicit degraded
or unavailable outcomes. A single GPS recording never verifies a canonical
route. Canonical geometry and a user's GPS trace remain separate objects.

Canonical responses must retain provider, source URL, licence, attribution,
retrieval time, source/import payload hashes, provenance version, QA flags,
rights classification, and verification state. Missing or conflicting
evidence is fail-closed; AI cannot repair or promote it.

## 3. Geometry, elevation, and available metrics

The SDE can expose deterministic facts where the route definition, ordered
geometry, and DEM provenance pass publication gates:

- route distance;
- total ascent/descent;
- minimum/maximum and start/summit elevation;
- ordered raw and smoothed profile samples;
- gradient/profile values;
- typical duration where sourced.

The elevation profile records calculation version, spacing, smoothing method and
parameters, nodata, and profile-to-DEM-tile provenance.

The following are not universally available in the audited model and must
return unknown/degraded rather than fabricated values:

- terrain or technical character;
- surface and difficulty summaries;
- exposure;
- altitude claims without a trusted source;
- weather/seasonality;
- route-network alternatives;
- one unified route-confidence score.

SDE geometry requires ordered topology and provenance. It does not silently
snap, route, gap-fill, or repair coordinate proximity. A generated route and a
verified route must remain distinguishable.

## 4. Tryfan, OSM, Copernicus, and DEM pipeline

The intended Tryfan pipeline preserves Geofabrik OSM Wales PBF and Copernicus
DEM GLO-30 inputs, recording SHA-256 hashes, CRS, retrieval/processing
versions, licences, attribution, and a manifest. It accepts a route only from
an exact ordered OSM relation way/node chain and stops when topology or DEM
coverage is incomplete.

The checked-in Tryfan review records:

- mountain status `NEEDS_REVIEW`, with OSM peak elevation 917.5;
- North Ridge, South Ridge, and Heather Terrace as `needs_review`;
- missing complete publishable route geometry/profile and metrics;
- topology/acquisition/rights diagnostics;
- no sufficient DEM/profile publication.

No Tryfan route should be presented as SummitReady Verified. The README
references import/validation/download scripts, but those script implementations
and raw/generated Tryfan outputs are not present in the tracked workspace;
therefore the documented engine guarantees cannot be treated as published app
facts yet.

Separate app/admin pipelines are weaker and must not be conflated with SDE:

- `routes/mountain-verification.ts` uses Nominatim, Overpass, polyline
  concatenation, OpenTopoData/SRTM90m sampling, and a database test surface.
  It lacks the SDE topology, source-hash, DEM provenance, and fail-closed
  publication contract.
- `scripts/src/seed-trails-overpass.ts` seeds named relations and may infer
  distance/ascent/difficulty from tags or heuristics. It stores app catalogue
  fields, not versioned verified geometry/profile provenance.
- `routes/hills-unified.ts` has useful validation, known-gain overrides, and
  topo sampling, but also legacy/cache/AI sources and `route:v1` compatibility
  keys. These are not canonical SDE proof.
- `routes/mountain.ts` has an AI fallback that can return coordinates,
  elevation, and routes. Those values are generated/legacy data and must not be
  labelled verified.

## 5. Current app/API route surfaces

### Existing canonical lookup

The server already has the safest shared read seam:

- `artifacts/api-server/src/services/mountain/canonicalMountainLookup.ts`
  applies verified mountain trust predicates, canonical name/alias lookup, and
  verified route joins;
- `artifacts/api-server/src/routes/mountain.ts` exposes
  `POST /api/mountain-lookup`, canonical-first before cache/AI fallback;
- canonical misses, ambiguity, and unavailable results are explicit rather
  than silently selected.

There is currently no SDE API router or generated shared SDE OpenAPI contract.
Clients must not query SDE tables directly.

### Training

`context/AppContext.tsx` stores `SummitGoal` and `TrainingWeek.hills`, but
training hill entries currently contain mostly display facts
(`name`, `elevation`, `distance`, `repeats`, coordinates) and do not
consistently carry SDE mountain/route/version IDs. Plan and target generation
still consume local/AI/alpine hill data and mountain image lookups. This is an
identity-loss boundary to address through an additive adapter, not by replacing
training state.

### Expedition

`NearbyHill` and `Session` already have the strongest app-side route boundary:
`routeIdentityKey`, `routeId`, `summitId`, `summitIdentityKey`,
`canonicalParentIdentityKey`, objective type, and immutable stage snapshots.
`trackingLaunchContext.ts` carries stable route/summit context into the
protected tracker. Legacy records may have empty or absent identity fields.
Expedition simulated progress and Stage 6 summit authority are separate from
route truth and must remain unchanged.

### Explore and hill surfaces

`app/(tabs)/explore.tsx` is primarily local ExploreHike achievement/statistics
presentation; `trails.tsx` aliases `SharedTrackScreen`. It is not currently a
canonical mountain/route browser. `hills-finder.tsx`, the Hills tab, and
`log-hill.tsx` consume `/hills-unified` and local route-shaped records.

The server supports explicit canonical activity links through
`routes/explore-hike-canonical.ts` and canonical activity link services, but
that is a link/write boundary rather than a shared route-discovery read model.

## 6. Activity-to-route linking

The canonical physical activity contract remains `(source_type, source_id)`.
The mobile tracker’s `activityId` identifies the recorded activity; it is never
a route identity. Existing activity links are owned by:

- `services/canonicalActivity.ts`;
- `canonicalActivityLinks.ts`;
- `canonicalActivityContracts.ts`;
- `canonicalActivityProjections.ts`;
- `canonicalQualificationEvaluator.ts`.

`trackingLaunchContext.ts` and `pendingHikeSelection.ts` preserve route and
summit identity plus an immutable stage snapshot for offline tracking. A saved
GPS trace may reference canonical route identity, but it cannot overwrite route
geometry, facts, verification, or provenance. One physical activity remains one
activity even when it links to Training, Expedition, Explore, or a canonical
route.

## 7. Caches, offline state, and duplicate stores

The app has several non-canonical caches and stores:

- `seededTrailsCache.ts`: read-through seeded catalogue cache, approximately
  seven-day TTL;
- `liveTrailsCache.ts`: location/radius-aware live trail cache, approximately
  24-hour TTL;
- cached hills/database mountain paths;
- AsyncStorage sessions, plans, hills, saved/completed trails, custom routes,
  ExploreHikes, expeditions, and active expedition state;
- constants such as `constants/mountains.ts`, `wainwrights.ts`, and
  `trailData.ts`;
- `data/virtualBundles.ts` and legacy route snapshots.

These are compatibility/discovery caches, not an SDE identity store. No
version-aware SDE geometry/profile offline bundle was found. A future cache
must key by `sde:route:<identity>@<version>` and retain trust/provenance
snapshot metadata; it must not key by display name.

The offline tracker’s checkpoints, GPS batches, pending route selection, and
sync outbox are protected and separate from canonical route geometry. Route
catalogue availability may be degraded without gating recording or Save.

## 8. Exact protected tracker boundary

`artifacts/summit-ready/app/hike-tracking.tsx` owns the protected:

```text
Start → Track → Pause → Resume → Finish → Save
```

It owns the local activity/route ID, background location, checkpoint
serialization/restoration, queued GPS batches, Finish cleanup, local activity
save, sync enqueue, and Stage 6 consequence behavior. Supporting boundaries are
`utils/activeHikeSession.ts`, `pendingHikeSelection.ts`, `syncOutbox.ts`, and
the app lifecycle retry bridge in `app/_layout.tsx`.

Stage 7 may pass stable route context into this tracker. It must not redesign
the GPS engine, checkpoint ownership, background lifecycle, outbox auth/timeout/
retry/dedupe behavior, offline semantics, physical activity identity, or
geometry-vs-trace separation.

## 9. Lowest-risk integration path

The lowest-risk path is additive and read-only:

1. Reuse the existing canonical-first mountain lookup service/endpoint boundary
   or add a thin server read adapter backed by verified SDE lookup functions.
2. Return a typed mountain/route DTO containing stable SDE IDs and versions,
   route definition/facts/geometry/profile only when published, provenance,
   rights, verification/trust, and explicit unavailable/degraded reasons.
3. Add an explicit compatibility mapping from app hill/route IDs and preserve
   legacy numeric/display fields for old records.
4. Add one client mapper/read selector so Training, Explore, and Expedition
   consume the same canonical facts without merging their journey state.
5. Keep canonical misses, ambiguity, `needs_review`, missing geometry, and
   missing metrics visible as unavailable/degraded; do not fall back to AI and
   label it verified.
6. Thread stable IDs into new Training targets and Expedition stage snapshots
   only where supplied; do not migrate existing identities destructively.

This can be implemented without production schema changes, backfill,
reconciliation, consumer switching, or tracker changes. A production adapter,
migration, canonical identity migration, or destructive SDE consolidation would
require owner approval and is not part of this audit.

## 10. Production and protected-boundary implications

No production SQL/schema, flags, activation, deployment, backfill,
reconciliation, release, auth/payment/privacy change, or PA-A2 action is
authorized. The standalone SDE migrations remain owned by the engine and must
not be run against SummitReady production. PA-A2 and its proposed production
index workaround remain isolated.

Progress Mountain/cinematic, Stage 6 simulated progress/summit authority,
Readiness 2.0, Elevation Bank semantics, mode separation, and canonical
activity dedupe remain protected.

## S7-R01 conclusion

The SDE is sufficiently explicit to serve as the canonical read authority, but
the app currently has multiple legacy/AI/cache route surfaces and no unified
read adapter. The safe next checkpoint is a typed, read-only compatibility layer
that exposes SDE provenance, versioned identities, trust, and deterministic
degraded states without renaming persisted states or changing consumers’
journey state.

**Status: PARTIAL**