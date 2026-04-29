-- ============================================================
-- H2 compatible migration script
-- ============================================================
-- schema.sql already creates these columns for fresh databases.
-- These guarded ALTERs keep older H2 databases compatible.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sub_category VARCHAR(255);
ALTER TABLE release_change_sets ALTER COLUMN requirement_name TEXT;
ALTER TABLE release_change_sets ALTER COLUMN review_remark TEXT;
ALTER TABLE release_package_diffs ADD COLUMN IF NOT EXISTS service_tag VARCHAR(100);
