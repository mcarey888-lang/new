# Overnight Runbook — Consolidation + Stage 8 Challenges & Achievements

**Authority:** Product owner has authorized autonomous GREEN development overnight. ChatGPT is lead product/design/architecture authority.
**Branch:** `virtual-expeditions-mode`
**Accepted baseline:** Stages 1–7 are accepted. Stage 7 completion is the current product baseline.

## Mission

Make substantial safe progress without requiring the product owner to supervise individual engineering steps.

Sequence:
1. Consolidate and regression-check the accepted Stages 1–7 architecture.
2. Build Stage 8 — Challenges & Achievements.
3. Self-review architecture, fix concrete GREEN blockers, rerun bounded regressions, document completion.
4. If Stage 8 completes cleanly, audit/prepare Stage 9 Community & Competition only. **Do not implement Stage 9.**

Do not wait for routine approval. Make reasonable product/UX/architecture decisions inside this runbook and record them.

## SummitReady product north star

SummitReady is not an AllTrails or Strava clone. It connects the mountain a user wants to climb with what they need to do to become capable of climbing it:

`Discover → Choose mountain → Understand route → Assess readiness → Train → Find local matches → Track real hikes → Build elevation → Complete expeditions → Achieve summits → Challenges/community → Next mountain`.

Challenges must reinforce mountain capability, consistency and exploration rather than dangerous speed.

## Permanent protected boundaries

Preserve:
- one physical activity stored once, with multiple consequences/qualifications;
- Training Readiness and Expedition Progress as separate primary metrics;
- real GPS ascent vs simulated Expedition elevation;
- Elevation Bank as personal eligible real elevation;
- Summit Data Engine stable/provenance-aware identities;
- Stage 7 route intelligence/Mountain DNA trust boundaries;
- offline-first Start → Track → Pause → Resume → Finish → Save;
- Stage 6 compact → expanded Progress Mountain → protected summit/cinematic/live-3D sequence;
- canonical owner isolation/dedupe;
- existing auth/privacy/payment behavior.

Protected implementations must not be replaced/substantially redesigned without approval:
- `MountainProgress.tsx`
- `ExpeditionMountainProgress.tsx`
- `CinematicPrototype.tsx`
- GPS/offline tracking engine and lifecycle.

## Production freeze / PA-A2/PA-A3

PA-A2 remains parked. Replit Support has supplied a possible four-index production workaround, but it is a separate RED production gate.

**Overnight work must NOT:**
- run production SQL;
- apply schema/migrations to production;
- enable production flags;
- backfill/reconcile production data;
- activate canonical history/route records;
- deploy/release/publish mobile or backend;
- perform PA-A3;
- change pricing/payments/auth/privacy;
- weaken SDE provenance;
- start destructive data work.

If any command requires one of these, record `APPROVAL REQUIRED` for that item and continue only with independent GREEN work where safe.

## Challenge product rules

Build motivation around:
- elevation accumulated;
- mountains/summits completed;
- hike/activity consistency;
- distance where useful;
- Expedition milestones;
- Training milestones/readiness improvement where evidence is legitimate;
- exploration/completion.

Avoid incentives for:
- fastest dangerous descents;
- risky scrambling speed;
- unsafe ascent speed;
- unverified manual public competition.

Personal achievements may acknowledge broader evidence where explicitly labelled. Competitive/public eligibility is stricter and must be separated from personal completion.

A single physical activity may progress multiple challenges/achievements, but must never be duplicated.

## Trust / eligibility principles

Define qualification separately from presentation.

Expected evidence tiers:
- eligible trusted GPS outdoor activity: may qualify for personal + public/competitive challenges subject to plausibility;
- manual outdoor entry: personal/history only unless a later explicit policy says otherwise;
- treadmill/StairMaster/indoor: Training/personal fitness achievements only, never real outdoor summit/elevation/public competition;
- simulated Expedition elevation: Expedition-specific milestones only; never Elevation Bank, real summit, or outdoor elevation challenge credit;
- canonical summit completion requires legitimate route/activity evidence under existing rules;
- retries/reprocessing must be idempotent.

Do not invent anti-cheat certainty. For Stage 8, establish explicit competitive eligibility hooks/flags and deterministic validation boundaries; deeper leaderboard anti-cheat belongs to Stage 9.

## Response protocol

Responses are `O8-R01` onward. Every response:
- states previous result reviewed;
- summarizes implementation/decisions;
- lists files/tests;
- identifies risks/limitations;
- gives commit SHA;
- ends with exactly one status: `COMPLETE`, `PARTIAL`, `BLOCKED`, `FAILED`, or `APPROVAL REQUIRED`.

Commit and push each meaningful checkpoint. Continue autonomously through GREEN commands. Do not stop merely because a test exposes a GREEN-scope bug: diagnose, fix, rerun, document.

---

## O8-C01 — Consolidation audit and regression baseline

Before new Stage 8 features, inspect accepted Stages 1–7 and establish a clean baseline.

Verify:
- activity identity/dedupe and owner isolation;
- offline tracker boundaries;
- Readiness 2.0;
- Elevation Bank;
- Expedition selected-stage consequences;
- compact/expanded Progress Mountain and summit authority;
- SDE route intelligence/Mountain DNA;
- production-default-off boundaries;
- PA-A2 isolation.

Run bounded relevant tests/typechecks/build/diff safety. Do not rewrite working systems.

Create `docs/OVERNIGHT_CONSOLIDATION_REPORT.md`.

If a concrete GREEN regression is found, fix it and record the fix before proceeding. Native-device QA remains separately required and is not falsely claimed.

## O8-C02 — Stage 8 architecture audit

Audit existing challenge, achievement, badge, streak, leaderboard, completion and profile code/data.

Map:
- current challenge/achievement stores and APIs;
- existing UI;
- activity/elevation/summit/Expedition/Training evidence sources;
- idempotency/duplicate risks;
- personal vs competitive eligibility;
- legacy/dead/duplicate concepts;
- schema implications;
- offline implications.

Prefer reuse/additive compatibility. Do not create a second activity ledger or summit catalogue.

Create `docs/STAGE_8_CHALLENGES_AUDIT.md`.

## O8-C03 — Challenge & achievement domain model

Define a deterministic versioned model.

At minimum cover:
- ChallengeDefinition;
- ChallengeWindow/period;
- ChallengeEnrollment where necessary;
- ChallengeProgress;
- AchievementDefinition;
- AchievementAward;
- EvidenceReference;
- qualification/eligibility;
- personal vs public/competitive scope;
- idempotent award/progress identity;
- corrections/revocations;
- offline/pending state.

Initial challenge families should support:
- monthly elevation;
- cumulative elevation;
- mountain/summit count;
- hiking distance;
- activity consistency;
- Expedition milestones;
- selected Training/readiness milestones where safe.

Achievement examples may include first tracked mountain, first 1,000m eligible elevation, first Expedition stage/Expedition completion, mountain-count milestones and consistency milestones. Names/copy can be refined during UI work.

Define rules before building UI. Create `docs/STAGE_8_CHALLENGE_MODEL.md`.

If persistent implementation requires a production migration, prepare code/migration only if additive and safe, but DO NOT apply production. If architecture would require destructive migration, stop that portion with APPROVAL REQUIRED.

## O8-C04 — Deterministic progress/award evaluator

Implement pure/versioned evaluation services with tests.

Requirements:
- one activity may contribute to many eligible challenge consequences without duplication;
- exact stable evidence identity;
- owner isolation;
- deterministic retry/idempotency;
- simulated vs real evidence separation;
- manual/indoor/public eligibility separation;
- bounded date/window logic supplied explicitly, no hidden clock inside pure evaluator;
- corrections/revocations modeled;
- no network/randomness in evaluator;
- explicit degraded/unavailable states.

Test duplicates, retries, cross-owner evidence, manual, indoor, simulated Expedition, GPS outdoor, corrections, date boundaries and repeated deterministic evaluation.

## O8-C05 — Personal challenge experience

Implement/refine a premium mobile Challenges experience consistent with SummitReady visual language.

Hierarchy should emphasize current meaningful goal, not a grid of SaaS cards.

Provide:
- active challenge hero;
- progress toward goal;
- concise challenge catalogue;
- completed/recent challenges;
- clear evidence/progress explanation;
- offline/pending state;
- no unsafe speed incentives.

Use strong outdoor imagery/typography where existing assets permit. Avoid excessive nested cards and tiny uppercase labels.

Integrate into existing navigation with the lowest-disruption route. Do not substantially redesign the shared shell without approval.

## O8-C06 — Achievements and celebration

Implement achievement presentation and safe award flow.

Requirements:
- meaningful, sparse achievements rather than badge spam;
- deterministic exactly-once award identity;
- celebration only after legitimate local/confirmed consequence;
- restart/replay safe;
- offline award can remain pending and reconcile later;
- clearly distinguish real summit, Expedition completion, Training milestone and general elevation achievements;
- do not alter protected Expedition summit cinematic.

Add an achievements section to the appropriate existing profile/You surface using the established premium outdoor style.

## O8-C07 — Activity consequence integration

Connect completed eligible activities to challenge/achievement evaluation through existing consequence architecture.

Must preserve:
- one physical activity;
- Elevation Bank rules;
- Readiness rules;
- Expedition simulated contribution rules;
- canonical history shadow/default boundaries;
- offline Finish/Save;
- sync retry/idempotency.

Completion UI may show newly earned challenge/achievement consequences only when deterministically known. Pending network consequences must be honestly labelled, never fabricated.

## O8-C08 — Challenge catalogue seed + product polish

Create a high-quality initial challenge/achievement catalogue using deterministic definitions.

Prefer a focused launch set over dozens of weak badges. Include a balanced mix of elevation, mountain completion, consistency, exploration and Expedition progress.

Do not make public leaderboard ranking the centre of Stage 8. Prepare metadata so Stage 9 can consume eligible challenge progress later.

Review copy, empty/completed states, accessibility, reduced motion and visual hierarchy.

## O8-C09 — Architecture/regression review and self-fix loop

Perform an independent adversarial review of C02–C08.

Explicitly check:
- duplicate activity/progress/award risks;
- cross-owner leakage;
- manual/indoor/simulated evidence incorrectly qualifying;
- public/competitive eligibility leakage;
- date/window/timezone boundary bugs;
- retry/restart behavior;
- Readiness/Elevation Bank/Expedition regressions;
- SDE identity/provenance;
- protected Progress Mountain/cinematic;
- offline tracker;
- auth/privacy/payment;
- production-default-safe state;
- PA-A2/PA-A3 isolation.

Run bounded then broader relevant tests, typechecks, API build and diff safety.

If review finds GREEN blockers, fix them, rerun review/tests, and continue until PASS or a genuine approval boundary.

Create `docs/STAGE_8_REGRESSION_REVIEW.md`.

## O8-C10 — Stage 8 completion gate

Create `docs/STAGE_8_COMPLETION_REPORT.md`. Update `docs/AI_HANDOFF.md` and `docs/AI_CHANGELOG.md`.

Stage 8 may be marked COMPLETE only when:
- challenge/achievement rules are deterministic and evidence-aware;
- one activity can safely produce multiple consequences without duplication;
- real/manual/indoor/simulated semantics remain distinct;
- personal vs future competitive eligibility is explicit;
- core challenge and achievement UX exists;
- offline/pending behavior is honest;
- protected systems remain intact;
- production remains unchanged;
- regressions pass or limitations are clearly documented.

Native-device QA remains a release gate and must be reported honestly.

## O8-C11 — Stage 9 preparation only, if Stage 8 is COMPLETE

If and only if O8-C10 is COMPLETE, perform a read-only audit for the next stage: **Community & Competition**.

Map:
- existing Community screens/APIs;
- friend/local/UK/global concepts;
- monthly Elevation League;
- eligible evidence needed for public ranking;
- privacy/identity concerns;
- anti-cheat/plausibility boundaries;
- moderation/reporting needs;
- challenge-to-leaderboard relationship;
- scalability/query implications.

Desired future tabs remain conceptually:
`Friends | Local | UK | Global`
with filters such as:
`Elevation | Mountains | Expeditions | Distance`.

Do NOT implement Stage 9, create production schema, enable leaderboards, or make privacy decisions overnight.

Create `docs/STAGE_9_COMMUNITY_AUDIT.md` and a proposed Stage 9 command sequence for lead review.

Then STOP.

---

## GREEN authorization

Proceed autonomously with:
- audits/docs;
- typed contracts;
- pure deterministic evaluators;
- additive/default-off services;
- UI refinements/integration within existing navigation;
- tests;
- refactors that preserve behavior;
- non-production additive migration preparation;
- fixing concrete GREEN-scope bugs found by review.

## AMBER

Make the safest reversible design choice and document it where possible. Stop that specific portion if it would materially alter navigation, public competition semantics, persistent model architecture beyond additive compatibility, or accepted Readiness/Expedition/Mountain DNA semantics.

## RED — never execute overnight

Production SQL/schema/migrations; production flags/activation; backfill/reconciliation; deployment/release/store publishing; pricing/payments; auth/privacy changes; destructive SDE work; canonical identity migration; tracker redesign; protected Progress Mountain/cinematic replacement; deletion of user data.

## Completion discipline

Do not chase unrelated cleanup. Do not weaken tests to pass. Do not manufacture data. Do not claim native QA without a real device. Preserve exact evidence/provenance boundaries.

The objective is meaningful finished product progress, not commit count.
