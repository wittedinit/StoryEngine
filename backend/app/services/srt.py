"""Generate SRT subtitle files from transcript segments."""
from __future__ import annotations


def _fmt_timestamp(seconds: float) -> str:
    """Format seconds as SRT timestamp: HH:MM:SS,mmm"""
    total_ms = int(seconds * 1000)
    ms = total_ms % 1000
    total_s = total_ms // 1000
    s = total_s % 60
    total_m = total_s // 60
    m = total_m % 60
    h = total_m // 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(segments: list[dict], story_start: float, story_end: float) -> str:
    """
    Build an SRT subtitle string from transcript segments within [story_start, story_end].

    Timestamps are kept absolute (not rebased to 0) so they align with the split clip,
    which also uses absolute timestamps from ffmpeg -c copy.

    segments: list of dicts with start_time, end_time, text
    """
    relevant = [
        s for s in segments
        if s["start_time"] >= story_start - 0.1 and s["end_time"] <= story_end + 0.1
    ]

    if not relevant:
        return ""

    lines = []
    for i, seg in enumerate(relevant, start=1):
        lines.append(str(i))
        lines.append(f"{_fmt_timestamp(seg['start_time'])} --> {_fmt_timestamp(seg['end_time'])}")
        lines.append(seg["text"].strip())
        lines.append("")

    return "\n".join(lines)
