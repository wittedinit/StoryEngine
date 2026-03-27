"""Generate JPEG thumbnails from video files using ffmpeg."""
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def generate_thumbnail(video_path: str, timestamp: float, output_path: Path) -> Path:
    """
    Extract a single frame from video_path at timestamp seconds and save as JPEG.
    Returns the output_path on success.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-ss", str(timestamp),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "2",       # JPEG quality (2 = high quality)
        "-y",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg thumbnail failed: {result.stderr[:500]}")

    if not output_path.exists():
        raise RuntimeError(f"Thumbnail file not created at {output_path}")

    logger.info("Thumbnail generated: %s", output_path)
    return output_path
