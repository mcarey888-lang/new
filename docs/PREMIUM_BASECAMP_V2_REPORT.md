# Premium Training Basecamp V2 Report

**Gate:** VR2-C01–VR2-C08  
**Authority baseline:** `ad7dde198c6041bbf6d5fef15e9c52d879c6b60b`  
**Date:** 2026-09-20 UTC  
**Viewport:** 390 × 844 CSS pixels, phone portrait  
**Status:** Complete

> **Post-completion correction:** The original first-viewport capture was later
> proven to show the existing mountain-image fallback because the approved
> resolver fetch was rejected by API CORS. The bounded correction and truthful
> replacement evidence are documented in
> `docs/BASECAMP_APPROVED_ARTWORK_FIX_REPORT.md`. The corrected screenshot is
> `docs/visual-qa/premium-basecamp-v2/approved-artwork-fixed-first-viewport.png`.

## Result

Training Basecamp is now a continuous premium outdoor/editorial page rather
than a stack of independent dashboard cards. The final hierarchy is:

1. approved Mont Blanc cinematic hero;
2. this week's mission, progress, and one next-session action;
3. Readiness 2.0 as a signature capability;
4. Elevation Bank and essential progress values;
5. quieter warnings, achievements, AI Coach, and commercial prompts.

Only Training Basecamp and the permitted decorative balance of the shared
central Track tab were refined. Existing Training, Readiness, Elevation Bank,
activity, shell, and navigation semantics remain intact.

## Approved Mont Blanc asset and deterministic mapping

The persisted Batch 01 manifest was read at completion:

- current versions: **12**;
- approved current versions: **12**;
- published versions: **0**.

The V2 pilot consumes:

- asset: `SR-MTN-MONTBLANC-001 — Mont Blanc — Alpine Dawn`;
- exact current version: `1`;
- status: `APPROVED`, `approved=true`;
- publication: `published=false`;
- source dimensions: `1536×1024`;
- generated: `2026-09-20T18:27:01.923Z`.

The development-only Active Hillwalker visual-QA goal uses existing Mont Blanc
fixture/catalogue values:

- name: `Mont Blanc`;
- summit date: the deterministic fixture's `daysFromNow(112)`;
- route distance: `19 km`;
- ascent: `2,800 m`;
- highest altitude: `4,808 m`;
- difficulty: `Alpine`.

No Ben Nevis metric remains under the Mont Blanc label. No real user's selected
goal is changed.

The approved-artwork resolver requires all three conditions before fetching:

1. a development build;
2. development profile ID `active_hillwalker`;
3. exact goal name `Mont Blanc`.

Other development profiles and a changed pilot goal return `null` without an
artwork request. Production also returns `null` without fetching. The existing
mountain-image URI and final gradient remain the fallback chain.

## Exact visual changes

### Hero

- Removed the competing animated logo.
- Let the named mountain image fill the structural top region.
- Integrated the Training/Expeditions switch into a restrained dark control.
- Reduced edit/subscription controls to quiet translucent icon buttons.
- Replaced metric pills with one editorial line for date, ascent, distance, and
  maximum altitude.
- Kept subtle top and bottom gradients for legibility.

### This week's mission

- Combined week, phase, accessible completion progress, and next session in one
  flat editorial section.
- Preserved the session description and valid `/session-detail` navigation with
  `weekNum` and `sessionIdx`.
- Kept Easy Run as the single dominant Training action.
- Replaced a tiny forced-uppercase action label with sentence case.

### Readiness

- Removed the outer gradient card, border, and boxed dashboard treatment.
- Increased Readiness title hierarchy and preserved the existing ring,
  dimensions, action, confidence, and detail navigation.
- The non-Pro state does not expose or invent a score. It explains the four
  existing dimensions and keeps the upgrade cue subordinate.
- Readiness calculations, evidence, lock rule, and questionnaire-derived
  baseline meaning are unchanged.

### Your progress and secondary content

- Removed Elevation Bank's independent gradient card and outer border while
  preserving its data, unavailable state, test ID, and `/elevation-history`
  action.
- Presented essential goal/session/hill/badge values as unboxed editorial
  numbers separated by whitespace.
- Replaced achievements and AI Coach cards with flatter rows.
- Kept actionable timing warnings prominent.
- Kept the commercial prompt at the end as a quiet row.
- Preserved AchievementToast and full Pro coach refresh, retry, assessment,
  tips, disclaimer, Q&A, and answer dismissal behavior.

### Navigation and motion

- Reduced only the decorative dominance of the central Track control: smaller
  footprint, lighter border, no heavy shadow, unchanged route and behavior.
- Retained existing entrance motion and gated every changed entrance with
  `useReducedMotion`.
- Added no loop, video, confetti, dependency, or interaction delay.

## Container/card reduction

Before V2, the populated page presented Mission Control, Readiness, Elevation
Bank, a four-tile stats strip, achievement strip, upgrade banner, coach pill,
and coach state as separate rounded surfaces.

After V2:

- hero: one unframed image region;
- mission: one flat section;
- Readiness: one flat section;
- progress: one flat section containing Elevation Bank and unboxed values;
- supporting content: divider-led rows, with a restrained surface only where an
  actionable warning or interactive coach response needs it.

This removes the repeated large-card rhythm without merging unrelated data
semantics.

## Real-screen evidence

All evidence below is a 390 × 844 PNG from the actual Expo app and production
Dashboard components with the deterministic development-only Active Hillwalker
profile:

- first viewport:
  `docs/visual-qa/premium-basecamp-v2/first-viewport.png`;
- locked/non-Pro Readiness:
  `docs/visual-qa/premium-basecamp-v2/locked-readiness.png`;
- mid-scroll Readiness and progress:
  `docs/visual-qa/premium-basecamp-v2/mid-readiness-progress.png`;
- lower supporting content:
  `docs/visual-qa/premium-basecamp-v2/lower-supporting-content.png`;
- final fallback with approved and mountain-image requests blocked:
  `docs/visual-qa/premium-basecamp-v2/fallback-hero.png`.

The fallback capture shows the final branded gradient without a broken image or
layout shift. Reduced motion is not retained as a duplicate PNG because it uses
the same static hierarchy; code review confirmed all changed entrance
animations are disabled through `useReducedMotion`.

## Direct visual self-review and corrections

The final captures were reviewed against VR2-C06, applying the authority's
Mont Blanc supersession to its stale Ben Nevis wording.

1. **Premium outdoor first impression:** pass. The approved named mountain
   fills the upper region and remains the visual subject.
2. **Mont Blanc recognition/aspiration:** pass for the approved asset and crop.
3. **Editorial continuity:** pass. Typography, whitespace, and dividers carry
   the page after the image.
4. **Fewer rounded cards:** pass. Main sections are no longer independent
   framed surfaces.
5. **One obvious Training action:** pass. Easy Run is the only dominant action.
6. **Readiness identity:** pass after increasing the locked-state hierarchy and
   explaining its four existing dimensions without exposing a score.
7. **Progress clarity:** pass. Elevation Bank and four unboxed values are
   readable without a dashboard-card grid.
8. **Green restraint:** pass. Green is used for shell state, progress, and
   actions rather than every module.
9. **Track balance:** pass. Track remains central but no longer overpowers Easy
   Run.
10. **Generic fitness/SaaS appearance:** no P0/P1 issue remains.

The correction loop fixed:

- an initially dim/dead-looking locked Readiness presentation;
- forced-uppercase microcopy;
- an accidental invalid next-session route;
- missing week-progress accessibility;
- an over-broad DEV artwork mapping;
- temporarily removed achievement/coach functionality;
- altered baseline semantics;
- one unconditional entrance animation.

Independent review initially failed those semantic issues, then returned
**PASS** after correction with no remaining P0/P1/P2 finding.

## Verification

- Focused artwork/profile/navigation/readiness regression after correction:
  **6 files / 34 tests passed**.
- Final configured SummitReady suite:
  **31 files / 195 tests passed**.
- SummitReady TypeScript: **passed**.
- Production iOS Expo export: **passed**.
- Production Android Expo export: **passed**.
- `git diff --check`: **passed**.
- Independent final architecture review: **PASS**.
- Running Expo and API workflows: healthy after restart.
- Protected-file diff scan: no protected Expedition Progress Mountain or
  cinematic file changed.

## Remaining shortcomings

- Native-device crop, dynamic type, screen-reader traversal, safe-area behavior,
  and low-end Android motion performance remain release QA.
- The screenshots are intentionally signed-out/non-Pro, so Readiness and
  Elevation Bank show honest locked/unavailable states rather than fabricated
  values.
- The Training/Expeditions switch remains prominent because shell clarity is
  functional.
- No mobile/store release readiness is claimed.

## Protected-boundary confirmation

No new artwork was generated. No Batch 02 or Ben Nevis generation occurred. No
artwork was published. No production schema, data, migration, backfill,
catalogue, deployment, release, payment, auth, privacy, Stage 9, Explore,
Expeditions, Track architecture, You/Profile, GPS/offline, canonical activity,
Readiness calculation, or Elevation Bank semantic change occurred.

Protected `MountainProgress.tsx`, `ExpeditionMountainProgress.tsx`, cinematic,
live-3D, summit-transition, and completion behavior were untouched.