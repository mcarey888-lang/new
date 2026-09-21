# SummitReady Explore Premium V2 — Mock-up Match

**Command:** EX2-C01
**Authority:** ChatGPT lead product/design/architecture
**Baseline:** e2950574a9d8ff5de62ad6d2621ae488a8d9a6f0
**Goal:** Make the functioning Explore tab match the approved Explore mock-up as closely as practical.
**Stage 9:** PAUSED / NOT AUTHORIZED.

## Locked visual direction

The approved SummitReady mock-ups are now visual specifications, not loose inspiration. Training Basecamp V3 establishes the shared design language. The supplied Explore mock-up is authoritative for Explore composition, hierarchy, imagery, typography, spacing, surfaces and overall premium outdoor character.

Do not reinterpret “premium” into another generic route list. Preserve real functionality/data while matching the mock-up.

IMPORTANT: visual-QA screenshots may be displayed inside a mock iPhone/device frame containing an artificial camera/Dynamic Island. Do **not** move or pad app UI to avoid that artificial frame element. Respect only the real runtime safe-area insets reported by the device/app.

## EX2-C01 — Preserve functional foundation

Keep existing Explore search, filters, canonical IDs, route navigation, curated catalogue/SDE boundaries, loading/error/empty behavior and real data.

Do not:
- create another mountain/route catalogue;
- merge mountains by display name;
- invent route metrics, difficulty, Mountain DNA or readiness;
- alter Stage 7 algorithms;
- change production schema/data;
- touch protected Progress Mountain/cinematic;
- start Stage 9.

## EX2-C02 — Hero/discovery composition

Rework the first viewport to closely match the supplied Explore mock-up.

Target:
- cinematic mountain discovery image as the dominant opening visual;
- strong editorial Explore/discovery heading;
- search integrated elegantly rather than visually dominating the photograph;
- restrained filter controls;
- featured mountain/route identity given substantial visual presence;
- deliberate dark gradient for text legibility;
- location/elevation/difficulty/route context limited to the most decision-useful real fields;
- clear tap-through into existing detail.

The opening should feel like discovering a mountain, not operating a database search screen.

Do not create giant dead space. Keep useful discovery available within the first viewport.

## EX2-C03 — Search and filters

Retain current practical search/filter behavior.

Visually match the mock-up:
- search should feel integrated into the premium dark system;
- filter controls compact and restrained;
- active state clear;
- do not use excessive pills/chips;
- maintain touch targets/accessibility;
- ensure keyboard/search states remain usable on small phones.

## EX2-C04 — Featured discovery

The featured mountain/route should use the strongest truthful imagery available under the existing hierarchy:
1. exact approved SummitReady artwork for the exact named mountain when available and appropriate;
2. approved/reviewed real photography where supported;
3. exact mountain image resolver;
4. branded atmospheric fallback.

Never show artwork for the wrong mountain.

Use the mock-up's strong editorial hierarchy: image → mountain/route name → concise useful context → action/navigation.

## EX2-C05 — More mountains/routes

Replace the current generic compact list-card feeling with the richer discovery treatment shown in the mock-up.

Requirements:
- larger, consistent landscape imagery;
- mountain/route name visually dominant;
- region/location secondary;
- only a few useful real metrics;
- consistent image aspect ratio/crop;
- graceful missing-image fallback;
- clear navigation affordance;
- avoid satellite-looking imagery where a truthful photographic mountain image can be resolved;
- no repetitive metadata clutter.

Use fewer stronger visual elements per result rather than many tiny labels.

## EX2-C06 — SummitReady differentiation

Explore must communicate more than “find hiking routes.”

Where verified existing data supports it, surface a restrained preview of SummitReady intelligence such as:
- route character/terrain;
- Mountain DNA;
- capability/readiness relationship;
- training relevance;
- elevation/technical context.

Only show claims backed by existing real data. If verified Mountain DNA is unavailable for a result, omit it rather than inventing it.

Design the result architecture so verified Mountain DNA can become a signature visual later without requiring another structural redesign.

## EX2-C07 — Shared visual system

Match accepted Basecamp/mock-up language:
- dark cinematic outdoor palette;
- editorial typography;
- purposeful surfaces;
- subtle borders/translucency;
- restrained green for active/progress/action meaning;
- generous but efficient spacing;
- premium imagery;
- coherent icon treatment;
- no SaaS/dashboard visual rhythm.

Bottom navigation remains exactly:
**Basecamp | Explore | Track | Expeditions | You**

Do not alter tab order or navigation architecture.

## EX2-C08 — Real-device responsiveness

Explicitly verify:
- actual safe-area inset behavior;
- no layout adjustment for artificial mock-device camera/Dynamic Island;
- small Android phone;
- modern iPhone dimensions;
- long mountain/route names;
- image failures;
- search keyboard state;
- bottom-nav content clearance;
- readable metadata/contrast.

Do not shrink typography excessively just to fit more content.

## EX2-C09 — Mandatory visual QA

Capture real populated 390×844 states under:
`docs/visual-qa/explore-premium-v2/`

Minimum:
1. first viewport;
2. scrolled discovery/results;
3. search state;
4. filter state;
5. image fallback state;
6. long-name/small-phone stress state.

If the managed browser cannot persist PNGs, do not mark the implementation failed solely for that. Record the capture IDs and exact limitation, but complete all other work. The product owner will supply real-phone screenshots for final visual acceptance.

Perform at least one visual self-correction pass based on rendered output.

Inspect specifically:
- similarity to supplied mock-up;
- image prominence and authenticity;
- whether result cards still feel like generic list rows;
- search/filter visual weight;
- text density;
- hierarchy;
- excessive green;
- safe areas;
- bottom-nav obstruction.

## EX2-C10 — Verification and STOP

Run targeted tests, bounded regression, TypeScript and relevant Expo exports. Avoid unrelated full-suite work.

Create:
`docs/EXPLORE_PREMIUM_V2_REPORT.md`

Update AI_HANDOFF, AI_CHANGELOG and visual QA manifest as appropriate.

Report:
- exact files changed;
- real data/media sources used;
- screenshots/capture IDs;
- self-corrections;
- tests/builds;
- remaining differences from the supplied mock-up;
- protected-boundary confirmation.

Commit/push and STOP.

Do not begin Track, Expeditions, You, Profile, Community or another design pass.

End with exactly one status:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
