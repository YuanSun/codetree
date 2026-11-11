-- Lecture Magique — initial schema (docs/DESIGN.md "数据库设计" DDL).
-- Additions to the design DDL are marked "ADDED:" and explained in docs/IMPLEMENTATION_NOTES.md.
-- Every object is schema-qualified with lecture. so nothing depends on search_path.

CREATE SCHEMA IF NOT EXISTS lecture;

-- 用户
CREATE TABLE lecture.app_user (
  id            bigserial PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('student','parent','admin')),
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 词典（共享）
CREATE TABLE lecture.lemma (
  id        bigserial PRIMARY KEY,
  lemma     text NOT NULL,
  pos       text NOT NULL,
  homograph smallint NOT NULL DEFAULT 0,   -- ADDED: Robert homograph number ("2. livre" -> 2), 0 = none
  gender    text,
  ipa       text,
  freq_rank int,
  UNIQUE (lemma, pos, homograph)           -- CHANGED: design had UNIQUE (lemma, pos)
);
CREATE INDEX lemma_lower_idx ON lecture.lemma (lower(lemma));   -- ADDED: case-insensitive matching

CREATE TABLE lecture.word_form (
  form     text NOT NULL,
  lemma_id bigint NOT NULL REFERENCES lecture.lemma(id),
  tags     text[],
  PRIMARY KEY (form, lemma_id)
);

CREATE TABLE lecture.sense (
  id            bigserial PRIMARY KEY,
  lemma_id      bigint NOT NULL REFERENCES lecture.lemma(id),
  source        text NOT NULL,
  seq           int NOT NULL DEFAULT 0,  -- ADDED: order within the entry; makes re-import an upsert
  sense_key     text,
  gloss_en      text,
  definition_fr text,
  example_fr    text,
  raw           jsonb,                   -- {"examples": [...up to 6]}
  UNIQUE (lemma_id, source, seq)         -- ADDED
);
CREATE INDEX sense_lemma_idx ON lecture.sense (lemma_id);

-- 内容（共享）
CREATE TABLE lecture.article (
  id          bigserial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  week_of     date NOT NULL,
  level       text,
  source_note text,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lecture.chapter (
  id         bigserial PRIMARY KEY,
  article_id bigint NOT NULL REFERENCES lecture.article(id) ON DELETE CASCADE,
  seq        int NOT NULL,
  title      text,
  UNIQUE (article_id, seq)
);
CREATE TABLE lecture.paragraph (
  id         bigserial PRIMARY KEY,
  chapter_id bigint NOT NULL REFERENCES lecture.chapter(id) ON DELETE CASCADE,
  seq        int NOT NULL,
  text       text NOT NULL,
  UNIQUE (chapter_id, seq)
);
CREATE TABLE lecture.token (
  id           bigserial PRIMARY KEY,
  paragraph_id bigint NOT NULL REFERENCES lecture.paragraph(id) ON DELETE CASCADE,
  seq          int NOT NULL,
  surface      text NOT NULL,
  char_start   int NOT NULL,
  char_end     int NOT NULL,
  is_word      boolean NOT NULL,
  lemma_id     bigint REFERENCES lecture.lemma(id),
  sense_id     bigint REFERENCES lecture.sense(id),
  needs_review boolean NOT NULL DEFAULT false,
  UNIQUE (paragraph_id, seq)
);
CREATE INDEX token_lemma_idx ON lecture.token (lemma_id);
CREATE TABLE lecture.token_gloss (
  token_id     bigint PRIMARY KEY REFERENCES lecture.token(id) ON DELETE CASCADE,
  kid_fr       text,
  kid_en       text,
  generated_by text,
  approved     boolean NOT NULL DEFAULT false
);
CREATE TABLE lecture.question (
  id           bigserial PRIMARY KEY,
  article_id   bigint NOT NULL REFERENCES lecture.article(id) ON DELETE CASCADE,
  chapter_id   bigint REFERENCES lecture.chapter(id) ON DELETE CASCADE,
  seq          int NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('open','choice','writing')),
  prompt       text NOT NULL,
  model_answer text,
  rubric       jsonb
);

-- 用户状态
CREATE TABLE lecture.reading_progress (
  user_id        bigint REFERENCES lecture.app_user(id),
  article_id     bigint REFERENCES lecture.article(id),
  last_chapter   int NOT NULL DEFAULT 1,
  last_paragraph int NOT NULL DEFAULT 1,
  chapters_done  int[] NOT NULL DEFAULT '{}',
  seconds_read   int NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  PRIMARY KEY (user_id, article_id)
);
CREATE TABLE lecture.lookup_event (
  id              bigserial PRIMARY KEY,
  user_id         bigint NOT NULL REFERENCES lecture.app_user(id),
  token_id        bigint NOT NULL REFERENCES lecture.token(id),
  lemma_id        bigint REFERENCES lecture.lemma(id),
  self_rating     text CHECK (self_rating IN ('unknown','vague','known')),
  dwell_ms        int,
  created_at      timestamptz NOT NULL DEFAULT now(),   -- when the tap happened (client clock, clamped)
  client_event_id uuid UNIQUE,                          -- ADDED: retried batches never double-insert
  received_at     timestamptz NOT NULL DEFAULT now()    -- ADDED: when the server stored it
);
CREATE INDEX lookup_event_user_lemma_idx ON lecture.lookup_event (user_id, lemma_id, created_at);
CREATE TABLE lecture.user_word (
  user_id         bigint REFERENCES lecture.app_user(id),
  lemma_id        bigint REFERENCES lecture.lemma(id),
  status          text NOT NULL DEFAULT 'learning' CHECK (status IN ('learning','known','ignored')),
  familiarity     smallint NOT NULL DEFAULT 0 CHECK (familiarity BETWEEN 0 AND 5),
  lookup_count    int NOT NULL DEFAULT 0,
  exposure_count  int NOT NULL DEFAULT 0,
  first_token_id  bigint REFERENCES lecture.token(id),
  fsrs_state      smallint,
  stability       real,
  difficulty      real,
  due_at          timestamptz,
  reps            int NOT NULL DEFAULT 0,
  lapses          int NOT NULL DEFAULT 0,
  last_review_at  timestamptz,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lemma_id)
);
CREATE INDEX user_word_due_idx ON lecture.user_word (user_id, due_at) WHERE status = 'learning';
CREATE TABLE lecture.review_log (
  id           bigserial PRIMARY KEY,
  user_id      bigint NOT NULL,
  lemma_id     bigint NOT NULL,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 4),
  source       text NOT NULL CHECK (source IN ('lookup','quiz','self')),
  response_ms  int,
  state_before jsonb,
  reviewed_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, lemma_id) REFERENCES lecture.user_word(user_id, lemma_id)
);
CREATE TABLE lecture.quiz (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES lecture.app_user(id),
  week_of     date NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (user_id, week_of)
);
CREATE TABLE lecture.quiz_item (
  id          bigserial PRIMARY KEY,
  quiz_id     bigint NOT NULL REFERENCES lecture.quiz(id) ON DELETE CASCADE,
  seq         int NOT NULL,
  lemma_id    bigint NOT NULL REFERENCES lecture.lemma(id),
  item_type   text NOT NULL,
  prompt      jsonb NOT NULL,
  expected    jsonb NOT NULL,
  response    jsonb,
  correct     boolean,
  response_ms int,
  answered_at timestamptz
);
CREATE TABLE lecture.answer (
  id           bigserial PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES lecture.app_user(id),
  question_id  bigint NOT NULL REFERENCES lecture.question(id),
  body         text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score        numeric,
  feedback     text,
  graded_by    text
);
