# S2-R01 — Unified Activity Architecture Audit

Status: **COMPLETE**
Command: `S2-C01`
Date: 2026-09-19
Scope: audit and design only

## Executive conclusion

SummitReady should keep **Training**, **Expeditions**, and **Free Hike** as separate product experiences while converging their physical work onto one canonical activity record.

The Phase 1 foundation is suitable for that convergence:

- `canonical_activities` is the owner-scoped physical-event anchor.
- `canonical_activity_evidence` separates evidence from summary data.
- `canonical_activity_links` allows one activity to contribute to several independent product contexts without copying it.
- `canonical_activity_qualifications` can decide eligibility separately for personal history, readiness, personal elevation, real summit evidence, leaderboards, and achievements.
- `canonical_activity_conflicts` preserves conflicts rather than overwriting accepted facts.

Stage 2 should add adapters and missing purpose-specific records around that foundation. It should not merge Training and Expeditions, create a second activity ledger, copy the Summit Data Engine, infer real summits from simulations, or modify the protected Progress Mountain/3D summit experience.

## 1. Current activity-system map

| Flow | Current storage and IDs | Evidence/elevation and completion | Downstream effects and risks | Proposed canonical relationship |
|---|---|---|---|---|
| GPS tracked hill session | `tracked_hill_sessions`; numeric row ID, client `activity_id`, optional hill/route and canonical activity IDs. Saved through `/hill-session/save-tracked` (`artifacts/api-server/src/routes/hill-session.ts:181-200,300-327`). | GPS track, elevation profile, recorded distance/ascent/duration, quality and match scores. Completion type is `tracked_gps` (`hill-session.ts:21-62,221-223`). | May update hill verification aggregates. Legacy `activity_id` is globally unique; owner collisions require explicit handling (`hill-session.ts:224-359,387-390`). | Existing bridge is correct: source `tracked_hill_session:<activityId>`, GPS/profile evidence, plus independent Training, hill, route, Expedition, or challenge links (`hill-session.ts:244-280`). |
| Free Hike GPS tracking | Uses the same tracker and tracked-session path. Active recovery is a user-scoped AsyncStorage checkpoint (`artifacts/summit-ready/utils/activeHikeSession.ts:6-48`). | Recorded GPS evidence when tracked. The checkpoint is in-progress state, not completion evidence. | Can duplicate a Training/Expedition contribution if another flow saves the same physical hike under another source ID. | One canonical activity with `primary_context=free_hike`; later attach additional Training/Expedition links rather than creating another activity. |
| Training manual hill completion | `/hill-session/complete` creates an `estimated_manual` tracked session without GPS and currently without the canonical bridge (`artifacts/api-server/src/routes/hill-session.ts:132-176`). | Planned/estimated gain, no GPS, `used_for_verification=false`. | A plan session can be marked complete locally and also create a separate legacy/manual or later GPS record. Manual retries lack the stable activity identity used by tracked saves. | Add a stable client source ID and a Phase 1 ingestion adapter. Evidence class remains manual/estimated; eligibility is purpose-specific and must not become competitive by default. |
| Training GPS completion | Training launches the shared tracker and supplies plan/session metadata (`artifacts/summit-ready/app/(tabs)/plan.tsx:49-108`). | Recorded GPS evidence and the same quality path as Free Hike. | Plan completion, tracked-session storage, recent activity, readiness, and elevation totals can all advance through separate state paths. | Keep one GPS canonical activity; link `training_plan` and `training_session`. Readiness must be a qualification derived from that activity, not a second activity record. |
| Logged hill / ExploreHike | Device-local `ExploreHike` entries are created by the log modal and stored with other app state (`artifacts/summit-ready/components/LogHikeModal.tsx:42-73`; `artifacts/summit-ready/app/(tabs)/hills.tsx:108-122,361-364`). | Usually manual/estimated evidence; elevation may be user-entered or derived from selected route/hill data. | The same hike can also appear as a tracked session, challenge activity, Expedition contribution, or plan completion. Names and dates are not safe dedupe keys. | Give each log a stable source-qualified ID and ingest once. Link it to existing hill/route identities only when identity is explicit; never fuzzy-merge by name/metrics. |
| Expedition route tracking and stage contribution | Expeditions keep separate run/progress state and completed route identity keys. They consume local hike logs and matched routes (`artifacts/summit-ready/app/(expedition)/progress.tsx:55-109,214`; `artifacts/summit-ready/app/(tabs)/hills.tsx:186-210`). | Physical evidence comes from the contributing real hike. Expedition target demand and simulated elevation are not evidence that the target summit was climbed. | One hike may count toward a stage, journal, score, challenge, and personal totals. Current progress is largely aggregate/local and does not retain a durable canonical contribution ledger. | Link the physical activity to `expedition` and `expedition_stage`. Add a separate Expedition run/stage contribution record later; do not change the activity's physical facts or create a real summit. |
| Training history / Recent Activity / Expedition Journal | Primarily projections of local Session, ExploreHike, ChallengeActivity, saved Expedition, and plan-completion state, rather than one server history (`SUMMITREADY_2_ARCHITECTURE_AUDIT.txt:7-25`). | Mixed recorded, manual, planned, and simulated values. | Different projections can show or total the same physical event more than once. Cross-device restore and authoritative correction are incomplete. | Treat canonical activities as universal private history. History, Recent Activity, and Journal become projections over links and qualifications; product-specific narrative remains separate. |
| Elevation totals / readiness | Existing calculations consume multiple local models and tracked-session values. Recorded ascent, validated ascent, planned route gain, summit altitude, and simulated target demand are not equivalent (`SUMMITREADY_2_ARCHITECTURE_AUDIT.txt:34-40`). | Mixed GPS, manual estimate, training/indoor, or unavailable evidence. | Double credit and semantic mixing are the highest-risk failure modes. | Store physical metrics once. Issue separate versioned qualifications/credit events for readiness, personal Elevation Bank, and any future competitive total. |
| Challenges / achievements | Challenge links are supported by the canonical schema, but enrollment, progress, completion, and award lifecycle remain in existing local/product state. | Eligibility varies by challenge and evidence quality. | A challenge completion can be mistaken for a new physical activity or awarded twice on retry. | Link the same activity to `challenge`; store versioned eligibility separately. Add durable challenge/award lifecycle records only in a later additive command. |
| Mountain/hill completion | Existing app hills, Expedition completion, and future real summit records represent different concepts. | A real summit needs explicit mountain/route identity and evidence; Expedition simulation is not summit evidence. | Name matching, route completion, or simulation could create false summit claims. | Add a separate real-summit record in a later command, linked to a canonical activity and an immutable Summit Data Engine mountain/route reference. Never infer it from Expedition completion alone. |

## 2. Fragmentation and duplication risks

1. **One hike can exist in several stores.** Session, ExploreHike, ChallengeActivity, tracked sessions/routes, plan completion, Expedition progress, Journal, and aggregate totals can each represent or consume the same event.
2. **IDs have different scopes.** Client activity IDs, numeric database IDs, local timestamps, spreadsheet IDs, app hill/route IDs, Summit Data Engine UUIDs, and route identity keys are not interchangeable.
3. **Legacy uniqueness differs from canonical uniqueness.** `tracked_hill_sessions.activity_id` is globally unique; canonical identity is owner-scoped `(owner_user_id, source_type, source_id)`.
4. **Manual and GPS paths differ.** GPS tracked saves already bridge to canonical activities. Manual Training completion does not yet have equivalent stable idempotent ingestion.
5. **Names are not identities.** Repeated summit names, aliases, transliteration, Unicode normalization, and multiple routes make name/date/metric matching unsafe.
6. **Metrics have different meanings.** Recorded ascent, validated ascent, estimated gain, planned gain, summit altitude, and simulated target elevation must not be summed as one field.
7. **Aggregate product state loses provenance.** Readiness, Expedition stage progress, challenge progress, and elevation totals can advance without retaining a durable list of contributing canonical activities and rule versions.
8. **Retry paths can double-award downstream effects.** Canonical ingestion deduplicates its own activity identity, but local achievements, plan completion, Expedition progress, and credit totals need their own idempotent projections.

No automatic fuzzy merge should be introduced in Stage 2. Ambiguous legacy records should remain unlinked or enter an explicit reconciliation workflow.

## 3. Proposed canonical mapping

### Core rule

Create one `canonical_activities` row per physical activity per owner/source identity. Product purposes are additive relationships, not duplicate activities.

### Context and links

- `primary_context` records the originating context: `training`, `expedition`, `free_hike`, or `mountain_simulation`.
- Additional uses are expressed through links:
  - `training_plan`
  - `training_session`
  - `expedition`
  - `expedition_stage`
  - `canonical_hill`
  - `canonical_route`
  - `community_route`
  - `challenge`
- A Free Hike later selected for Training or Expedition keeps its original activity and gains links.
- Real summit, Expedition completion, and mountain simulation remain separate domain records; they are not generic activity links that imply equivalent completion.

`canonical_activity_links` already enforces uniqueness per activity, link type, and target (`lib/db/src/schema/canonical-activities.ts:73-85`).

### Source identities

Use stable, source-qualified IDs:

- `tracked_hill_session:<client activity ID>`
- `training_manual:<stable completion ID>`
- `explore_hike:<stable local log ID>`
- future imported providers: `<provider>:<provider activity ID>`

Never derive source identity from hill name, date, distance, or elevation.

### Evidence

- GPS track and elevation profile remain separate private evidence rows.
- Source snapshots preserve provenance but are not proof by themselves.
- Manual estimates remain explicit estimates.
- Product calculations read the canonical summary plus the applicable qualification; they do not rewrite evidence.

## 4. Qualification and eligibility matrix

| Purpose | Evidence accepted initially | Credit/meaning | Must not imply |
|---|---|---|---|
| Universal personal history | GPS, manual, indoor/training, or unavailable if clearly labelled | The user recorded an activity | Verification, public eligibility, or a summit |
| Personal Elevation Bank | GPS/recorded; manual or indoor only under an explicit personal rule | Versioned credited ascent for the owner | Competitive/public elevation |
| Future public/competitive elevation | Only evidence meeting published quality, moderation, and anti-cheat rules | Public/ranked credited ascent | Personal-history deletion or silent correction |
| Training/readiness | GPS, quality-accepted recorded data, and explicitly governed manual/indoor work | Contribution to a named readiness rule version | Expedition completion or real summit |
| Expedition/stage progress | A linked physical activity accepted by the Expedition rule/version | Contribution to a simulated stage/run | Climbing the simulated target mountain |
| Real summit evidence | Explicit Summit Data Engine mountain/route identity plus accepted evidence | Evidence toward a real summit record | Automatic Crown or leaderboard eligibility |
| Summit Crown | Verified real summit plus collection/rule requirements | Purpose-specific collection award | Expedition target completion |
| Challenge/achievement | Evidence required by that challenge's versioned rule | Contribution or award eligibility | A second physical activity |

Qualification storage already supports purpose, status, evidence class, reason codes, credited metric, rule version, evaluation time, and revocation (`lib/db/src/schema/canonical-activities.ts:87-105`).

## 5. Elevation evidence classification

| Class | Canonical treatment | Default eligibility |
|---|---|---|
| GPS/recorded | `gps_track` and/or `elevation_profile`; recorded ascent kept distinct from validated ascent | Personal history; readiness/personal bank only after purpose rule; competitive only after stronger validation |
| Estimated/manual | `manual_estimate`; retain input provenance and method | Personal history; optional personal/readiness credit under explicit rules; not competitive by default |
| Indoor/training | Add an explicit evidence type or classification additively; record machine/session source and claimed/validated work separately | Personal history/readiness under a defined rule; not a real summit |
| Unavailable/untrusted | Add explicit vocabulary; preserve the event without treating absent evidence as zero or verified | Personal history only unless later corrected |

Phase 1 currently supports `gps_track`, `elevation_profile`, `manual_estimate`, and `source_snapshot` (`canonical-activities.ts:57-71`). Indoor/training and unavailable/untrusted require additive vocabulary.

## 6. Summit Data Engine integration map

### Existing protected asset

The Summit Data Engine is a standalone, provenance-first catalogue, not an activity or progression store (`summit-data-engine/README.md:1-25`). Its reviewed import reports:

- 21,576 mountains
- 21,576 source records
- 33,369 classifications

(`summit-data-engine/reports/international-v4-development-import-2026-09-07.md:18-20`)

### Core schema and stable identities

Core tables include:

- provenance/source: `source_bundles`, `mountain_source_records`, `evidence_sources`
- summit identity: `mountains`, `mountain_classifications`, `mountain_aliases`
- routes: `routes`, `route_sources`, `route_validation`, `route_elevation_profiles`, `route_elevation_samples`
- versioned route identity/facts: `route_identities`, `route_definitions`, `route_definition_evidence`, `route_facts`
- geometry/elevation provenance: `route_geometries`, `route_geometry_members`, `dem_tiles`, `route_elevation_profile_sources`

The definitions are in `summit-data-engine/src/summit_data_engine/db/models.py:47-827`.

Stable identity rules:

- `mountains.id` and `routes.id` are UUIDs.
- Mountain source identity is unique by source bundle and feature ID and carries a canonical source key.
- DoBIH identity is DoBIH Number plus release version, never display name (`summit-data-engine/README.md:68-75`).
- `route_identities.identity_key + version` is the stable route layer; definitions/facts version interpretations separately.

### Provenance and pipeline

`source_bundles` retains provider, URL, licence, retrieval time, hash, metadata, and immutable provenance version. Mountain source records retain dataset/version/feature ID, source/import hashes, licence, attribution, trust, verification/QA, and raw/prepared payloads (`models.py:47-79,147-272`).

The DoBIH import verifies source/archive/import hashes and is transactional and idempotent. International and Wales review processes are deterministic. Route publication fails closed when topology, rights, evidence, source hashes, or DEM coverage are insufficient (`summit-data-engine/README.md:68-130,160-184`).

### Current SummitReady references

- API canonical mountain lookup reads SDE `mountains`, source records, verified aliases, facts, coordinates, and provenance version (`artifacts/api-server/src/services/mountain/canonicalMountainLookup.ts:124-190,371-460`).
- Verified route lookup joins route identities, definitions, facts, and evidence and requires verified status (`canonicalMountainLookup.ts:193-220`).
- App `canonical_hills`/`canonical_hill_routes` remain smaller AI/Overpass-backed app records with serial IDs (`lib/db/src/schema/canonical-hills.ts:7-51`).
- Expeditions use `virtual_expeditions`/`expedition_routes`; Training uses separate `training_routes`. Route DNA belongs to one route type and `route_matches` relates the two (`lib/db/src/schema/virtual-expedition-engine.ts:16-180,195-211`).

### Canonical activity references

Use namespaced immutable link targets:

- `sde:mountain:<mountains.id>`
- `sde:route:<route_identities.identity_key>@<version>`

Store `sourceFeatureId`, `canonicalSourceKey`, provenance version, and verification status in link metadata.

Do not:

- copy SDE rows into canonical activities or a replacement summit table;
- use a display name, slug, spreadsheet ID, or app serial ID as cross-catalogue identity;
- automatically merge `canonical_hills` with SDE mountains;
- put Training, Expedition, challenge, or progression state into the SDE.

## 7. Phase 1 schema gaps

The gaps are additive domain records, not reasons to replace Phase 1:

1. **Stable source IDs for manual/local adapters.**
2. **Typed link-target validation.** `target_id` is currently unconstrained text.
3. **Explicit indoor/training and unavailable/untrusted evidence vocabulary.**
4. **Elevation Bank credit ledger.** Immutable credit events, credited ascent, rule version, corrections/revocations, and separate personal versus competitive projections.
5. **Qualification current/superseded semantics** across rule versions.
6. **Expedition run/stage contribution records.** Run identity, stage snapshot, contributing canonical activity, accepted metric, rule/score version, and simulated-completion semantics.
7. **Real summit records.** SDE identity, achieved date, contributing canonical activity/evidence, verification state, and correction history.
8. **Challenge and achievement lifecycle records.**
9. **Public/competitive governance.** Opt-in, visibility, periods/rankings, moderation, anti-cheat, and correction state.
10. **Explicit reconciliation records** for ambiguous legacy duplicates; no automatic fuzzy merge.

## 8. Recommended additive Stage 2 sequence

Each command should remain independently reviewable and default-off where it changes writes.

1. **Contracts and IDs:** define source-ID namespaces, link target formats, evidence semantics, and adapter interfaces. No behavior change.
2. **Manual Training adapter:** add stable completion IDs and canonical ingestion behind a feature flag; preserve legacy writes and responses.
3. **ExploreHike/Free Hike adapter:** canonicalize new local logs with stable IDs; no historical backfill.
4. **Contribution-link service:** attach existing activities to Training and Expedition purposes idempotently; do not duplicate activities or alter product UI.
5. **Qualification evaluator:** add versioned, read-only evaluation output for personal history/readiness first. Existing calculations remain authoritative until separately approved.
6. **Elevation credit ledger:** add personal credit events and projections; keep competitive/public totals absent until governance exists.
7. **Expedition run/stage ledger:** record contributing activity IDs and versioned simulated progress without changing current Progress Mountain or stage calculations.
8. **Read projections:** migrate Training history, Recent Activity, and Journal one surface at a time with compatibility comparisons.
9. **Real summit/challenge domains:** only after explicit product rules and SDE identity contracts are approved.
10. **Reconciliation/backfill:** separate reviewed command, dry-run report first, never implicit.

## 9. Backwards-compatibility risks and controls

| Risk | Control |
|---|---|
| Released clients still send legacy payloads | Keep all existing request/response fields and nullable bridge columns. Add fields only. |
| Canonical and legacy writes diverge | Keep transactional dual-write where already used; add metrics/alerts and feature flags for new adapters. |
| Cross-owner legacy ID collision | Preserve explicit `409`; never expose another owner's row. |
| Existing ownerless production rows | Do not backfill automatically. Require a separate reconciliation policy and dry run. |
| Same source ID with changed payload | Preserve conflict audit; never last-write-wins overwrite. |
| Duplicate downstream awards | Make links, qualifications, credit events, and contributions idempotent with stable unique keys. |
| Metrics change while UI still reads legacy stores | Run compatibility projections and compare before switching each consumer. |
| Simulation creates a false summit | Keep Expedition completion and real summit records separate by schema and language. |
| SDE/app hill identity collision | Use namespaced IDs and explicit mappings; never names as keys. |
| Protected experience regression | Treat Progress Mountain/3D files as no-touch boundaries for Stage 2 data work. |

## 10. Protected-assets confirmation

### Progress Mountain and 3D summit

No protected code was modified.

Protected boundaries identified:

- `artifacts/summit-ready/components/MountainProgress.tsx`
- `artifacts/summit-ready/components/ExpeditionMountainProgress.tsx`
- `artifacts/summit-ready/app/(expedition)/base-camp.tsx` production placement
- `artifacts/summit-ready/components/CinematicPrototype.tsx` summit handoff boundary

The elevation-driven fill, summit transition/zoom, live 3D mountain, and climber summit experience remain untouched.

### Summit Data Engine

No SDE schema, pipeline, data, IDs, catalogue records, imports, or runtime code was modified. This audit recommends referencing the existing engine; it does not create or recommend a competing catalogue.

## 11. Replit command-detection recommendation

### Investigation result

Replit's official documentation does not describe a native trigger that starts an Agent session from a GitHub commit or file change. Replit Agent is interactive and requires a user prompt. Scheduled Deployments can run application code on a timer, but they do not initiate an Agent coding session.

Sources:

- Replit Agent overview: https://docs.replit.com/features/agent/overview
- Scheduled Deployments: https://docs.replit.com/features/publishing/deployment-types#scheduled

### Recommendation

Use a **human-gated one-line trigger** for now:

1. ChatGPT writes the next numbered command to `docs/AI_TASK.md` and pushes it.
2. GitHub notifies the owner through normal repository notifications or a lightweight GitHub Action.
3. The owner sends Replit Agent a minimal prompt such as: `Execute the next command in docs/AI_TASK.md`.
4. Agent reads the command, checks its number against `AI_HANDOFF.md`/`AI_CHANGELOG.md`, executes once, commits, pushes, and stops.

This is the simplest supported and safest method. It prevents duplicate execution, surprise credit use, unattended destructive work, and command races.

Optional no-cost/low-risk improvement: a GitHub Action can detect changes to `docs/AI_TASK.md`, validate that the command ID is newer than the last result ID, and create a GitHub issue or notification. It still should **not** attempt to start Replit Agent because there is no documented native Agent webhook/trigger.

Do not build a paid polling service, store Replit credentials, automate browser prompts, or let a scheduled deployment execute repository instructions. Revisit only if Replit publishes an official Agent automation API with scoped authentication, idempotency, budget controls, and approval gates.

## 12. Checks used

- Read `docs/AI_TASK.md` from GitHub branch `virtual-expeditions-mode`.
- Targeted repository searches and three independent read-only audit passes:
  - activity flows and downstream effects;
  - Phase 1 canonical model and eligibility;
  - Summit Data Engine and protected boundaries.
- Reviewed existing Phase 0, Phase 1, and architecture audit reports.
- Consulted Replit's official documentation for Agent and Scheduled Deployment capabilities.
- Confirmed this command changed documentation only.

## S2-R01 result

**COMPLETE**

No runtime behavior, UI/navigation, schema, data, production environment, deployment, release, mobile build, Progress Mountain/3D summit code, or Summit Data Engine asset was changed.
