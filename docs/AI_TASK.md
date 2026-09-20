# Visual QA + Navigation/Rank Refinement Gate

**Authority:** Product owner has accepted Stages 1–8. ChatGPT is lead product/design/architecture authority.
**Branch:** `virtual-expeditions-mode`
**Current baseline:** Stage 8 complete; Stage 9 audited but NOT authorized for implementation.

## Objective

Before Stage 9, establish a visual-quality baseline for the entire SummitReady app and implement the newly approved information architecture:

**Basecamp | Explore | Track | Expeditions | You**

Challenges must not occupy a permanent bottom tab. Challenges are supporting motivation surfaced contextually in Basecamp and under You.

Also design the long-term SummitReady **Rank** system as a distinct layer from Achievements and Challenges:

- Rank = who the user is becoming / long-term mountain capability identity
- Achievements = what the user has accomplished
- Challenges = what the user is working toward now

Do not begin Stage 9 Community implementation during this gate.

## Product benchmark

SummitReady should feel like a premium outdoor product: Berghaus/Arc'teryx visual discipline + Strava motivation + AllTrails clarity, while retaining its own mountain-preparation identity.

Avoid:
- generic SaaS dashboard feel;
- excessive nested cards;
- too many tiny uppercase labels;
- weak competing CTAs;
- badge spam;
- generic Bronze/Silver/Gold gamification;
- visual clutter.

Prefer:
- one dominant purpose per screen;
- strong mountain imagery where useful;
- confident typography;
- clear metric hierarchy;
- generous space;
- meaningful progress visualization;
- obvious Training vs Expedition context;
- premium, adventurous, credible tone.

## Protected boundaries

Do not alter the GPS/offline tracking engine, canonical activity identity, Readiness formulas, Elevation Bank qualification, Expedition contribution semantics, SDE identity/provenance, Mountain DNA formulas, protected Progress Mountain renderer, or summit/cinematic/live-3D sequence merely for visual QA.

No production SQL/schema/migration, production flags, backfill, deployment/release, payment/pricing, auth/privacy changes, PA-A2/PA-A3, or destructive data work.

## Command protocol

Responses are `VQ-R01` onward. Continue autonomously through GREEN work. Commit/push meaningful checkpoints. End every response with exactly one of: `COMPLETE`, `PARTIAL`, `BLOCKED`, `FAILED`, `APPROVAL REQUIRED`.

### VQ-C01 — Screen inventory and capture plan

Audit all meaningful user-facing SummitReady screens and states.

Create `docs/VISUAL_QA_SCREEN_INVENTORY.md` containing:
- screen/route;
- journey: shared / Training / Expedition / Explore;
- purpose;
- primary CTA;
- key states worth capturing;
- whether authentic preview capture is currently possible;
- capture method.

At minimum include:
Basecamp, Explore, mountain detail, route detail/Mountain DNA, Track start, active tracking, Training Home, Readiness detail, Expeditions discovery/selection, Expedition Basecamp, compact Progress Mountain, expanded Progress Mountain, activity completion, Challenges, You/Profile, Rank/Achievements, important empty/loading/completed states.

### VQ-C02 — Reliable visual-review harness

Attempt authentic screenshot capture of the real app.

Do not treat the unrelated landing-page artifact as mobile evidence.

If authenticated Expo/native screens cannot be reliably captured from Replit preview, create a **development-only visual review harness** that renders the actual SummitReady production components with deterministic representative fixture data. It must not fork/reimplement screen designs, modify production behavior, or ship in production.

Provide clear evidence of which captures are authentic runtime screens versus harness-rendered real components.

### VQ-C03 — Full screenshot pack

Capture the principal screens at a consistent modern phone viewport.

Store screenshots in a clearly named non-production review location such as `docs/visual-qa/` if repository binary policy permits; otherwise use the Replit artifact/output mechanism and create an indexed manifest with stable accessible paths.

Capture enough representative states to judge:
- visual hierarchy;
- typography;
- spacing;
- imagery;
- CTA priority;
- navigation;
- Training/Expedition distinction;
- data density;
- empty/pending/completed states;
- compact vs expanded Progress Mountain;
- Stage 8 Challenge/Achievement presentation.

Do NOT redesign screens yet except for minimal changes required to make faithful capture possible.

Create `docs/VISUAL_QA_MANIFEST.md` mapping each screenshot to route/state/capture method.

### VQ-C04 — Bottom navigation refinement

Implement the approved primary navigation:

**Basecamp | Explore | Track | Expeditions | You**

Requirements:
- Track remains the visually strongest/central recurring action where platform conventions permit.
- Expeditions gets permanent first-class navigation.
- Challenges is removed from permanent bottom navigation.
- Challenges remains accessible contextually from Basecamp and You.
- Preserve Training/Expedition state and deep-link/back behavior.
- Avoid duplicate navigation stacks.
- Do not remove Community code/data; Stage 9 may later decide how Community is surfaced.

Run navigation/mode-isolation regression.

### VQ-C05 — Rank hierarchy product specification

Create `docs/SUMMITREADY_RANK_SYSTEM.md`.

Rank must be meaningful mountain identity, not raw XP and not Bronze/Silver/Gold.

Working hierarchy to evaluate/refine:
1. Trailhead
2. Hillwalker
3. Summiteer
4. Mountaineer
5. Alpinist
6. Expeditioner
7. final elite rank — choose the strongest credible name after evaluating alternatives.

Define deterministic requirements for each rank using a balanced combination of legitimate evidence such as:
- verified/eligible outdoor activities;
- eligible elevation;
- distinct mountain/summit completions;
- consistency/active weeks;
- Expedition milestones where appropriate;
- mountain experience.

High ranks must not be achievable primarily through manual/indoor/simulated evidence.

Do not casually equate app rank with professional qualifications or technical safety competence. Rank is SummitReady progression identity.

Specify:
- exact requirements;
- evidence eligibility;
- progress calculation;
- missing/degraded evidence;
- corrections/revocations;
- anti-gaming boundaries;
- how existing users are evaluated;
- relationship to Achievements and Challenges.

No production migration.

### VQ-C06 — Rank + Achievements visual experience

Implement/refine the You/Profile experience so Rank becomes a prestigious long-term progression layer.

Desired hierarchy:
- current Rank prominently displayed;
- progress toward next rank;
- concise “requirements remaining”;
- tappable rank journey;
- vertical/mountain-ascent progression visualization where practical;
- Achievements below Rank;
- Challenges accessible but secondary.

Use actual Stage 8 deterministic achievement data where authoritative. Do not fabricate completed achievements or rank evidence.

Keep the visual experience premium and sparse rather than badge-heavy.

### VQ-C07 — Lead-design visual self-audit

Using the screenshot pack, perform a screen-by-screen design audit against the product benchmark.

Create `docs/VISUAL_QA_DESIGN_AUDIT.md` with findings classified:
- P0 broken/confusing
- P1 materially harms premium feel or comprehension
- P2 polish/consistency
- P3 optional enhancement

Evaluate:
- 3-second comprehension;
- primary CTA;
- visual hierarchy;
- typography;
- spacing;
- card density;
- imagery;
- navigation clarity;
- Training vs Expedition distinction;
- consistency;
- accessibility/reduced motion;
- whether each screen feels like SummitReady rather than generic SaaS.

Do not use the audit as permission for a wholesale redesign.

### VQ-C08 — Fix P0/P1 visual issues

Fix all GREEN-scope P0/P1 findings. Make coherent shared-component fixes where possible rather than one-off patches.

Do not change protected product semantics to solve visual problems.

Rerun relevant tests/typechecks/navigation regression.

### VQ-C09 — Recapture final screenshot pack

Recapture every principal screen affected by C04–C08.

Update `VISUAL_QA_MANIFEST.md` so the lead designer can compare final screens consistently.

The output must be usable for external ChatGPT review: stable files/artifacts, clear names, no transient localhost-only URLs as the sole evidence.

### VQ-C10 — Completion report and STOP

Create `docs/VISUAL_QA_COMPLETION_REPORT.md`; update `docs/AI_HANDOFF.md` and `docs/AI_CHANGELOG.md`.

Report:
- navigation implementation;
- Rank system/spec implementation status;
- screenshot pack location/index;
- visual issues fixed;
- remaining P2/P3;
- tests/build/typecheck;
- native-device QA status;
- protected/production boundary status.

Then **STOP**. Do not begin Stage 9 implementation.

## GREEN authorization

Audits, screenshot tooling, development-only visual harness, additive UI work, shared styling/component cleanup, approved navigation refinement, Rank specification and additive Rank/Profile UI, tests and documentation.

## AMBER

Stop the specific portion if it requires a major new navigation paradigm beyond the approved five tabs, material changes to accepted Readiness/Expedition/Mountain DNA semantics, or a significant persistent architecture redesign.

## RED

Never execute production DB/schema/SQL, backfill/reconciliation, production flags, release/publishing, payments/pricing, auth/privacy changes, destructive SDE changes, GPS/offline tracker redesign, or Progress Mountain/cinematic replacement.

## Completion discipline

Visual QA is evidence, not theatre. Screenshots must represent actual production components. Do not make mock screens merely to satisfy the screenshot requirement. Preserve working architecture and improve the product users actually see.
