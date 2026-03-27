import logging
import subprocess
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


def extract_audio(video_path: str, video_id: str) -> Path:
    """
    Extract audio from a video file as 16kHz mono WAV for Whisper.
    Returns the path to the extracted WAV file.
    """
    output_dir = settings.audio_work_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{video_id}.wav"

    # Remove stale output if exists
    if output_path.exists():
        output_path.unlink()

    result = subprocess.run(
        [
            "ffmpeg",
            "-i", video_path,
            "-vn",                  # No video
            "-acodec", "pcm_s16le", # 16-bit PCM
            "-ar", "16000",         # 16kHz sample rate
            "-ac", "1",             # Mono
            "-y",                   # Overwrite
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=600,  # 10 minute timeout for very long videos
    )

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg audio extraction failed: {result.stderr[:500]}")

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError(f"Audio extraction produced empty file for {video_path}")

    logger.info("Extracted audio: %s (%.1f MB)", output_path.name, output_path.stat().st_size / 1e6)
    return output_path


def cleanup_audio(video_id: str) -> None:
    """Remove the temporary WAV file after transcription."""
    audio_path = settings.audio_work_dir / f"{video_id}.wav"
    if audio_path.exists():
        audio_path.unlink()
        logger.debug("Cleaned up audio: %s", audio_path.name)
