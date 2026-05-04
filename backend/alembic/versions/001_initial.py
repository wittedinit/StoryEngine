"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Reusable PG ENUM type definitions. `create_type=False` means the column does
# NOT auto-create the type on CREATE TABLE — we create them explicitly below
# with `checkfirst=True` so they're idempotent against an existing schema and
# can be safely re-used by later migrations.
videostatus = postgresql.ENUM(
    "discovered", "processing", "completed", "failed", "ignored",
    name="videostatus", create_type=False,
)
jobstatus = postgresql.ENUM(
    "pending", "running", "completed", "failed", "cancelled",
    name="jobstatus", create_type=False,
)
stagestatus = postgresql.ENUM(
    "pending", "running", "completed", "failed", "skipped",
    name="stagestatus", create_type=False,
)
pipelinestage = postgresql.ENUM(
    "scan", "extract_audio", "transcribe", "detect_stories",
    "detect_sponsors", "split", "embed", "dedup",
    name="pipelinestage", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    # Create enum types first (idempotent — checkfirst skips if already present)
    videostatus.create(bind, checkfirst=True)
    jobstatus.create(bind, checkfirst=True)
    stagestatus.create(bind, checkfirst=True)
    pipelinestage.create(bind, checkfirst=True)

    # Videos
    op.create_table(
        "videos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("file_path", sa.String(2048), unique=True, nullable=False),
        sa.Column("filename", sa.String(1024), nullable=False),
        sa.Column("youtube_id", sa.String(32), nullable=True, index=True),
        sa.Column("file_hash", sa.String(64), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("format", sa.String(32), nullable=True),
        sa.Column("title", sa.String(1024), nullable=False),
        sa.Column("status", videostatus, nullable=False, server_default="discovered"),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_videos_status", "videos", ["status"])

    # Transcripts
    op.create_table(
        "transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("full_text", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration", sa.Float(), nullable=False, server_default="0"),
        sa.Column("model_used", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Transcript segments
    op.create_table(
        "transcript_segments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("transcript_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_time", sa.Float(), nullable=False),
        sa.Column("end_time", sa.Float(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
    )
    op.create_index("ix_transcript_segments_lookup", "transcript_segments", ["transcript_id", "start_time"])

    # Stories
    op.create_table(
        "stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(1024), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("start_time", sa.Float(), nullable=False),
        sa.Column("end_time", sa.Float(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=False),
        sa.Column("story_index", sa.Integer(), nullable=False),
        sa.Column("transcript_excerpt", sa.Text(), nullable=False, server_default=""),
        sa.Column("llm_model", sa.String(64), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_stories_video_order", "stories", ["video_id", "story_index"])

    # Processing jobs
    op.create_table(
        "processing_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("job_type", sa.String(32), nullable=False, server_default="full_pipeline"),
        sa.Column("status", jobstatus, nullable=False, server_default="pending"),
        sa.Column("celery_task_id", sa.String(256), nullable=True),
        sa.Column("progress_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])

    # Job stages
    op.create_table(
        "job_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", pipelinestage, nullable=False),
        sa.Column("status", stagestatus, nullable=False, server_default="pending"),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_job_stages_job", "job_stages", ["job_id", "order"])

    # Settings
    op.create_table(
        "settings",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_table("job_stages")
    op.drop_table("processing_jobs")
    op.drop_table("stories")
    op.drop_table("transcript_segments")
    op.drop_table("transcripts")
    op.drop_table("videos")

    bind = op.get_bind()
    pipelinestage.drop(bind, checkfirst=True)
    stagestatus.drop(bind, checkfirst=True)
    jobstatus.drop(bind, checkfirst=True)
    videostatus.drop(bind, checkfirst=True)
