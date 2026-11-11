-- Run ONCE by Ryan with an admin account, before the first migration:
--   psql -U <admin> -d postgres -v app_password="'choose-a-password'" -f deploy/init_role.sql
--
-- Creates the lecture schema (next to the existing family_budget schema, in the same database)
-- and the lecture_app role. lecture_app gets rights on the lecture schema only: nothing on
-- family_budget or public, so even a compromised web app cannot read the expense data.
-- Works in whichever database you run it in (current_database()).

\set ON_ERROR_STOP on

CREATE ROLE lecture_app LOGIN PASSWORD :app_password;

-- Connect to this database only. Nothing is granted on family_budget or public; database-wide
-- defaults for other roles are left untouched.
SELECT format('GRANT CONNECT ON DATABASE %I TO lecture_app', current_database()) \gexec
REVOKE ALL ON SCHEMA public FROM lecture_app;

CREATE SCHEMA IF NOT EXISTS lecture;
GRANT USAGE ON SCHEMA lecture TO lecture_app;

-- Tables and sequences created later by migrations (run as the admin role that executes
-- this file) are granted automatically:
ALTER DEFAULT PRIVILEGES IN SCHEMA lecture GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lecture_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA lecture GRANT USAGE, SELECT ON SEQUENCES TO lecture_app;

-- And anything that already exists (safe to re-run after migrations):
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lecture TO lecture_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lecture TO lecture_app;

ALTER ROLE lecture_app SET search_path = lecture;
