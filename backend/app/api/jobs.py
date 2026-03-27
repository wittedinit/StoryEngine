from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.enums import JobStatus
from app.models.job import ProcessingJob
from app.models.video import Video
from app.schemas.job import JobDetail, JobListResponse, JobSummary

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status: JobStatus | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ProcessingJob, Video.title.label("video_title"))
        .outerjoin(Video, ProcessingJob.video_id == Video.id)
    )
    count_query = select(func.count(ProcessingJob.id))

    if status:
        query = query.where(ProcessingJob.status == status)
        count_query = count_query.where(ProcessingJob.status == status)

    total = (await db.execute(count_query)).scalar()

    query = query.order_by(ProcessingJob.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(query)).all()

    items = []
    for job, video_title in rows:
        items.append(JobSummary(
            id=job.id,
            video_id=job.video_id,
            job_type=job.job_type,
            status=job.status,
            progress_pct=job.progress_pct,
            error_message=job.error_message,
            started_at=job.started_at,
            finished_at=job.finished_at,
            created_at=job.created_at,
            video_title=video_title or "",
        ))

    return JobListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{job_id}", response_model=JobDetail)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessingJob)
        .options(selectinload(ProcessingJob.stages))
        .where(ProcessingJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    video_title = ""
    if job.video_id:
        video = await db.get(Video, job.video_id)
        if video:
            video_title = video.title

    return JobDetail(
        id=job.id,
        video_id=job.video_id,
        job_type=job.job_type,
        status=job.status,
        progress_pct=job.progress_pct,
        error_message=job.error_message,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        celery_task_id=job.celery_task_id,
        stages=job.stages,
        video_title=video_title,
    )
