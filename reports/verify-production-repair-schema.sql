-- READ ONLY. Run before/after the supported Publish schema migration.
-- First result: every row must have passed=true. Do not treat table existence
-- alone as migration success. Later results inventory defaults/constraints/indexes.
-- This file contains no migration, DDL, data mutations or secret values.
WITH expected(table_name, column_name, data_type, nullable, default_value) AS (
 VALUES
 ('recorded_hike_backups','owner_user_id','text','NO',NULL),
 ('recorded_hike_backups','hike_id','text','NO',NULL),
 ('recorded_hike_backups','snapshot','jsonb','NO',NULL),
 ('recorded_hike_backups','revision','text','NO',NULL),
 ('recorded_hike_backups','updated_at','timestamp with time zone','NO','now()'),
 ('recorded_hike_backups','deleted_at','timestamp with time zone','YES',NULL),
 ('activity_preferences','owner','text','NO',NULL),
 ('activity_preferences','audience','text','YES',NULL),
 ('activity_preferences','cover_path','text','YES',NULL),
 ('activity_follows','follower','text','NO',NULL),
 ('activity_follows','followed','text','NO',NULL),
 ('activity_publications','owner','text','NO',NULL),
 ('activity_publications','hike_id','text','NO',NULL),
 ('activity_publications','audience','text','NO',NULL),
 ('activity_publications','audience_revision','text','NO', '''1970-01-01T00:00:00.000Z''::text'),
 ('activity_publications','updated_at','timestamp with time zone','NO','now()'),
 ('activity_bookmarks','viewer','text','NO',NULL),
 ('activity_bookmarks','owner','text','NO',NULL),
 ('activity_bookmarks','hike_id','text','NO',NULL),
 ('activity_route_reports','reporter','text','NO',NULL),
 ('activity_route_reports','owner','text','NO',NULL),
 ('activity_route_reports','hike_id','text','NO',NULL),
 ('activity_route_reports','reason','text','NO',NULL),
 ('activity_trail_suggestions','owner','text','NO',NULL),
 ('activity_trail_suggestions','hike_id','text','NO',NULL),
 ('activity_trail_suggestions','evidence_revision','text','NO',NULL),
 ('activity_trail_suggestions','status','text','NO', '''pending''::text'),
 ('activity_trail_suggestions','review_notes','text','YES',NULL),
 ('activity_trail_suggestions','reviewed_at','timestamp with time zone','YES',NULL),
 ('tracked_routes','audience','text','YES',NULL)
)
SELECT e.table_name, e.column_name,
 (c.column_name IS NOT NULL AND c.data_type=e.data_type AND c.is_nullable=e.nullable
   AND c.column_default IS NOT DISTINCT FROM e.default_value) AS passed,
 c.data_type AS actual_type, c.is_nullable AS actual_nullable, c.column_default AS actual_default
FROM expected e LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=e.table_name AND c.column_name=e.column_name
ORDER BY e.table_name,e.column_name;

-- Required PRIMARY KEYs, valid backing indexes, exact composite FK/cascade,
-- and CHECKs. Review CHECK definitions in the inventory below as well.
WITH expected(table_name, key_columns) AS (
 VALUES
 ('recorded_hike_backups',ARRAY['owner_user_id','hike_id']::text[]),
 ('activity_preferences',ARRAY['owner']::text[]),
 ('activity_follows',ARRAY['follower','followed']::text[]),
 ('activity_publications',ARRAY['owner','hike_id']::text[]),
 ('activity_bookmarks',ARRAY['viewer','owner','hike_id']::text[]),
 ('activity_route_reports',ARRAY['reporter','owner','hike_id']::text[]),
 ('activity_trail_suggestions',ARRAY['owner','hike_id']::text[])
)
SELECT e.table_name, EXISTS (
 SELECT 1 FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_index i ON i.indexrelid=k.conindid
 WHERE n.nspname='public' AND t.relname=e.table_name AND k.contype='p'
 AND k.convalidated AND i.indisvalid AND i.indisready AND i.indisunique
 AND ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY u(attnum,ord)
 JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=u.attnum ORDER BY u.ord)=e.key_columns
) AS primary_key_and_index_passed FROM expected e ORDER BY e.table_name;

SELECT EXISTS (
 SELECT 1 FROM pg_constraint k
 WHERE k.conrelid=to_regclass('public.activity_publications')
 AND k.confrelid=to_regclass('public.recorded_hike_backups')
 AND k.contype='f' AND k.convalidated AND k.confdeltype='c' AND k.confupdtype='a'
 AND ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY u(attnum,ord)
 JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.attnum ORDER BY u.ord)=ARRAY['owner','hike_id']::text[]
 AND ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY u(attnum,ord)
 JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.attnum ORDER BY u.ord)=ARRAY['owner_user_id','hike_id']::text[]
) AS publication_backup_fk_passed;

SELECT t.relname AS table_name, k.contype, k.convalidated, pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public' AND t.relname IN (
 'recorded_hike_backups','activity_preferences','activity_follows',
 'activity_publications','activity_bookmarks','activity_route_reports','activity_trail_suggestions')
ORDER BY t.relname,k.contype,definition;

SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN (
 'recorded_hike_backups','activity_preferences','activity_follows',
 'activity_publications','activity_bookmarks','activity_route_reports','activity_trail_suggestions')
ORDER BY tablename,indexname;
