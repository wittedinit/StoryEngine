"""Add channel_name to videos

Revision ID: 004
Revises: 003
Create Date: 2026-03-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("videos", sa.Column("channel_name", sa.String(512), nullable=True))
    op.create_index("ix_videos_channel_name", "videos", ["channel_name"])

    # Backfill existing rows using the parent directory name from file_path
    op.execute("""
        UPDATE videos
        SET channel_name = reverse(split_part(reverse(regexp_replace(file_path, '/[^/]+$', '')), '/', 1))
        WHERE channel_name IS NULL
    """)


def downgrade() -> None:
    op.drop_index("ix_videos_channel_name", "videos")
    op.drop_column("videos", "channel_name")
