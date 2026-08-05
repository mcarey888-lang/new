# Atlas Media Studio — Build Report

**Date:** 2026-08-05  
**Task:** #123 — Build Atlas Media Studio as an independent internal image management tool for the four Atlas brands.

---

## Overview

Atlas Media Studio is a standalone internal tool at `/atlas-media-studio` for managing AI-generated marketing imagery for four Atlas brands: **Alliance Installations**, **AI Wraps**, **Vistaluxe**, and **Installa**. It runs on the same monorepo infrastructure as SummitReady with its own isolated DB tables, API routes, and frontend. The original SummitReady Artwork Admin (`/api/artwork/...`) is completely untouched.

---

## What Was Built

### Database (`lib/db/src/schema/atlas.ts`)

Three new Drizzle/PostgreSQL tables:

| Table | Purpose |
|---|---|
| `atlas_brands` | Brands with styleProfile JSON + styleLock JSON |
| `atlas_asset_types` | Asset type catalogue (Hero Campaign, Vehicle Wrap, etc.) |
| `atlas_assets` | Full asset records with 9 crop paths, sceneVars, status machine |

Seeded data:
- **4 brands**: Alliance Installations, AI Wraps, Vistaluxe, Installa — each with full styleLock (Lighting, Colour grading, Composition, Architecture, Camera lens, Perspective, Mood, Depth of field, Contrast, Camera height)
- **8 asset types**: Hero Campaign, Vehicle Wrap, Window Graphics, Signage Installation, Social Content, Case Study, Event Backdrop, MEWP Scene

### API Server (`artifacts/api-server/src/`)

New files:
- `services/atlas/atlasPromptBuilder.ts` — brand styleProfile + styleLock + sceneVars → prompt + hash
- `services/atlas/atlasCropService.ts` — 8 WebP crops from 1536×1024 master
- `services/atlas/atlasStorage.ts` — GCS upload/stream/delete at `atlas-media/{brand}/{type}/{id}/v{n}/{crop}.webp`
- `services/atlas/atlasService.ts` — full pipeline: generate, approve, reject, archive, publish, clear, bulk generate
- `routes/atlas.ts` — REST endpoints at `/api/atlas/...`
- `scripts/seed-atlas.ts` — idempotent seed script

New endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/atlas/brands` | List brands |
| GET | `/api/atlas/asset-types` | List asset types |
| GET | `/api/atlas/status` | All assets (optionally filtered by brandId) |
| POST | `/api/atlas/assets` | Create new asset |
| POST | `/api/atlas/generate/:assetId` | Generate image (force=true to regenerate) |
| POST | `/api/atlas/approve/:assetId` | Approve |
| POST | `/api/atlas/reject/:assetId` | Reject |
| POST | `/api/atlas/archive/:assetId` | Archive (soft-delete) |
| POST | `/api/atlas/publish/:assetId` | Publish approved asset |
| DELETE | `/api/atlas/:assetId` | Clear/delete asset |
| POST | `/api/atlas/bulk` | Bulk generate (SSE streaming) |
| PATCH | `/api/atlas/brands/:brandId/style-lock` | Update style lock |
| GET | `/api/atlas/image/:assetId/:crop` | Stream crop image |

Rate limiting: `/api/atlas/generate` and `/api/atlas/bulk` share the existing `aiLimiter`.

### Frontend (`artifacts/atlas-media-studio/`)

Two pages:

**`/` — Atlas Media Studio (main)**
- Brand selector pill bar (AI Wraps, Alliance Installations, Installa, Vistaluxe)
- Asset type tab bar (All Types + 8 types)
- Asset table: thumbnail, asset ID badge, scene vars, status badge, action buttons
- Prompt expansion row (shows full prompt, cost, provider, generation date)
- Bulk generation with real-time SSE progress modal
- New asset dialog with scene variable dropdowns
- Style Lock dialog (10-field form per brand, persisted to DB)
- Image preview drawer (all 9 crops, download, approve/reject/archive/publish)
- Match reference system — pin an approved asset's visual style to influence future generations

**`/library` — Asset Library**
- Masonry grid of all approved assets across all brands
- Sidebar filters: brand (multi-select), asset type, scene, lighting, status (all/approved/published)
- Asset detail overlay with desktop hero + download links

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Isolated DB tables (`atlas_*`) | Zero risk to existing SummitReady tables |
| Direct fetch + React Query | No coupling to `@workspace/api-client-react` which is SummitReady-specific |
| WebP throughout | Better quality/size than JPEG used in artwork-admin |
| Asset IDs: `ATL` + base-36 timestamp | Visually distinct from SummitReady `SIG*` IDs |
| Archive = soft-delete | Preserves audit trail, GCS images retained |
| StyleLock per brand | Consistent visual DNA without per-prompt engineering |
| SSE for bulk generation | Real-time progress without polling, matches artwork-admin pattern |

---

## Regression Check

- `GET /api/artwork/status` → **OK** (existing SIG routes unaffected)
- `GET /api/atlas/brands` → **OK** (4 brands returned)
- `GET /api/atlas/asset-types` → **OK** (8 types returned)
- Atlas Media Studio frontend → **Running at `/atlas-media-studio`**
- Original Artwork Admin → **Running at `/artwork-admin`**

---

## Files Modified (existing)

| File | Change |
|---|---|
| `lib/db/src/schema/index.ts` | Added `export * from "./atlas"` |
| `artifacts/api-server/src/routes/index.ts` | Registered `atlasRouter` at `/atlas` |
| `artifacts/api-server/src/app.ts` | Added `aiLimiter` for `/api/atlas/generate` and `/api/atlas/bulk` |
