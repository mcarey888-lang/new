# SummitReady AI Task

## S2-C02 — Canonical Contracts and Stable IDs

Stage: 2 — Unified Training/Expedition foundation
Command: S2-C02
Previous response reviewed: S2-R01 ✓ ACCEPTED.

Mode/cost guidance: Use normal/default Replit Agent effort. Keep this implementation bounded and targeted. Reuse the S2-R01 audit; do not repeat the whole repository audit. Escalate reasoning effort only for a concrete blocker.

### Objective
Implement the lowest-risk contract/identity foundation recommended by S2-R01 so subsequent adapters can canonicalize Training, Expedition and Free Hike activity without duplicating physical activities.

This command may add internal TypeScript contracts/helpers/tests/documentation. It must NOT yet switch user-facing behavior or create production/schema changes.

### Approved architecture
- Training and Expeditions remain separate product experiences.
- One physical activity maps to one owner-scoped canonical activity; additional purposes are links/qualifications.
- Stable source identity is source-qualified and never derived from names, dates, distance or elevation.
- Existing Summit Data Engine is authoritative geographic asset and is referenced, not copied.
- Real Summit, Expedition Completion and Mountain Simulation remain distinct.
- S2-R01 source-ID/link/evidence direction is approved as the baseline.

### Implement
1. Define central typed contracts/helpers for canonical source namespaces, including at minimum:
   - tracked_hill_session
   - training_manual
   - explore_hike
   - extensible provider/import namespace support.
2. Define/validate namespaced canonical link targets, including SDE mountain and route references. Keep existing persisted link schema compatible; validation can be service-layer/type-layer in this command.
3. Define central evidence classification semantics for:
   - gps_recorded
   - estimated_manual
   - indoor_training
   - unavailable_untrusted
   Map these safely onto existing Phase 1 evidence storage without schema migration in this command.
4. Define adapter interfaces/input contracts that future manual Training and ExploreHike adapters will use.
5. Add deterministic unit tests for formatting/parsing/validation, invalid IDs, SDE references, and idempotent identity generation.
6. Document contracts briefly so later commands consume one definition rather than inventing new conventions.

### Important compatibility requirement
Do not rename or invalidate existing Phase 1 source_type/source_id values. The existing tracked-hill bridge must remain compatible. If S2-R01's illustrative colon-form differs from existing persisted conventions, preserve the existing persisted identity and make helpers explicitly backwards-compatible rather than migrating data.

### Protected assets
NO changes to:
- the 21,576-mountain Summit Data Engine data/schema/import pipeline;
- Progress Mountain, ExpeditionMountainProgress, cinematic/3D summit behavior;
- Training/Expedition UX or calculations.

### Do not
- change production;
- apply DB/schema migrations;
- backfill historical records;
- create a mobile build;
- switch history/readiness/elevation/Expedition consumers to canonical reads;
- implement Elevation Bank yet;
- implement public leaderboards/competitive rules;
- implement real summit records;
- start S2-C03.

### Verification
Run the smallest relevant unit/type/build checks for changed files/packages plus regression tests around existing canonical ingestion/bridge where practical. Do not spend credits rerunning unrelated expensive suites unless needed.

### Completion protocol
When complete:
- update docs/AI_HANDOFF.md;
- append S2-R02 to docs/AI_CHANGELOG.md;
- commit and push implementation/docs/tests to virtual-expeditions-mode;
- status must be COMPLETE/PARTIAL/BLOCKED/FAILED/APPROVAL REQUIRED;
- report commit SHA and checks;
- stop before S2-C03.

Expected response ID: S2-R02.
