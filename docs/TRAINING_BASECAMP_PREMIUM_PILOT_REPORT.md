# Training Basecamp Premium Pilot Report

**Gate:** UI-C01–UI-C09  
**Date:** 2026-09-20 UTC  
**Viewport:** 390 × 844 CSS pixels, phone portrait  
**Status:** Complete

## Implemented GREEN scope

- Added a development-only, read-only resolver for approved Batch 01 artwork.
- The resolver accepts only the canonical asset ID plus `hero`, `card`, or
  `thumbnail`; it returns the current approved version only and exposes no
  prompt, provider, history, master, or object-storage fields.
- Stable approved media is served with `no-store` so a newly current approval
  cannot be hidden behind a previous version's cache lifetime.
- Non-development resolution fails closed. Missing, malformed, unapproved, and
  rejected candidates preserve the existing mountain-image fallback.
- Migrated only the real Training Basecamp production screen.
- Reordered the screen to structural mountain hero, Mission Control, Readiness
  2.0, then secondary progress.
- Preserved existing readiness calculations, training/session routes, goal
  editing, elevation, coaching, shell switching, offline/activity behavior, and
  bottom navigation.
- Added restrained entrance motion through the existing Reanimated primitives;
  reduced-motion users receive static content without delayed interaction.
- Repaired the development-only deterministic fixture loader so dual-shell
  hydration receives the fixture goal and unauthenticated local QA can reach
  the populated Basecamp. Production auth behavior is unchanged.

## Artwork provenance

- Asset: `SR-TRAIN-BASECAMP-001 — Training Basecamp — Build Today`
- Version: `1`
- Review state: `APPROVED`, `approved=true`
- Publication state: `published=false`
- Source dimensions: `1536×1024`
- Generated: `2026-09-20T18:30:49.771Z`
- Runtime use: development/demo pilot only; no production publication occurred.

Persisted Batch 01 verification after implementation: **12 versions,
12 approved, 0 published**.

## Visual QA

Repository baseline evidence:

- Before: `docs/visual-qa/media-pilot/training-basecamp-before.png`
- Earlier structural-artwork pilot:
  `docs/visual-qa/media-pilot/training-basecamp-after.png`
- Earlier Mission Control evidence:
  `docs/visual-qa/media-pilot/training-basecamp-mission-after.png`

The final combined implementation was exercised in a real browser against the
local Expo workflow using the deterministic Active Hillwalker profile. The
testing runner retains its final captures as evidence IDs:

- `bgo4xx` — populated first viewport.
- `es75c0` — Readiness, Elevation Bank, stats, achievements, and AI Coach.
- `26e2mc` — reduced-motion first viewport.
- `fzf381` — approved-artwork request forced to 404; mountain fallback intact.

The first viewport shows the Ben Nevis objective, Week 1 Base progress at 67%,
one dominant Easy Run action, Readiness, and the unchanged
Basecamp/Explore/Track/Expeditions/You navigation. The artwork fallback produced
no broken image, clipping, or layout collapse. Reduced motion produced no shift
or overlap.

The supporting capture showed Elevation Bank, time guidance, 1,345 m elevation
goal, two hills, six sessions, three badges, achievements, and AI Coach. The
fixed bottom navigation behaves as expected while scrolling.

The next-session description remains intentionally single-line and may truncate
at 390 px. Session identity, training zone, and the action affordance remain
visible; expanding it would reduce the amount of Readiness visible above the
fold.

## Verification

- API resolver/regression tests: **3 files, 11 tests passed** in the final
  focused run.
- Focused mobile resolver/navigation/profile/readiness tests:
  **6 files, 32 tests passed** before the fixture compatibility correction.
- Bounded SummitReady suite: **25 files, 162 tests passed**.
- SummitReady TypeScript: **passed**.
- API production build: **passed**.
- Production iOS Expo export: **passed**.
- Production Android Expo export: **passed**.
- Real-browser populated, reduced-motion, and fallback states: **passed**.
- Native-device QA: **not run**.

Non-blocking web-preview logs remain: expected Reanimated reduced-motion
diagnostics, React Native Web deprecation warnings, preview CSP warnings, and
signed-out coach-assessment CORS failures. No uncaught application crash or
error overlay occurred.

## Boundaries and stop conditions

No Batch 02 generation, artwork publication, media-schema migration, deployment,
broad reskin, Stage 9 work, or release occurred. Expedition Progress Mountain
and cinematic behavior were not modified. Batch 01 remains unpublished and the
approved-artwork resolver remains development-only.