from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.story import Story
from app.models.video import Video
from app.schemas.story import StoryDetail, StoryListResponse, StorySummary, StoryPatch

router = APIRouter(prefix="/stories", tags=["stories"])


@router.get("", response_model=StoryListResponse)
async def list_stories(
    video_id: UUID | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Story, Video.title.label("video_title")).join(Video, Story.video_id == Video.id)
    count_query = select(func.count(Story.id))

    if video_id:
        query = query.where(Story.video_id == video_id)
        count_query = count_query.where(Story.video_id == video_id)
    if search:
        search_filter = Story.title.ilike(f"%{search}%") | Story.summary.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar()

    query = query.order_by(Story.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(query)).all()

    items = []
    for story, video_title in rows:
        item = StorySummary(
            id=story.id,
            video_id=story.video_id,
            title=story.title,
            summary=story.summary,
            start_time=story.start_time,
            end_time=story.end_time,
            duration=story.duration,
            story_index=story.story_index,
            confidence=story.confidence,
            video_title=video_title or "",
            has_clip=story.clip_path is not None,
            has_embedding=story.embedding is not None,
            segment_type=story.segment_type or "story",
            created_at=story.created_at,
        )
        items.append(item)

    return StoryListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{story_id}", response_model=StoryDetail)
async def get_story(story_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Story, Video.title.label("video_title"))
        .join(Video, Story.video_id == Video.id)
        .where(Story.id == story_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")

    story, video_title = row
    return StoryDetail(
        id=story.id,
        video_id=story.video_id,
        title=story.title,
        summary=story.summary,
        start_time=story.start_time,
        end_time=story.end_time,
        duration=story.duration,
        story_index=story.story_index,
        confidence=story.confidence,
        transcript_excerpt=story.transcript_excerpt,
        llm_model=story.llm_model,
        video_title=video_title or "",
        has_clip=story.clip_path is not None,
        has_embedding=story.embedding is not None,
        clip_path=story.clip_path,
        thumbnail_path=story.thumbnail_path,
        youtube_video_id=story.youtube_video_id,
        youtube_playlist_id=story.youtube_playlist_id,
        segment_type=story.segment_type or "story",
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


@router.patch("/{story_id}", response_model=StoryDetail)
async def patch_story(story_id: UUID, payload: StoryPatch, db: AsyncSession = Depends(get_db)):
    """Partially update story title, summary, or timestamps."""
    result = await db.execute(
        select(Story, Video.title.label("video_title"))
        .join(Video, Story.video_id == Video.id)
        .where(Story.id == story_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")

    story, video_title = row

    if payload.title is not None:
        story.title = payload.title
    if payload.summary is not None:
        story.summary = payload.summary

    times_changed = False
    if payload.start_time is not None:
        story.start_time = payload.start_time
        times_changed = True
    if payload.end_time is not None:
        story.end_time = payload.end_time
        times_changed = True

    if times_changed:
        story.duration = story.end_time - story.start_time
        # Clip and thumbnail are stale when timestamps change
        story.clip_path = None
        story.thumbnail_path = None

    db.add(story)
    await db.commit()
    await db.refresh(story)

    return StoryDetail(
        id=story.id,
        video_id=story.video_id,
        title=story.title,
        summary=story.summary,
        start_time=story.start_time,
        end_time=story.end_time,
        duration=story.duration,
        story_index=story.story_index,
        confidence=story.confidence,
        transcript_excerpt=story.transcript_excerpt,
        llm_model=story.llm_model,
        video_title=video_title or "",
        has_clip=story.clip_path is not None,
        has_embedding=story.embedding is not None,
        clip_path=story.clip_path,
        thumbnail_path=story.thumbnail_path,
        youtube_video_id=story.youtube_video_id,
        youtube_playlist_id=story.youtube_playlist_id,
        segment_type=story.segment_type or "story",
        created_at=story.created_at,
        updated_at=story.updated_at,
    )
