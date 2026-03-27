from fastapi import APIRouter

from app.api.dedup import router as dedup_router
from app.api.export import router as export_router
from app.api.jobs import router as jobs_router
from app.api.pipeline import router as pipeline_router
from app.api.settings import router as settings_router
from app.api.stories import router as stories_router
from app.api.videos import router as videos_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(videos_router)
api_router.include_router(stories_router)
api_router.include_router(jobs_router)
api_router.include_router(pipeline_router)
api_router.include_router(settings_router)
api_router.include_router(export_router)
api_router.include_router(dedup_router)
