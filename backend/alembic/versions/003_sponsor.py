"""Add segment_type to stories

Revision ID: 003
Revises: 002
Create Date: 2026-03-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stories",
        sa.Column("segment_type", sa.String(32), nullable=False, server_default="story"),
    )
    op.create_index("ix_stories_segment_type", "stories", ["segment_type"])


def downgrade() -> None:
    op.drop_index("ix_stories_segment_type", "stories")
    op.drop_column("stories", "segment_type")
