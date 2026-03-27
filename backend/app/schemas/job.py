from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import JobStatus, PipelineStage, StageStatus


class JobStageSchema(BaseModel):
    stage: PipelineStage
    status: StageStatus
    order: int
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None
    result_json: dict | None

    model_config = {"from_attributes": True}


class JobSummary(BaseModel):
    id: UUID
    video_id: UUID | None
    job_type: str
    status: JobStatus
    progress_pct: float
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    video_title: str = ""

    model_config = {"from_attributes": True}


class JobDetail(JobSummary):
    celery_task_id: str | None
    stages: list[JobStageSchema] = []


class JobListResponse(BaseModel):
    items: list[JobSummary]
    total: int
    page: int
    per_page: int
