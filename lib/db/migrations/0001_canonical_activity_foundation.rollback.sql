-- DEVELOPMENT rollback reference for Phase 1.
-- Do not run against production. Runtime can be disabled first with:
-- CANONICAL_ACTIVITY_BRIDGE_ENABLED=false
--
-- Existing tracked_hill_sessions rows are preserved. This rollback removes only
-- the nullable bridge column and new Phase 1 tables.

DROP INDEX IF EXISTS "tracked_hill_sessions_canonical_activity_idx";
ALTER TABLE "tracked_hill_sessions"
  DROP CONSTRAINT IF EXISTS "tracked_hill_sessions_canonical_activity_id_canonical_activities_id_fk";
ALTER TABLE "tracked_hill_sessions"
  DROP COLUMN IF EXISTS "canonical_activity_id";

DROP TABLE IF EXISTS "canonical_activity_conflicts";
DROP TABLE IF EXISTS "canonical_activity_qualifications";
DROP TABLE IF EXISTS "canonical_activity_links";
DROP TABLE IF EXISTS "canonical_activity_evidence";
DROP TABLE IF EXISTS "canonical_activities";