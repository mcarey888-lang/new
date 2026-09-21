# SummitReady Explore Premium V2 — Mock-up Match

**Command:** EX2-C01–EX2-C10  
**Baseline:** `e2950574a9d8ff5de62ad6d2621ae488a8d9a6f0`  
**Status:** COMPLETE

## Implementation

Explore now follows the supplied locked mock-up as closely as practical while
remaining a functioning view over the existing route catalogue:

- cinematic Helvellyn discovery photography and a deliberate dark legibility fade;
- compact SummitReady identity, embedded non-sticky Training/Expeditions switch,
  editorial Explore heading and integrated search;
- four existing functional filters presented as restrained discovery controls;
- substantial, horizontally browsable featured mountain photography;
- richer mountain-route cards and large landscape search/filter results;
- real route detail navigation using the original `Trail.id`;
- a functioning route-browser control and existing nearby hill finder entry point;
- branded image failure treatment with an explicit SummitReady mountain mark.

The bottom navigation remains unchanged:
**Basecamp | Explore | Track | Expeditions | You**.

## Real data and media

- Catalogue and canonical IDs: existing `CURATED_HILLS`.
- Search fields: existing name, location and region.
- Filter fields: existing terrain and difficulty.
- Intelligence previews: existing difficulty, terrain, route type, elevation gain,
  distance and `bestFor` values only.
- Photography: existing `/api/mountain-image` resolver queried with exact normalized
  mountain subjects to favor mountain photography over route-map imagery.
- Detail navigation: existing `/trail-detail?id=<Trail.id>`.
- Route browser: existing `/trail-list`.
- Nearby hill finder: existing `/hills-finder`.

No Mountain DNA, readiness, popularity, multiple-route count, summit altitude or
other unsupported claim was invented.

## Rendered visual QA

The managed real-browser tester ran against local Expo web. It exposed inspectable
capture IDs but not PNG bytes that could be persisted to the workspace. This is
explicitly permitted by EX2-C09; the product owner will provide real-phone
screenshots for final acceptance.

| Capture | Viewport | State |
|---|---:|---|
| `nxd78m` | 390×844 | Corrected populated first viewport |
| `trhllr` | 390×844 | Corrected scrolled discovery/results |
| `4mov4j` | 390×844 | Search: Snowdon |
| `oootiv` | 390×844 | Filter: Hard |
| `loymbp` | 390×844 | Genuine branded image fallback |
| `lk3xgf` | 360×800 | Long-name/small-phone stress: Sca Fell |

The tester also verified canonical navigation to
`/trail-detail?id=h002`, route browsing, filtering, search, the hill-finder control,
bottom navigation clearance and the absence of app exceptions.

## Visual correction passes

### First rendered pass

The composition matched the reference, but hero/featured photography was too dark,
mountain subject resolution could still return route-map imagery, the discovery
filter edge felt abruptly clipped, and the shared mode switch covered content while
scrolling.

### Correction

- brightened hero and card image overlays without reducing text contrast;
- normalized route names to exact mountain subjects for image resolution;
- promoted truthful Helvellyn photography to the first featured card;
- fitted all four existing filters cleanly at 390px;
- embedded the shell switch in Explore so it scrolls with the header;
- strengthened the branded image fallback after a forced-failure capture showed
  the original mark was too faint.

The final fallback capture `loymbp` visibly renders the SummitReady mark and
`MOUNTAIN IMAGE UNAVAILABLE`.

## Remaining differences from the mock-up

- The real catalogue contains UK and Irish routes rather than the mock-up's Mont
  Blanc, Kilimanjaro and Matterhorn set.
- Unsupported popularity, favorite state, summit-altitude and multiple-route claims
  are omitted.
- Only the four existing functional filters are shown.
- The map callout opens the existing nearby hill finder rather than introducing a
  second map/catalogue implementation.
- Real photography varies with source conditions and weather.

## Verification

- SummitReady TypeScript
- Focused SummitReady test suite
- Production web Expo export
- Production iOS and Android Expo exports
- `git diff --check`
- Mandatory real-browser visual and interaction QA

## Files changed

- `artifacts/summit-ready/app/(tabs)/explore.tsx`
- `artifacts/summit-ready/app/(tabs)/_layout.tsx`
- `docs/EXPLORE_PREMIUM_V2_REPORT.md`
- `docs/visual-qa/explore-premium-v2/README.md`
- `docs/VISUAL_QA_MANIFEST.md`
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`

## Protected boundaries

No production schema/data, SDE algorithm, catalogue, canonical identity, tracking,
Readiness, Elevation Bank, Progress Mountain, cinematic, artwork publication,
authentication, payment, Track, Expeditions, You, Profile, Community or Stage 9
work was changed.