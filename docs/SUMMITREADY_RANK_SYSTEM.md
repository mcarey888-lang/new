# SummitReady Rank System

Status: **VQ-C05 product specification; additive evaluator only.**

Rank is SummitReady's long-term mountain progression identity: who a person is
becoming through sustained, eligible mountain practice. It is not XP, a public
leaderboard, a professional qualification, or a claim of technical safety
competence. Achievements describe what a person has accomplished; Challenges
describe what they are working toward now. Rank is a separate projection.

## Rank ladder

The ladder deliberately avoids generic Bronze/Silver/Gold labels:

1. **Trailhead** — beginning a deliberate mountain practice.
2. **Hillwalker** — building dependable hill experience.
3. **Summiteer** — turning repeated outings into summit experience.
4. **Mountaineer** — demonstrating broad, sustained mountain capability.
5. **Expeditioner** — maintaining a long-term record of prepared mountain
   progression.

There is no claim that the ladder maps to qualifications, grades, leadership,
rescue competence, or readiness for a particular route.

## Deterministic requirements

Every requirement in a rank must be met. Values are cumulative over the
available canonical evidence history.

| Rank | Eligible activities | Eligible elevation | Distinct mountains | Summit completions | Active weeks | Expedition milestones |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Trailhead | 1 | 100 m | — | — | 1 | — |
| Hillwalker | 5 | 1,000 m | 2 | — | 2 | — |
| Summiteer | 12 | 3,000 m | 4 | 2 | 4 | — |
| Mountaineer | 25 | 7,500 m | 8 | 5 | 8 | 1 |
| Expeditioner | 50 | 15,000 m | 12 | 8 | 12 | 3 |

The evaluator is implemented in `utils/rankEvaluator.ts` and the versioned
domain contract is in `utils/rankDomain.ts`. Requirements are data, not UI
heuristics, and the evaluator is pure and non-persistent.

## Evidence eligibility and authority

Only owner-scoped evidence with `qualificationStatus: eligible` and an
eligible outdoor class (`trusted_gps_outdoor` or a canonical summit with both
SDE target identity and provenance hash) contributes. Manual outdoor entries,
indoor sessions, simulated Expedition gain, Community Routes, pending or
unverified records, cross-owner records, invalid timestamps, and unprovenanced
canonical claims cannot advance Rank.

Evidence is reduced by lineage using the shared Stage 8
`compareEvidenceAuthority` order. A correction or revocation therefore replaces
an earlier arrival regardless of input order. Revoked latest evidence contributes
nothing and is retained in the result's exclusion explanation. Activities,
mountains, summits, weeks, and Expedition milestones are then derived only from
the surviving eligible records.

## Progress, missing, and degraded evidence

The evaluator returns the current rank, next rank, each requirement's value,
remaining amount, status, and an overall deterministic progress ratio.

- `met`: authoritative value meets the threshold.
- `missing`: the producer is available, but the threshold is not met or no
  eligible value exists.
- `degraded`: a producer has uncertain/incomplete authority; it may show
  progress but cannot enable promotion.
- `unavailable`: an authoritative producer is not available. The value is
  intentionally `null`, never zero.

Missing available evidence means the requirement is not met. Degraded or
unavailable **mandatory** signals set `promotionBlocked` and are surfaced in
`blockedReasons`; they cannot be silently inferred from local sessions,
readiness, legacy badges, or simulated activity. This is essential while
canonical mountain, verified elevation, summit, and Expedition producers are
not all available.

## Corrections, revocations, and retries

Rank is recomputed from the authoritative evidence set rather than incremented
by UI events. Replaying the same evidence is idempotent. A corrected lineage
uses the shared total authority order; a revoked latest record removes its
contribution and can lower Rank on the next evaluation. No local optimistic
projection may permanently preserve a promotion after its evidence is revoked.

## Anti-gaming boundaries

Rank must not be earned primarily through manual, indoor, simulated, pending,
unverified, duplicated, cross-owner, or client-asserted evidence. Stable
lineage and source authority prevent duplicate replay from inflating totals.
Distinct mountains are keyed by canonical mountain identity where available,
not display names. Active weeks are derived from evidence timestamps using a
locale-independent UTC week bucket. A future authoritative producer may add
stronger plausibility and duplicate-track checks; this specification does not
call any score cheat-proof.

## Existing users and rollout

Existing users are evaluated from the currently available canonical evidence
when the non-persistent evaluator is introduced. Local historical sessions may
remain visible as personal history and may continue to support legacy
Achievements, but they do not become Rank evidence merely because they already
exist. If a required producer is unavailable, the user receives an explicit
degraded/unavailable explanation and no promotion is fabricated. There is no
backfill, migration, persistent Rank record, or automatic conversion of legacy
badges in this gate.

## Relationship to other motivation systems

- **Rank:** long-term progression identity from eligible, authority-aware
  evidence.
- **Achievements:** discrete accomplishments with their own Stage 8
  definitions, evidence purpose, award status, and correction/revocation path.
- **Challenges:** active personal goals and progress projections, with their own
  windows and rule versions.

One activity can independently affect these projections or none of them.
Completing a Challenge does not grant Rank or enroll anyone in competition.
Achieving Rank does not fabricate an Achievement, and an Achievement does not
prove a Rank requirement unless the same eligible evidence independently
qualifies.

## Scope boundary

This specification adds no production schema, migration, persistence, API,
leaderboard, public identity, or UI. The evaluator and focused tests are
development-only pure logic for later review.