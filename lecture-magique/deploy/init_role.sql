-- Run ONCE by Ryan with an admin account, before the first migration:
--   psql -U <admin> -d family_budget -v app_password="'choose-a-password'" -f deploy/init_role.sql
--
-- Creates the lecture schema and the lecture_app role. lecture_app can use only the
-- lecture schema: it has no rights on public or on any budget schema, so even a
-- compromised web app cannot read the family budget data.

\set ON_ERROR_STOP on

CREATE ROLE lecture_app LOGIN PASSWORD :app_password;

-- Nothing in other schemas: drop the default PUBLIC grants this role would inherit.
REVOKE ALL ON SCHEMA public FROM lecture_app;
REVOKE CONNECT ON DATABASE family_budget FROM PUBLIC;
GRANT CONNECT ON DATABASE family_budget TO lecture_app;
-- NOTE: the REVOKE CONNECT ... FROM PUBLIC above means every other role that connects to
-- family_budget needs an explicit GRANT CONNECT. If you would rather not touch that, delete
-- that line; lecture_app still cannot read other schemas without USAGE on them.

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
