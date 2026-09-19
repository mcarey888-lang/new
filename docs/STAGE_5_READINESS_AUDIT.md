# Stage 5 Readiness 2.0 — existing data-flow audit

**Review:** S5-C01 / S5-R01  
**Date:** 2026-09-19 UTC  
**Branch:** `virtual-expeditions-mode`  
**Result:** COMPLETE — read-only audit; no runtime, database, flag, release, or protected-asset change.

## Scope and safety boundary

This audit maps the existing Training Readiness implementation before the
versioned Readiness 2.0 model is specified. It does not choose new weights,
change calculations, apply migrations, enable canonical consumers, modify
production, release mobile, or alter Summit Data Engine identities, Progress
Mountain, or cinematic/live-3D summit behavior.

PA-A2 remains a parked parallel infrastructure issue. The incomplete
24-statement production Publish diff must not be applied, but it does not block
default-safe Stage 5 development.

## Current authority and calculations

The current score authority is the pure mobile utility
`artifacts/summit-ready/utils/readinessScore.ts`.

`calculateReadiness(goal, plan, sessions, options)` currently:

- returns `0` without a goal or plan;
- uses `max(5, fitnessBaseline)` when no completed activity exists;
- combines completed plan sessions with Explore hike records converted to
  cardio-like completed sessions;
- awards consistency, elevation, “big day”, hill/cardio repetitions, effort
  trend, recent activity, and Alpine-requirement points;
- applies effort and inactivity penalties;
- adds the questionnaire/setup fitness baseline;
- caps early scores according to completed-session count and target difficulty;
- can floor a completed prior goal at 85 or supersede the result to at least 95.

The existing component maxima are:

| Component | Maximum / behavior |
|---|---:|
| Consistency | 25 |
| Elevation | 25 |
| Big day | 20 |
| Hill/cardio repetitions | 15 |
| Effort trend | 8 |
| Recent activity | 7 |
| Alpine requirements | up to 10 |
| High average effort penalty | -5 |
| Inactivity penalty | -5 or -10 |

Target elevation is currently normalized against 60% of the goal elevation.
The big-day threshold varies by difficulty: Easy 55%, Moderate 62%, Hard 72%,
Alpine 82%.

`getReadinessStatus()` defines:

- `Ready` at 70 or above;
- `Close` from 40 to 69;
- `Not Ready` below 40.

Achievement thresholds are separate and conflicting:

- “Halfway There” at 50;
- “Summit Ready” at 75;
- “Peak Condition” at 90.

`diagnoseScoreStagnation()` separately reconstructs recent activity and explains
inactivity, overexertion, early-session caps, low elevation, unchanged scores,
and score drops. `isRequirementMet()` separately evaluates plan requirements.
These paths duplicate parts of the score engine rather than consuming one
structured result.

## Current displays and user-facing claims

Readiness appears in:

- Training Home / Plan dashboard, with numeric score and
  Ready/Close/Not Ready labels;
- dashboard coaching requests, where the score is supplied as context to
  `/coach-assessment` and `/coach-ask`;
- setup/edit-goal fitness controls and labels;
- questionnaire result and past-hill prompts;
- session completion messaging (“readiness updated”);
- hike logging messaging that says the hike updates readiness;
- paywall/subscription feature copy;
- achievements driven by independent score thresholds.

The dominant Training hierarchy is already:

**Mountain → Readiness → Next Action → Weekly Progress**

There is no dedicated “Am I Ready?” detail experience and no single structured
result containing dimensions, evidence, confidence, gaps, strengths, next
action, and projected impact.

## Goal, target, and questionnaire inputs

`SummitGoal` in `artifacts/summit-ready/context/AppContext.tsx` carries:

- target mountain name and stable target metadata where available;
- summit date;
- distance, elevation gain, altitude, and difficulty;
- target mountain/route references;
- training availability and fitness baseline;
- separate virtual/simulation state.

Questionnaire/setup inputs include exercise frequency, typical hiking elevation,
longest hike, uphill frequency, prior summit, running, strength, walk duration,
training frequency, available days, equipment, and fitness baseline.

The setup screen maps questionnaire fitness choices to a fixed baseline and
uses separate Beginner/Average/Strong plan-generation logic. These values are
inputs to plan creation and the readiness score, but they are not currently
represented with provenance or confidence.

## Training-plan and completion inputs

Current readiness inputs are local mobile state:

- generated Training plan weeks and sessions;
- completed plan sessions;
- manually completed sessions;
- Explore hikes;
- assigned hills;
- hill/cardio repetition counts;
- reported effort;
- completed goals;
- optional virtual-session count.

The score itself is not persisted as an independent source of truth. AppContext
recalculates it during hydration and after relevant goal, plan, session,
repetition, effort, and Explore-hike mutations. AsyncStorage remains the
authoritative persistence for these released mobile flows.

Planned sessions do not count as completed evidence, but the current
calculation has no typed evidence boundary that clearly distinguishes planned,
manual, indoor, GPS, canonical, stale, invalid, or simulated provenance.

## Activity evidence sources

### Eligible or potentially eligible physical evidence

1. Canonical owner-scoped activities and private evidence, when the canonical
   capability is explicitly available.
2. Existing tracked-hill sessions and Explore hikes with stable activity IDs
   and recorded GPS metrics.
3. Explicit manual/indoor Training completions, currently treated through the
   local session model.
4. Missing or unavailable evidence.

Canonical contracts preserve one physical activity identity and typed links.
Retries deduplicate by stable activity/source identity; changed payloads are
retained as conflicts rather than silently replacing evidence.

### Evidence that must remain excluded or constrained

- planned but incomplete sessions;
- simulated Expedition elevation or simulated stage completion;
- duplicate retries or mirrored completion records;
- invalid/untrusted GPS;
- public leaderboard/community data;
- fuzzy mountain/route-name matches;
- AI-invented route demand;
- Elevation Bank lifetime totals used as if they were recent capacity.

An Expedition GPS activity may represent real physical evidence independently
of its simulated Expedition consequence. The physical activity and simulated
progress must remain separate and must not be double-counted.

## Target mountain and route demand

Approved target demand sources exist in this order:

1. stable Summit Data Engine mountain/route identity and verified route facts;
2. approved canonical route profile/adapters with complete deterministic facts;
3. existing goal metadata already accepted by released flows;
4. explicit unknowns.

Relevant facts are target distance, ascent/elevation gain, route/mountain
identity, difficulty, terrain classification where explicitly verified, and
summit date. Missing facts currently fall back inconsistently across goal,
route, hill, and plan-generation paths. Stage 5 must centralize this resolution
without modifying SDE records or inventing geography.

## API and client contracts

There is no authoritative readiness API or persisted readiness record.
Readiness is calculated locally.

Current indirect API dependencies include:

- hill/route lookup used during questionnaire and setup;
- nearby/assigned-hill resolution;
- plan adjustment;
- coaching routes that consume a supplied readiness score;
- canonical qualification infrastructure that recognizes a `readiness`
  purpose but does not replace the local score;
- activity consequence planning that deliberately does not fabricate a
  readiness value.

Stage 4 canonical history and Stage 2 ledger services are default-safe,
development/test-only or shadowed. Readiness 2.0 cannot depend on production
ledger availability or switch canonical history consumers.

## Offline, cache, and synchronization behavior

Offline tracking is local-first:

- GPS/checkpoints and the activity record are saved locally;
- outbox writes are user-scoped and deduplicated by mutation ID;
- retries occur after sign-in, periodically, and when the app becomes active;
- an 8-second request timeout prevents indefinite blocking;
- successful sync removes only the matching queued payload;
- completion renders `saved_locally`, pending, unavailable, or confirmed
  consequences without blocking Finish/Save.

Stable activity IDs and reliability utilities prevent duplicate completion,
legacy week/index drift, duplicate Expedition hike metrics, and cross-user
checkpoint restoration.

Readiness currently updates immediately from local completion evidence. Any
canonical enrichment arrives later. Stage 5 must preserve this property:
Readiness refresh or server availability may never become a prerequisite for
local save or navigation.

## Legacy fallback and production gates

- Released Training, history, and readiness consumers remain local/legacy
  authoritative.
- Canonical history remains shadow-only until equivalence is proven.
- Stage 2 ledger writes and canonical projection/activation have hard
  non-production gates.
- Production flags remain unset/default-safe.
- Migration `0002_stage2_activity_ledgers.sql` is applied only in development;
  the unsafe production Publish diff remains parked with Replit support.

Readiness 2.0 therefore needs a local deterministic engine with a
provenance-aware adapter that can prefer canonical evidence when available and
fall back safely to trusted released evidence without changing production
capability.

## Duplicate and conflicting calculations

1. The scalar score, status thresholds, achievement thresholds, setup fitness
   labels, requirement checks, and stagnation diagnostics are independently
   implemented.
2. Explore hikes are adapted into session-like records inside the formula,
   while completion/reliability code also maintains activity identity and
   consequence deduplication.
3. Fitness baseline affects both plan classification and readiness without a
   shared typed provenance contract.
4. Target demand is copied into goal state and resolved through multiple hill,
   route, plan, and virtual-target paths.
5. Coaching consumes a caller-supplied scalar rather than the structured
   deterministic result.
6. Some UI claims that completion updates readiness even when evidence quality,
   target facts, or confidence are unavailable.
7. There are no direct tests for the current readiness formula; related
   reliability, completion, canonical qualification, and consequence tests
   cover adjacent boundaries only.

## Migration path to one Readiness service

The safe path is additive and does not require a destructive migration or a
new activity store:

1. Define a versioned, pure, typed Readiness 2.0 input/result contract.
2. Add a target-demand resolver that reads stable SDE/approved facts and
   returns explicit unknowns.
3. Add an owner-scoped evidence adapter that normalizes canonical or trusted
   legacy evidence, with stable deduplication and explicit provenance.
4. Calculate overall score, four dimensions, confidence, strengths, gaps, and
   explanations in one pure engine.
5. Select next action and estimate impact by simulating evidence through that
   same engine without persisting it.
6. Have AppContext derive the result from existing local state; keep the old
   scalar available temporarily as a compatibility projection.
7. Move Training Home, detail, coaching context, completion messaging, and
   achievements to structured result fields only where explicitly included in
   Stage 5.
8. Retain legacy/offline fallback and default-safe unavailable/degraded states.
9. Add direct fixtures/tests before wiring consumers.
10. Remove old duplicate calculation paths only after all consumers and
    regression checks are accounted for.

## Relevant test inventory and gaps

Existing related coverage includes:

- offline reliability, checkpoint restoration, owner-scoped hydration, and
  stable session/activity identity;
- activity completion presentation and delayed/unavailable consequences;
- canonical activity identity, owner isolation, deduplication, and conflicts;
- canonical qualification purpose handling;
- Elevation Bank evidence eligibility;
- activity consequences and simulated Expedition separation;
- canonical/legacy history projection;
- target profile and route identity behavior;
- shared shell and Virtual Expedition isolation.

The primary gap is direct fixture coverage for the current Readiness formula
and its UI contract. Stage 5 must add tests for no/partial/strong/stale evidence,
manual/indoor treatment, duplicate and invalid GPS exclusion, simulated
Expedition exclusion, missing target facts, owner isolation, deterministic
bounds, next-action projection, and offline-safe refresh.

## Protected-boundary result

- Summit Data Engine identities and catalogue: unchanged.
- Progress Mountain and Virtual Expedition progress: unchanged.
- Cinematic/live-3D summit lifecycle and transition: unchanged.
- Offline Start → Track → Pause → Resume → Finish → Save: unchanged.
- Canonical history consumers: unchanged and shadowed.
- Production database, flags, backfill, adapters, activation, and releases:
  unchanged.
- Authentication, payments/pricing, and privacy: unchanged.

No S5-C01 finding requires destructive migration or a major new flow.