# SummitReady Explore Premium V3 — Scale Correction

**Command:** EX3-C01–EX3-C09  
**Runbook commit:** `d7cd5012c`  
**Baseline:** `2d6b36cb12a5706b74100e11b1f237e0a7a8ce1d`  
**Status:** COMPLETE

## Outcome

Explore V3 is a precision correction of the approved Explore composition, not a
redesign. The V2 screen was materially oversized at the locked 390×844
viewport. V3 keeps the same hierarchy and working catalogue while reducing the
hero, typography, controls, cards, section gaps, metadata and result rows to the
approved mobile density.

The final first viewport now contains:

- the safe-area-aware header and embedded Training/Expeditions switch;
- the complete Explore title and supporting line;
- the search field;
- all four real filters;
- the complete Featured Mountains heading and first featured card;
- the start of Mountain Routes above the unchanged bottom navigation.

## Locked hero source

Explore uses the existing bundled source directly:

`artifacts/summit-ready/assets/images/hero-base-camp.png`

The source is a 1536×1024 PNG. It was not generated, resolved externally,
altered, duplicated or substituted. The screen applies an explicit cover crop
and the existing dark legibility gradient.

## Visual correction passes

### Pass A — macro geometry

- Reduced the hero field from 550px to 380px.
- Reduced the title, search, filter, featured, mountain-route, map and result
  dimensions without applying a global transform.
- Kept all four functional filters visible at 390px.
- Preserved safe-area handling and bottom-navigation clearance.
- Added hit slop to compact clear, header and View all controls.

Evidence: `docs/visual-qa/explore-premium-v3/01-pass-a-macro.png`.

### Pass B — typography, spacing and visual weight

- Made the bundled hero crop explicit and added a clean dark content
  transition.
- Limited featured names to two lines and refined title, subtitle, tag and
  metadata sizing.
- Tightened section rhythm, card gaps, radii and borders.
- Reduced result-card height while retaining location, ascent, distance,
  difficulty and route character.
- Extended the dark content surface through the bottom inset.
- Repositioned branded fallback marks so they do not collide with route titles.

Evidence:

- `02-final-first-viewport.png`
- `03-final-scrolled.png`
- `04-hard-filter.png`
- `05-snowdon-search.png`
- `06-image-fallback.png`

## Preserved product behavior

- Existing `CURATED_HILLS` catalogue and canonical `Trail.id` values.
- Search over name, location and region.
- All, Mountains, Hills and Hard filters.
- Existing featured and mountain-route selections.
- Existing `/trail-detail?id=<Trail.id>`, `/trail-list` and `/hills-finder`
  navigation boundaries.
- Existing `/api/mountain-image` route-card media resolution.
- Loading, empty, error and branded image-fallback behavior.
- Existing reduced-motion handling, keyboard behavior, safe area and bottom
  navigation.

No SDE, schema, authentication, payments, Track, Expeditions, You, Profile,
Community, artwork approval/publication, production data, deployment, release
or Stage 9 work changed.

## Rendered verification

The final local Expo web runtime was captured through the actual Metro endpoint
at 390×844. The normal Replit artifact preview and managed tester resolved to
the separate SummitReady landing artifact; managed failure captures
`7ezx3r`, `39fgxu`, `b2pmwj` and `fxi5t1` document that routing limitation and
are not product evidence.

The direct Metro pass verified:

- first viewport and scrolled discovery density;
- Hard filter: 14 results;
- Snowdon query while Hard remains active: 2 results;
- branded route-image fallback under blocked mountain-image requests;
- fixed bottom navigation and clear content separation.

## Automated verification

- SummitReady TypeScript: passed.
- Focused navigation/dev-profile/artwork tests: 3 files, 16 tests passed.
- Bounded SummitReady regression: 25 files, 166 tests passed.
- Production Expo export: web, iOS and Android passed.
- `git diff --check`: passed.

Native-device screenshot acceptance remains a release QA activity; no native or
store release was performed.

## Files changed

- `artifacts/summit-ready/app/(tabs)/explore.tsx`
- `docs/EXPLORE_PREMIUM_V3_REPORT.md`
- `docs/visual-qa/explore-premium-v3/*`
- `docs/VISUAL_QA_MANIFEST.md`
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`

## Stop boundary

EX3-C01–EX3-C09 ends with Explore. Track was not started.