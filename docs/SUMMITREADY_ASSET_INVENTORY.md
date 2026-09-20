# SummitReady Existing Asset Inventory

**Gate:** MV-C07  
**Date:** 2026-09-20 UTC  
**Policy:** Inventory only; nothing deleted or moved

## Counts and reproducible scope

- **41** targeted raster source/evidence files were classified in three relevant
  source roots: SummitReady assets (22), landing source assets (11), and
  mockup public images (8).
- GIF/video/audio, generated `dist`/static-build files, prototypes, attached
  uploads and external Object Storage objects are excluded from this bounded
  raster count.
- Reproduce with:
  `find artifacts/summit-ready/assets artifacts/summit-landing/src/assets artifacts/mockup-sandbox/public/images -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \)`.
- Runtime Object Storage contents are external and cannot be counted safely
  from source. Existing code defines four signature crops per version and nine
  Atlas crops per version.

## Targeted classification totals

| Classification | Count | Meaning |
|---|---:|---|
| KEEP | 4 | Active core mobile identity/background assets |
| KEEP / REPROCESS | 19 | Useful source requiring consistent crop, optimisation, provenance or art direction |
| REPLACE | 0 | No deletion/replacement authorized before placement review |
| LEGACY / UNUSED | 8 | Mockup/duplicate source, retained for reference |
| PROTECTED | 10 | Visual-QA/release evidence; never treat as masters |
| **Total** | **41** | Exclusive targeted classification |

## Inventory

| Source/pattern | Count | Class | Notes |
|---|---:|---|---|
| `summit-ready/assets/images/{hero-base-camp,mountain-bg,icon}.png`, `assets/mascot.webp` | 4 | KEEP | Current mobile identity/background media |
| `summit-ready/assets/images/exercise-*.png` | 6 | KEEP / REPROCESS | Retain subjects; normalise style, crop, dimensions and provenance |
| `summit-ready/assets/store-*.png` | 2 | KEEP / REPROCESS | Marketing/store derivatives, not visual masters |
| `summit-ready/assets/screenshots/*.png` | 10 | PROTECTED | Historical/release evidence |
| `summit-landing/src/assets/*` raster sources | 11 | KEEP / REPROCESS | Canonical for landing; candidates for managed provenance/derivatives |
| `mockup-sandbox/public/images/*` | 8 | LEGACY / UNUSED | Duplicated/experimental design references |

## Other assets

- Artwork Object Storage and reviewed mountain candidates are **KEEP** as
  canonical managed records; count requires an authorized runtime inventory.
- Atlas media is **KEEP** inside the separate Atlas domain, not imported into
  SummitReady merely because its tooling is more mature.
- Completion video/GIF and prototype motion media in attached/prototype roots
  are **KEEP / REPROCESS** pending provenance, performance and reduced-motion
  review.
- Tryfan 3D/Cesium textures and generated build copies are prototype/build
  material, not SummitReady Media Studio masters.

## Protected assets

`MountainProgress.tsx`, `ExpeditionMountainProgress.tsx`,
`CinematicPrototype.tsx` and their accepted visual/cinematic behaviour are
protected systems, not candidates for MV replacement.
