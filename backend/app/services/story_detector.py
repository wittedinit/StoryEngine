import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

STORY_DETECTION_PROMPT = """You are a video content analyzer. Given the transcript of a video, identify distinct story segments or topics.

A "story" is a self-contained topic, news item, interview segment, tutorial section, or discussion point. Each story should have a clear beginning and end in the transcript.

TRANSCRIPT (with timestamps in [MM:SS] format):
---
{transcript}
---

Analyze this transcript and identify all distinct stories/segments. For each story, provide:
1. A concise, descriptive title (5-10 words)
2. A 1-2 sentence summary
3. The start timestamp (seconds from beginning)
4. The end timestamp (seconds from beginning)
5. Your confidence level (0.0-1.0)

Rules:
- Stories must not overlap
- Stories must cover the entire transcript (no gaps larger than 5 seconds)
- Adjacent small talk or transitions should be merged into the nearest story
- If the video is a single continuous topic, return exactly one story
- Minimum story duration: 30 seconds

Return ONLY valid JSON in this exact format, no other text:
{{"stories": [{{"title": "string", "summary": "string", "start_time": float, "end_time": float, "confidence": float}}]}}"""


def format_transcript_with_timestamps(segments: list[dict], interval: float = 30.0) -> str:
    """Format transcript segments with periodic timestamp markers."""
    if not segments:
        return ""

    lines = []
    next_marker = 0.0

    for seg in segments:
        while seg["start_time"] >= next_marker:
            minutes = int(next_marker // 60)
            seconds = int(next_marker % 60)
            lines.append(f"\n[{minutes:02d}:{seconds:02d}]")
            next_marker += interval

        lines.append(seg["text"])

    return " ".join(lines).strip()


def _chunk_transcript(formatted: str, max_tokens: int = 6000, overlap_tokens: int = 1000) -> list[str]:
    """Split a long transcript into overlapping chunks for the LLM."""
    # Rough estimate: 4 chars per token
    max_chars = max_tokens * 4
    overlap_chars = overlap_tokens * 4

    if len(formatted) <= max_chars:
        return [formatted]

    chunks = []
    start = 0
    while start < len(formatted):
        end = start + max_chars
        chunk = formatted[start:end]
        chunks.append(chunk)
        start = end - overlap_chars

    return chunks


def _validate_stories(stories: list[dict], total_duration: float) -> list[dict]:
    """Validate and fix story boundaries."""
    if not stories:
        return [{
            "title": "Full Video",
            "summary": "Single continuous segment",
            "start_time": 0.0,
            "end_time": total_duration,
            "confidence": 0.5,
        }]

    # Sort by start_time
    stories.sort(key=lambda s: s["start_time"])

    validated = []
    for s in stories:
        story = {
            "title": str(s.get("title", "Untitled"))[:1024],
            "summary": str(s.get("summary", ""))[:4096],
            "start_time": max(0.0, float(s.get("start_time", 0))),
            "end_time": min(total_duration, float(s.get("end_time", total_duration))),
            "confidence": max(0.0, min(1.0, float(s.get("confidence", 0.5)))),
        }
        # Ensure end > start
        if story["end_time"] <= story["start_time"]:
            story["end_time"] = story["start_time"] + 30.0
        validated.append(story)

    # Fix overlaps: if story N overlaps with N+1, set boundary to midpoint
    for i in range(len(validated) - 1):
        if validated[i]["end_time"] > validated[i + 1]["start_time"]:
            midpoint = (validated[i]["end_time"] + validated[i + 1]["start_time"]) / 2
            validated[i]["end_time"] = midpoint
            validated[i + 1]["start_time"] = midpoint

    # Fill gaps > 5 seconds by extending previous story
    for i in range(len(validated) - 1):
        gap = validated[i + 1]["start_time"] - validated[i]["end_time"]
        if gap > 5.0:
            validated[i]["end_time"] = validated[i + 1]["start_time"]

    return validated


async def detect_stories(
    segments: list[dict],
    total_duration: float,
    model: str | None = None,
    ollama_url: str | None = None,
) -> list[dict]:
    """
    Send transcript to Ollama for story boundary detection.
    Returns list of validated story dicts.
    """
    model = model or settings.llm_model
    base_url = ollama_url or settings.ollama_url
    formatted = format_transcript_with_timestamps(segments)

    if not formatted.strip():
        return [{
            "title": "Full Video",
            "summary": "No transcript available",
            "start_time": 0.0,
            "end_time": total_duration,
            "confidence": 0.0,
        }]

    chunks = _chunk_transcript(formatted)
    all_stories = []

    async with httpx.AsyncClient(timeout=180.0) as client:
        for chunk in chunks:
            prompt = STORY_DETECTION_PROMPT.format(transcript=chunk)

            for attempt in range(3):
                try:
                    response = await client.post(
                        f"{base_url}/api/generate",
                        json={
                            "model": model,
                            "prompt": prompt,
                            "stream": False,
                            "format": "json",
                            "options": {
                                "temperature": 0.1,
                                "num_predict": 4096,
                            },
                        },
                    )
                    response.raise_for_status()
                    result = response.json()
                    parsed = json.loads(result["response"])
                    stories = parsed.get("stories", [])
                    all_stories.extend(stories)
                    break
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("LLM response parse error (attempt %d): %s", attempt + 1, e)
                    if attempt == 2:
                        logger.error("Failed to parse LLM response after 3 attempts")
                except httpx.HTTPError as e:
                    logger.warning("Ollama request failed (attempt %d): %s", attempt + 1, e)
                    if attempt == 2:
                        raise

    # If multiple chunks produced overlapping stories, merge them
    if len(chunks) > 1 and len(all_stories) > 1:
        all_stories.sort(key=lambda s: s.get("start_time", 0))
        merged = [all_stories[0]]
        for story in all_stories[1:]:
            prev = merged[-1]
            # If this story overlaps with previous (from chunk overlap), merge
            if story.get("start_time", 0) < prev.get("end_time", 0):
                # Keep the one with more context (longer summary)
                if len(str(story.get("summary", ""))) > len(str(prev.get("summary", ""))):
                    merged[-1] = story
            else:
                merged.append(story)
        all_stories = merged

    return _validate_stories(all_stories, total_duration)
