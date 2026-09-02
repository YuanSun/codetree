-- One-time bootstrap for using an existing local Postgres instance
-- (instead of the bundled docker-compose Postgres) to hold the vault
-- embedding index.
--
-- Creates the `vault` role/database and installs the pgvector extension.
-- Must be run as a superuser — pgvector's extension isn't marked
-- "trusted", so CREATE EXTENSION needs elevated privileges even though
-- the `vault` role itself doesn't need them afterward.
--
--   psql -U postgres -f db/bootstrap_local.sql
--
-- Safe to re-run: skips role/database creation if they already exist.

DO $$
BEGIN
    CREATE ROLE vault LOGIN PASSWORD 'vault';
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Role "vault" already exists, skipping';
END
$$;

SELECT 'CREATE DATABASE vault OWNER vault'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vault')
\gexec

\c vault
CREATE EXTENSION IF NOT EXISTS vector;
