import uuid

from sqlalchemy import BigInteger, Float, Index, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid
from app.models.enums import VideoStatus


class Video(Base, TimestampMixin):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    file_path: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(1024), nullable=False)
    youtube_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    format: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[VideoStatus] = mapped_column(default=VideoStatus.DISCOVERED, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    transcript: Mapped["Transcript"] = relationship(back_populates="video", uselist=False)
    stories: Mapped[list["Story"]] = relationship(back_populates="video", order_by="Story.story_index")
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(back_populates="video")

    __table_args__ = (
        Index("ix_videos_status", "status"),
    )
