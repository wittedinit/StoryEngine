"""Phase 4: thumbnails, YouTube columns, webhooks, transcript full-text search

Revision ID: 005
Revises: 004
Create Date: 2026-03-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Stories: thumbnail path and YouTube columns ──────────────────────────
    op.add_column("stories", sa.Column("thumbnail_path", sa.String(2048), nullable=True))
    op.add_column("stories", sa.Column("youtube_video_id", sa.String(64), nullable=True))
    op.add_column("stories", sa.Column("youtube_playlist_id", sa.String(64), nullable=True))
    op.create_index("ix_stories_youtube_video_id", "stories", ["youtube_video_id"])

    # ── Transcripts: generated tsvector column for full-text search ──────────
    # PostgreSQL 12+ GENERATED ALWAYS AS STORED column — auto-synced with full_text
    op.execute("""
        ALTER TABLE transcripts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(full_text, ''))) STORED
    """)
    op.execute("""
        CREATE INDEX ix_transcripts_search_vector
        ON transcripts USING GIN (search_vector)
    """)

    # ── Webhooks table ────────────────────────────────────────────────────────
    op.create_table(
        "webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("events", postgresql.JSON(), nullable=False, server_default='[]'),
        sa.Column("secret", sa.String(256), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("label", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_webhooks_active", "webhooks", ["active"])


def downgrade() -> None:
    op.drop_index("ix_webhooks_active", "webhooks")
    op.drop_table("webhooks")

    op.execute("DROP INDEX IF EXISTS ix_transcripts_search_vector")
    op.execute("ALTER TABLE transcripts DROP COLUMN IF EXISTS search_vector")

    op.drop_index("ix_stories_youtube_video_id", "stories")
    op.drop_column("stories", "youtube_playlist_id")
    op.drop_column("stories", "youtube_video_id")
    op.drop_column("stories", "thumbnail_path")
