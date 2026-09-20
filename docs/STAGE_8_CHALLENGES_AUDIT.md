# Stage 8 Challenges and Achievements Architecture Audit

**Command:** O8-C02  
**Baseline:** `81711de` / accepted Stages 1–7  
**Scope:** Read-only audit; no code, schema, migration, or production changes

## Executive summary

SummitReady already has three different challenge-shaped concepts:

1. local personal challenges in `ChallengesContext`;
2. curated Signature Challenges in the API/database for Expedition discovery;
3. a local achievement catalogue and unlock list used by Profile.

They are useful product inputs but are not one authoritative consequence model.
The Stage 8 foundation should add typed definitions and pure evaluation around
the existing canonical activity/evidence boundary. It must not create a second
activity ledger, copy the Summit Data Engine catalogue, or silently promote
local/manual/simulated evidence into public competition.

The current architecture is suitable for an additive, local/read-only first
foundation. Persistent server progress, awards, or public ranking would require
an explicitly reviewed additive schema and rollout; no production migration is
required for the pure/local foundation described in
`STAGE_8_CHALLENGE_MODEL.md`.

## Existing stores, APIs, and UI

### Local personal challenge store

`artifacts/summit-ready/context/ChallengesContext.tsx` stores
`ActiveChallenge[]` in AsyncStorage. Data is keyed by Clerk user ID, with a
one-time guarded migration from the historical flat key. An active record has a
challenge ID, start time, activity records, completion flag, and completion
time. Activities contain title/date/elevation/distance/duration/notes and an
optional `activityId`.

The context supports start, abandon, log, log-without-session, progress lookup,
and clear operations. It recalculates completion during hydration and prevents a
second local activity with the same activity ID within one challenge. However,
new local IDs use time/random values when no canonical activity ID is supplied,
there is no versioned evidence or qualification reference, and a single
activity is only associated with the challenge being logged. Reprocessing,
correction, revocation, and server reconciliation are not represented.

`constants/challenges.ts` defines the local catalogue. It currently includes
elevation and hike-count metrics, long-running mountain-themed goals, duration
labels, milestones, difficulty, premium metadata, and display copy. The
catalogue is presentation-oriented and does not define evidence policy,
timezone/window semantics, scope, or competitive eligibility.

### Signature Challenges

`lib/db/src/schema/signature-challenges.ts`,
`challenge_stages`, and `challenge_limitations` hold curated Expedition
challenge content. The API routes in
`artifacts/api-server/src/routes/signature-challenges.ts` expose active,
featured, by-mountain, and detail reads. Import is intentionally idempotent by
the curated `challenge_id`.

These records describe a curated mountain adventure: target mountain name,
soft slug, route, recommended days, route-DNA/adventure scores, difficulty,
stages, limitations, source confidence, and artwork status. They are not a
user-owned progress or award ledger. Mountain names/slugs are not canonical SDE
identity; Stage 8 must retain stable SDE references when a challenge targets a
canonical mountain or route.

### Achievements and Profile

`utils/achievements.ts` contains a local static catalogue of session,
elevation, hill, big-day, readiness, and consistency achievements. It defines
display IDs, titles, tiers, categories, and descriptions. Profile derives
unlocked IDs from local application state and displays private stats and
achievement cards in `app/(expedition)/profile.tsx`.

This is a presentation/unlock surface, not an immutable award store. It has no
award identity, evidence reference, correction record, pending state, or
server-owned ownership boundary. Profile statistics are private local
aggregates; they are not a leaderboard or public profile.

### Existing screens and completion flows

- `app/(tabs)/challenges.tsx` lists active/local challenges.
- `app/challenge-detail.tsx` shows a selected local challenge.
- `app/completed-challenges.tsx` shows locally completed challenges.
- `app/challenge-complete.tsx` provides a local celebration.
- Expedition screens consume Signature Challenge content as route/adventure
  context, while Expedition progress/contribution remains a separate simulated
  journey.
- `app/(expedition)/profile.tsx` presents local achievements and private stats.
- `app/community-routes.tsx` browses public user-submitted routes; it is not a
  challenge or competition surface.

The shared tab bar currently places Challenges behind the Community-labelled
tab. This is a navigation compatibility detail, not evidence of a leaderboard
implementation.

## Evidence sources and current consequence boundary

The authoritative physical activity is the existing canonical activity and
legacy-compatible activity flow. `activityConsequences.ts` already supports
multiple consequence kinds from one activity:

- Elevation Bank personal credit;
- Training completion and Readiness impact;
- simulated Expedition stage contribution;
- challenge and achievement hooks;
- canonical mountain/route evidence.

Its `hasApplied`/`markApplied` boundary and stable activity-derived keys are the
correct integration seam. Stage 8 should supply challenge/achievement
evaluation and writers through this seam, not create another activity table or
re-log the same GPS activity.

`canonicalQualificationEvaluator.ts` already distinguishes
`personal_elevation`, `expedition_progress`, `real_summit_evidence`,
`challenge_eligibility`, and `competitive_elevation`, with explicit statuses,
reason codes, rule versions, supersession keys, and owner-bound activity input.
The challenge model should consume these outputs and retain the qualification
version/evidence identity.

Relevant evidence sources:

- trusted completed outdoor GPS activity and its canonical evidence;
- validated elevation where existing rules permit it;
- route/mountain SDE references, preserving provenance and exact version;
- legitimate summit/route evidence under current qualification rules;
- Training completion and Readiness evidence for narrowly defined personal
  milestones;
- Expedition stage/completion consequences, which are simulated and must remain
  Expedition-only;
- local/manual entries, which may support clearly labelled personal history or
  personal achievements but not public competition by default;
- indoor/treadmill/StairMaster evidence, which may support fitness or Training
  achievements but not outdoor elevation, summit, or public competition.

## Idempotency and duplicate risks

1. Local challenge IDs are stable only when a canonical `activityId` is
   supplied; fallback time/random IDs are unsafe for replay.
2. `ChallengesContext.logActivity` also creates Training and Explore records.
   Reusing it for canonical consequence processing could duplicate an activity.
3. The same activity can legitimately produce several consequences, so
   consequence identity must be per activity + consequence target + rule
   version, not one global “already awarded” flag.
4. Existing challenge and achievement hooks are pending legacy hooks; they do
   not yet prove durable exactly-once writes.
5. Signature Challenge `challengeId` is curated content identity, not user
   progress identity.
6. `tracked_routes` is a public route catalogue with contribution records, not
   an activity ledger. Contributions without an explicit contribution ID use a
   time/random fallback and must not qualify public competition automatically.
7. Local session, Explore Hike, Expedition completion, challenge activity, and
   canonical activity records can describe the same event. Stage 8 must use
   exact stable source/activity identity and never fuzzy-match by title, date,
   distance, or elevation.

## Personal versus competitive eligibility

Personal presentation and public eligibility are separate decisions.

| Evidence | Personal challenge/achievement | Future public/competitive |
| --- | --- | --- |
| Trusted completed outdoor GPS activity with accepted evidence | Eligible where the definition allows | Candidate only when the separate competitive qualification is eligible |
| Manual outdoor entry | Personal/history only by default | Ineligible |
| Indoor/treadmill/StairMaster | Training/personal fitness only | Ineligible |
| Simulated Expedition elevation | Expedition milestones only | Ineligible for real outdoor rankings |
| Canonical SDE mountain/route reference | Supports route/mountain context | Does not alone prove a completed summit |
| Community route | History/discovery context | Ineligible for real summit/public ranking by default |
| Pending/offline activity | Display pending, not confirmed award | Ineligible until independently qualified |
| Revoked/deleted/corrected evidence | Recompute and revoke/supersede as required | Remove from eligibility pending policy |

Stage 8 may expose deterministic competitive hooks and flags, but it must not
invent anti-cheat certainty or implement leaderboards.

## Legacy, duplicate, and dead concepts

- Local `ChallengeTemplate` and `ActiveChallenge` are legacy-compatible
  personal state.
- Static `Achievement` definitions and local unlocked IDs are legacy-compatible
  presentation state.
- Signature Challenges are curated Expedition content and must not be merged
  with personal challenge progress.
- Consequence `challenge_hook` and `achievement_hook` are the intended additive
  integration seam but currently report pending legacy handoff.
- Community routes and their contribution records are discovery/evidence
  context, not canonical SDE routes or public competition proof.
- Profile’s local stats must not become a public ranking source.
- No leaderboard store, public achievement API, moderation system, or
  competition privacy policy currently exists.

## Schema and migration implications

The pure/local foundation needs no production migration. Definitions can remain
static/versioned and evaluation can return deterministic consequence intents.
Existing AsyncStorage may hold a compatibility projection keyed by user and
stable evidence identity.

A later durable server implementation would likely need additive,
owner-scoped records for definition version, window, enrollment, progress,
evidence reference, award identity, and correction/revocation state, plus
unique constraints on the idempotency identities. It must reuse canonical
activity/evidence IDs and existing owner isolation. No such schema is created
by O8-C02.

Any design that requires replacing activity identity, copying SDE mountains,
destructively changing existing records, or applying production SQL is outside
GREEN and requires approval.

## Offline implications

Local challenge views and locally known definitions can render offline.
Completion and award state must distinguish:

- `confirmed`: deterministic evidence and local consequence are known;
- `pending`: activity is saved locally or consequence requires sync/server
  confirmation;
- `unavailable`: the definition/evidence needed to evaluate is not present;
- `revoked`: a previously accepted evidence reference was invalidated.

Offline Finish/Save remains immediate and must not wait for challenge evaluation.
Retry/restart must replay the same stable evidence and consequence identities.
Pending UI must never show an unconfirmed award as earned.

## Guardrails for O8-C03 onward

- Keep one physical activity and one canonical evidence identity.
- Allow one activity to produce multiple independently idempotent consequences.
- Keep real elevation, Elevation Bank, Readiness, simulated Expedition progress,
  summit authority, and route provenance separate.
- Keep public/competitive eligibility stricter than personal recognition.
- Do not alter the protected tracker or Progress Mountain/cinematic sequence.
- Keep production frozen; do not apply migrations or enable flags.
- Keep PA-A2 parked and do not start PA-A3.

**O8-R02 status: COMPLETE**