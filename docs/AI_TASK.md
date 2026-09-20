# Visual Refinement + Demo Profiles Gate

**Authority:** Visual QA gate accepted with follow-up refinements. ChatGPT is lead product/design/architecture authority.
**Branch:** `virtual-expeditions-mode`
**Baseline:** `c6ce90058`
**Stage 9:** NOT authorized.

## Objective

Perform one tightly bounded post-Visual-QA refinement pass. Improve premium outdoor visual quality, restore a longer aspirational Rank ladder, and add safe development-only demo user profiles with realistic metrics so the real app can be reviewed in populated states.

This is not a wholesale redesign.

## VR-C01 — Demo profile architecture

Extend the existing development-only demo/profile fixture system rather than creating real users or production records.

Create a small set of clearly named synthetic personas, for example:
- Beginner / first mountain goal
- Active Hillwalker
- Experienced Summiteer
- Expedition-focused user
- Advanced all-round user

Each profile should contain internally consistent representative metrics sufficient to populate the actual production components: eligible outdoor activities, elevation, distinct mountains/summits, active weeks, readiness dimensions where existing fixture contracts permit, Training goal/plan, Expedition progress/stages, Elevation Bank, Challenges/Achievements, recent activity, and Rank evidence.

Requirements:
- `__DEV__` / development-only and impossible to activate as production identity.
- No Clerk fake accounts, production database rows, production API writes, migrations, backfills, or fabricated production evidence.
- Reuse existing fixture/dev-profile loader and actual production screens/components.
- Clearly label synthetic data in developer tooling; do not add intrusive "demo" labels to normal production UI.
- Deterministic and repeatable.
- Add tests proving production builds cannot select/load these profiles.

## VR-C02 — Rank ladder refinement

Keep the deterministic authority-gated Rank model but refine the progression to seven aspirational levels:

1. Trailhead
2. Hillwalker
3. Summiteer
4. Mountaineer
5. Alpinist
6. Expeditioner
7. Summit Elite

Treat **Summit Elite** as the working final name for this gate; keep naming centralized so it can be changed later without migration.

Define balanced cumulative thresholds that rise meaningfully across eligible outdoor activities, eligible elevation, distinct canonical mountains/summits, active weeks and authoritative Expedition milestones. Do not let manual, indoor or simulated evidence qualify high ranks. Do not imply professional qualifications, technical competence or safety certification.

Update `docs/SUMMITREADY_RANK_SYSTEM.md`, evaluator/tests and Rank UI. Do not persist Rank or add production schema.

## VR-C03 — Lead-designer visual refinement

Use the final screenshot pack and actual production components. Fix the remaining high-value P2 issues without changing accepted product semantics:
- reduce unnecessary nested rounded-card-on-card presentation;
- reduce tiny uppercase-label repetition;
- strengthen type hierarchy and breathing room;
- normalize shared spacing/radii where practical;
- improve image crop/hero consistency between Training and Expeditions;
- maintain one obvious primary action per screen;
- keep Training vs Expedition context immediately distinguishable;
- preserve the dark premium outdoor identity.

Prioritize Basecamp, Explore, Track, Expedition discovery/Basecamp, Challenges, You/Profile and Rank. Prefer shared-component/token improvements over one-off patches.

Do NOT redesign protected Progress Mountain, cinematic/live-3D sequence, GPS/offline tracking, Readiness logic, Mountain DNA calculations, SDE identity/provenance, activity qualification, Elevation Bank semantics, or Expedition contribution semantics.

## VR-C04 — Populated-state screenshot matrix

Using the synthetic development profiles, recapture a concise representative matrix at 390×844 from the real production screens/components.

At minimum capture:
- Beginner Training Basecamp
- Active Hillwalker Basecamp/Explore
- Experienced Summiteer You/Profile + Rank journey
- Expedition user Expedition Basecamp + Progress
- Advanced user Track, Challenges/Achievements and populated You/Profile

Store stable evidence under `docs/visual-qa/demo-profiles/` and update the manifest. State explicitly that these are deterministic synthetic development profiles rendered through production UI.

## VR-C05 — Verification

Run targeted navigation, Rank, dev-profile isolation and affected UI tests, then the bounded SummitReady regression suite and TypeScript. Bundle iOS/Android production Expo builds if that remains the established gate.

Verify:
- demo profiles unavailable in production;
- bottom nav remains Basecamp | Explore | Track | Expeditions | You;
- Challenges remains contextual;
- protected Progress Mountain/cinematic unchanged;
- no Stage 9 implementation;
- no production DB/schema/flags/deploy/release/auth/payment/privacy changes.

## VR-C06 — Completion and STOP

Create `docs/VISUAL_REFINEMENT_COMPLETION_REPORT.md`; update `docs/VISUAL_QA_MANIFEST.md`, `docs/AI_HANDOFF.md`, and `docs/AI_CHANGELOG.md`.

Report exact tests/builds, screenshot paths, demo personas, Rank thresholds, visual changes, remaining P2/P3, native-device QA status, and protected/production boundaries.

Commit/push meaningful checkpoints and STOP. Do not begin Stage 9.

## Authority

GREEN: all work above.
AMBER: stop only if a requested refinement requires material persistent architecture or changes accepted Readiness/Expedition/Mountain DNA semantics.
RED: production SQL/schema/migration/backfill, production flags, deployment/release, auth/privacy/payments/pricing, destructive SDE work, GPS/offline tracker redesign, protected Progress Mountain/cinematic replacement.

End responses with exactly one of: COMPLETE, PARTIAL, BLOCKED, FAILED, APPROVAL REQUIRED.
