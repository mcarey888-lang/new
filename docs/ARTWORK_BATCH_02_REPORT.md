# SummitReady Mock-up Support Artwork — Batch 02

**Authority:** ART2-C01–ART2-C08 from GitHub commit `d09bcedfe`  
**Batch:** `batch-02`  
**Generated:** 2026-09-21 UTC  
**State:** **REVIEW REQUIRED**  
**Approved:** No  
**Published:** No

## Result

- Generated exactly the 12 authorized standalone masters, one initial attempt
  each and no retries or additional candidates.
- Provider/model: `openai-gpt-image-1` / `gpt-image-1`.
- Master format: 1536×1024 landscape JPEG.
- Recorded provider estimate: **$0.04 per master / $0.48 total**. Replit AI proxy
  billing may differ.
- All 12 attempts completed, all 12 candidates were stored as version 1, and
  every candidate remains **REVIEW REQUIRED**.
- Each candidate has immutable `master`, 16:9 `hero`, 4:5 `card`, and 1:1
  `thumbnail` derivatives.
- No candidate was approved, published, resolved into the app, or integrated
  into Explore V3 or any other screen.

## Pre-generation gate

- Manifest count: 12 unique stable IDs.
- Authorized estimated spend: $0.48.
- Existing Batch 02 attempts/candidates: 0.
- Other queued review generation: 0.
- Whole-batch and catalogue-wide generation remained disabled.
- Batch 02 regeneration is rejected by both the service and API contract and is
  absent from the review UI.

An initial HTTP submission was rejected by the admin guard with 401 before the
generation route ran. The persisted ledger remained at 0 attempts and $0.00.
The requests were then submitted through the guard's existing base64-safe header.
This did not create a retry: each asset still had exactly one provider attempt.

## Final manifest

Storage layout:

`expedition-artwork/review-batches/batch-02/{asset-id}/v1/{master|hero|card|thumbnail}.jpg`

| Asset | Placement | Prompt hash | Version / cost / state |
|---|---|---|---|
| `SR-EXPLORE-HERO-002` — Explore — Into the Mountains | `explore.discovery.hero` | `f32a95ed14a06860` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-EXPLORE-RIDGE-002` — Explore Route — Exposed Ridge | `explore.route.card.ridge` | `a0eb481458067750` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-EXPLORE-SUMMIT-002` — Explore Route — Summit Day | `explore.route.card.summit` | `997c7b07b836860c` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-EXPLORE-VALLEY-002` — Explore Route — Valley to Mountain | `explore.route.card.valley` | `2fed8207ef7bc30f` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-TRACK-HERO-002` — Track — Into the Wild | `track.hero` | `780a3dabbe1dd3af` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-TRACK-ACTIVITY-002` — Track — Mountain Activity | `track.activity.hero` | `8469cb349295014e` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-EXPEDITION-HERO-002` — Expeditions — Bigger Objective | `expedition.discovery.hero` | `d479a4c4a060f34d` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-EXPEDITION-STAGE-002` — Expedition — The Ascent | `expedition.stage.hero` | `d45359d7fd87ffe5` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-YOU-HERO-002` — You — Mountain Identity | `profile.hero` | `a6be29541f6dc8b1` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-RANK-ASCENT-002` — Rank — The Ascent | `rank.progress.background` | `3885cd05c8e756f8` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-DNA-TERRAIN-002` — Mountain DNA — Terrain Layers | `mountain.dna.background` | `27d876b883a08783` | v1 · $0.04 · REVIEW REQUIRED |
| `SR-ATMOSPHERE-002` — SummitReady — Alpine Atmosphere | `app.atmosphere.background` | `f7a371c6acc59aff` | v1 · $0.04 · REVIEW REQUIRED |

The exact prompt text and crop guidance are persisted with every version and are
visible in the review gallery. Batch 02 definitions deliberately describe
non-specific terrain and forbid named-mountain claims.

## Review location

Development Artwork Admin:

`/artwork-admin/assets`

The **Mock-up Support Pack — Batch 02** section appears before Batch 01. It
shows master, hero and card derivatives, placement, prompt/version metadata,
cost and status. Exact-version approve/reject actions remain available behind
the existing admin guard. There is no Batch 02 regenerate control, and Publish
remains unavailable.

Rendered evidence:

`screenshots/artwork-batch-02-review.jpg`

## Verification

- Focused artwork suite: **5 files / 24 tests passed**.
- API production bundle: passed.
- Artwork Admin TypeScript: passed.
- Artwork Admin production bundle: passed.
- Persisted manifest: 12 candidates, 12 versions, 12 attempts.
- Attempt invariant: all `INITIAL`, attempt 1, version 1, status `stored`.
- Candidate invariant: 12 `REVIEW REQUIRED`, 0 approved, 0 published.
- Prompt hashes: 12 unique.
- Stored derivative checks: **48/48 HTTP 200**.
- Live API and Artwork Admin workflows restarted cleanly.
- Real development review gallery rendered with 12/12 candidates and $0.48.
- Workspace-wide API TypeScript remains blocked by unrelated pre-existing
  canonical-history, object-storage, project-reference and mountain-record
  errors; no Batch 02 error appeared in the successful focused suite or bundle.

## Boundaries preserved

- No extra candidate and no failed-generation retry.
- No automatic approval or publication.
- No app resolver, screen integration, Explore V3, catalogue-wide generation,
  persistent Media catalogue, SDE/schema, protected Progress Mountain, cinematic
  or production-release change.