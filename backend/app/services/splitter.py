import logging
import re
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

_SAFE_EXTS = {".mp4", ".mkv", ".webm", ".mov"}


def _slugify(text: str, max_len: int = 40) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text[:max_len].strip("_") or "clip"


def split_story(
    video_path: str,
    video_id: str,
    story_index: int,
    title: str,
    start_time: float,
    end_time: float,
    segments_dir: Path,
) -> Path:
    """
    Losslessly split a story clip from a video using ffmpeg -c copy.
    Output: segments_dir/{video_id}/{index:03d}_{slug}.{ext}
    Returns the path relative to segments_dir (for DB storage).
    """
    src = Path(video_path)
    ext = src.suffix.lower() if src.suffix.lower() in _SAFE_EXTS else ".mp4"

    output_dir = segments_dir / video_id
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{story_index:03d}_{_slugify(title)}{ext}"
    output_path = output_dir / filename

    result = subprocess.run(
        [
            "ffmpeg",
            "-ss", str(start_time),
            "-to", str(end_time),
            "-i", video_path,
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-y",
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg split failed: {result.stderr[:500]}")

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError(f"Split produced empty file: {output_path.name}")

    logger.info("Split clip: %s (%.1fMB)", output_path.name, output_path.stat().st_size / 1e6)

    # Return relative path for DB storage
    return Path(video_id) / filename
