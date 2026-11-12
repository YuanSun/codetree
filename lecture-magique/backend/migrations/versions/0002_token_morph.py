"""token.morph (grammar of the word in its sentence) + index for conjugation tables

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # spaCy's morphological features for this occurrence, e.g.
    # "Mood=Ind|Number=Sing|Person=3|Tense=Pres|VerbForm=Fin". Filled by the article importer
    # (and by `importer.article rematch` for articles imported before this column existed).
    op.execute("ALTER TABLE lecture.token ADD COLUMN IF NOT EXISTS morph text")
    op.execute("CREATE INDEX IF NOT EXISTS word_form_lemma_idx ON lecture.word_form (lemma_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS lecture.word_form_lemma_idx")
    op.execute("ALTER TABLE lecture.token DROP COLUMN IF EXISTS morph")
