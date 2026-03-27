import mimetypes
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.story import Story
from app.models.video import Video

router = APIRouter(prefix="/export", tags=["export"])

_MEDIA_TYPES = {
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
}


@router.post("/stories/{story_id}/split")
async def split_single_story(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Queue a clip split for a single story."""
    result = await db.execute(
        select(Story, Video).join(Video, Story.video_id == Video.id).where(Story.id == story_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")

    from app.worker.tasks import split_single_story_task
    task = split_single_story_task.delay(str(story_id))
    return {"detail": "Split queued", "task_id": task.id}


@router.post("/videos/{video_id}/split")
async def split_video_stories(video_id: UUID, db: AsyncSession = Depends(get_db)):
    """Queue clip splits for all stories in a video."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    from app.worker.tasks import split_video_stories_task
    task = split_video_stories_task.delay(str(video_id))
    return {"detail": "Split queued for all stories", "task_id": task.id}


@router.get("/stories/{story_id}/clip")
async def download_clip(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Download the split clip file for a story."""
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if not story.clip_path:
        raise HTTPException(status_code=404, detail="Clip not available. Split the story first.")

    clip_full_path = settings.segments_dir / story.clip_path
    if not clip_full_path.exists():
        raise HTTPException(status_code=404, detail="Clip file missing from disk. Re-split the story.")

    ext = Path(story.clip_path).suffix.lower()
    media_type = _MEDIA_TYPES.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(clip_full_path),
        media_type=media_type,
        filename=clip_full_path.name,
        headers={"Content-Disposition": f'attachment; filename="{clip_full_path.name}"'},
    )
