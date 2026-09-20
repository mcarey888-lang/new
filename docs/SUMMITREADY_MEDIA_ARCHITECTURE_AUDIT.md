# SummitReady Media Architecture Audit

**Gate:** MV-C01  
**Date:** 2026-09-20 UTC  
**Authority baseline:** `ef1deafcad0773a2692da6b3daaf12e9992c6baf`  
**Status:** Complete, read-only audit; no production data or schema changes

## Executive decision

SummitReady already has a credible canonical media foundation. The correct path
is to evolve **Artwork Admin + the artwork API** into the SummitReady Media
Studio. Atlas Media Studio remains a separate Atlas-brand publishing system.
The mountain-image service remains the runtime external-photo resolver and
fallback, with approved reviewed artwork taking precedence.

No third media service, admin, storage namespace, or generation pipeline should
be created.

## Existing systems

| System | Current authority | Decision |
|---|---|---|
| `artifacts/artwork-admin/` | Signature artwork generation/review and mountain candidate review | **Canonical internal SummitReady review surface; retain and evolve** |
| `artifacts/api-server/src/routes/artwork.ts` | Status, generation, regeneration, approval, rejection, bulk SSE and image serving | **Canonical managed artwork API; retain** |
| `artifacts/api-server/src/services/artwork/` | Generation, object storage, prompt/cost/provider metadata and mountain review | **Canonical SummitReady media service layer; retain** |
| `artifacts/api-server/src/routes/mountain-image.ts` | Approved-image-first lookup, then external source/fallback resolution | **Retain as runtime resolver; do not turn into a second studio** |
| `artifacts/atlas-media-studio/` and Atlas API/services | Atlas brand profiles, approved library, WebP derivatives and GitHub publishing | **Retain separately; reference useful patterns, do not merge domains** |
| Bundled SummitReady assets | Exercise, Basecamp, mascot, app/store and historical screenshot media | **Inventory and selectively reprocess** |
| Landing and mockup assets | Marketing source images and duplicated design exploration assets | **Landing remains its own consumer; mockup copies are non-canonical** |

## Canonical data and storage

### Signature artwork

- `signature_challenges` carries hero/card/thumbnail serving paths, prompt,
  version, status, approval, timestamps, provider and generation cost.
- Object Storage uses
  `expedition-artwork/{challengeId}/v{version}/{master|hero|card|thumbnail}.jpg`.
- Artwork Admin supports status, generate/regenerate, approve/reject, clear and
  bulk generation through existing API routes.
- Mutating artwork routes are protected by the existing admin-key middleware.

### Reviewed mountain heroes

- Candidate review metadata is stored in `cached_mountains` under
  `hero-review:v1:<mountain UUID>`.
- Approved lookup is stored under `hero-approved:v1:<canonical subject>`.
- Metadata already includes source URL/page, licence, artist, dimensions,
  review score and update time.
- The mountain-image route checks approved media before Wikimedia/Wikipedia or
  Mapbox fallback resolution.

### Atlas

- Atlas stores under
  `atlas-media/{brandSlug}/{assetTypeSlug}/{assetId}/v{version}/{crop}.webp`.
- It has useful style-lock, derivative, manifest and publish concepts.
- It is not a SummitReady mobile media authority and no SummitReady consumer
  was found. Reuse concepts, not its records or brand workflow.

## Actual consumers

Production SummitReady image consumers include Training Basecamp, Plan,
hill detail, Expedition route/detail/completion and Expedition discovery.
Most mountain surfaces resolve through `/api/mountain-image`; Expedition
signature surfaces can consume approved artwork. Artwork Admin previews through
`/api/artwork/image`; Atlas previews through `/api/atlas/image`; the landing
site imports bundled source assets.

This means approval is not yet globally authoritative across every mobile
placement. Consolidation should make published Media Studio variants the first
choice while preserving the current resolver as fallback.

## Duplication and obsolete risk

- Landing source assets and mockup public images duplicate several heroes and
  feature images. Landing source is authoritative for the landing app; mockup
  copies are experimental.
- `dist`, Expo static builds, caches and visual-QA screenshots are outputs or
  evidence, never master media.
- The mountain-image POST route is a compatibility no-op returning no image.
- Artwork “latest version” selection is lexicographic; version 10+ requires a
  numeric selector before it can be treated as durable publishing authority.
- Stored API serving paths are not equivalent to portable object paths.

## Safe consolidation sequence

1. Keep Artwork Admin and its APIs as the central SummitReady studio.
2. Add a family-aware master/variant catalogue above the existing records.
3. Import or link current approved records without moving bytes.
4. Make published placement variants the preferred runtime source.
5. Preserve mountain-image fallback for missing/unreviewed subjects.
6. Retire duplicate references only after consumer equivalence is proven.

Persistent catalogue/schema work is **AMBER/RED** and is proposed only in
`SUMMITREADY_MEDIA_STUDIO_SPEC.md`; it is not implemented in MV.
