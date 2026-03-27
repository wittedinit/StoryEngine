import json
import subprocess
from pathlib import Path


def probe_file(file_path: Path) -> dict:
    """Run ffprobe and return parsed JSON metadata."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(file_path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {file_path}: {result.stderr}")
    return json.loads(result.stdout)


def get_duration(file_path: Path) -> float | None:
    """Get duration in seconds from a media file."""
    try:
        info = probe_file(file_path)
        duration_str = info.get("format", {}).get("duration")
        if duration_str:
            return float(duration_str)
    except Exception:
        pass
    return None


def get_format(file_path: Path) -> str | None:
    """Get the container format name."""
    try:
        info = probe_file(file_path)
        return info.get("format", {}).get("format_name")
    except Exception:
        return None


def has_audio_stream(file_path: Path) -> bool:
    """Check if the file has at least one audio stream."""
    try:
        info = probe_file(file_path)
        streams = info.get("streams", [])
        return any(s.get("codec_type") == "audio" for s in streams)
    except Exception:
        return False
