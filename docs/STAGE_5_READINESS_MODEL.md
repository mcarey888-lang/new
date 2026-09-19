# Stage 5 Readiness 2.0 — versioned model specification

**Review:** S5-C02 / S5-R02  
**Date:** 2026-09-19 UTC  
**Model version:** `readiness-v2.0.0`  
**Result:** COMPLETE — additive pure-model specification; no migration or major new persistence flow required.

## Contract

Readiness is evaluated by a pure function:

```ts
evaluateReadiness(input: ReadinessInput): ReadinessResult
```

`ReadinessInput` contains an explicit `ownerId`, `asOf` timestamp, resolved
target demand, normalized completed evidence, optional Training plan context,
and optional previous result for a real trend. It contains no database handle,
network client, clock, random source, or mutable application state.

`ReadinessResult` contains:

- `modelVersion: "readiness-v2.0.0"`;
- `state: "available" | "degraded" | "unavailable"`;
- `overallScore: number | null`;
- Endurance, Elevation Capacity, Consistency, and Mountain Experience results;
- `confidence: "high" | "medium" | "low" | "none"`;
- included/excluded evidence summaries with provenance;
- deterministic strengths, gaps, explanations, and missing-data notices;
- optional next action and estimated projected impact;
- limitations and the caller-supplied evaluation time.

Unavailable is not represented as zero. Every score is a finite integer in
`0..100`.

## Target demand

Target facts resolve in strict order:

1. stable Summit Data Engine mountain/route facts;
2. complete approved canonical route profile;
3. already-accepted goal metadata used by released Training;
4. explicit unknown.

The resolver returns each fact independently with source and confidence:
stable mountain/route identity, distance km, ascent m, expected duration where
explicitly available, difficulty, verified terrain tags, altitude, and target
date. It never fuzzy-matches a name, invents route facts, mutates SDE data, or
uses AI geography.

Invalid, negative, non-finite, or zero demand is unknown. A missing target
identity and all missing demand facts makes the result unavailable. Partial
demand produces a degraded result and missing-data callouts.

## Evidence normalization and eligibility

Evidence must be completed, owner-matching, physically occurring, timestamped,
and stably identified.

Preference:

1. eligible canonical GPS evidence;
2. trusted tracked-hill/Explore GPS evidence;
3. explicit manual or indoor Training completion;
4. missing evidence.

Deduplication keys:

1. `(ownerId, canonicalActivityId)` when present;
2. otherwise `(ownerId, sourceType, stableEvidenceId)`.

For duplicate representations, choose one deterministic winner:
canonical over legacy, synced over queued/local, trusted GPS over manual, then
latest valid revision. Conflicting representations are never summed.

Exclude:

- another owner’s activity;
- planned/incomplete sessions;
- simulated Expedition stage/elevation data;
- duplicate retries/mirrors;
- invalid or untrusted GPS;
- future-dated or malformed evidence;
- public leaderboard/community records;
- evidence older than 180 days;
- any projected action.

A real Expedition-associated GPS activity may count once as physical evidence;
its simulated Expedition consequence never counts.

Manual/indoor multipliers:

| Contribution | Multiplier |
|---|---:|
| Endurance duration/distance | 0.70 |
| Elevation with explicit recorded ascent | 0.50 |
| Consistency completion | 0.70 |
| Mountain Experience | 0 unless verified real outdoor terrain exists |

Never infer ascent from indoor incline, distance from duration, or technical
competence from elevation.

## Recency

For evidence age `d` days:

```text
recency(d) = exp(-ln(2) × d / 42)
```

The 42-day half-life applies to metric contributions. Evidence from 91–180 days
may support historical experience but is stale and cannot create a high
confidence result. Evidence older than 180 days is excluded from the score.
Future timestamps are invalid.

## Dimensions

Each dimension is `0..100`. Available subcomponents are renormalized within
their dimension. Missing demand never becomes a zero contribution.

### Endurance — 30%

- 60%: best recency-weighted completed distance / target distance;
- 25%: best recency-weighted sustained duration / explicit target or longest
  planned-session duration;
- 15%: recency-weighted 42-day cumulative distance /
  `(2.5 × target distance)`.

Ratios clamp to `0..1`. At least distance or explicit duration demand is needed;
otherwise Endurance is unavailable.

### Elevation Capacity — 30%

- 55%: best recency-weighted ascent / target ascent;
- 30%: recency-weighted 42-day cumulative ascent /
  `(2.5 × target ascent)`;
- 15%: recency-weighted 21-day cumulative ascent / target ascent.

Only explicit eligible recorded ascent counts. This is recent capacity, not
lifetime Elevation Bank.

### Consistency — 25%

Measured over the most recent six weeks:

- 40%: active weeks / 6;
- 40%: weighted completed due Training sessions / due planned sessions;
- 20% recency:
  - 0–3 days: 100;
  - 4–7: 80;
  - 8–14: 55;
  - 15–28: 25;
  - over 28: 0.

When no plan exists, the completion component uses a conservative two eligible
activities per active week expectation. Additional volume above the cap does
not increase the dimension.

### Mountain Experience — 15%

Only real outdoor evidence contributes:

- 45%: up to four eligible hill/mountain outings in 180 days;
- 35%: up to three outings with explicit verified relevant terrain;
- 20%: up to two distinct sustained mountain days reaching at least 40% of
  target ascent or distance.

No score implies navigation, scrambling, exposure, weather judgement,
acclimatization, or technical competence.

## Overall score and caps

Default dimension weights are 30/30/25/15. If one target-dependent dimension is
unavailable, available weights renormalize and the result is degraded.

Caps:

- one or two eligible activities: overall maximum 55;
- fewer than three distinct active weeks: maximum 70;
- stale-only evidence (no evidence within 90 days): maximum 60;
- missing distance or ascent target demand: maximum 75;
- manual/indoor-only evidence: maximum 65;
- no eligible evidence: unavailable, score `null`.

There is no questionnaire baseline floor, completed-goal 85/95 floor, virtual
session credit, or simulated Expedition contribution in v2.

## Confidence and state

Confidence is descriptive and never multiplies the score:

- **high:** complete target distance/ascent, at least seven eligible activities
  across at least three weeks, and a majority of canonical/trusted GPS;
- **medium:** at least three eligible activities and usable target demand;
- **low:** one or two activities, stale evidence, manual-heavy evidence, or
  materially incomplete target facts;
- **none:** no eligible evidence.

`available` requires eligible evidence and sufficient target facts to calculate
at least three dimensions. `degraded` has a score but incomplete target or
evidence coverage. `unavailable` has no defensible score.

## Explanations, strengths, and gaps

Dimension explanations cite normalized metrics, target facts, evidence IDs, and
provenance. Strengths sort by highest dimension score. Gaps sort by largest
shortfall from 100. Ties use fixed order: Endurance, Elevation Capacity,
Consistency, Mountain Experience.

Copy must distinguish:

- “recorded” from “estimated”;
- “missing evidence” from poor performance;
- real physical evidence from simulated Expedition progress;
- recent Elevation Capacity from lifetime Elevation Bank.

## Next best action

Candidate actions come first from existing incomplete Training sessions.
Fallback actions are deterministic and gap-specific: easy aerobic work,
progressive hill work, outdoor terrain exposure, or recovery.

Ranking:

1. largest current dimension gap;
2. action’s explicit evidence relevance;
3. earliest scheduled date;
4. stable session/action ID.

Recovery outranks training when recent effort/fatigue data explicitly indicates
overload. The engine never invents a completed action.

## Projected impact

Projection:

1. clones normalized input;
2. converts the proposed action to explicitly projected evidence;
3. evaluates it through the same `readiness-v2.0.0` engine;
4. discards the cloned state.

Show `current → projected` only when the current result has a score, required
target facts exist, and the action has explicit estimable metrics. Round to
whole scores, cap displayed delta at 20, label it “estimated”, and explain
missing projections.

Projected evidence is never persisted, marked complete, written to history or
Elevation Bank, queued for sync, or treated as real progress.

## Trend

A trend is shown only when a prior result from the same model version exists
with a known evaluation timestamp and source evidence. Recompute both snapshots
through the same model where possible. Never synthesize historical scores from
the current scalar or draw a chart from planned work.

## Fixture and test matrix

Before consumer wiring, table-driven tests must cover:

1. missing target/no evidence → unavailable/null;
2. one trusted GPS activity → low confidence and bounded result;
3. strong multi-week GPS evidence;
4. partial target demand and dimension renormalization;
5. stale and over-180-day evidence;
6. manual-only and indoor-only multipliers/cap;
7. mixed GPS/manual provenance;
8. planned, incomplete, simulated, leaderboard, and invalid GPS exclusion;
9. real Expedition GPS included exactly once;
10. canonical/legacy duplicate and retry deduplication;
11. owner isolation;
12. malformed, negative, non-finite, and future metrics;
13. exact 0/42/90/180-day recency boundaries;
14. below/equal/above target normalization;
15. consistency volume cap;
16. early, stale, missing-fact, and manual-only caps;
17. deterministic tie ordering and repeatability;
18. next-action selection;
19. same-engine projection and non-persistence;
20. fully offline local evidence;
21. legacy AppContext adaptation and scalar compatibility;
22. every score/dimension remains within `0..100`.

## Safety limitations

Readiness 2.0 is an explainable Training heuristic. It is not medical advice
and does not guarantee fitness, health, acclimatization, safe weather, route
conditions, navigation skill, technical competence, or summit success.

## Migration assessment

No destructive migration, new activity store, production schema change,
backfill, canonical-history switch, or mandatory online flow is required.
Implementation is an additive typed adapter, pure engine, derived AppContext
result, and temporary scalar compatibility projection.