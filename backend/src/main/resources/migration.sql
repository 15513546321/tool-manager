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
ALTER TABLE change_step_scan_records ADD COLUMN IF NOT EXISTS system_code VARCHAR(50);
ALTER TABLE change_step_scan_records ADD COLUMN IF NOT EXISTS document_type VARCHAR(20);
ALTER TABLE change_step_scan_records ADD COLUMN IF NOT EXISTS validation_total INT DEFAULT 0 NOT NULL;
ALTER TABLE change_step_scan_records ADD COLUMN IF NOT EXISTS validation_passed INT DEFAULT 0 NOT NULL;
ALTER TABLE change_step_scan_records ADD COLUMN IF NOT EXISTS validation_failed INT DEFAULT 0 NOT NULL;
ALTER TABLE change_step_scan_records ADD COLUMN IF NOT EXISTS validation_warnings INT DEFAULT 0 NOT NULL;
