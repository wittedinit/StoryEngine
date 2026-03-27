"""CRUD endpoints for webhook management."""
import uuid as uuid_lib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.webhook import Webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

VALID_EVENTS = [
    "job_completed",
    "job_failed",
    "story_detected",
    "thumbnail_generated",
    "youtube_uploaded",
]


class WebhookCreate(BaseModel):
    url: str
    events: list[str] = []
    secret: str | None = None
    label: str | None = None
    active: bool = True


class WebhookUpdate(BaseModel):
    url: str | None = None
    events: list[str] | None = None
    secret: str | None = None
    label: str | None = None
    active: bool | None = None


def _hook_to_dict(hook: Webhook) -> dict:
    return {
        "id": str(hook.id),
        "url": hook.url,
        "events": hook.events or [],
        "secret": "***" if hook.secret else None,
        "label": hook.label,
        "active": hook.active,
        "created_at": hook.created_at.isoformat(),
    }


@router.get("")
async def list_webhooks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Webhook).order_by(Webhook.created_at))
    hooks = result.scalars().all()
    return {"webhooks": [_hook_to_dict(h) for h in hooks], "valid_events": VALID_EVENTS}


@router.post("")
async def create_webhook(payload: WebhookCreate, db: AsyncSession = Depends(get_db)):
    invalid = [e for e in payload.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown events: {invalid}")

    hook = Webhook(
        id=uuid_lib.uuid4(),
        url=payload.url,
        events=payload.events,
        secret=payload.secret or None,
        label=payload.label,
        active=payload.active,
    )
    db.add(hook)
    await db.commit()
    await db.refresh(hook)
    return _hook_to_dict(hook)


@router.put("/{hook_id}")
async def update_webhook(hook_id: UUID, payload: WebhookUpdate, db: AsyncSession = Depends(get_db)):
    hook = await db.get(Webhook, hook_id)
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if payload.events is not None:
        invalid = [e for e in payload.events if e not in VALID_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Unknown events: {invalid}")
        hook.events = payload.events
    if payload.url is not None:
        hook.url = payload.url
    if payload.secret is not None:
        hook.secret = payload.secret
    if payload.label is not None:
        hook.label = payload.label
    if payload.active is not None:
        hook.active = payload.active

    await db.commit()
    return _hook_to_dict(hook)


@router.delete("/{hook_id}")
async def delete_webhook(hook_id: UUID, db: AsyncSession = Depends(get_db)):
    hook = await db.get(Webhook, hook_id)
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(hook)
    await db.commit()
    return {"deleted": True}


@router.post("/{hook_id}/test")
async def test_webhook(hook_id: UUID, db: AsyncSession = Depends(get_db)):
    """Send a test payload to verify the webhook URL is reachable."""
    hook = await db.get(Webhook, hook_id)
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    import httpx
    import json
    import hashlib
    import hmac
    from datetime import datetime, timezone

    body = json.dumps({
        "event": "test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": "StoryEngine webhook test",
    })
    headers = {"Content-Type": "application/json", "X-StoryEngine-Event": "test"}
    if hook.secret:
        sig = hmac.new(hook.secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-StoryEngine-Signature"] = f"sha256={sig}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(hook.url, content=body, headers=headers)
        return {"success": True, "status_code": resp.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}
