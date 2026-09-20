# SummitReady Rank System

**Status:** VR-C02 specification and additive, pure evaluator. No persistence,
migration, API, leaderboard, or public activation.

Rank is SummitReady's long-term mountain progression identity: who a person is
becoming through sustained, authority-checked outdoor practice. It is not XP, a
professional qualification, a safety certification, or a public competition.
Achievements describe what a person has accomplished; Challenges describe what
they are working toward now.

## Rank ladder and requirements

The ladder intentionally avoids generic Bronze/Silver/Gold labels:

| Rank | Eligible activities | Eligible elevation | Distinct mountains | Summit completions | Active weeks | Expedition milestones |
|---|---:|---:|---:|---:|---:|---:|
| Trailhead | 1 | 100 m | — | — | 1 | — |
| Hillwalker | 5 | 1,000 m | 2 | — | 2 | — |
| Summiteer | 12 | 3,000 m | 4 | 2 | 4 | — |
| Mountaineer | 25 | 7,500 m | 8 | 5 | 8 | 1 |
| Alpinist | 75 | 25,000 m | 16 | 12 | 16 | 5 |
| Expeditioner | 120 | 40,000 m | 24 | 20 | 24 | 10 |
| Summit Elite | 200 | 75,000 m | 40 | 35 | 36 | 20 |

Every requirement for a rank must be met. Values are cumulative over the
surviving owner-scoped evidence set. The ladder does not imply route readiness,
technical competence, leadership, rescue ability, or any external qualification.

## Signal-specific evidence contracts

The authoritative ladder names, identities, and thresholds are centralized in
`artifacts/summit-ready/utils/rankDomain.ts` (`RANKS`). The evaluator is
`artifacts/summit-ready/utils/rankEvaluator.ts`; the input and result types are
in `utils/rankDomain.ts`. Each accepted signal has an exact purpose and rule
version. The current rule version is `summitready-rank-v1`.

| Signal | Accepted producer/class | Exact purpose | Required fields |
|---|---|---|---|
| Eligible activities | `canonical_activity` + `trusted_gps_outdoor` | `rank_real_outdoor` | exact `qualificationRuleVersion: summitready-rank-v1`; finite timestamp; stable `activityId` or source ID |
| Eligible elevation | `canonical_activity` + `trusted_gps_outdoor` | `rank_real_elevation` | exact rule version; finite, non-negative `value`; canonical activity lineage |
| Distinct mountains | `canonical_route_evidence` + `canonical_summit` | `rank_canonical_summit` | exact rule version; `summitCompleted: true`; `sdeTargetId`; `provenanceHash`; canonical mountain identity |
| Summit completions | same canonical summit contract | `rank_canonical_summit` | the same exact proof and identity requirements |
| Active weeks | the accepted outdoor-activity contract | `rank_real_outdoor` | UTC week bucket derived from the valid occurred-at timestamp |
| Expedition milestones | `expedition_consequence` + `trusted_gps_outdoor` | `rank_expedition_milestone` | exact rule version and authoritative consequence producer; completed-stage/completion flag |

The evaluator requires a complete explicit
`Record<RankSignal, RankSignalAvailability>` availability map. Omission is not
availability. In the current application callers mark all Rank producers
`unavailable`, so the UI shows “Evidence building” rather than asserting a
rank from local history.

Missing or `undefined` availability is fail-closed: it is not interpreted as
`available`, `missing`, or zero. A producer marked `degraded` may expose
diagnostic progress, but it cannot satisfy a mandatory requirement or promote
the owner. Any incomplete availability map or uncertain mandatory producer
therefore blocks promotion.

`EvidenceReference.value` is never a generic Rank input. It contributes only to
the elevation signal when the exact `rank_real_elevation` purpose, producer,
class, rule version, owner, and lifecycle checks pass. A value attached to a
wrong-purpose record is excluded. Summit and Expedition booleans on ordinary
GPS records are not authoritative and never qualify a summit or milestone.
Manual, indoor, simulated, Community Route, pending, unverified, cross-owner,
invalid, and unprovenanced evidence cannot advance Rank. Mountaineer, Alpinist,
Expeditioner, and Summit Elite additionally require canonical summit completions
and authoritative Expedition milestones; they cannot be reached through
activity or elevation evidence alone.

## Evaluation and status semantics

The pure evaluator returns current rank, next rank, each requirement's value and
remaining amount, excluded evidence explanations, and a deterministic progress
ratio:

- `met` — authority-checked value reaches the threshold;
- `missing` — the producer is available but the threshold is not reached;
- `degraded` — evidence is incomplete or uncertain and cannot promote;
- `unavailable` — the authoritative producer is not available; the value is
  `null`, never silently converted to zero.

Degraded or unavailable/undefined mandatory signals set `promotionBlocked`.
An available signal that is merely `missing` remains below its threshold and
therefore cannot advance the owner either. Progress can be displayed for
available signals, but it cannot promote through an uncertain or unavailable
requirement.

## Corrections, revocations, and anti-gaming

Evidence is reduced by lineage using the shared Stage 8
`compareEvidenceAuthority` total order. Reversed arrival order, restart, and
correction/revocation therefore produce the same result. A revoked latest
record contributes nothing and remains visible in the exclusion explanation.
Rank is recomputed from evidence; it is not incremented by UI events.

Stable lineage and canonical IDs prevent duplicate replay from inflating
activity or mountain counts. Active weeks use locale-independent UTC buckets.
Future plausibility and duplicate-track checks may add review states, but this
system does not claim to be cheat-proof.

## Existing users and motivation layers

Existing users are evaluated only from evidence that satisfies these contracts.
Local historical sessions may remain personal history and may continue to feed
legacy Achievements, but they do not become Rank evidence automatically. No
backfill, migration, persistent Rank record, or conversion of legacy badges is
performed in this gate.

Rank, Achievements, and Challenges are independent projections. One activity may
affect one, several, or none of them. Completing a Challenge does not grant
Rank; an Achievement does not prove a Rank requirement unless the same evidence
independently satisfies the Rank contract.

## Scope boundary

The additive UI provides a tappable Rank journey and honest unavailable
evidence states. The evaluator and focused tests are development-only pure
logic. No production schema, persistence, public identity, leaderboard,
competitive activation, backfill, deployment, or Stage 9 Community work is
included.