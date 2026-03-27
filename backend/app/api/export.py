import mimetypes
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
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


# ── Story splitting ────────────────────────────────────────────────────────────

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


# ── Playlist export ────────────────────────────────────────────────────────────

def _stories_to_dicts(stories: list[Story], video_title: str = "") -> list[dict]:
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "summary": s.summary,
            "video_title": video_title,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "duration": s.duration,
            "has_clip": bool(s.clip_path),
            "clip_path": s.clip_path,
        }
        for s in stories
    ]


@router.get("/videos/{video_id}/playlist")
async def video_playlist(
    video_id: UUID,
    format: str = Query("m3u8", pattern="^(m3u8|json)$"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Export a playlist (M3U8 or JSON) for all stories in a video."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    result = await db.execute(
        select(Story)
        .where(Story.video_id == video_id, Story.segment_type == "story")
        .order_by(Story.story_index)
    )
    stories = result.scalars().all()

    story_dicts = _stories_to_dicts(stories, video.title)
    base_url = str(request.base_url).rstrip("/") if request else ""
    title = video.title

    from app.services.playlist import build_m3u8, build_playlist_json
    if format == "m3u8":
        content = build_m3u8(story_dicts, base_url, title)
        filename = f"{video.filename.rsplit('.', 1)[0]}.m3u8"
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        data = build_playlist_json(story_dicts, title)
        filename = f"{video.filename.rsplit('.', 1)[0]}.json"
        import json
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@router.get("/stories/playlist")
async def stories_playlist(
    ids: str = Query(..., description="Comma-separated story UUIDs"),
    format: str = Query("m3u8", pattern="^(m3u8|json)$"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Export a playlist for a custom selection of stories."""
    story_ids = [s.strip() for s in ids.split(",") if s.strip()]
    if not story_ids:
        raise HTTPException(status_code=400, detail="No story IDs provided")

    import uuid
    uuid_list = []
    for sid in story_ids:
        try:
            uuid_list.append(uuid.UUID(sid))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid UUID: {sid}")

    result = await db.execute(
        select(Story, Video)
        .join(Video, Story.video_id == Video.id)
        .where(Story.id.in_(uuid_list))
        .order_by(Story.video_id, Story.story_index)
    )
    rows = result.all()

    story_dicts = [
        {
            "id": str(s.id),
            "title": s.title,
            "summary": s.summary,
            "video_title": v.title,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "duration": s.duration,
            "has_clip": bool(s.clip_path),
            "clip_path": s.clip_path,
        }
        for s, v in rows
    ]

    base_url = str(request.base_url).rstrip("/") if request else ""
    from app.services.playlist import build_m3u8, build_playlist_json
    if format == "m3u8":
        content = build_m3u8(story_dicts, base_url, "StoryEngine Selection")
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers={"Content-Disposition": 'attachment; filename="selection.m3u8"'},
        )
    else:
        import json
        data = build_playlist_json(story_dicts, "StoryEngine Selection")
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="selection.json"'},
        )


# ── Bulk ZIP download ─────────────────────────────────────────────────────────

@router.post("/zip")
async def request_bulk_zip(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Queue a bulk ZIP download of clip files. Returns task_id to poll."""
    story_ids = payload.get("story_ids", [])
    if not story_ids:
        raise HTTPException(status_code=400, detail="No story IDs provided")
    if len(story_ids) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 stories per ZIP")

    from app.worker.tasks import build_bulk_zip_task
    task = build_bulk_zip_task.delay(story_ids)
    return {"task_id": task.id, "detail": "ZIP build queued"}


@router.get("/zip/{task_id}/status")
async def bulk_zip_status(task_id: str):
    """Poll the status of a bulk ZIP build task."""
    from celery.result import AsyncResult
    from app.celery_app import celery
    result = AsyncResult(task_id, app=celery)

    if result.state == "PENDING":
        return {"state": "pending", "ready": False}
    elif result.state == "SUCCESS":
        return {"state": "success", "ready": True, "download_url": f"/api/v1/export/zip/{task_id}/download"}
    elif result.state == "FAILURE":
        return {"state": "failure", "ready": False, "error": str(result.result)}
    else:
        meta = result.info or {}
        return {"state": result.state.lower(), "ready": False, "progress": meta.get("progress", 0)}


@router.get("/zip/{task_id}/download")
async def download_bulk_zip(task_id: str):
    """Download a completed bulk ZIP file."""
    from celery.result import AsyncResult
    from app.celery_app import celery
    result = AsyncResult(task_id, app=celery)

    if result.state != "SUCCESS":
        raise HTTPException(status_code=404, detail="ZIP not ready or task not found")

    zip_path = Path(result.result.get("zip_path", ""))
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="ZIP file missing from disk")

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=zip_path.name,
        headers={"Content-Disposition": f'attachment; filename="{zip_path.name}"'},
    )


# ── SRT subtitle export ───────────────────────────────────────────────────────

@router.get("/stories/{story_id}/srt")
async def download_srt(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Generate and download an SRT subtitle file for a story."""
    from sqlalchemy import select as sa_select
    from app.models.transcript import Transcript, TranscriptSegment

    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    transcript_result = await db.execute(
        sa_select(Transcript).where(Transcript.video_id == story.video_id)
    )
    transcript = transcript_result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not available")

    seg_result = await db.execute(
        sa_select(TranscriptSegment)
        .where(TranscriptSegment.transcript_id == transcript.id)
        .order_by(TranscriptSegment.start_time)
    )
    segments = [
        {"start_time": s.start_time, "end_time": s.end_time, "text": s.text}
        for s in seg_result.scalars().all()
    ]

    from app.services.srt import build_srt
    srt_content = build_srt(segments, story.start_time, story.end_time)

    slug = story.title[:40].replace(" ", "_").replace("/", "_")
    filename = f"{slug}.srt"

    return Response(
        content=srt_content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── NFO export ────────────────────────────────────────────────────────────────

@router.get("/stories/{story_id}/nfo")
async def download_nfo(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Generate and download a Jellyfin/Kodi NFO file for a story."""
    result = await db.execute(
        select(Story, Video)
        .join(Video, Story.video_id == Video.id)
        .where(Story.id == story_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")

    story, video = row

    from app.services.nfo import build_nfo
    nfo_content = build_nfo(
        story={
            "id": str(story.id),
            "title": story.title,
            "summary": story.summary,
            "duration": story.duration,
            "start_time": story.start_time,
            "end_time": story.end_time,
            "story_index": story.story_index,
            "created_at": story.created_at,
        },
        video={
            "title": video.title,
            "channel_name": video.channel_name,
            "filename": video.filename,
        },
    )

    slug = story.title[:40].replace(" ", "_").replace("/", "_")
    filename = f"{slug}.nfo"

    import json as _json
    return Response(
        content=nfo_content,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Thumbnail ─────────────────────────────────────────────────────────────────

@router.post("/stories/{story_id}/thumbnail")
async def generate_thumbnail(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Queue thumbnail generation for a story."""
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    from app.worker.tasks import generate_thumbnail_task
    task = generate_thumbnail_task.delay(str(story_id))
    return {"detail": "Thumbnail generation queued", "task_id": task.id}


@router.get("/stories/{story_id}/thumbnail")
async def get_thumbnail(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Download the thumbnail image for a story."""
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if not story.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail not generated yet.")

    thumb_path = settings.segments_dir / story.thumbnail_path
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file missing from disk.")

    return FileResponse(path=str(thumb_path), media_type="image/jpeg")
