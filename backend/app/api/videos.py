from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.enums import VideoStatus
from app.models.story import Story
from app.models.transcript import Transcript, TranscriptSegment
from app.models.video import Video
from app.schemas.video import (
    TranscriptSchema,
    VideoDetail,
    VideoListResponse,
    VideoSummary,
)

router = APIRouter(prefix="/videos", tags=["videos"])


@router.get("", response_model=VideoListResponse)
async def list_videos(
    status: VideoStatus | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Video)
    count_query = select(func.count(Video.id))

    if status:
        query = query.where(Video.status == status)
        count_query = count_query.where(Video.status == status)
    if search:
        query = query.where(Video.title.ilike(f"%{search}%"))
        count_query = count_query.where(Video.title.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar()

    query = query.order_by(Video.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    videos = (await db.execute(query)).scalars().all()

    # Get story counts
    items = []
    for v in videos:
        story_count_result = await db.execute(
            select(func.count(Story.id)).where(Story.video_id == v.id)
        )
        item = VideoSummary(
            id=v.id,
            filename=v.filename,
            title=v.title,
            youtube_id=v.youtube_id,
            duration=v.duration,
            format=v.format,
            status=v.status,
            story_count=story_count_result.scalar() or 0,
            created_at=v.created_at,
        )
        items.append(item)

    return VideoListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{video_id}", response_model=VideoDetail)
async def get_video(video_id: UUID, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Compute stream URL — derive path relative to downloads_dir
    from pathlib import Path
    from app.services.settings import get_setting
    stream_url = None
    try:
        downloads_dir = Path(await get_setting(db, "downloads_dir"))
        rel = Path(video.file_path).relative_to(downloads_dir)
        stream_url = f"/files/downloads/{rel}"
    except Exception:
        pass

    detail = VideoDetail.model_validate(video)
    detail.stream_url = stream_url
    return detail


@router.get("/{video_id}/transcript", response_model=TranscriptSchema)
async def get_video_transcript(video_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transcript)
        .options(selectinload(Transcript.segments))
        .where(Transcript.video_id == video_id)
    )
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return TranscriptSchema.model_validate(transcript)


@router.delete("/{video_id}")
async def delete_video(video_id: UUID, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    await db.delete(video)
    await db.commit()
    return {"detail": "Video removed from database"}
