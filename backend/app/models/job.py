import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid
from app.models.enums import JobStatus, PipelineStage, StageStatus


class ProcessingJob(Base, TimestampMixin):
    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    video_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="SET NULL"), nullable=True
    )
    job_type: Mapped[str] = mapped_column(String(32), nullable=False, default="full_pipeline")
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(
            JobStatus,
            name="jobstatus",
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
            create_type=False,
        ),
        default=JobStatus.PENDING,
        nullable=False,
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    progress_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    video: Mapped["Video"] = relationship(back_populates="processing_jobs")
    stages: Mapped[list["JobStage"]] = relationship(back_populates="job", order_by="JobStage.order")

    __table_args__ = (
        Index("ix_processing_jobs_status", "status"),
    )


class JobStage(Base, TimestampMixin):
    __tablename__ = "job_stages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False
    )
    stage: Mapped[PipelineStage] = mapped_column(
        SAEnum(
            PipelineStage,
            name="pipelinestage",
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[StageStatus] = mapped_column(
        SAEnum(
            StageStatus,
            name="stagestatus",
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
            create_type=False,
        ),
        default=StageStatus.PENDING,
        nullable=False,
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped["ProcessingJob"] = relationship(back_populates="stages")

    __table_args__ = (
        Index("ix_job_stages_job", "job_id", "order"),
    )
