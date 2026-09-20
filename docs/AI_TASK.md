# SummitReady Basecamp Final Polish → Explore Visual Pilot

**Command:** BP-C01
**Authority:** ChatGPT lead product/design/architecture
**Baseline:** e12e77b0b6e114f2bd15c447d000e2b8f56cb468
**Status:** Training Basecamp V3 visual direction ACCEPTED.
**Scope:** Small Basecamp cleanup, then Explore visual pilot only.
**Stage 9:** PAUSED / NOT AUTHORIZED.

## Locked design language

Training Basecamp V3 is now the accepted SummitReady master visual language:
- cinematic mountain imagery;
- strong editorial typography;
- purposeful premium surfaces rather than generic card stacks;
- restrained green;
- dark outdoor palette;
- signature feature visuals;
- clear hierarchy and breathing room;
- real data and real interactions;
- approved artwork where appropriate.

Do not redesign Basecamp again. Make only the four bounded cleanup items below, verify, then use the accepted language as the reference for Explore.

## BP-C01 — Basecamp bounded cleanup

1. Remove the user-facing line `HIGHER VERSIONS OF YOU`. Do not replace it with another slogan.
2. Easy Run thumbnail: remove/avoid any thumbnail with baked-in text. Use an existing clean local/approved training asset if one is appropriate; otherwise use a restrained native visual treatment rather than inventing or generating artwork.
3. Training Insight: retain the same warning logic/copy meaning but move away from red/error styling to a restrained dark amber/earth coaching treatment. It must still meet contrast/accessibility requirements.
4. Alpine Requirements: reduce visual density in Basecamp. Present a premium compact summary (title, meaningful completion/status, essential risk/context cues) with a clear tap-through/expand path to existing detail. Preserve all underlying requirement/risk data and behavior. Do not delete information; reduce first-level density.

Capture one 390×844 first viewport and one lower-content screenshot after cleanup.

## BP-C02 — Explore audit before implementation

Before changing Explore, inspect its current implementation, data sources, navigation, Mountain/Route/SDE integrations, loading/error/empty states, and existing approved-artwork/mountain-image usage.

Preserve the Summit Data Engine boundary and canonical mountain/route identities.

Do not create a second mountain catalogue, duplicate route data, auto-merge by name, or move progression state into SDE.

Document a concise implementation note in the final report; do not spend a separate audit cycle.

## BP-C03 — Explore visual objective

Refine the existing functioning Explore surface using the accepted Basecamp V3 visual language.

Explore should answer:
**Where could I go, what mountain is this, what is the route like, and how does it relate to my capability?**

It should feel like premium mountain discovery, not a generic list/search screen.

Priorities:
- cinematic discovery imagery;
- strong search/discovery hierarchy;
- clear mountain identity;
- useful route context;
- Mountain DNA where existing real data supports it;
- obvious path into mountain/route detail;
- restrained filters;
- editorial spacing and typography;
- visually coherent with Basecamp without copying Basecamp's layout.

Use real existing data only.

## BP-C04 — Artwork hierarchy

For named mountains, use this hierarchy:
1. approved SummitReady mountain artwork when an exact approved asset exists for that mountain/placement;
2. approved/reviewed real mountain photography where already supported;
3. existing mountain-image resolver;
4. branded atmospheric fallback.

Do not use artwork for the wrong named mountain merely because it looks attractive.

Existing approved flagship mountain assets such as Mont Blanc, Matterhorn and Kilimanjaro may be used for their matching mountains.

No new generation.
No Batch 02.
No auto-approval.
No publication/schema work.

Production must remain fail-closed according to the existing media boundary.

## BP-C05 — Explore composition

Use judgment based on the current Explore feature set, but target this hierarchy where supported by real functionality:

**Explore header / search**
→ **featured or relevant mountain discovery**
→ **mountain/route context**
→ **Mountain DNA / terrain intelligence preview where available**
→ **additional discovery/results**

Avoid:
- repetitive same-sized cards;
- tiny metadata overload;
- decorative chips everywhere;
- excessive green;
- giant empty hero areas;
- hiding useful existing discovery functionality merely to match a mock-up.

Filters/search should remain fast and practical.

## BP-C06 — Mountain cards / discovery surfaces

Where mountain cards are appropriate:
- image should do meaningful visual work;
- mountain name should dominate;
- region/location and essential elevation/route context should be secondary;
- use only a few decision-useful metrics;
- preserve tap target and existing navigation;
- handle missing imagery/data gracefully.

Do not fabricate difficulty, route metrics, readiness or Mountain DNA.

If Readiness relationship is shown, use existing deterministic Readiness data/entitlement semantics only.

## BP-C07 — Mountain DNA

Mountain DNA is a signature SummitReady concept.

Where current Explore data already exposes valid Mountain DNA/route intelligence, give it a distinctive but restrained preview treatment consistent with the Basecamp Readiness visual language.

Do not calculate new DNA in UI code.
Do not invent missing DNA.
Do not change Stage 7 algorithms.

## BP-C08 — Functional/protected boundaries

Preserve:
- Basecamp accepted architecture and functionality;
- bottom navigation: Basecamp | Explore | Track | Expeditions | You;
- canonical activity architecture;
- offline tracking;
- Readiness 2.0 calculations;
- Elevation Bank;
- Summit Data Engine;
- existing search/filter/navigation semantics unless a clear UI-only refinement is needed;
- accessibility, reduced motion, safe areas and small-phone behavior.

Do not touch protected:
- MountainProgress.tsx
- ExpeditionMountainProgress.tsx
- Expedition Basecamp progress integration
- CinematicPrototype.tsx
- summit transition/live-3D behavior.

No schema migration.
No production data mutation.
No deploy/release.
No payments/pricing/auth changes.
No Stage 9/community work.

## BP-C09 — Mandatory visual QA

Capture real populated 390×844 screenshots under:

`docs/visual-qa/explore-premium-v1/`

Minimum:
1. Explore first viewport;
2. populated discovery/results;
3. mountain/route intelligence state if accessible from Explore;
4. search/filter state;
5. missing-image/data fallback;
6. small-phone or constrained-content state if materially different.

Also retain the two Basecamp cleanup screenshots.

Self-review actual screenshots and perform at least one correction pass. Do not claim visual success based on tests alone.

Inspect:
- photographic quality/authenticity;
- hierarchy;
- typography;
- card repetition;
- Mountain DNA prominence;
- filter/search usability;
- excessive green;
- text density;
- bottom-nav dominance;
- consistency with accepted Basecamp V3.

## BP-C10 — Verification and STOP

Run targeted tests, bounded regression, TypeScript and relevant Expo exports. Avoid wasteful unrelated full-suite work.

Create:
`docs/EXPLORE_PREMIUM_V1_REPORT.md`

Update:
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`
- visual QA manifest/inventory where appropriate.

Report exact files changed, tests/builds, screenshots, artwork sources, fallback behavior, and any remaining visual differences/limitations.

Commit/push and STOP.

Do not redesign Track, Expeditions, You, Profile, Stage 9 or other screens until Explore is visually reviewed by product owner + lead designer.

End with exactly one status:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
