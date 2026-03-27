from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import VideoStatus


class VideoSummary(BaseModel):
    id: UUID
    filename: str
    title: str
    youtube_id: str | None
    duration: float | None
    format: str | None
    status: VideoStatus
    channel_name: str | None = None
    story_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoDetail(VideoSummary):
    file_path: str
    file_size: int
    file_hash: str
    metadata_json: dict | None
    stream_url: str | None = None
    updated_at: datetime


class TranscriptSegmentSchema(BaseModel):
    start_time: float
    end_time: float
    text: str
    confidence: float | None

    model_config = {"from_attributes": True}


class TranscriptSchema(BaseModel):
    id: UUID
    language: str
    full_text: str
    word_count: int
    duration: float
    model_used: str
    segments: list[TranscriptSegmentSchema] = []

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    items: list[VideoSummary]
    total: int
    page: int
    per_page: int
