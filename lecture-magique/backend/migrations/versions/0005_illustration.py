"""illustration: pictures shown between the paragraphs of a chapter

Revision ID: 0005
Revises: 0004
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The picture itself is stored in the row (bytea), like the text: importing a pack brings its pictures,
    # nothing to copy next to the app, and re-importing replaces them (ON DELETE CASCADE from chapter).
    # Pictures from books stay out of git (content/ is git-ignored); only the pack import puts them here.
    # after_seq: shown after paragraph `after_seq` of the chapter (0 = before the first paragraph).
    op.execute("""
        CREATE TABLE IF NOT EXISTS lecture.illustration (
          id         bigserial PRIMARY KEY,
          chapter_id bigint NOT NULL REFERENCES lecture.chapter(id) ON DELETE CASCADE,
          after_seq  int    NOT NULL CHECK (after_seq >= 0),
          mime       text   NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
          data       bytea  NOT NULL,
          width      int    NOT NULL CHECK (width > 0),
          height     int    NOT NULL CHECK (height > 0),
          caption    text,
          UNIQUE (chapter_id, after_seq)
        )""")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lecture.illustration")
