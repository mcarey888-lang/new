-- A deleted recording UUID cannot be recreated by an old offline device.
-- No catalogue tables are altered. Snapshot evidence is removed only for an
-- owner-requested deletion; the owner/id tombstone contains no GPS trace.
ALTER TABLE recorded_hike_backups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
