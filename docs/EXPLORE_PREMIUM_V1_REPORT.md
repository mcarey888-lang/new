# SummitReady Basecamp Cleanup and Explore Premium V1

**Command:** BP-C01–BP-C10  
**Status:** PARTIAL — implementation and browser QA complete; managed screenshots could not be exported as workspace PNGs

## Implementation

### Basecamp bounded cleanup

- Removed the exact user-facing line `HIGHER VERSIONS OF YOU` without adding a replacement slogan.
- Replaced the Easy Run baked-text asset with a restrained native contour/footprints visual.
- Preserved Training Insight logic and copy while moving every warning state to a dark amber/earth coaching treatment.
- Made Alpine Requirements compact by default while retaining completion, altitude/technical/minimum-week context, key risks, every requirement row, and the acclimatisation note behind an accessible expand control.

### Explore audit and implementation

- Source: existing `CURATED_HILLS`; no second catalogue or route duplication.
- Navigation: every discovery row retains `/trail-detail?id=<trail.id>`.
- Media: exact named-mountain photography is requested for the Helvellyn lead; route rows use the existing route-aware `/api/mountain-image` resolver; failures use a branded atmospheric fallback.
- Mountain DNA: omitted because Explore's current catalogue does not expose verified DNA. Existing `terrain` and `routeType` are labelled only as route character.
- SDE, canonical identities, AppContext progression, tracking, Readiness, Elevation Bank, auth, payments, schema and protected components were not changed.
- Composition: photographic discovery lead with integrated search and four practical filters, followed by compact editorial result rows. Legacy achievement/progress modules no longer compete with discovery on this surface.

## Pixel review and correction

The first real 390×844 capture revealed that the route-aware featured request returned satellite imagery. The correction pass changed only the featured request to the exact mountain subject `Helvellyn`; the follow-up capture confirmed photographic ridge/lake imagery. Route rows retain truthful route-aware imagery.

Final review found no text overflow, horizontal overflow, broken card geometry, excessive green, filter ambiguity, or bottom-nav obstruction. The existing route-detail map can display as a dark tap-to-open placeholder; this was not changed because trail detail is outside the authorized visual pilot.

## Visual QA inventory

All captures were produced by the managed real-browser tester against the running local Expo app at exactly 390×844 and inspected pixel-by-pixel. The tester does not expose screenshot bytes to the workspace, so the durable references below are screenshot IDs rather than committed PNG files.

| ID | State |
|---|---|
| `qpn40s` | Corrected Explore first viewport with photographic Helvellyn lead |
| `m3qvev` | Populated discovery/results |
| `ro004x` | Ben Nevis route detail/intelligence state |
| `5cwcf4` | Search state: Snowdon |
| `owl4dr` | Filter state: Hard |
| `3bb4h9` | Genuine missing-image fallback with only mountain-image requests aborted |
| `n09skh` | Basecamp first viewport; exact removed slogan absent and text-free Up Next visual |
| `nr39ni` | Basecamp lower content; amber Training Insight and collapsed Alpine summary |
| `spuntd` | Alpine Requirements expanded, proving all detail remains accessible |
| `2t0e7l` | Final collapsed lower-content state |

## Verification

- SummitReady TypeScript
- Focused SummitReady tests
- Relevant Expo exports
- `git diff --check`
- Real-browser navigation, search, filter, route-detail and image-failure QA

## Files changed

- `artifacts/summit-ready/app/(tabs)/dashboard.tsx`
- `artifacts/summit-ready/app/(tabs)/explore.tsx`
- `docs/EXPLORE_PREMIUM_V1_REPORT.md`
- `docs/VISUAL_QA_MANIFEST.md`
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`

## Limitation

The BP-C09 visual states were captured and inspected, but the managed browser could not export its automatic screenshots into `docs/visual-qa/explore-premium-v1/`. This is the only incomplete deliverable.