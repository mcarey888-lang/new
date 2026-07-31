---
name: Signature Expedition Library
description: Curated adventure weekends that echo target mountain Route DNA — schema, import, API, and mobile integration.
---

## What was built

60 curated challenges (120 stages, 112 limitations) imported from xlsx into 3 new DB tables.

## New DB tables (lib/db/src/schema/signature-challenges.ts)
- `signature_challenges` — one row per challenge (challenge_id text UNIQUE PK key for upserts)
- `challenge_stages` — ordered daily routes, unique(challenge_id, stage_order)
- `challenge_limitations` — one row per limitation sentence

## Mountain slug field
`mountain_slug` is a normalised text field (no prefix, e.g. `matterhorn`, `k2`), NOT a FK. Matches the `/api/sx/challenges/for-mountain/:slug` lookup.
Slug function: `name.toLowerCase().replace(/[àáâãäå]/g,'a')...replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')`

## API (artifacts/api-server/src/routes/signature-challenges.ts)
Routes are prefixed `/sx/...` inside the router (NOT `/api/sx/` — app mounts main router at `/api`):
- GET `/api/sx/challenges` — list, optional ?mountain= ?featured= ?region= ?days= ?difficulty= ?withStages=
- GET `/api/sx/featured` — featured challenges only
- GET `/api/sx/challenges/for-mountain/:slug` — primary lookup, returns with stages+limitations
- GET `/api/sx/challenges/:challengeId` — single challenge detail

**Critical routing rule:** All new API routes in routes/index.ts must use paths like `/sx/...` not `/api/sx/...` because app.ts mounts the main router at `/api`.

## Import script
`artifacts/api-server/src/scripts/import-signature-challenges.ts` — reads the xlsx, upserts on challenge_id, deletes+re-inserts stages and limitations. Run with `pnpm exec tsx src/scripts/import-signature-challenges.ts`.

## Mobile integration (virtual.tsx)
- `toMountainSlug()` helper normalises mountain name to slug
- `sigChallenge` state + `fetchSigChallenge()` — called non-blocking alongside main expedition fetch
- Signature challenge card shown in results view above AI hills, with purple theme, stage day cards (Sat/Sun), DNA/Adventure scores, expand/collapse for why-selected reasoning and limitations

## 5 mountains already cached (virt-mt-v2- prefix): ben-nevis, kilimanjaro, matterhorn, mont-blanc, mount-fuji
Remaining 45 mountains will auto-link when users search those mountains (cache builds on demand).

**Why:** ensures non-repetitive curated adventures ("Matterhorn Ridge Challenge: Tryfan North Ridge + Crib Goch Traverse") replace AI-generated repeated hill laps.
