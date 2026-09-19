# Stage 5 Readiness 2.0 — completion report

**Review:** S5-C10 / S5-R10
**Date:** 2026-09-19 UTC
**Branch:** `virtual-expeditions-mode`
**Implementation range:** `ead1c0d` through `393f559`
**Result:** **COMPLETE** under the Stage 5 runbook. Stage 6 must not begin.

## Completion rule and safety boundary

Readiness 2.0 is deterministic, explainable, bounded, evidence-backed, and
visible in Training Home and the detailed “Am I Ready?” experience. The
implementation is additive and local-first. No production schema, database,
flag, backfill, reconciliation, canonical-history switch, mobile release,
payment, authentication, privacy, Summit Data Engine identity, Progress
Mountain, or cinematic/live-3D change was made.

Native-device QA was not run. This report is not mobile release approval.

PA-A2 remains an unresolved parallel Replit Publish issue. The unsafe
24-statement production diff was not applied, the reviewed `0002` migration was
not changed or published, and production remains frozen/default-safe.

## S5-C01 through S5-C10 result

| Checkpoint | Result | Primary output |
|---|---|---|
| S5-C01 / R01 | COMPLETE | `docs/STAGE_5_READINESS_AUDIT.md` |
| S5-C02 / R02 | COMPLETE | `docs/STAGE_5_READINESS_MODEL.md` |
| S5-C03 / R03 | COMPLETE | Pure versioned engine and fixtures |
| S5-C04 / R04 | COMPLETE | Stable target-demand resolver |
| S5-C05 / R05 | COMPLETE | Deterministic action/projection service |
| S5-C06 / R06 | COMPLETE | Training Home Readiness 2.0 surface |
| S5-C07 / R07 | COMPLETE | Detailed “Am I Ready?” screen |
| S5-C08 / R08 | COMPLETE | Offline-safe completion/evidence integration |
| S5-C09 / R09 | COMPLETE | `docs/STAGE_5_REGRESSION_REVIEW.md` |
| S5-C10 / R10 | COMPLETE | This report and coordination updates |

## Model and formulas

The model version is `readiness-v2.0.0`, evaluated by a pure deterministic
engine with no clock, network, database, randomness, or mutable state.

The four weighted dimensions are:

- **Endurance — 30%:** recency-weighted best distance, explicit sustained
  duration, and 42-day cumulative distance against verified demand.
- **Elevation Capacity — 30%:** recency-weighted best ascent, 42-day cumulative
  ascent, and 21-day recent ascent against verified target ascent. This is
  distinct from lifetime Elevation Bank.
- **Consistency — 25%:** active weeks, completed due sessions, and recency over
  six weeks, with volume caps.
- **Mountain Experience — 15%:** real outdoor hill/mountain outings and
  explicitly verified relevant terrain only.

Evidence uses a 42-day half-life and excludes evidence older than 180 days.
Scores are bounded `0..100`; unavailable is represented as `overallScore: null`,
not a fabricated zero. Partial demand/evidence returns an explicit degraded
state with missing-data callouts.

Manual and indoor evidence has reduced influence. Planned, incomplete,
simulated Expedition, duplicate, invalid/untrusted GPS, future, malformed, and
public leaderboard evidence is excluded. A real Expedition-associated GPS
activity may count once as physical evidence.

Caps prevent sparse, stale, incomplete-target, and manual-only evidence from
appearing overconfident. Confidence is descriptive and does not multiply the
score.

## Evidence and target-demand sources

Evidence is owner-scoped and provenance-aware, preferring:

1. eligible canonical GPS activity evidence;
2. trusted tracked-hill/Explore GPS evidence;
3. explicit manual/indoor Training evidence;
4. explicit missing evidence.

Canonical activity IDs are preferred for deduplication, with stable source IDs
as the legacy fallback. Completion adaptation preserves GPS provenance,
canonical/stable activity identity, Expedition association, and local/queued/
synced state. Local completion therefore updates derived Readiness immediately
without waiting for network sync.

Target demand resolves each field independently from:

1. stable verified Summit Data Engine mountain/route facts;
2. approved canonical route profiles;
3. already-accepted released goal metadata;
4. explicit unknown.

The resolver does not fuzzy-match names, invent route metrics, or mutate the
Summit Data Engine. Invalid or missing distance/ascent remains unknown and
reduces confidence/state rather than becoming invented data.

## Next action and projection

The highest-value action is selected deterministically from existing incomplete
Training context, ranked by dimension gap, relevance, scheduled date, and stable
ID. Explicit overload favors recovery.

Projected impact clones the input, adds proposed evidence, and reruns the exact
same model. It is shown only when sufficient target/action facts exist, is
labelled estimated, and is capped for display. Projected evidence is never
persisted, marked complete, synced, written to history, or credited to Elevation
Bank.

## User-facing outcomes

Training Home preserves:

**Mountain → Readiness → Next Action → Weekly Progress**

It now presents one dominant score, four concise dimensions, strongest gap and
reason, confidence, deterministic next action, estimated impact when supported,
and a route to detail without adding a primary navigation tab.

The detailed “Am I Ready?” experience presents target mountain/date, score,
four dimensions with evidence summaries, real trend only where evidence exists,
missing-data callouts, next action/estimated impact, and concise limitations.
No paywall or pricing behavior changed.

## Verification evidence

The bounded S5-C09 commands produced:

- SummitReady focused regression: **63/63** across nine files;
- API focused regression: **85/85** across eight files;
- SummitReady TypeScript: **PASS**;
- API production bundle: **PASS**;
- database package TypeScript: **PASS**;
- `git diff --check`: **PASS**.

The mobile coverage includes the Readiness engine, target demand, actions and
projection, adapter/evidence integration, offline reliability, tracking launch,
completion presentation, canonical history projection, and Expedition
isolation. API coverage includes canonical identity/links/activation, Stage 2
planning, Elevation Bank, activity consequences, projections, and safe history
fallback.

## Offline and production capability

Finish/Save remains immediate and local-first. Readiness refresh is derived
after local state changes and never blocks navigation or outbox persistence.
Delayed sync may enrich canonical evidence later. No Readiness 2.0 production
endpoint or Stage 2 ledger capability is required.

Production remains unchanged/default-safe:

- no production migration or SQL;
- no Stage 2/4/5 production flags;
- no backfill/reconciliation;
- no canonical-history consumer switch;
- no adapter/runtime activation;
- no production/mobile release.

## Protected boundaries and limitations

Summit Data Engine identities/catalogue, Progress Mountain, Virtual Expedition
simulation, and cinematic/live-3D summit transitions are unchanged. Canonical
identity, Elevation Bank separation, simulated-versus-real Expedition semantics,
shared shell, authentication, payments, and privacy remain protected.

Readiness is a training heuristic, not medical advice and not a guarantee of
fitness, health, acclimatization, weather safety, route conditions, navigation,
technical competence, or summit success. Missing evidence is not proof of
unreadiness, and a score is not a safety clearance.

## Native QA and release status

Native-device QA was **NOT RUN**. Before any mobile release, a native-compatible
build must verify authenticated Home/detail rendering, offline
Start → Track → Pause → Resume → Finish → Save, restart recovery, delayed sync,
and subsequent Readiness refresh. No store or production mobile release is
claimed or authorized by this completion report.