-- Run ONCE by you with a Postgres admin account, before the first migration:
--   psql -d postgres -v app_password="'choose-a-password'" -f db/init_role.sql
--
-- Creates the mathlab schema (next to family_budget and lecture, in the same database) and the
-- mathlab_app role. mathlab_app gets rights on the mathlab schema only: nothing on family_budget,
-- lecture or public, so even a compromised web app cannot read the expense data.

\set ON_ERROR_STOP on

CREATE ROLE mathlab_app LOGIN PASSWORD :app_password;

SELECT format('GRANT CONNECT ON DATABASE %I TO mathlab_app', current_database()) \gexec
REVOKE ALL ON SCHEMA public FROM mathlab_app;

CREATE SCHEMA IF NOT EXISTS mathlab;
GRANT USAGE ON SCHEMA mathlab TO mathlab_app;

-- Tables created later by migrations (run by the admin role that executes this file) are granted automatically:
ALTER DEFAULT PRIVILEGES IN SCHEMA mathlab GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mathlab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA mathlab GRANT USAGE, SELECT ON SEQUENCES TO mathlab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mathlab TO mathlab_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mathlab TO mathlab_app;

ALTER ROLE mathlab_app SET search_path = mathlab;
