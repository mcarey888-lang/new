# Stage 9 Preparation Audit — Community & Competition

Date: 2026-09-20 UTC
Branch: `virtual-expeditions-mode`
Authorization: O8-C11 read-only preparation after O8-C10 COMPLETE
Status: **AUDIT ONLY — STAGE 9 NOT STARTED**

## Scope and stop condition

This document maps the current Community surface and proposes a future Stage 9
command sequence for lead review.

No Stage 9 implementation, production schema, migration, leaderboard,
competitive qualification activation, public profile, privacy decision,
moderation workflow, backfill, deployment, or release was performed.

After this audit is committed, the overnight run stops.

## Executive summary

SummitReady does not currently have a Community & Competition platform.

The bottom Community tab routes to the personal Challenges screen. A separate
Community Routes screen lists shared tracked routes, and the API exposes public
route discovery. There is no friend graph, public user profile, leaderboard,
competition result store, moderation/reporting system, or authoritative
competitive qualification persistence.

Stage 8 provides a suitable private foundation:

- owner-scoped canonical evidence;
- exact evidence purpose and producer rule;
- deterministic corrections and revocations;
- explicit personal versus competitive-candidate semantics;
- stable challenge identities and windows;
- no promotion of manual, indoor, simulated, unverified, or pending evidence.

That foundation must not be treated as an activated leaderboard. A future
Stage 9 requires explicit product, privacy, identity, moderation, anti-cheat,
schema, and operational decisions before implementation or public activation.

## Current mobile surfaces

### Bottom Community tab

`artifacts/summit-ready/components/SharedTabBar.tsx` maps Community to
`/(tabs)/challenges`.

`artifacts/summit-ready/app/(tabs)/challenges.tsx` is titled
“Community / Challenges” and currently shows:

- personal active/completed challenge counts;
- local/offline challenge progress;
- Stage 8 projection and pending/unavailable qualification;
- challenge cards linking to challenge detail;
- completed challenges linking to the completed list.

It is not a social feed or leaderboard.

### Challenge flow

The current challenge flow is private/local:

- `ChallengesContext` persists owner-keyed local challenge state;
- Stage 8 persists an owner-keyed evidence projection;
- challenge detail and completion are personal;
- Account/Profile surfaces show the signed-in user's own state;
- no challenge links to another user's profile or rank.

### Community Routes

`artifacts/summit-ready/app/community-routes.tsx` is a separate stack route
reached from Expedition Base Camp, not the bottom Community tab.

It displays shared tracked routes and can launch a route into tracking.
Expedition Base Camp also shows a community activity card based on the route
feed.

### Personal tracking and profile

Shared Track and Account/Profile surfaces show the current user's local history,
goals, expedition context, and statistics. They do not expose a social graph,
public identity, follower/friend state, or rank.

## Current API and data surfaces

### Shared tracked routes

`artifacts/api-server/src/routes/tracked-routes.ts` is the only implemented
community-adjacent API:

- authenticated route creation;
- public latest-route listing;
- public nearby-route search;
- public route detail;
- authenticated route contribution;
- authenticated owner deletion.

The current route model has:

- optional creator ID;
- route name/location;
- submitted distance, elevation, duration, and difficulty;
- start coordinates;
- full track points;
- notes;
- contribution count;
- timestamp.

It has no visibility state, public identity contract, moderation status,
geographic cohort, ranking eligibility, competitive evidence status, or
publication consent workflow.

### Existing privacy concern

Public list/nearby responses omit creator identity, but route detail currently
returns the stored row, including creator and detailed route content. Precise
start coordinates, full track points, and notes are privacy-sensitive.

Stage 9 must not build profiles, local rankings, or social attribution on this
legacy public response. A separate review must define:

- whether route sharing is opt-in;
- coordinate and home-location redaction;
- public-summary versus private evidence;
- creator attribution;
- withdrawal/deletion;
- legacy nullable-owner handling;
- retention and takedown.

No privacy behavior was changed during this audit.

### Canonical activity foundation

Canonical activities are private and owner-scoped:

- owner is derived from authentication;
- canonical evidence is private;
- activity visibility supports private/unlisted/public-summary as a future
  boundary;
- owner-scoped identity and correction/conflict handling already exist;
- typed links can reference challenges and community routes.

These records are provenance inputs. They are not a public profile or
leaderboard query model.

### Competitive qualification

The qualification evaluator recognizes future competitive purposes, but
competitive evidence is explicitly not enabled or persistable as a production
authority.

Current structural safeguards include:

- stable owner/source identity;
- lifecycle and evidence states;
- nonnegative metric constraints;
- correction/revocation handling;
- payload conflicts;
- private raw evidence;
- exact SDE identity for verified summit semantics.

Client-supplied evidence state or validated ascent is not sufficient authority
for a public rank.

## Desired conceptual tabs and metrics

The requested future scopes remain conceptual:

`Friends | Local | UK | Global`

Candidate metric filters:

`Elevation | Mountains | Expeditions | Distance`

None is implemented as a competition scope.

### Friends

No friend/follow graph, invitation model, block/mute state, or friend-only
visibility exists.

Questions requiring lead/privacy approval:

- mutual friends versus one-way follows;
- invitation and discovery method;
- default discoverability;
- friend-only activity/score visibility;
- blocking and historical score behavior;
- minors/age policy, if applicable.

### Local

The only current “local” behavior is radius-based shared-route discovery.

A ranking locality must not infer or publish a person's home/current location.
It requires an approved coarse geography model, for example an opt-in region,
club, or broad administrative area. Exact GPS/start coordinates must not define
the public cohort.

### UK

No country/region profile field or verified country membership exists.

The lead must decide whether UK means:

- self-selected profile region;
- broad residence setting;
- activity location;
- club membership;
- another approved non-sensitive rule.

The decision must include travel, relocation, deletion, spoofing, and privacy
semantics.

### Global

No global ranking projection, public participant identity, cursor API, or
moderation capacity exists. Global scope has the highest abuse, scale, and
privacy risk and should be activated last, not used as the MVP default.

## Monthly Elevation League concept

A Monthly Elevation League is feasible only as a new, versioned competition
projection.

Minimum contract:

- competition ID and immutable competition/rule version;
- explicit IANA timezone and start-inclusive/end-exclusive month;
- participant/public-profile reference, never raw Clerk ID;
- exact eligible metric and unit;
- server-confirmed competitive qualification;
- accepted activity/evidence lineage;
- score revision and status;
- pending, confirmed, revoked, disqualified, and unavailable states;
- deterministic tie-break;
- correction/revocation timestamp;
- moderation/adjudication status;
- stable snapshot/cursor semantics.

Do not rank:

- local challenge progress;
- Profile aggregate totals;
- raw tracked-route metrics;
- client-supplied validated ascent;
- manual entries;
- indoor sessions unless a later league explicitly permits them;
- simulated Expedition gain;
- pending/unverified activities;
- Community Route contributions;
- display names, route names, or timestamps as identity.

### Suggested MVP order

Subject to explicit approval:

1. private “your eligible monthly score” preview;
2. opt-in friends-only test cohort;
3. opt-in coarse local cohort;
4. UK cohort;
5. global cohort.

Each expansion requires privacy, moderation, abuse, query-load, and rollback
review. This is a proposal, not an approved product decision.

## Challenge-to-leaderboard relationship

Challenges and competitions should remain separate projections over the same
canonical evidence.

One activity may independently produce:

- personal challenge progress;
- a personal achievement;
- Elevation Bank credit;
- a competition-eligible contribution;
- no public consequence.

Each consequence needs its own:

- immutable definition/rule version;
- idempotency identity;
- evidence purpose;
- status;
- correction/revocation path.

Completing a personal challenge must not automatically enroll the user, expose
their identity, or publish a score. A future challenge may link to a league
definition, but enrollment and competitive qualification must remain explicit.

Signature Challenges are curated Expedition content, not a competition result
store. Community Routes are discovery content, not competitive evidence.

## Public identity and privacy gaps

There is no approved public identity model.

A future model must be separate from internal Clerk owner IDs and define:

- stable public participant ID;
- display name/handle rules;
- avatar policy;
- discoverability;
- profile and metric visibility;
- scope-specific consent;
- rename/history behavior;
- account deletion and score anonymization/removal;
- blocked-user behavior;
- data export;
- retention;
- legal/age requirements.

Clerk IDs, email addresses, precise GPS, raw evidence, and private canonical
records must never be returned as leaderboard identity.

Privacy defaults and consent/withdrawal rules are approval decisions and are
not decided by this audit.

## Anti-cheat and plausibility boundaries

There is no competition anti-cheat service.

Existing integrity controls do not prove competitive legitimacy. A future
system may evaluate:

- duplicate source/activity lineage;
- impossible speed or elevation-rate segments;
- GPS gaps and teleportation;
- repeated/overlapping tracks;
- elevation-source disagreement;
- device/source attestation;
- cross-account duplicates;
- unusual correction frequency;
- route/SDE plausibility;
- revoked/deleted evidence;
- appeal and manual adjudication.

These checks produce evidence and review states, not certainty. The product
must not claim that a score is “cheat-proof.”

Only server-confirmed competitive qualification may enter a public projection.
Offline optimistic progress can remain visible privately but must not be
publicly ranked until confirmed.

## Moderation and reporting gaps

No user-facing system exists for:

- report;
- block/mute;
- takedown;
- moderation queue;
- moderator action audit;
- score disqualification;
- appeal;
- content or display-name review;
- contribution withdrawal;
- abuse rate limiting.

Before any public identity, route attribution, comments, or ranking activation,
Stage 9 needs:

- reportable object types and reason codes;
- reporter privacy and abuse prevention;
- moderation roles and authorization;
- queue ownership and service expectations;
- action history;
- user notification;
- appeal/reinstatement;
- retention/deletion;
- emergency disable/rollback.

No public launch should occur without an owned moderation process.

## Scalability and query implications

Current schemas and APIs are not leaderboard-ready:

- no competition/participant/result projection;
- no score/time-window ordering index;
- no region/friend scope index;
- no stable rank tie-break;
- no cursor pagination;
- no snapshot version;
- no revocation-aware public query;
- no materialized aggregate;
- no geospatial index for route discovery;
- public route search reads a bounded latest set and filters nearby in memory;
- full JSON track payloads are expensive and privacy-sensitive.

A future competition result should be a separate projection keyed by
competition/version and participant, not a live aggregation over mutable
canonical activities.

Candidate query requirements:

- competition ID/version + scope;
- metric + month;
- region/friend cohort;
- confirmed eligibility only;
- score descending + deterministic tie-break;
- cursor/snapshot pagination;
- participant's own rank without scanning all rows;
- correction/revocation update path;
- moderation status filter;
- bounded public payload without raw evidence.

Scale targets, refresh latency, and consistency guarantees require lead
approval before schema design.

## Stage 9 approval boundaries

### RED until explicit approval

- production schema or migration;
- production backfill/reconciliation;
- public leaderboard endpoint or activation;
- competitive qualification persistence/activation;
- public profile or Clerk identity exposure;
- privacy/consent default;
- precise-location publication;
- friend graph;
- moderation or enforcement policy;
- ranking manual, indoor, simulated, unverified, pending, or client-asserted
  evidence;
- deployment or mobile release.

### Required lead decisions

1. Stage 9 MVP scope: private preview, Friends, Local, UK, or another sequence.
2. Public identity and discoverability model.
3. Consent, withdrawal, deletion, and retention behavior.
4. Local/UK cohort definition.
5. Eligible metrics and evidence.
6. Competition timezone and tie-break.
7. Anti-cheat review/adjudication policy.
8. Moderation ownership, reporting, appeals, and emergency shutdown.
9. Scale/latency targets.
10. Production rollout and rollback gates.

## Proposed Stage 9 command sequence for lead review

This is a proposal only. None of these commands is authorized by O8-C11.

### S9-C01 — Product, privacy, and threat-model decision record

Read-only/design work:

- choose candidate MVP scope;
- define public identity options;
- define consent/withdrawal/deletion options;
- map abuse cases and threat actors;
- define moderation ownership options;
- record unresolved decisions.

**Gate:** lead, privacy/security, and moderation-owner approval before any
schema or public API work.

### S9-C02 — Competitive eligibility contract

Design and pure tests only:

- versioned competition purpose/rule;
- accepted evidence classes;
- correction/revocation semantics;
- anti-cheat/plausibility states;
- pending/confirmed/revoked/disqualified outcomes;
- explicit exclusion matrix.

**Gate:** no activation or persistence until the contract and policy are
approved. Preserve Stage 8 personal qualification semantics.

### S9-C03 — Public identity and scope contract

Design and pure contracts:

- public participant identity separate from Clerk;
- profile visibility/discoverability;
- Friends/Local/UK/Global cohort identity;
- block/delete/rename behavior;
- geoprivacy/redaction.

**Gate:** explicit privacy approval. Do not infer locality from GPS or expose
internal owner IDs.

### S9-C04 — Additive development schema proposal

Prepare a reviewed, non-production additive proposal for:

- competitions/versions;
- participant enrollment and consent;
- immutable result/contribution lineage;
- public profile reference;
- moderation/report/action audit;
- correction/revocation;
- indexes and cursor snapshots.

**Gate:** separate approval before creating or applying any migration. No
production SQL, migration, or backfill.

### S9-C05 — Default-off server projection and read contracts

After C01–C04 approval:

- owner-safe competitive qualification adapter;
- idempotent result projection;
- correction/revocation path;
- private “my eligibility/score” read;
- cursor/snapshot contracts;
- no raw evidence in public payload.

**Gate:** development/test only and default-off. Security review required.

### S9-C06 — Moderation, reporting, and operational controls

After moderation ownership is approved:

- report/block contracts;
- moderator authorization and action audit;
- disqualification/appeal workflow;
- emergency competition disable;
- abuse/rate controls;
- retention/deletion tests.

**Gate:** no public cohort without an operational owner and tested rollback.

### S9-C07 — Private competition preview UX

Build the lowest-risk private experience:

- eligible versus pending score;
- evidence/reason explanation;
- correction/revocation feedback;
- opt-in and withdrawal;
- no public identity or rank by default.

**Gate:** native-device, accessibility, privacy-copy, and offline-state QA.

### S9-C08 — Opt-in cohort UX

Only after explicit scope approval:

- tabs conceptually `Friends | Local | UK | Global`;
- filters `Elevation | Mountains | Expeditions | Distance`;
- empty/loading/pending/revoked/moderated states;
- report/block controls;
- participant privacy and visibility controls.

Unsupported tabs/filters must remain unavailable, not use fabricated data.

**Gate:** staged dark launch; Friends before broader public scopes unless the
lead approves another sequence.

### S9-C09 — Architecture, security, privacy, and scale review

Adversarial review:

- owner/public identity leakage;
- precise-location leakage;
- ineligible evidence;
- duplicate scores;
- corrections/revocations;
- account deletion;
- block/report enforcement;
- moderation bypass;
- ranking stability;
- cursor/snapshot consistency;
- query load and denial-of-service;
- rollback and kill switch;
- protected Stage 5–8 regressions.

Fix only authorized GREEN blockers. Stop on unresolved privacy, moderation,
production, or policy boundaries.

### S9-C10 — Completion and activation proposal

Document:

- implementation and test evidence;
- exact disabled/default-off state;
- native-device QA;
- privacy/security/moderation approval evidence;
- development migration state;
- production diff review;
- backfill/reconciliation proposal;
- staged activation and rollback.

Stage 9 code completion must remain separate from production/public activation.
Production migration, leaderboard activation, and release require new explicit
authorization.

## O8-C11 conclusion

The read-only Stage 9 preparation audit and proposed command sequence are
complete.

Stage 9 remains **NOT STARTED**. The overnight run stops here as required.