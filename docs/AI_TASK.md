# SummitReady Approved Artwork → Training Basecamp Premium Integration

**Command:** UI-C01
**Authority:** ChatGPT lead product/design/architecture
**Baseline:** `6263d9450a75e47019643f09ac90cb512a035dbf`
**Editorial state:** All 12 Flagship Artwork Batch 01 candidates have been manually APPROVED by the product owner.
**Stage 9:** PAUSED / NOT AUTHORIZED.

## Goal

Prove the complete production-facing visual pipeline on ONE real functioning screen:

**approved Media Studio artwork → safe app asset resolution → Training Basecamp → populated demo profile → premium UI + restrained motion → visual QA**

The target is the previously approved SummitReady concept: cinematic authentic outdoor imagery, dark natural surfaces, strong hierarchy, fewer nested cards, restrained blue/green accents, generous space, one obvious next action, and meaningful subtle motion.

This is NOT permission for a broad app reskin.

## UI-C01 — Verify approval state and define app-consumption boundary

Read the persisted Batch 01 manifest and verify all 12 exact current versions are APPROVED and not PUBLISHED.

Do not infer approval from docs.

Implement the smallest safe read-only app-consumption boundary needed for approved artwork. Requirements:
- app code must not know GCS/object-storage internals;
- resolve by stable asset ID + intended placement;
- only APPROVED assets may be returned by this pilot resolver;
- publication remains a separate future concept; because Batch 01 is development-only, this pilot may consume approved assets only in development/demo builds;
- production must fail closed/fallback rather than consume DEV review fixtures;
- no production schema/migration/backfill;
- no automatic publication.

Preferred pilot asset:
`SR-TRAIN-BASECAMP-001 — Training Basecamp — Build Today`

Preserve graceful fallback to the current Basecamp imagery if the approved asset is unavailable.

## UI-C02 — Training Basecamp premium composition

Refine the ACTUAL Training Basecamp production component, not a screenshot-only clone.

Use the approved Training Basecamp master/hero derivative as structural artwork in DEV/demo mode.

Design hierarchy:

### A. Cinematic goal hero
- image should occupy meaningful visual area and feel integrated with the screen;
- dark readability gradient/overlay;
- active target mountain/goal and date/context overlaid where data exists;
- Readiness should be visually important but not compete with the primary action;
- image focal point/crop must respect the approved artwork guidance;
- avoid card-inside-card framing around the hero.

### B. Mission Control
Unify the next meaningful Training action and immediate weekly context into one strong section.
- one obvious primary CTA;
- next session/action first;
- weekly progress/supporting metrics secondary;
- do not invent data;
- retain existing Training semantics and navigation.

### C. Readiness / capability
Use existing Readiness 2.0 outputs exactly. Improve presentation only.
- overall Readiness
- useful dimensional context where already supported
- next-action/gap messaging where existing selectors expose it
- no scoring/calculation changes.

### D. Supporting progress
Keep only useful secondary modules visible in the first viewport/scroll sequence. Reduce nested rounded containers and tiny uppercase label repetition. Preserve access to existing functionality.

## UI-C03 — Shared visual primitives

Extract only primitives proven useful by this pilot, for example:
- cinematic image hero/overlay;
- premium section heading;
- metric treatment;
- mission/primary-action surface;
- approved artwork resolver/hook.

Do not prematurely abstract every visual element.

Follow `docs/SUMMITREADY_PREMIUM_UI_SYSTEM.md` and `docs/SUMMITREADY_ART_DIRECTION.md`.

## UI-C04 — Motion pilot

Implement restrained, production-safe motion using the established motion system.

Training Basecamp should demonstrate at most 2–3 meaningful effects:
1. subtle hero entrance/parallax/scale response where performant;
2. Readiness/progress value settles/rises smoothly on entry;
3. Mission Control/next-action transition where useful.

Rules:
- motion must never delay interaction;
- respect reduced-motion preference;
- no looping decorative distraction;
- no confetti;
- no heavy video for UI motion;
- avoid excessive simultaneous animation;
- preserve low-end Android performance.

Do not touch protected Expedition Progress Mountain/cinematic code.

## UI-C05 — Functional preservation

Verify unchanged:
- Basecamp navigation and deep links;
- Training goal context;
- Training plan/session actions;
- Readiness values and evidence semantics;
- offline/activity tracking behavior;
- bottom tabs remain Basecamp | Explore | Track | Expeditions | You;
- demo profiles remain DEV-only;
- no new production data writes.

If the visual target conflicts with functional clarity, preserve functionality and document the visual compromise.

## UI-C06 — Populated visual QA

Use the deterministic **Beginner / first mountain goal** and **Active Hillwalker** profiles as appropriate.

Capture at 390×844:
- Training Basecamp BEFORE (use existing accepted baseline if valid)
- Training Basecamp AFTER — first viewport
- Training Basecamp AFTER — scrolled/supporting content
- reduced-motion state if materially different
- fallback/no-approved-artwork state

Store under:
`docs/visual-qa/premium-basecamp/`

Screenshots must come from the real screen/components and populated fixtures, not reconstructed mockups.

## UI-C07 — Tests and build verification

Add/run targeted tests proving:
- approved asset resolves for DEV/demo pilot;
- unapproved/rejected asset cannot resolve;
- production cannot consume Batch 01 DEV fixtures;
- missing artwork falls back safely;
- Training semantics/navigation unchanged;
- reduced-motion path works;
- existing nav/demo isolation tests remain green.

Run:
- affected SummitReady targeted tests;
- bounded SummitReady regression suite;
- TypeScript;
- iOS/Android production Expo exports if shared production mobile code changed.

No production deploy/release.

## UI-C08 — Lead-design self-review

Before declaring complete, compare the real AFTER screenshot against the premium target and self-correct obvious issues:
- too much nested-card UI;
- weak hero;
- poor image crop;
- insufficient text contrast;
- competing CTAs;
- excessive uppercase/micro-labels;
- inconsistent spacing/radii;
- Training/Expedition ambiguity;
- generic SaaS/dashboard appearance.

Do not expand scope to other screens while correcting the pilot.

## UI-C09 — Completion report and STOP

Create:
`docs/PREMIUM_BASECAMP_PILOT_REPORT.md`

Update:
- `docs/AI_HANDOFF.md`
- `docs/AI_CHANGELOG.md`
- visual QA manifest if applicable.

Report:
- exact approved asset/version consumed;
- consumption/fallback architecture;
- UI changes;
- motion implemented;
- before/after screenshot paths;
- tests/builds;
- remaining visual shortcomings;
- production boundary;
- protected feature confirmation.

Commit/push meaningful checkpoints and STOP.

Do NOT:
- generate Batch 02;
- publish artwork to production;
- migrate the media schema;
- reskin Explore/Track/Expeditions/You;
- begin Stage 9;
- deploy/release mobile;
- modify protected Progress Mountain/cinematic behavior.

End response with exactly one status:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
