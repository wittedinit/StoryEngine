"""Build M3U8 and JSON playlists from story lists."""
from __future__ import annotations

import re
from typing import Any


def _slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", text)[:60]


def build_m3u8(stories: list[dict], base_url: str, title: str = "StoryEngine Playlist") -> str:
    """
    Build an M3U8 playlist. Each story must have id, title, duration, has_clip.
    Only stories with clips are included. base_url should be the public API root
    (e.g. 'http://localhost:8100').
    """
    lines = ["#EXTM3U", f"#PLAYLIST:{title}"]
    for s in stories:
        if not s.get("has_clip") and not s.get("clip_path"):
            continue
        dur = int(s.get("duration", 0))
        t = s.get("title", "Untitled")
        vid_title = s.get("video_title", "")
        label = f"{vid_title} — {t}" if vid_title else t
        lines.append(f"#EXTINF:{dur},{label}")
        lines.append(f"{base_url}/api/v1/export/stories/{s['id']}/clip")
    return "\n".join(lines) + "\n"


def build_playlist_json(stories: list[dict], title: str = "StoryEngine Playlist") -> dict[str, Any]:
    """
    Build a JSON playlist manifest.
    """
    return {
        "version": 1,
        "title": title,
        "story_count": len(stories),
        "stories": [
            {
                "id": s["id"],
                "title": s.get("title", ""),
                "summary": s.get("summary", ""),
                "video_title": s.get("video_title", ""),
                "start_time": s.get("start_time", 0),
                "end_time": s.get("end_time", 0),
                "duration": s.get("duration", 0),
                "has_clip": s.get("has_clip", False),
                "clip_endpoint": f"/api/v1/export/stories/{s['id']}/clip",
            }
            for s in stories
        ],
    }
