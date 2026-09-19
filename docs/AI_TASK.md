# SummitReady AI Task

## S2-C01 — Unified Activity Architecture Audit

Stage: 2 — Unified Training/Expedition foundation
Command: S2-C01
Previous stage reviewed: Stage 1 production verification ACCEPTED.

Mode/cost guidance: Use normal Replit Agent effort. This is a bounded audit/design task. Do not use expensive extended/max-effort reasoning unless a concrete blocker genuinely requires it. Reuse existing reports and targeted searches rather than repeatedly re-reading the whole repository.

### Objective
Design the safest additive path for Training, Expeditions and Free Hike to share one canonical physical-activity foundation while keeping Training and Expeditions intentionally distinct.

Training serves users preparing for a real target mountain and centres on readiness and a personalised training plan.
Expeditions serves casual/adventure hikers simulating famous mountain demands using local hills/routes and centres on staged expedition progress.

Do not merge these experiences. Unify the underlying activity/data foundation.

### Protected assets
1. Progress Mountain + summit transition: preserve the existing elevation-driven route/progress fill and the summit handoff/zoom into the live 3D mountain with climber summit experience. Do not modify, replace, simplify or regress it.
2. Existing Summit Data Engine / 20,000+ UK summit catalogue: identify its actual schema, pipeline, IDs and relationships. Integrate with it; do not create a competing replacement catalogue, destructively migrate, duplicate or rebuild it.

### Audit scope
Map every activity-like flow: GPS tracked hill sessions, Free Hike, Expedition tracking and stage completion, Training sessions including manual completion, logged hill sessions, Training history, Expedition Journal, Recent Activity, elevation totals, readiness calculations, achievements/challenges, mountain/hill completion, and any additional physical-activity systems discovered.

For each identify: database model; API/service; client/local storage; ID generation; GPS/evidence; elevation source; completion representation; duplicate-record risk; downstream effects; and proposed relationship to the Phase 1 canonical model.

### Canonical model review
Review canonical_activities, canonical_activity_evidence, canonical_activity_links, canonical_activity_conflicts and canonical_activity_qualifications.

Assess whether one physical activity can safely have multiple independent purposes/links without destructive change.

Explicitly distinguish universal personal history, personal Elevation Bank, future public/competitive elevation, Training/readiness, Expedition/stage progress, summit/mountain completion, and challenge/achievement eligibility.

Classify elevation evidence as GPS/recorded, estimated/manual, indoor/training, or unavailable/untrusted.

### Summit Data Engine audit
Locate and document the existing 20,000+ UK summit catalogue: canonical tables/schema, stable IDs, provenance metadata if present, import/build pipeline, current Training/Expedition/Explore references, route relationships and duplicate-identity risks. Recommend how canonical activity links should reference this existing asset.

### Deliverable
Create docs/STAGE_2_ARCHITECTURE_AUDIT.md containing:
1. current activity-system map;
2. fragmentation/duplication risks;
3. proposed canonical mapping;
4. qualification/eligibility matrix;
5. Summit Data Engine integration map;
6. Phase 1 schema gaps;
7. recommended additive Stage 2 implementation sequence;
8. backwards-compatibility risks;
9. explicit confirmation both protected assets remain untouched.

### Constraints
Audit/design only. Do not change runtime behaviour, UI/navigation, readiness/Expedition calculations, Progress Mountain/3D summit code, summit catalogue, production, schema, data, or mobile build. Do not backfill or introduce a second activity system. Use targeted inspection to keep cost low.

### Completion protocol
Update docs/AI_HANDOFF.md, append S2-R01 to docs/AI_CHANGELOG.md, commit and push documentation changes to virtual-expeditions-mode, report status as COMPLETE/PARTIAL/BLOCKED/FAILED/APPROVAL REQUIRED, identify commit SHA and checks used, then stop. Do not begin S2-C02.

Expected response ID: S2-R01.
