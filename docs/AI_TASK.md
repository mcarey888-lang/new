# SummitReady AI Task — Stage 5: Readiness 2.0

## Objective
Make Training Readiness answer: **Am I ready for my mountain, and what should I do next?**

Stage 5 builds on the existing canonical evidence architecture but MUST NOT depend on the blocked production ledger migration being activated. Development may use the verified development schema. Production remains unchanged/default-safe.

## Product outcome
Training users with a target mountain/date get:
- overall Readiness 0–100;
- four explainable dimensions: **Endurance, Elevation Capacity, Consistency, Mountain Experience**;
- evidence quality/state;
- concise strongest gaps/strengths;
- deterministic next best action;
- estimated projected impact where evidence supports it, e.g. “Complete Saturday’s 800m hill session — estimated readiness 72 → 76”;
- real progress/trend only where source evidence exists.

Readiness is a training heuristic, not a guarantee of mountain safety, weather, technical competence, health, or summit success.

## Architecture rules
One physical activity has one canonical identity. Readiness consumes evidence; it does not create a second Training activity store.

Evidence preference:
1. eligible canonical GPS activity evidence;
2. trusted existing tracked-hill evidence where canonical capability is unavailable;
3. explicit manual/indoor Training evidence with appropriate reduced influence;
4. missing evidence.

Never count simulated Expedition elevation, planned sessions, duplicate retries, invalid/untrusted GPS, or public leaderboard data as completed Readiness evidence.

Use the existing Summit Data Engine for canonical mountain/route knowledge. No fuzzy-name identity, duplicate summit store, AI-invented route metrics, or destructive SDE changes.

PA-A2 remains a parallel blocker. Never publish the unsafe 24-statement diff, weaken schema to satisfy Publish, apply production migration 0002, set production Stage 2/4/5 flags, backfill production, switch canonical-history consumers, or release mobile during Stage 5.

## Model principles
Deterministic, versioned, testable, explainable, bounded 0–100. Do not claim scientific/physiological validation.

Dimensions:
- **Endurance:** recent eligible duration/distance/longest sustained activity vs verified target demand.
- **Elevation Capacity:** recent/largest/cumulative eligible ascent vs verified target ascent; distinct from lifetime Elevation Bank.
- **Consistency:** eligible session frequency, plan adherence and recency, capped so overtraining is not rewarded indefinitely.
- **Mountain Experience:** eligible real mountain/hill experience and verified relevant terrain evidence; never infer technical competence from elevation/distance alone.

Audit existing evidence before finalizing weights. Default direction if evidence does not justify another split:
- Endurance 30%
- Elevation Capacity 30%
- Consistency 25%
- Mountain Experience 15%

Recent evidence should matter more than stale evidence. Missing verified target facts must fail soft and reduce confidence, never be invented.

## S5-C01 — Existing Readiness/data-flow audit
Audit only. Map every current Readiness formula/display, target mountain/date input, Training plan/session input, activity evidence source, SDE/route fact source, API/client contract, offline/cache behavior, legacy fallback, production gate and relevant test. Identify duplicate/conflicting calculations and the migration path to one service.

Create docs/STAGE_5_READINESS_AUDIT.md.
End S5-R01 with one status.

## S5-C02 — Versioned Readiness specification
Define readiness_model_version, four formulas, weighting, caps/floors, recency, target normalization, evidence eligibility, confidence/missing-data semantics, manual/indoor treatment, duplicate protection, explanations, next-action selection, projected-impact calculation and safety limitations.

Prefer pure typed deterministic functions. Define fixtures/tests before consumer wiring.
Create docs/STAGE_5_READINESS_MODEL.md.
If destructive migration or major new flow is required: APPROVAL REQUIRED.

## S5-C03 — Calculation service
Implement pure/versioned Readiness engine + service boundary:
- owner scoped;
- deterministic/read-only/idempotent;
- no duplicate activity creation;
- no production dependency on unavailable Stage 2 ledgers;
- provenance-aware evidence;
- score + four dimensions + confidence/state + explanation;
- explicit unavailable/degraded response instead of fabricated zero.

Test no/partial/strong/stale evidence, manual/indoor only, simulated Expedition exclusion, duplicates, invalid GPS, missing target facts, owner isolation and bounds.

## S5-C04 — Target mountain demand
Connect Readiness to verified target mountain/route facts via existing SDE/approved route sources. Stable identity only; deterministic distance/ascent facts; explicit unknowns; no AI geography. Safe fallback to existing approved target metadata when verified SDE route facts are unavailable. Do not alter SDE identities/catalogue.

## S5-C05 — Next best action + projected impact
Select the highest-value action from the existing Training plan/context. Projection must simulate the proposed evidence through the same engine, show current → projected only when sufficient inputs exist, be labelled estimated, never mark planned work completed, and never write projected evidence to history/Elevation Bank.

## S5-C06 — Training Home experience
Preserve hierarchy:
**Mountain → Readiness → Next Action → Weekly Progress**

Show one dominant score, four concise dimensions, strongest gap/why, confidence where useful, next action, estimated impact, and route to detail. Premium outdoor dark-navy visual language, restrained cards, accessible contrast. No new primary nav tab.

## S5-C07 — Detailed “Am I Ready?” experience
Target mountain/date, overall score, four dimensions, evidence behind each, real trend where evidence exists, missing-evidence callouts, next action/estimated impact, concise limitations. Explain rather than overwhelm. No paywall/pricing changes.

## S5-C08 — Activity consequence integration
Eligible newly completed activities affect subsequent Readiness through existing canonical/legacy-safe evidence boundary. Count once. Offline Finish/Save remains immediate; Readiness refresh never blocks save; delayed sync updates later. Expedition GPS may count as real physical evidence if independently eligible, but simulated Expedition progress never counts. Do not activate blocked production ledgers.

## S5-C09 — Regression/protected-boundary review
Run bounded relevant suites then required build/type checks. Verify no regression to offline Start→Track→Pause→Resume→Finish→Save, mode isolation, canonical identity/dedupe, Elevation Bank, simulated Expedition semantics, shared shell, SDE identity/provenance, Progress Mountain, cinematic/live-3D summit transition, auth/payment/privacy, or existing production behavior. Native-device offline QA remains a release prerequisite.

## S5-C10 — Completion gate
Create docs/STAGE_5_COMPLETION_REPORT.md and update docs/AI_HANDOFF.md + docs/AI_CHANGELOG.md.

Report commands/responses, model version/formula, evidence sources, target-demand source/fallbacks, tests/build/typecheck, offline compatibility, production capability state, PA-A2 isolation, protected-boundary verification, limitations and native-device QA status.

Stage 5 COMPLETE only when deterministic explainable Readiness 2.0 exists; four dimensions are visible/evidence-backed; next action works; projections are estimated/non-persistent; simulated/planned data cannot masquerade as completed evidence; offline tracking remains non-blocking; production remains unchanged/default-safe; protected assets remain preserved.

Then STOP. Do not begin Stage 6.

## Response protocol
Use S5-R01 through S5-R10. Each response states prior result reviewed, concise implementation/files/tests/risks/commit, and ends with exactly one status: COMPLETE, PARTIAL, BLOCKED, FAILED, or APPROVAL REQUIRED.

## Authorization
GREEN Stage 5 development and additive/default-off implementation above is authorized.

NOT authorized: production DB/schema changes, production activation, destructive migration/backfill/reconciliation, production/mobile release, payments/pricing, auth/privacy changes, destructive SDE changes, Progress Mountain/cinematic/live-3D replacement, or Stage 6. Any such need must stop for explicit owner approval.
