"""Fire webhook notifications for pipeline events."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SUPPORTED_EVENTS = {
    "job_completed",
    "job_failed",
    "story_detected",
    "thumbnail_generated",
    "youtube_uploaded",
}


def fire_webhooks_sync(db, event: str, payload: dict) -> None:
    """
    Fire all active webhooks registered for the given event.
    Runs synchronously inside Celery workers. Errors are suppressed — this is fire-and-forget.
    """
    try:
        import httpx
        from sqlalchemy import select
        from app.models.webhook import Webhook

        hooks = db.execute(
            select(Webhook).where(Webhook.active == True)  # noqa: E712
        ).scalars().all()

        body = json.dumps({
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **payload,
        })

        for hook in hooks:
            if hook.events and event not in hook.events:
                continue
            try:
                headers = {"Content-Type": "application/json", "X-StoryEngine-Event": event}
                if hook.secret:
                    sig = hmac.new(hook.secret.encode(), body.encode(), hashlib.sha256).hexdigest()
                    headers["X-StoryEngine-Signature"] = f"sha256={sig}"

                resp = httpx.post(hook.url, content=body, headers=headers, timeout=5.0)
                logger.info("Webhook %s → %s: HTTP %d", event, hook.url, resp.status_code)
            except Exception as e:
                logger.warning("Webhook delivery failed for %s: %s", hook.url, e)

    except Exception as e:
        logger.warning("fire_webhooks_sync error: %s", e)
