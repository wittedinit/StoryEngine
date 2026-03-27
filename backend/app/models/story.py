import uuid

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class Story(Base, TimestampMixin):
    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    story_index: Mapped[int] = mapped_column(Integer, nullable=False)
    transcript_excerpt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    llm_model: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    clip_path: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    segment_type: Mapped[str] = mapped_column(String(32), nullable=False, default="story")

    video: Mapped["Video"] = relationship(back_populates="stories")

    __table_args__ = (
        Index("ix_stories_video_order", "video_id", "story_index"),
    )
