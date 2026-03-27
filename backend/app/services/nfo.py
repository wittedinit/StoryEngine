"""Generate Jellyfin/Kodi compatible NFO XML files for story clips."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime


def build_nfo(story: dict, video: dict) -> str:
    """
    Build a Kodi/Jellyfin episodedetails NFO XML string.

    story: dict with title, summary, duration, start_time, end_time, created_at, story_index
    video: dict with title, channel_name, filename
    """
    root = ET.Element("episodedetails")

    def _sub(tag: str, text: str) -> None:
        el = ET.SubElement(root, tag)
        el.text = str(text) if text else ""

    _sub("title", story.get("title", ""))
    _sub("showtitle", video.get("title", ""))
    _sub("plot", story.get("summary", ""))

    duration_min = int(story.get("duration", 0) / 60)
    _sub("runtime", str(duration_min))

    episode = story.get("story_index", 0) + 1
    _sub("episode", str(episode))
    _sub("season", "1")

    if story.get("created_at"):
        try:
            dt = story["created_at"]
            if isinstance(dt, str):
                dt = datetime.fromisoformat(dt)
            _sub("aired", dt.strftime("%Y-%m-%d"))
        except Exception:
            pass

    if video.get("channel_name"):
        _sub("studio", video["channel_name"])

    _sub("tag", "StoryEngine")

    # UniqueID for media server matching
    uid = ET.SubElement(root, "uniqueid", type="storyengine", default="true")
    uid.text = str(story.get("id", ""))

    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")
