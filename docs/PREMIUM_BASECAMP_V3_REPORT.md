# SummitReady Training Basecamp V3 — Locked Reference-Match Report

**Date:** 2026-09-21 UTC
**Scope:** V3-C01–V3-C12, Training Basecamp only
**Implementation baseline:** `9199b5c60`
**Viewport:** 390 × 844 CSS pixels

## Result

The functioning Training Basecamp now follows the locked reference hierarchy:
approved Mont Blanc hero → weekly mission → premium next session → signature
Readiness → Elevation Bank → Training Insight → existing Alpine requirements →
quieter Achievements/AI Coach modules.

The page uses real goal, plan, session, entitlement, readiness and ledger data.
No mock screen or screenshot-only implementation was added.

## Exact implementation

### V3-C01 — Hero

- Uses the existing approved-artwork resolver and stable approved media stream.
- Consumes exact asset `SR-MTN-MONTBLANC-001 — Mont Blanc — Alpine Dawn`,
  version 1, `hero` derivative (1536 × 864).
- Uses a 320px unframed cinematic hero, dark lower transition, SummitReady
  wordmark, restrained goal metadata and real goal values.
- Embeds the existing functional Training/Expeditions shell switch in the hero
  on Basecamp only. Other screens retain their existing persistent switch.
- Preserves resolver diagnostics and the approved → mountain-image → gradient
  fallback chain.

### V3-C02/C03 — Mission and Up Next

- Mission and Up Next use separate restrained surfaces matching the reference
  grouping.
- Mission shows the real week number, phase, completion percentage and
  accessible progressbar values. View Plan routes to `/(tabs)/plan`.
- Up Next routes to the real session detail and uses the session's real
  `label`, `description`, `duration`, optional `targetElevation` and existing
  exercise image mapping. No Zone/intensity or duration value is invented.

### V3-C04 — Readiness

- Replaced the generic locked ring with a four-segment SVG identity for
  Endurance, Elevation, Consistency and Mountain Experience.
- Locked/non-Pro users see the structure and labels but no calculated overall
  or dimension score.
- Entitled users continue to receive actual Readiness 2.0 values.
- Calculation, evidence and entitlement semantics are unchanged.

### V3-C05 — Elevation Bank

- Presents the existing explanation and real ledger-backed values in a
  three-metric layout when available.
- Loading, signed-out, unavailable and empty states remain truthful.
- View Details still routes to the existing elevation history.
- No ledger qualification or evidence logic changed.

### V3-C06/C07 — Supporting modules

- Removed the user-facing `Supporting` heading.
- Restyled the existing schedule warning as `TRAINING INSIGHT` without changing
  its trigger or meaning.
- Achievements and AI Coach are compact paired modules with distinct
  iconography and preserved destinations/Pro gating.
- Existing Alpine Requirements remains visible for the real Alpine Mont Blanc
  goal; it was not removed to imitate a screenshot.

### V3-C08/C09 — Navigation and visual language

- Bottom navigation remains exactly Basecamp, Explore, Track, Expeditions, You.
- Track remains central and distinct without an oversized floating treatment.
- Dark cinematic surfaces, subtle borders, controlled accent colour, compact
  typography and reduced card repetition align with the locked reference.
- Reduced-motion guards remain in place.
- Icon-only controls, mode tabs and week progress expose accessibility labels,
  selected state and values.

## Visual correction loop

The first real 390 × 844 render exposed:

- a 380px hero that pushed priority content too low;
- a duplicated Training/Expeditions switch;
- Mission and Up Next merged into one oversized surface;
- cramped Readiness labels;
- a pinned mode switch obscuring scrolled content;
- `Achievements` wrapping mid-word at 390px.

The final correction reduced the hero to 320px, embedded the production mode
switch in the hero, separated/compacted Mission and Up Next, tightened
Readiness and paired modules, and restored/expanded accessibility semantics.
Fresh captures were taken after the corrections.

## Final screenshot evidence

All captures are from the real Expo Dashboard using the existing deterministic
development-only Active Hillwalker profile. They are not mock screens.

| File | Evidence |
|---|---|
| `docs/visual-qa/premium-basecamp-v3/01-hero-mission.png` | Approved hero, header, Mission, Up Next and locked Readiness |
| `docs/visual-qa/premium-basecamp-v3/02-mission-readiness.png` | Mission, Up Next, Readiness, Elevation Bank and Training Insight |
| `docs/visual-qa/premium-basecamp-v3/03-readiness-elevation-bank.png` | Readiness, truthful signed-out Elevation Bank, insight and Alpine content |
| `docs/visual-qa/premium-basecamp-v3/04-training-insight-secondary.png` | Alpine content, Achievements, AI Coach and upgrade row |
| `docs/visual-qa/premium-basecamp-v3/05-full-scroll.png` | Stitched 390 × 1731 complete content scroll |
| `docs/visual-qa/premium-basecamp-v3/06-approved-artwork-fallback.png` | Approved stream blocked; genuine `/api/mountain-image` fallback rendered |

Browser network evidence confirmed HTTP 200 for the resolver and stable approved
image, with the final rendered source resolving to the exact approved 1536 × 864
hero. The fallback capture blocked the stable approved stream and rendered the
existing mountain-image source without a broken image or layout shift.

## Verification

- `pnpm run test` — **25 files / 166 tests passed**.
- `pnpm run typecheck` — passed.
- `NODE_ENV=production pnpm exec expo export --platform web ...` — passed.
- `NODE_ENV=production pnpm exec expo export --platform ios ...` — passed.
- `NODE_ENV=production pnpm exec expo export --platform android ...` — passed.
- `git diff --check` — passed.
- Real 390 × 844 browser render, scroll capture and fallback capture — passed.
- Independent post-fix architecture/boundary review — **PASS**, no unresolved
  P0/P1/P2 issue.

## Remaining differences from the locked reference

- Up Next uses the closest truthful existing outdoor-session image, whose
  embedded typography differs from the reference boots photograph. No artwork
  was generated.
- The signed-out QA runtime correctly shows the Elevation Bank sign-in state
  instead of fabricated ledger values.
- The real Alpine Mont Blanc goal includes the existing Alpine Requirements
  module below Training Insight; the reference does not show it.
- Browser captures omit simulated native status/home indicators.

## Protected-boundary confirmation

- Training generation, session completion and navigation semantics: unchanged.
- Readiness 2.0 calculation/evidence semantics: unchanged.
- Elevation Bank ledger/evidence semantics: unchanged.
- Canonical activity architecture and offline tracking: untouched.
- DEV/demo isolation: preserved.
- Approved-artwork resolver, CORS, diagnostics and fail-closed behavior:
  preserved.
- Progress Mountain, ExpeditionMountainProgress, summit cinematic and live-3D:
  untouched.
- Schema/data migrations: none.
- Artwork generation/publication: none.
- Production deploy/release and Stage 9: not performed.
- No design propagation to Explore, Track, Expeditions, You or other screens.