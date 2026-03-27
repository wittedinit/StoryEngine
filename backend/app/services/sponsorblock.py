"""SponsorBlock integration and LLM-based sponsor detection."""
import logging

import httpx

logger = logging.getLogger(__name__)

SPONSORBLOCK_API = "https://sponsor.ajay.app/api/skipSegments"

# Categories we fetch — covers all non-content segments
SPONSORBLOCK_CATEGORIES = [
    "sponsor",
    "selfpromo",
    "interaction",
    "intro",
    "outro",
    "preview",
    "filler",
]


def fetch_sponsorblock(youtube_id: str) -> list[dict]:
    """
    Fetch sponsor/non-content segments from the SponsorBlock API.

    Returns list of dicts: {category, start_time, end_time, title, votes}
    Returns empty list if no data or API unavailable.
    """
    try:
        params = {
            "videoID": youtube_id,
            "categories": str(SPONSORBLOCK_CATEGORIES).replace("'", '"'),
        }
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(SPONSORBLOCK_API, params=params)
            if resp.status_code == 404:
                return []  # No segments submitted for this video
            resp.raise_for_status()
            segments = resp.json()

        result = []
        for seg in segments:
            start, end = seg.get("segment", [0, 0])
            category = seg.get("category", "sponsor")
            result.append({
                "category": category,
                "start_time": float(start),
                "end_time": float(end),
                "title": _category_label(category),
                "votes": seg.get("votes", 0),
            })

        logger.info("SponsorBlock: %d segments for %s", len(result), youtube_id)
        return result

    except Exception as e:
        logger.warning("SponsorBlock fetch failed for %s: %s", youtube_id, e)
        return []


def _category_label(category: str) -> str:
    return {
        "sponsor": "Sponsored Segment",
        "selfpromo": "Self-Promotion",
        "interaction": "Interaction Reminder",
        "intro": "Intro",
        "outro": "Outro",
        "preview": "Preview",
        "filler": "Filler",
    }.get(category, category.title())


async def detect_sponsors_llm(
    segments: list[dict],
    duration: float,
    model: str,
    ollama_url: str,
) -> list[dict]:
    """
    Use the LLM to identify sponsored or promotional segments from the transcript.
    Returns list of {category, start_time, end_time, title} dicts.
    """
    if not segments or not ollama_url:
        return []

    # Build condensed transcript with timestamps
    lines = []
    for seg in segments:
        m = int(seg["start_time"] // 60)
        s = int(seg["start_time"] % 60)
        lines.append(f"[{m:02d}:{s:02d}] {seg['text']}")

    transcript_text = "\n".join(lines[:300])  # Limit context

    prompt = f"""You are analysing a video transcript to identify non-content segments such as sponsored promotions, self-promotions, intros, outros, and interaction reminders (subscribe/like).

Transcript:
{transcript_text}

Identify any sponsor, promotional, intro, or outro segments. Return ONLY valid JSON in this exact format:
{{"segments": [{{"category": "sponsor|selfpromo|intro|outro|interaction|filler", "start_time": 0.0, "end_time": 0.0, "title": "brief description"}}]}}

If no such segments are found, return {{"segments": []}}.
Only include segments you are confident about. Do not invent segments."""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={"model": model, "prompt": prompt, "format": "json", "stream": False, "options": {"temperature": 0.1}},
            )
            resp.raise_for_status()
            import json
            data = json.loads(resp.json().get("response", "{}"))
            segs = data.get("segments", [])

            result = []
            for seg in segs:
                start = float(seg.get("start_time", 0))
                end = float(seg.get("end_time", 0))
                if end > start and end <= duration + 5:
                    result.append({
                        "category": seg.get("category", "sponsor"),
                        "start_time": start,
                        "end_time": end,
                        "title": seg.get("title", _category_label(seg.get("category", "sponsor"))),
                        "votes": 0,
                    })

            logger.info("LLM sponsor detection: %d segments found", len(result))
            return result

    except Exception as e:
        logger.warning("LLM sponsor detection failed: %s", e)
        return []
