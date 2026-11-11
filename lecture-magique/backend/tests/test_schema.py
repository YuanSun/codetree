from sqlalchemy import text


def test_migration_creates_all_tables_in_lecture_schema(engine):
    with engine.connect() as c:
        tables = {r[0] for r in c.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='lecture'"))}
        public = c.execute(text(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")).scalar()
    expected = {"app_user", "lemma", "word_form", "sense", "article", "chapter", "paragraph", "token",
                "token_gloss", "question", "reading_progress", "lookup_event", "user_word", "review_log",
                "quiz", "quiz_item", "answer", "alembic_version"}
    assert expected <= tables
    assert public == 0
