-- MathCompetition accounts and progress. Every object is schema-qualified, so nothing depends on search_path.
CREATE SCHEMA IF NOT EXISTS mathlab;

CREATE TABLE mathlab.app_user (
  id            bigserial PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('child','parent')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per finished/attempted thing: the same unit -> page -> item shape the pages keep in localStorage.
CREATE TABLE mathlab.progress (
  user_id    bigint NOT NULL REFERENCES mathlab.app_user(id) ON DELETE CASCADE,
  unit       text NOT NULL,              -- "week08", "sem07"
  page       text NOT NULL,              -- "lesson", "practice", "homework"
  item       text NOT NULL,              -- a lesson task id or a question id
  data       jsonb NOT NULL,             -- {done, stars, attempts, hints, time, ...}
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit, page, item)
);

CREATE TABLE mathlab.profile (
  user_id    bigint PRIMARY KEY REFERENCES mathlab.app_user(id) ON DELETE CASCADE,
  xp         integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Give the web app's role access (it is created by db/init_role.sql; skipped if it does not exist yet).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mathlab_app') THEN
    GRANT USAGE ON SCHEMA mathlab TO mathlab_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mathlab TO mathlab_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mathlab TO mathlab_app;
  END IF;
END $$;
