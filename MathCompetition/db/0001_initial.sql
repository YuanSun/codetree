-- MathCompetition progress. The profiles themselves are Lecture Magique's (lecture.app_user): user_id below is that id.
-- (No foreign key: this app's role only needs to read the user table, and a deleted profile's rows are harmless.)
CREATE SCHEMA IF NOT EXISTS mathlab;

-- One row per finished/attempted thing: the same unit -> page -> item shape the pages keep in localStorage.
CREATE TABLE mathlab.progress (
  user_id    bigint NOT NULL,
  unit       text NOT NULL,              -- "week08", "sem07"
  page       text NOT NULL,              -- "lesson", "practice", "homework"
  item       text NOT NULL,              -- a lesson task id or a question id
  data       jsonb NOT NULL,             -- {done, stars, attempts, hints, time, ...}
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit, page, item)
);

CREATE TABLE mathlab.profile (
  user_id    bigint PRIMARY KEY,
  xp         integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
