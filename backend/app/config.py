from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://storyengine:storyengine@postgres:5432/storyengine"
    database_url_sync: str = "postgresql+psycopg2://storyengine:storyengine@postgres:5432/storyengine"
    redis_url: str = "redis://redis:6379/2"
    ollama_url: str = ""  # Empty = not configured yet; set via dashboard

    downloads_dir: Path = Path("/data/downloads")  # Default; set via dashboard
    work_dir: Path = Path("/work")
    segments_dir: Path = Path("/segments")
    data_dir: Path = Path("/data")

    whisper_model: str = "base"
    whisper_device: str = "auto"
    whisper_compute_type: str = "auto"

    llm_model: str = "llama3.1:8b"
    embed_model: str = "nomic-embed-text"
    dedup_threshold: float = 0.85

    worker_concurrency: int = 2
    scan_interval: int = 300

    media_extensions: list[str] = [
        ".mp4", ".mkv", ".webm", ".avi", ".mov",
        ".m4a", ".mp3", ".opus", ".flac", ".wav",
    ]

    model_config = {"env_prefix": "SE_", "env_file": ".env", "extra": "ignore"}

    @property
    def audio_work_dir(self) -> Path:
        return self.work_dir / "audio"

    @property
    def usearch_index_path(self) -> Path:
        return self.data_dir / "usearch" / "stories.usearch"


settings = Settings()
