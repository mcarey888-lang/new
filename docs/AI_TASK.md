# SummitReady Explore V3 — Precision Mock-up Match

**Command:** EX3-C01
**Authority:** ChatGPT lead product/design/architecture
**Baseline:** 2d6b36cb12a5706b74100e11b1f237e0a7a8ce1d
**Goal:** Correct Explore V2 so the real app matches the approved Explore mock-up in visual scale, density, composition and hierarchy.
**Stage 9:** PAUSED / NOT AUTHORIZED.

## Locked decisions

1. The approved Explore mock-up is the visual specification. Do not reinterpret it.
2. Use the EXISTING bundled Asset Library image `sumit-ready/assets/images/hero-base-camp.png` as the Explore hero. Do not generate a new hero, substitute another image, call an external image resolver for the hero, or alter the source asset.
3. Batch 2 artwork is approved and may be used for supporting placements where it matches the mock-up and subject truthfully.
4. No new artwork generation is authorized in this gate.
5. Preserve existing Explore functionality: search, filters, canonical identities, route data, navigation, SDE boundaries, loading/error/empty states.
6. Do not compensate for artificial camera/Dynamic Island elements shown by mock device frames. Use only real runtime safe-area insets.

## EX3-C01 — Same-viewport calibration

The main V2 defect is scale/density. Compare implementation and mock-up at the SAME logical viewport, using 390×844 as the primary QA reference.

Measure and correct:
- hero height and crop;
- title size/line height;
- search height;
- filter/chip height and gaps;
- horizontal gutters;
- vertical section spacing;
- route/discovery card height;
- image-to-text proportions;
- metadata size/line height;
- bottom-nav clearance.

Do not simply apply a global scale transform. Correct component tokens/styles so touch targets, accessibility and responsive behavior remain valid.

Target: approximately the same amount of meaningful content should be visible at 390×844 as in the approved mock-up.

## EX3-C02 — Exact Explore hero asset

Wire Explore's primary hero to the existing bundled asset:
`sumit-ready/assets/images/hero-base-camp.png`

Verify the actual repository path/casing before changing imports. If the literal path above is an Asset Library display/storage identifier rather than the source import path, resolve it to its existing bundled source; do NOT duplicate the file.

Crop/position it to reproduce the approved Explore mock-up composition as closely as possible. Preserve the hiker and primary mountain focal points. Use restrained gradient treatment for text readability.

Record the resolved source path and rendered placement in the completion report.

## EX3-C03 — First viewport

Reproduce the approved Explore mock-up's first viewport closely:
- compact, intentional top composition;
- editorial discovery title;
- integrated search;
- restrained filters;
- hero photography remains visually dominant;
- featured discovery text/metadata positioned and sized like the mock-up;
- avoid oversized controls and excessive padding.

The screen must feel like premium mountain discovery, not a large-font accessibility demo or generic route database.

Maintain valid touch targets even when visible chrome is compact.

## EX3-C04 — Results/discovery surfaces

Bring the result section to mock-up scale:
- larger/better imagery relative to text than V2, but smaller overall card footprint where the mock-up is denser;
- consistent editorial crops;
- concise hierarchy: name first, location/context second, only useful verified metrics;
- remove redundant badges/labels;
- avoid satellite imagery where approved/bundled truthful photography exists;
- use approved Batch 2 assets where appropriate and truthful;
- no invented mountain identity, metrics or Mountain DNA.

## EX3-C05 — SummitReady intelligence

Where existing verified data is already available, retain restrained SummitReady-specific capability intelligence (Mountain DNA/training relevance/terrain/elevation context). It must not increase card bulk or overpower discovery imagery.

If verified data is absent, omit the intelligence element. Never fabricate it.

## EX3-C06 — Pixel-density self-review

Render at 390×844 and compare directly against the approved Explore mock-up.

Perform at least TWO correction passes:
Pass A: macro geometry — hero, sections, card dimensions, content density.
Pass B: typography, spacing, crop/focal point, borders, metadata and visual weight.

Explicitly check for the V2 failure mode: “everything is larger than the mock-up.” If the implementation still visibly shows materially less content because components are oversized, it is not complete.

Do not claim mock-up match based only on tests.

## EX3-C07 — Responsive/safety verification

Verify:
- 390×844 primary;
- smaller phone;
- modern iPhone;
- long route/mountain names;
- search keyboard;
- filter state;
- image fallback;
- bottom-nav content inset;
- actual safe-area behavior.

Artificial screenshot/device-frame camera cutouts are irrelevant.

## EX3-C08 — Evidence

Save screenshots if tooling permits under:
`docs/visual-qa/explore-premium-v3/`

Minimum:
- 390×844 first viewport;
- 390×844 scrolled results;
- search/filter state;
- small-phone stress state.

If browser tooling cannot persist PNGs, record capture identifiers/limitation and continue. Final visual acceptance will be made from the product owner's real-phone screenshot.

Create:
`docs/EXPLORE_PREMIUM_V3_REPORT.md`

Report:
- exact files changed;
- exact resolved path for `hero-base-camp.png`;
- approved Batch 2 assets used;
- before/after scale/density corrections;
- two visual correction passes;
- tests/builds;
- remaining known visual differences from mock-up;
- protected-boundary confirmation.

Update AI_HANDOFF, AI_CHANGELOG and visual QA manifest as appropriate.

## EX3-C09 — Verification and STOP

Run targeted tests, bounded regression, TypeScript and relevant Expo exports. Avoid unrelated work.

Commit/push and STOP.

Do NOT start Track, Expeditions, You, Profile, Community, production migrations, artwork generation or another stage.

End with exactly one:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
