"""Phase 2: clip_path and embedding on stories

Revision ID: 002
Revises: 001
Create Date: 2026-03-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stories", sa.Column("clip_path", sa.String(2048), nullable=True))
    op.add_column("stories", sa.Column("embedding", postgresql.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("stories", "embedding")
    op.drop_column("stories", "clip_path")
