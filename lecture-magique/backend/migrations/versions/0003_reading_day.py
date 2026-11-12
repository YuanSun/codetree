"""reading_day: reading time per child, book and day (for the parent's weekly chart)

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Filled by PUT /api/progress alongside reading_progress.seconds_read (which keeps the per-book total).
    # Time read before this table existed is only in that total, not per day.
    op.execute("""
        CREATE TABLE IF NOT EXISTS lecture.reading_day (
          user_id    bigint NOT NULL REFERENCES lecture.app_user(id),
          article_id bigint NOT NULL REFERENCES lecture.article(id) ON DELETE CASCADE,
          day        date   NOT NULL,
          seconds    int    NOT NULL DEFAULT 0 CHECK (seconds >= 0),
          PRIMARY KEY (user_id, day, article_id)
        )""")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lecture.reading_day")
