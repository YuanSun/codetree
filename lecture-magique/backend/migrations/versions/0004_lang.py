"""lang on lemma, article and quiz: English reading next to French

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 'fr' (Petit Robert + French Wiktionary entries) or 'en' (English Wiktionary entries).
    # Existing rows are all French, hence the default. English senses use source='wiktionary_en' too
    # (gloss_en = the English definition); lemma.lang tells them apart from glosses of French words.
    for table in ("lemma", "article", "quiz"):
        op.execute(f"""ALTER TABLE lecture.{table} ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'fr'
                       CHECK (lang IN ('fr', 'en'))""")
    # "set" (n.) exists in both languages: the dictionary key now includes the language.
    op.execute("ALTER TABLE lecture.lemma DROP CONSTRAINT IF EXISTS lemma_lemma_pos_homograph_key")
    op.execute("ALTER TABLE lecture.lemma ADD CONSTRAINT lemma_lang_lemma_pos_homograph_key "
               "UNIQUE (lang, lemma, pos, homograph)")
    # One défi per language per week.
    op.execute("ALTER TABLE lecture.quiz DROP CONSTRAINT IF EXISTS quiz_user_id_week_of_key")
    op.execute("ALTER TABLE lecture.quiz ADD CONSTRAINT quiz_user_id_week_of_lang_key UNIQUE (user_id, week_of, lang)")


def downgrade() -> None:
    op.execute("DELETE FROM lecture.quiz WHERE lang <> 'fr'")
    op.execute("ALTER TABLE lecture.quiz DROP CONSTRAINT IF EXISTS quiz_user_id_week_of_lang_key")
    op.execute("ALTER TABLE lecture.quiz ADD CONSTRAINT quiz_user_id_week_of_key UNIQUE (user_id, week_of)")
    op.execute("ALTER TABLE lecture.lemma DROP CONSTRAINT IF EXISTS lemma_lang_lemma_pos_homograph_key")
    op.execute("ALTER TABLE lecture.lemma ADD CONSTRAINT lemma_lemma_pos_homograph_key UNIQUE (lemma, pos, homograph)")
    for table in ("lemma", "article", "quiz"):
        op.execute(f"ALTER TABLE lecture.{table} DROP COLUMN IF EXISTS lang")
