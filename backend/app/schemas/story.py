from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StorySummary(BaseModel):
    id: UUID
    video_id: UUID
    title: str
    summary: str
    start_time: float
    end_time: float
    duration: float
    story_index: int
    confidence: float | None
    video_title: str = ""
    has_clip: bool = False
    has_embedding: bool = False
    segment_type: str = "story"
    created_at: datetime

    model_config = {"from_attributes": True}


class StoryDetail(StorySummary):
    transcript_excerpt: str
    llm_model: str
    clip_path: str | None = None
    updated_at: datetime

    @property
    def is_sponsor(self) -> bool:
        return self.segment_type != "story"


class StoryListResponse(BaseModel):
    items: list[StorySummary]
    total: int
    page: int
    per_page: int
