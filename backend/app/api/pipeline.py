from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.enums import VideoStatus
from app.models.video import Video

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/scan")
async def trigger_scan():
    """Trigger an immediate scan of the downloads directory."""
    from app.worker.tasks import scan_downloads
    task = scan_downloads.delay()
    return {"detail": "Scan triggered", "task_id": task.id}


@router.post("/reprocess/{video_id}")
async def reprocess_video(video_id: UUID, db: AsyncSession = Depends(get_db)):
    """Reprocess a specific video through the full pipeline."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video.status = VideoStatus.DISCOVERED
    db.add(video)
    await db.commit()

    from app.worker.tasks import process_video
    task = process_video.delay(str(video_id))
    return {"detail": "Reprocessing triggered", "task_id": task.id}


class BatchReprocessRequest(BaseModel):
    video_ids: list[str]


@router.post("/reprocess-batch")
async def reprocess_batch(payload: BatchReprocessRequest, db: AsyncSession = Depends(get_db)):
    """Reprocess multiple videos through the full pipeline."""
    if not payload.video_ids:
        raise HTTPException(status_code=400, detail="No video IDs provided")
    if len(payload.video_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 videos per batch")

    from app.worker.tasks import process_video
    task_ids = []
    queued = 0

    for vid_str in payload.video_ids:
        try:
            vid_uuid = UUID(vid_str)
        except ValueError:
            continue
        video = await db.get(Video, vid_uuid)
        if not video:
            continue
        video.status = VideoStatus.DISCOVERED
        db.add(video)
        task = process_video.delay(str(vid_uuid))
        task_ids.append(task.id)
        queued += 1

    await db.commit()
    return {"queued": queued, "task_ids": task_ids}
