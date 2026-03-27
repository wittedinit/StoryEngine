import subprocess

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.database import AsyncSessionLocal, async_engine

app = FastAPI(title="StoryEngine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Mount static file serving for downloads and segments
if settings.downloads_dir.exists():
    app.mount("/files/downloads", StaticFiles(directory=str(settings.downloads_dir)), name="downloads")
if settings.segments_dir.exists():
    app.mount("/files/segments", StaticFiles(directory=str(settings.segments_dir)), name="segments")


@app.get("/health")
async def health_check():
    checks = {}

    # Database
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis
    try:
        import redis
        r = redis.from_url(settings.redis_url, socket_timeout=2)
        r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # Ollama (use DB setting if available)
    try:
        from app.services.settings import get_setting
        async with AsyncSessionLocal() as db:
            ollama_url = await get_setting(db, "ollama_url")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ollama_url}/")
            checks["ollama"] = "ok" if resp.status_code == 200 else f"status: {resp.status_code}"
            checks["ollama_url"] = ollama_url
    except Exception as e:
        checks["ollama"] = f"error: {e}"

    # ffmpeg
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        checks["ffmpeg"] = "ok" if result.returncode == 0 else "error"
    except Exception:
        checks["ffmpeg"] = "not found"

    # Downloads directory
    checks["downloads_dir"] = "ok" if settings.downloads_dir.exists() else "missing"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "healthy" if all_ok else "degraded", "checks": checks}


@app.get("/api/v1/stats")
async def get_stats():
    from sqlalchemy import func, select
    from app.database import AsyncSessionLocal
    from app.models.enums import JobStatus, VideoStatus
    from app.models.job import ProcessingJob
    from app.models.story import Story
    from app.models.video import Video

    async with AsyncSessionLocal() as db:
        total_videos = (await db.execute(select(func.count(Video.id)))).scalar()
        completed_videos = (await db.execute(
            select(func.count(Video.id)).where(Video.status == VideoStatus.COMPLETED)
        )).scalar()
        total_stories = (await db.execute(select(func.count(Story.id)))).scalar()
        pending_jobs = (await db.execute(
            select(func.count(ProcessingJob.id)).where(
                ProcessingJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING])
            )
        )).scalar()
        failed_jobs = (await db.execute(
            select(func.count(ProcessingJob.id)).where(ProcessingJob.status == JobStatus.FAILED)
        )).scalar()

    return {
        "total_videos": total_videos,
        "completed_videos": completed_videos,
        "total_stories": total_stories,
        "pending_jobs": pending_jobs,
        "failed_jobs": failed_jobs,
    }
