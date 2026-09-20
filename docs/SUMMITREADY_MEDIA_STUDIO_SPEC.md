# SummitReady Media Studio Specification

**Gate:** MV-C02 / MV-C06  
**Status:** Architecture complete; development-only gallery implemented inside Artwork Admin

## Consolidation

Artwork Admin becomes **SummitReady Media Studio**. It remains the one internal
SummitReady review application and uses the existing artwork API/service and
Object Storage boundaries. Atlas Media Studio stays separate.

MV adds `/assets` to Artwork Admin only when `import.meta.env.DEV` is true. The
gallery imports existing source media directly, shows classification and
placement intent, and performs no persistence or mutation.

## Families

1. Mountains
2. Expeditions
3. Training
4. Routes / Mountain DNA
5. Rank
6. Achievements
7. Challenges
8. Onboarding / App UI
9. Atmospheric/background
10. Marketing/store
11. Motion specifications/assets

## Lifecycle

`Generate/import → Review → Refine/regenerate → Approve → Derive variants → Optimise → Publish → Consume`

An asset is not consumable merely because generation succeeded. Only a
published placement variant can become runtime-preferred. Approval is an
editorial decision; publish is a delivery decision.

## Master and variant model

- **Media asset:** stable visual identity for one family and subject.
- **Master version:** immutable generated/imported source plus provenance.
- **Variant:** derivative linked to one master version and placement contract.
- **Publication:** environment/placement binding to one optimised variant.
- Regeneration creates a new master version; it never silently overwrites an
  approved or published version.
- Focal point, safe area and crop policy are inherited unless a variant
  explicitly overrides them.

## Required metadata

- Stable asset ID; family and subtype.
- Canonical subject/entity reference where available.
- Master/version/derived relationship.
- Prompt, negative prompt and style/prompt version.
- Provider, model and generation cost.
- Original and output dimensions/aspect ratio.
- Intended placements and crop/fit policy.
- Normalised focal point and safe-area insets.
- Dark/light overlay suitability.
- Imported-media provenance, creator and licence.
- `draft | generated | review | approved | published | retired`.
- Created, reviewed, approved and published timestamps/actors.
- Mobile optimisation state, format and byte size.
- Motion type, duration, trigger and reduced-motion fallback.

## Placement contracts

Placement names are stable contracts, not free-text screen names, for example:

- `training.basecamp.hero`
- `mountain.discovery.card`
- `expedition.basecamp.hero`
- `route.dna.hero`
- `rank.level.background`
- `achievement.badge`
- `marketing.store.feature`

Runtime clients ask for a placement and subject; the service returns a
published variant or a typed “unavailable” response. Existing mountain-image
resolution remains the graceful fallback.

## Studio review surface

The future production-capable studio should show:

- Master with all derivatives together.
- Prompt/style/provider/cost/version lineage.
- Placement previews at real viewport crops.
- Focal/safe-area overlays and dark/light text tests.
- Provenance/licence warnings.
- Approval and publish states as separate actions.
- Mobile optimisation/byte budget status.
- Motion preview plus reduced-motion fallback.

## Deferred persistence proposal

A later separately approved gate may add `media_assets`,
`media_asset_versions`, `media_variants`, `media_publications` and
`media_reviews`, or equivalent records. It must include owner/admin audit,
foreign keys to canonical subjects where appropriate, immutable version
lineage and uniqueness per environment/placement/subject.

That proposal is **not authorized here**. No production schema, migration,
backfill, object move, flag or publication was performed.
