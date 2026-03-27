import hashlib
import logging
import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.enums import VideoStatus
from app.models.video import Video
from app.services.ffprobe import get_duration, get_format, has_audio_stream

logger = logging.getLogger(__name__)

# Match YouTube ID pattern in filenames like "Title [dQw4w9WgXcQ].mp4"
YOUTUBE_ID_RE = re.compile(r"\[([a-zA-Z0-9_-]{11})\]")

# Bytes to read for partial file hashing
HASH_HEAD_BYTES = 65536


def compute_file_hash(file_path: Path) -> str:
    """Compute a fast hash from first 64KB + file size for change detection."""
    h = hashlib.sha256()
    size = file_path.stat().st_size
    h.update(str(size).encode())
    with open(file_path, "rb") as f:
        h.update(f.read(HASH_HEAD_BYTES))
    return h.hexdigest()


def parse_title(filename: str) -> str:
    """Extract a display title from the filename."""
    name = Path(filename).stem
    # Remove YouTube ID bracket
    name = YOUTUBE_ID_RE.sub("", name).strip()
    # Remove trailing dashes/dots
    name = name.rstrip("-. ")
    return name or filename


def extract_youtube_id(filename: str) -> str | None:
    """Extract YouTube video ID from filename if present."""
    match = YOUTUBE_ID_RE.search(filename)
    return match.group(1) if match else None


def scan_downloads(db: Session) -> list[dict]:
    """
    Scan the downloads directory for new or changed media files.
    Returns list of dicts with video_id and is_new for each discovered/changed file.
    """
    # Read downloads_dir from DB settings (allows runtime configuration)
    from app.services.settings import get_setting_sync
    try:
        downloads_dir_str = get_setting_sync(db, "downloads_dir")
    except Exception:
        downloads_dir_str = str(settings.downloads_dir)

    downloads_dir = Path(downloads_dir_str)
    if not downloads_dir.exists():
        logger.info("Downloads directory not found: %s (configure in Settings)", downloads_dir)
        return []
    if not any(downloads_dir.iterdir()):
        logger.debug("Downloads directory is empty: %s", downloads_dir)
        return []

    results = []
    media_extensions = set(settings.media_extensions)

    # Get all existing videos indexed by file_path
    existing = {}
    for video in db.execute(select(Video)).scalars().all():
        existing[video.file_path] = video

    # Walk the downloads directory
    for file_path in sorted(downloads_dir.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in media_extensions:
            continue

        path_str = str(file_path)
        file_hash = compute_file_hash(file_path)
        stat = file_path.stat()

        if path_str in existing:
            video = existing[path_str]
            if video.file_hash == file_hash:
                continue  # Unchanged
            # File changed — update hash and re-process
            video.file_hash = file_hash
            video.file_size = stat.st_size
            video.status = VideoStatus.DISCOVERED
            db.add(video)
            results.append({"video_id": str(video.id), "is_new": False})
            logger.info("File changed: %s", file_path.name)
        else:
            # Check if it has audio before adding
            if not has_audio_stream(file_path):
                logger.debug("Skipping file without audio: %s", file_path.name)
                continue

            video = Video(
                file_path=path_str,
                filename=file_path.name,
                youtube_id=extract_youtube_id(file_path.name),
                channel_name=file_path.parent.name if file_path.parent != downloads_dir else None,
                file_hash=file_hash,
                file_size=stat.st_size,
                duration=get_duration(file_path),
                format=get_format(file_path),
                title=parse_title(file_path.name),
                status=VideoStatus.DISCOVERED,
            )
            db.add(video)
            db.flush()  # Get the ID
            results.append({"video_id": str(video.id), "is_new": True})
            logger.info("New file discovered: %s", file_path.name)

    db.commit()
    return results
