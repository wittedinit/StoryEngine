"""Channel-level reports: story counts, dedup analysis."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.story import Story
from app.models.video import Video

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/channels")
async def list_channels(db: AsyncSession = Depends(get_db)):
    """
    List all channels with aggregate stats.
    A 'channel' is the parent directory name stored in videos.channel_name.
    Videos with no parent (channel_name=NULL) are grouped as '(root)'.
    """
    result = await db.execute(
        select(
            func.coalesce(Video.channel_name, "(root)").label("channel"),
            func.count(Video.id).label("video_count"),
            func.sum(func.coalesce(Video.duration, 0)).label("total_duration"),
        )
        .group_by(func.coalesce(Video.channel_name, "(root)"))
        .order_by(func.coalesce(Video.channel_name, "(root)"))
    )
    rows = result.all()

    # Story counts per channel — join through Video
    story_result = await db.execute(
        select(
            func.coalesce(Video.channel_name, "(root)").label("channel"),
            func.count(Story.id).label("story_count"),
            func.sum(
                func.cast(Story.clip_path.isnot(None), func.Integer() if False else Story.id.__class__)
            ).label("clip_count"),
        )
        .join(Story, Story.video_id == Video.id, isouter=True)
        .group_by(func.coalesce(Video.channel_name, "(root)"))
    )
    # Simpler approach: count clips in Python
    story_result2 = await db.execute(
        select(
            func.coalesce(Video.channel_name, "(root)").label("channel"),
            func.count(Story.id).label("story_count"),
        )
        .join(Story, Story.video_id == Video.id, isouter=True)
        .where(Story.segment_type == "story")
        .group_by(func.coalesce(Video.channel_name, "(root)"))
    )
    story_counts = {r.channel: r.story_count for r in story_result2.all()}

    clip_result = await db.execute(
        select(
            func.coalesce(Video.channel_name, "(root)").label("channel"),
            func.count(Story.id).label("clip_count"),
        )
        .join(Story, Story.video_id == Video.id, isouter=True)
        .where(Story.clip_path.isnot(None))
        .group_by(func.coalesce(Video.channel_name, "(root)"))
    )
    clip_counts = {r.channel: r.clip_count for r in clip_result.all()}

    channels = []
    for row in rows:
        channels.append({
            "channel": row.channel,
            "video_count": row.video_count,
            "total_duration": float(row.total_duration or 0),
            "story_count": story_counts.get(row.channel, 0),
            "clip_count": clip_counts.get(row.channel, 0),
        })

    return {"channels": channels, "total": len(channels)}


@router.get("/channels/{channel_name}/dedup")
async def channel_dedup_report(
    channel_name: str,
    threshold: float = Query(0.85, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
):
    """
    Find duplicate story clusters within a specific channel.
    Uses the same USearch HNSW index as the global dedup, but scopes
    results to stories belonging to videos in this channel.
    """
    # Get all story IDs in this channel
    result = await db.execute(
        select(Story.id, Story.title, Story.video_id, Story.duration, Story.embedding, Story.clip_path)
        .join(Video, Story.video_id == Video.id)
        .where(
            func.coalesce(Video.channel_name, "(root)") == channel_name,
            Story.segment_type == "story",
        )
        .order_by(Story.video_id, Story.story_index)
    )
    stories = result.all()

    if not stories:
        return {"clusters": [], "total_stories": 0, "total_embedded": 0, "threshold": threshold}

    story_ids = {str(s.id) for s in stories}
    embedded = [s for s in stories if s.embedding]

    if len(embedded) < 2:
        return {
            "clusters": [],
            "total_stories": len(stories),
            "total_embedded": len(embedded),
            "threshold": threshold,
            "message": "Not enough embedded stories. Run 'Embed All Stories' first.",
        }

    # Build scoped dedup clusters
    from app.services.dedup import find_clusters
    from app.models.story import Story as StoryModel

    all_stories_result = await db.execute(
        select(StoryModel)
        .join(Video, StoryModel.video_id == Video.id)
        .where(
            func.coalesce(Video.channel_name, "(root)") == channel_name,
            StoryModel.segment_type == "story",
            StoryModel.embedding.isnot(None),
        )
    )
    embedded_stories = all_stories_result.scalars().all()

    # Get video titles
    video_ids = {s.video_id for s in embedded_stories}
    vids_result = await db.execute(select(Video).where(Video.id.in_(video_ids)))
    video_map = {v.id: v.title for v in vids_result.scalars().all()}

    clusters_raw = find_clusters(embedded_stories, threshold=threshold)

    clusters = [
        [
            {
                "id": str(s.id),
                "title": s.title,
                "video_id": str(s.video_id),
                "video_title": video_map.get(s.video_id, ""),
                "duration": s.duration,
                "has_clip": bool(s.clip_path),
            }
            for s in cluster
        ]
        for cluster in clusters_raw
    ]

    return {
        "channel": channel_name,
        "clusters": clusters,
        "total_stories": len(stories),
        "total_embedded": len(embedded_stories),
        "total_clusters": len(clusters),
        "threshold": threshold,
    }


@router.get("/channels/{channel_name}/videos")
async def channel_videos(
    channel_name: str,
    db: AsyncSession = Depends(get_db),
):
    """List all videos in a channel."""
    q_channel = None if channel_name == "(root)" else channel_name
    result = await db.execute(
        select(Video)
        .where(
            Video.channel_name == q_channel if q_channel else Video.channel_name.is_(None)
        )
        .order_by(Video.title)
    )
    videos = result.scalars().all()

    return {
        "channel": channel_name,
        "videos": [
            {
                "id": str(v.id),
                "title": v.title,
                "filename": v.filename,
                "duration": v.duration,
                "status": v.status.value,
            }
            for v in videos
        ],
        "total": len(videos),
    }
