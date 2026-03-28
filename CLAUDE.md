# StoryEngine

## Project Overview

Audio and video story splitting and deduplication engine. Pure Python backend (FastAPI + Celery + Celery Beat), Next.js frontend, PostgreSQL, Redis, Ollama for LLM inference, faster-whisper for transcription.

Reads audio and video files from a configured media library directory (filesystem only, no API dependency). Supports `.mp3`, `.m4a`, `.opus`, `.flac`, `.wav`, `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`. Transcribes, detects story boundaries via LLM, and presents results in a web UI. UYTDownloader `/downloads` volume is one valid source but StoryEngine works with any media folder.

## Architecture

- **Backend:** FastAPI (async) + Celery workers + PostgreSQL + Redis
- **Frontend:** Next.js App Router + Tailwind CSS
- **Pipeline:** scan → extract_audio → transcribe → detect_stories (Celery chain)
- **Celery queues:** `scan` (filesystem), `pipeline` (ffmpeg), `gpu` (whisper), `llm` (Ollama)
- **Config:** pydantic-settings with `SE_` env prefix
- **Ports:** Backend :8100, Frontend :3100 (offset from UYT's 8000/3000)

## Code Conventions

- All models use UUID primary keys and TimestampMixin (created_at, updated_at)
- Async SQLAlchemy for API routes, sync for Celery workers
- Pydantic schemas in `schemas/` for all API responses
- Services in `services/` are stateless — they take parameters and return results
- Worker tasks in `worker/tasks.py` orchestrate services and update DB state

## Dependencies

- UYTDownloader `/downloads` volume (read-only mount)
- Ollama running at `SE_OLLAMA_URL` with models: `SE_LLM_MODEL`, `SE_EMBED_MODEL`
- ffmpeg and ffprobe available in PATH (installed in Docker images)
