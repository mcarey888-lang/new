# Premium Training Basecamp Pilot Report

**Gate:** UI-C01–UI-C09  
**Date:** 2026-09-20 UTC  
**Viewport:** 390 × 844 CSS pixels, phone portrait  
**Status:** Complete

## Approval and asset consumed

The persisted Batch 01 manifest was read again at completion. It contains
**12 current versions, 12 approved, and 0 published**.

The pilot consumes:

- Asset: `SR-TRAIN-BASECAMP-001 — Training Basecamp — Build Today`
- Current version: `1`
- Review state: `APPROVED`, `approved=true`
- Publication state: `published=false`
- Source dimensions: `1536×1024`
- Generated: `2026-09-20T18:30:49.771Z`

This is approved development artwork, not published production media.

## Consumption and fallback architecture

The app requests artwork by stable asset ID and typed placement from a
development-only read boundary. The resolver:

- returns only the current approved version;
- supports only `hero`, `card`, and `thumbnail`;
- exposes no master, historical version, prompt, provider, or object-storage
  path;
- streams stable approved media with `private, no-store, max-age=0`, forcing
  current-version revalidation;
- returns 404 outside development.

The Training Basecamp image chain is:

1. approved Training Basecamp hero in DEV/demo;
2. the existing mountain-image URI;
3. the existing gradient if both images fail.

Production therefore fails closed to existing imagery and cannot consume Batch
01 review fixtures.

## UI and motion

Only the real Training Basecamp production screen was changed. Its order is:

1. cinematic target hero;
2. Mission Control with weekly context and one dominant next-session action;
3. existing Readiness 2.0 presentation;
4. Elevation Bank, timing guidance, stats, achievements, and AI Coach.

Existing Training goal/session routes, readiness calculations, coaching,
elevation, activity/offline behavior, shell switching, and
Basecamp/Explore/Track/Expeditions/You navigation are unchanged.

Top-level content uses the established Reanimated entrance primitives. Motion
is skipped when reduced motion is requested, does not delay interaction, and
does not loop.

## Real-screen visual evidence

All files below are 390 × 844 captures from the actual Expo app and production
Dashboard components using the deterministic DEV-only Active Hillwalker
fixture:

- Before: `docs/visual-qa/premium-basecamp/before-active-hillwalker.png`
- After, first viewport:
  `docs/visual-qa/premium-basecamp/after-first-viewport.png`
- After, supporting/scrolled content:
  `docs/visual-qa/premium-basecamp/after-supporting-content.png`
- Approved-artwork resolver blocked, fallback state:
  `docs/visual-qa/premium-basecamp/fallback-no-approved-artwork.png`

The fallback capture was made with both stable approved-artwork request paths
blocked and browser cache disabled. Its pixels match the normal capture because
the existing mountain-image fallback currently resolves to the same approved
visual treatment for this target. That continuity is expected; the fallback
state contains no broken image or layout change.

Reduced motion was exercised and produced the same static hierarchy without
layout shift, so a duplicate PNG is not retained.

## Lead-design self-review

The final real screenshots were reviewed against UI-C08.

- **Nested-card density:** Mission Control is one surface; supporting modules
  are delayed until the scroll sequence.
- **Hero strength/crop:** artwork occupies the structural top region, preserves
  the horizon/focal area, and uses a dark lower gradient for target text.
- **Contrast:** mountain, date, metrics, weekly progress, and action text remain
  legible over the image and dark surfaces.
- **CTA competition:** Easy Run is the only dominant Training action in the
  first viewport. Readiness is visually important but subordinate.
- **Labels:** Training shell identity is explicit. Uppercase is limited to the
  retained small `PERSONAL PROGRESS` category label in supporting content.
- **Spacing/radii:** hero is unframed; Mission Control and Readiness use
  consistent radii and spacing.
- **Generic dashboard appearance:** the large authentic outdoor image, target
  context, and training-specific Mission Control prevent a generic SaaS look.

The review found two visible issues and corrected both before final capture:

1. the next-session guidance truncated as `Conversation…`; it now uses two
   readable lines without hiding Readiness;
2. the first supporting capture began mid-module; it was recaptured from the
   Elevation Bank boundary.

No P0/P1 visual issue remains.

## Verification

- Focused artwork/profile/navigation/readiness suite:
  **6 files, 32 tests passed**.
- Bounded SummitReady suite from the implementation checkpoint:
  **25 files, 162 tests passed**.
- SummitReady TypeScript: **passed** after the final visual correction.
- Production iOS Expo export: **passed** after the final visual correction.
- Production Android Expo export: **passed** after the final visual correction.
- API resolver/regression suite from the implementation checkpoint:
  **3 files, 11 tests passed**.
- API build and live stable-media response: **passed**.
- Native-device QA: **not run**.

The initial parallel post-capture verification attempt exhausted the container
process limit (`EAGAIN`/`EPIPE`). Chromium was stopped and every affected check
was rerun sequentially; the sequential checks passed.

## Remaining shortcomings

- Readiness and Elevation Bank are honestly entitlement/auth gated in the
  signed-out deterministic capture; no values were invented for the screenshot.
- The Training/Expeditions shell switch remains visually prominent over the
  hero because shell clarity is a functional requirement.
- Native-device crop, dynamic type, screen-reader traversal, safe areas, and
  low-end Android animation performance remain release QA, not pilot blockers.

## Boundaries and protected features

No Batch 02 artwork was generated. No artwork was published. No media schema,
production data, migration, backfill, deployment, release, broad reskin, or
Stage 9 work occurred.

Protected Expedition Progress Mountain and cinematic behavior were not
modified.