"""YouTube OAuth2 flow and upload management endpoints."""
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/youtube", tags=["youtube"])

# In-memory state store for OAuth2 CSRF protection (short-lived)
_oauth_states: dict[str, bool] = {}


@router.get("/status")
async def youtube_status(db: AsyncSession = Depends(get_db)):
    """Return whether YouTube is connected and the authenticated channel info."""
    from app.services.settings import get_setting

    refresh_token = await get_setting(db, "youtube_refresh_token")
    client_id = await get_setting(db, "youtube_client_id")
    client_secret = await get_setting(db, "youtube_client_secret")

    if not refresh_token:
        return {"connected": False, "channel": None}

    if not client_id or not client_secret:
        return {"connected": False, "channel": None, "error": "Client credentials not configured"}

    try:
        from app.services.youtube_upload import get_youtube_service, get_channel_info
        from app.database import SyncSessionLocal
        db_sync = SyncSessionLocal()
        try:
            youtube = get_youtube_service(db_sync)
            channel = get_channel_info(youtube)
        finally:
            db_sync.close()
        return {"connected": True, "channel": channel}
    except Exception as e:
        return {"connected": False, "channel": None, "error": str(e)}


@router.get("/oauth/authorize")
async def oauth_authorize(db: AsyncSession = Depends(get_db)):
    """Build and return the Google OAuth2 authorization URL."""
    from app.services.settings import get_setting
    from app.services.youtube_upload import get_oauth_flow

    client_id = await get_setting(db, "youtube_client_id")
    client_secret = await get_setting(db, "youtube_client_secret")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail="Configure YouTube Client ID and Client Secret in Settings first.",
        )

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = True

    flow = get_oauth_flow(client_id, client_secret)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=state,
        prompt="consent",  # force consent screen to get refresh_token
    )
    return {"auth_url": auth_url}


@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle the OAuth2 redirect, exchange code for tokens, and store refresh token."""
    if error:
        return RedirectResponse(url=f"http://localhost:3100/youtube?error={error}")

    if state not in _oauth_states:
        raise HTTPException(status_code=400, detail="Invalid OAuth state. Try authorising again.")
    del _oauth_states[state]

    from app.services.settings import get_setting, update_setting
    from app.services.youtube_upload import get_oauth_flow

    client_id = await get_setting(db, "youtube_client_id")
    client_secret = await get_setting(db, "youtube_client_secret")
    flow = get_oauth_flow(client_id, client_secret)

    flow.fetch_token(code=code)
    creds = flow.credentials

    if not creds.refresh_token:
        return RedirectResponse(url="http://localhost:3100/youtube?error=no_refresh_token")

    await update_setting(db, "youtube_refresh_token", creds.refresh_token)

    return RedirectResponse(url="http://localhost:3100/youtube?connected=1")


@router.delete("/oauth/revoke")
async def oauth_revoke(db: AsyncSession = Depends(get_db)):
    """Remove stored OAuth tokens, disconnecting YouTube."""
    from app.services.settings import reset_setting
    await reset_setting(db, "youtube_refresh_token")
    return {"disconnected": True}


@router.post("/upload/{story_id}")
async def upload_story(story_id: UUID, db: AsyncSession = Depends(get_db)):
    """Queue a YouTube upload for a single story clip."""
    from sqlalchemy import select
    from app.models.story import Story

    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if not story.clip_path:
        raise HTTPException(status_code=400, detail="No clip file. Split the story first.")

    from app.worker.tasks import youtube_upload_task
    task = youtube_upload_task.delay(str(story_id))
    return {"detail": "Upload queued", "task_id": task.id}


@router.get("/upload/{task_id}/status")
async def upload_status(task_id: str):
    """Poll the status of a YouTube upload task."""
    from celery.result import AsyncResult
    from app.celery_app import celery
    result = AsyncResult(task_id, app=celery)

    if result.state == "PENDING":
        return {"state": "pending", "ready": False}
    elif result.state == "SUCCESS":
        return {"state": "success", "ready": True, **result.result}
    elif result.state == "FAILURE":
        return {"state": "failure", "ready": False, "error": str(result.result)}
    else:
        meta = result.info or {}
        return {"state": result.state.lower(), "ready": False, "progress": meta.get("progress", 0)}


@router.post("/upload-all")
async def upload_all_stories(db: AsyncSession = Depends(get_db)):
    """Queue YouTube uploads for all stories that have clips but no youtube_video_id."""
    from sqlalchemy import select
    from app.models.story import Story
    from app.worker.tasks import youtube_upload_task

    result = await db.execute(
        select(Story).where(Story.clip_path.isnot(None), Story.youtube_video_id.is_(None))
    )
    stories = result.scalars().all()

    task_ids = []
    for s in stories:
        task = youtube_upload_task.delay(str(s.id))
        task_ids.append(task.id)

    return {"queued": len(task_ids), "task_ids": task_ids}
