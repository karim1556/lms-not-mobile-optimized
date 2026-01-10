-- mark_migrations.sql
-- Creates a simple migration tracking table and marks existing migration files as applied.
-- Run this once in Supabase SQL Editor or via psql. It's idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (name) VALUES ('0001_add_new_course_fields.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('0002_create_curriculum_tables.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('0003_create_quiz_question_tables.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20240726_add_curriculum_columns.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20250824_add_clerk_columns.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20250827_add_levels.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20250827_seed_levels.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20250927_add_label_to_level_courses.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20251021_create_projects_table.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20251023_create_camps_table.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('20251024_create_internship_applications.sql') ON CONFLICT (name) DO NOTHING;

-- See what was marked
SELECT * FROM schema_migrations ORDER BY applied_at;
