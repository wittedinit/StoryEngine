from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.story import Story
from app.models.video import Video

router = APIRouter(prefix="/dedup", tags=["dedup"])


@router.post("/embed")
async def trigger_embed_all():
    """Queue embedding of all stories that don't have embeddings yet."""
    from app.worker.tasks import embed_all_stories_task
    task = embed_all_stories_task.delay()
    return {"detail": "Embedding queued", "task_id": task.id}


@router.get("/clusters")
async def get_clusters(
    threshold: float | None = Query(None, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
):
    """Find and return clusters of semantically similar stories."""
    from app.services.dedup import find_clusters
    from app.services.settings import get_setting

    effective_threshold = threshold if threshold is not None else float(await get_setting(db, "dedup_threshold"))

    result = await db.execute(
        select(Story, Video.title.label("video_title"))
        .join(Video, Story.video_id == Video.id)
        .where(Story.embedding.isnot(None))
    )
    rows = result.all()

    if len(rows) < 2:
        return {"clusters": [], "total_embedded": len(rows), "threshold": effective_threshold}

    story_embeddings = [(str(story.id), story.embedding) for story, _ in rows]
    story_map = {str(story.id): (story, video_title) for story, video_title in rows}

    clusters = find_clusters(story_embeddings, effective_threshold)

    result_clusters = []
    for cluster in clusters:
        cluster_stories = []
        for sid in cluster:
            if sid in story_map:
                story, video_title = story_map[sid]
                cluster_stories.append({
                    "id": str(story.id),
                    "title": story.title,
                    "video_id": str(story.video_id),
                    "video_title": video_title,
                    "duration": story.duration,
                    "has_clip": story.clip_path is not None,
                })
        if len(cluster_stories) > 1:
            result_clusters.append(cluster_stories)

    return {
        "clusters": result_clusters,
        "total_embedded": len(rows),
        "total_clusters": len(result_clusters),
        "threshold": effective_threshold,
    }


@router.get("/similar/{story_id}")
async def get_similar_stories(
    story_id: UUID,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Find stories semantically similar to a given story."""
    story = await db.get(Story, story_id)
    if not story or story.embedding is None:
        return {"similar": [], "message": "Story has no embedding yet. Run /dedup/embed first."}

    from app.services.dedup import find_similar_to
    from app.services.settings import get_setting

    threshold = float(await get_setting(db, "dedup_threshold"))

    result = await db.execute(
        select(Story, Video.title.label("video_title"))
        .join(Video, Story.video_id == Video.id)
        .where(Story.embedding.isnot(None))
    )
    rows = result.all()
    all_embeddings = [(str(s.id), s.embedding) for s, _ in rows]
    story_map = {str(s.id): (s, vt) for s, vt in rows}

    similar = find_similar_to(story.embedding, all_embeddings, threshold, limit=limit, exclude_id=str(story_id))

    return {
        "similar": [
            {
                "id": sid,
                "similarity": score,
                "title": story_map[sid][0].title if sid in story_map else "",
                "video_title": story_map[sid][1] if sid in story_map else "",
                "has_clip": story_map[sid][0].clip_path is not None if sid in story_map else False,
            }
            for sid, score in similar
            if sid in story_map
        ]
    }
