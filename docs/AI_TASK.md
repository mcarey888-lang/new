# SummitReady Media Studio + Premium Visual/Motion System

**Command:** MV-C01
**Authority:** ChatGPT lead product/design/architecture
**Branch:** `virtual-expeditions-mode`
**Accepted baseline:** `ef1deafcad0773a2692da6b3daaf12e9992c6baf`
**Stage 9:** PAUSED / NOT AUTHORIZED

## Product target

Move the functioning SummitReady product toward the approved premium concept: cinematic authentic mountain imagery, dark natural surfaces, confident typography, restrained blue/green accents, generous space, fewer nested cards, strong information hierarchy, and purposeful motion.

This is a real-product design system, not a screenshot recreation. Existing functionality, accessibility, offline behaviour, evidence authority and protected systems take precedence over decorative fidelity.

## MV-C01 — Audit existing media architecture FIRST

Audit, do not replace:
- `artifacts/artwork-admin/`
- `artifacts/api-server/src/routes/artwork.ts`
- `artifacts/api-server/src/services/artwork/`
- mountain-image API/services and documented remote-image behaviour
- `artifacts/atlas-media-studio/`
- `artifacts/summit-ready/assets/`
- landing/mockup image assets where potentially reusable
- DB fields/tables used by artwork
- storage provider/object paths, prompt/provider/cost/version metadata
- approval/rejection/bulk-generation workflow
- actual app consumers of artwork/images

Document what is canonical, duplicated, experimental, production-coupled, safe to reuse, and obsolete. Do not create a third parallel media system.

Create `docs/SUMMITREADY_MEDIA_ARCHITECTURE_AUDIT.md`.

## MV-C02 — Design the consolidated SummitReady Media Studio

Produce an implementation architecture that evolves the strongest existing system into one central internal studio.

Required asset families:
1. Mountains
2. Expeditions
3. Training
4. Routes / Mountain DNA
5. Rank
6. Achievements
7. Challenges
8. Onboarding / App UI
9. Atmospheric/background assets
10. Marketing / store assets where appropriate
11. Motion assets/specifications

Required lifecycle:
**Generate/import → Review → Refine/regenerate → Approve → Derive variants → Optimise → Publish → Consume**

Design a master/variant model so one approved visual identity can create controlled derivatives rather than unrelated imagery per screen.

Metadata should support where appropriate:
- stable asset ID
- family/subtype
- subject/canonical entity reference
- master/derived relationship
- prompt + prompt/style version
- provider/model + generation cost
- dimensions/aspect ratio
- intended placements
- focal point
- safe-area metadata
- crop/fit policy
- dark/light overlay suitability
- provenance/licence for imported imagery
- status: draft/generated/review/approved/published/retired
- created/approved timestamps
- mobile optimisation state
- motion type/duration/trigger/reduced-motion fallback where relevant

Do not implement production schema changes in this gate. If persistent schema is needed, propose it as a later AMBER/RED gate.

Create `docs/SUMMITREADY_MEDIA_STUDIO_SPEC.md`.

## MV-C03 — SummitReady Art Direction System

Turn the existing useful prompt-builder principles into a documented, reusable art-direction system.

Target:
- premium outdoor editorial/cinematic photography;
- believable geography and terrain;
- authentic hikers/equipment where people appear;
- natural colour, atmospheric depth, controlled dawn/dusk/golden-hour use;
- dark-image compatibility for SummitReady UI;
- deliberate negative space and focal placement;
- no baked-in UI text/logos unless the asset specifically requires typography;
- avoid fantasy mountains, oversaturation, generic AI gloss, impossible routes, fake technical gear, duplicated anatomy or implausible climbing scenes.

Define family-specific direction for Mountain, Expedition, Training, Route/DNA, Rank/Achievement, onboarding and marketing assets while preserving one brand.

Specify standard master sizes/aspect ratios and derivative targets based on actual app usage rather than arbitrary dimensions.

Create `docs/SUMMITREADY_ART_DIRECTION.md`.

## MV-C04 — Premium UI design system

Codify the approved visual direction into reusable implementation guidance/tokens/components.

Priorities:
- cinematic imagery used as structural UI, not decoration;
- dark navy/charcoal natural surfaces;
- strong large headings and metric hierarchy;
- restrained blue/green/orange semantic accents;
- fewer card-within-card containers;
- borders/backgrounds used sparingly;
- generous but efficient spacing;
- consistent radii;
- readable labels rather than excessive micro-uppercase text;
- one dominant action per screen;
- image overlays/gradients that protect readability;
- Training and Expedition remain immediately distinguishable;
- central Track action remains visually strong;
- bottom navigation remains **Basecamp | Explore | Track | Expeditions | You**.

Create `docs/SUMMITREADY_PREMIUM_UI_SYSTEM.md`.

Do not wholesale reskin every screen yet. Implement only shared, low-risk primitives/tokens if doing so clearly enables the next screen migration without changing product semantics.

## MV-C05 — Motion language

Design a restrained motion system and implement only safe reusable foundations/prototypes.

Motion hierarchy:
- ambient: subtle hero/parallax/atmospheric movement;
- interface: smooth state/metric/progress transitions;
- meaningful: elevation gain, Readiness response, Mountain DNA reveal, Rank ascent;
- celebratory: achievements/challenges;
- cinematic: protected Expedition summit sequence.

Create `docs/SUMMITREADY_MOTION_SYSTEM.md`.

Define durations/easing, interruption behaviour, performance constraints and reduced-motion alternatives.

Preferred implementation:
- native/Reanimated/SVG/procedural motion for UI and data-driven animation;
- Lottie only when it is genuinely the right asset;
- video for cinematic content where appropriate;
- never use heavyweight video for an effect better implemented natively.

Prototype shared primitives only if they are isolated and regression-safe. Do NOT alter the protected Progress Mountain/cinematic behaviour in this gate.

## MV-C06 — Internal Media Gallery / Studio plan

The internal studio should ultimately provide a review surface for approved and candidate assets across families, with master + derivatives visible together.

For this gate, either:
A) extend the existing admin safely if architecture audit makes the path obvious and no persistent production schema change is needed, OR
B) produce a precise implementation plan and a development-only gallery using existing data/assets.

Do not duplicate `artwork-admin` and `atlas-media-studio` merely to move faster.

## MV-C07 — Existing asset inventory

Inventory existing SummitReady assets and classify:
- KEEP
- KEEP / REPROCESS
- REPLACE
- LEGACY / UNUSED
- PROTECTED

Include exercise imagery, Basecamp imagery, mountain backgrounds, website heroes, mascot, completion media and any relevant Atlas/Artwork assets.

Do not delete anything in this gate.

Create `docs/SUMMITREADY_ASSET_INVENTORY.md`.

## MV-C08 — First real visual migration pilot

After the audit/specs are complete, migrate ONE representative real screen to the new shared visual system as a pilot. Use a populated development persona.

Preferred pilot: **Training Basecamp**, unless repository evidence shows another screen is a safer/better representative.

Requirements:
- actual production component;
- actual navigation/data semantics;
- no fake screenshot-only implementation;
- preserve functionality;
- use current approved/available artwork, with graceful fallback;
- demonstrate hero treatment, hierarchy, surfaces, CTA and at least one safe motion primitive;
- capture before/after at 390×844.

This pilot should answer whether the new system can reproduce the approved premium character in the functioning app before broad migration.

## MV-C09 — Verification

Run targeted affected tests, TypeScript, and bounded regression tests. Production bundle only if affected code warrants it.

Verify:
- no Stage 9;
- no production DB/schema/migration/backfill;
- no production deploy/release;
- no auth/payment/privacy changes;
- no SDE identity/provenance changes;
- no GPS/offline semantics changes;
- no Readiness calculation changes;
- no Expedition contribution changes;
- no protected Progress Mountain/cinematic replacement;
- demo profiles remain development-only.

## MV-C10 — Completion and STOP

Create `docs/MEDIA_VISUAL_MOTION_COMPLETION_REPORT.md`.
Update `docs/AI_HANDOFF.md` and `docs/AI_CHANGELOG.md`.
Store pilot screenshots under `docs/visual-qa/media-pilot/`.

Report:
- architecture findings;
- consolidation decision;
- files/systems to retain;
- proposed future persistence changes, if any;
- asset inventory totals;
- motion foundations/prototypes;
- pilot before/after;
- tests/builds;
- unresolved decisions;
- production/protected boundaries.

Commit/push meaningful checkpoints and STOP. Do not start broad screen migration, asset mass-generation, production schema changes, or Stage 9.

## Cost discipline

Use targeted repository inspection; do not re-audit Stages 1–8. Reuse existing docs and tests. Avoid broad full-repo analysis where scoped searches suffice. This gate is intended to establish the system and prove it with one pilot, not regenerate the entire application.

## Authority

GREEN: audit, documentation, development-only tooling/gallery, low-risk shared visual/motion primitives, one-screen pilot, tests.
AMBER: persistent media schema design or substantial cross-screen migration — document and STOP before implementation.
RED: production schema/migrations/backfills, deploy/release, auth/privacy/payments/pricing, destructive asset/SDE work, protected Progress Mountain/cinematic changes.

End the response with exactly one of:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
