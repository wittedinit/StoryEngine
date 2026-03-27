"""Full-text transcript search using PostgreSQL tsvector GIN index."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.transcript import Transcript
from app.models.video import Video

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/transcripts")
async def search_transcripts(
    q: str = Query(..., min_length=2, description="Search query"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search across all video transcripts using PostgreSQL GIN index.
    Returns matching videos with a highlighted excerpt from the transcript.
    """
    if not q.strip():
        return {"results": [], "total": 0, "page": page, "per_page": per_page, "query": q}

    # Use plainto_tsquery for safe multi-word input (no tsquery syntax required)
    ts_query = func.plainto_tsquery("english", q)

    # Count total matches
    count_result = await db.execute(
        select(func.count()).select_from(Transcript).where(
            Transcript.search_vector.op("@@")(ts_query)
        )
    )
    total = count_result.scalar() or 0

    if total == 0:
        return {"results": [], "total": 0, "page": page, "per_page": per_page, "query": q}

    # Fetch ranked results with headline snippets
    offset = (page - 1) * per_page
    result = await db.execute(
        select(
            Transcript.video_id,
            Video.title.label("video_title"),
            Video.filename.label("video_filename"),
            Video.duration.label("video_duration"),
            func.ts_headline(
                "english",
                Transcript.full_text,
                ts_query,
                "MaxWords=30, MinWords=15, ShortWord=3, HighlightAll=false",
            ).label("excerpt"),
            func.ts_rank(Transcript.search_vector, ts_query).label("rank"),
        )
        .join(Video, Video.id == Transcript.video_id)
        .where(Transcript.search_vector.op("@@")(ts_query))
        .order_by(func.ts_rank(Transcript.search_vector, ts_query).desc())
        .offset(offset)
        .limit(per_page)
    )
    rows = result.all()

    results = [
        {
            "video_id": str(row.video_id),
            "video_title": row.video_title,
            "video_filename": row.video_filename,
            "video_duration": row.video_duration,
            "excerpt": row.excerpt,
            "rank": float(row.rank),
        }
        for row in rows
    ]

    return {
        "results": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "query": q,
    }
