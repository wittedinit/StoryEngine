# StoryEngine

**Automatically transcribe, analyse, and split video libraries into their individual stories.**

StoryEngine watches a folder of video files, transcribes them with Whisper, uses a local LLM to detect story boundaries, and presents the results in a web UI. You can then split individual stories into lossless clip files, identify duplicate content across your library, and detect sponsored segments.

---

## What it does

| Stage | What happens |
|-------|-------------|
| **Scan** | Watches your video library folder every N minutes, detects new or changed files |
| **Transcribe** | Extracts audio and runs faster-whisper to produce timestamped word-level transcript |
| **Detect Stories** | Sends transcript to your local LLM (via Ollama) to identify story boundaries, titles, and summaries |
| **Detect Sponsors** | Optionally fetches sponsor timestamps from SponsorBlock (YouTube videos) or asks the LLM to detect them |
| **Split** | Optionally cuts each story into a lossless clip file using `ffmpeg -c copy` |
| **Embed** | Optionally generates semantic embeddings for each story (via Ollama) |
| **Dedup** | Finds stories with similar content across your entire library using USearch HNSW |

---

## Requirements

- **Docker** and Docker Compose (Docker Desktop, OrbStack, etc.)
- **Ollama** running somewhere on your network with at least one LLM loaded
  - Story detection: `llama3.1:8b` or any capable model
  - Embeddings: `nomic-embed-text` (optional, for dedup)
- A folder of video files (`.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, `.m4a`, etc.)

> No GPU is required. CPU works fine, though transcription is faster with one.

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/wittedinit/StoryEngine.git
cd StoryEngine

# 2. Start (no configuration required to boot)
docker compose up -d

# 3. Open the dashboard
open http://localhost:3100
```

The UI will guide you through the two required settings on first visit:
- **Ollama Endpoint** — URL of your Ollama instance (e.g. `http://192.168.1.60:11434`)
- **Video Library Path** — absolute path to your video folder *inside the container* (see Paths below)

Once both are set, StoryEngine will automatically scan and process your videos.

---

## GPU acceleration

### NVIDIA (Docker)

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

This passes all NVIDIA GPUs to both the worker (faster-whisper/CUDA) and Ollama containers.

### Apple Silicon (native only)

Docker Desktop on macOS cannot pass Metal through to containers. For GPU-accelerated transcription on Apple Silicon, run the worker natively:

```bash
cd backend
pip install ".[worker]"
SE_WHISPER_DEVICE=metal celery -A app.celery_app:celery worker -Q gpu --concurrency=1
```

The `whisper_device` setting in the dashboard supports `auto` (detects CUDA → Metal → CPU), `cuda`, `metal`, and `cpu`.

---

## Mapping your video library

The video library path must be accessible **inside the container**. Add a volume mount to `docker-compose.yml`:

```yaml
services:
  backend:
    volumes:
      - /your/host/videos:/videos:ro  # read-only is fine

  worker:
    volumes:
      - /your/host/videos:/videos:ro
```

Then set **Video Library Path** to `/videos` in Settings → Paths.

If you use [UYTDownloader](https://github.com/wittedinit/UYTDownloader), mount its downloads volume:

```yaml
volumes:
  - uytdownloader_downloads:/videos:ro
```

---

## Ports

| Service | Default port | Change via |
|---------|-------------|-----------|
| Web UI | `3100` | `SE_FRONTEND_PORT` in `.env` |
| API | `8100` | `SE_PORT` in `.env` |

These are intentionally offset from UYTDownloader's 3000/8000 so both can run side by side.

To change ports, copy `.env.default` to `.env` and set the values before `docker compose up`.

---

## Settings reference

All settings are configurable from the dashboard at **Settings** (no restart required unless noted).

### LLM & Ollama

| Setting | Default | Description |
|---------|---------|-------------|
| Ollama Endpoint | *(empty)* | URL of your Ollama instance |
| LLM Model | `llama3.1:8b` | Model for story detection — click "Test Connection" to pick from your available models |
| Embed Model | `nomic-embed-text` | Model for semantic embeddings (dedup feature) |

### Transcription

| Setting | Default | Description |
|---------|---------|-------------|
| Whisper Model | `base` | `tiny` / `base` / `small` / `medium` / `large-v3` / `distil-large-v3` |
| Compute Device | `auto` | `auto` (CUDA → Metal → CPU), `cuda`, `metal`, `cpu` |
| Compute Precision | `auto` | `float16` (GPU), `int8` (CPU), `float32` (safe fallback) |

Changing Whisper settings requires a worker restart to reload the model.

### Pipeline

| Setting | Default | Description |
|---------|---------|-------------|
| Scan Interval | `300` | Seconds between automatic library scans |
| Auto-Split Clips | `false` | Create clip files for every story automatically after detection |
| Auto-Embed Stories | `false` | Generate embeddings after detection (needed for dedup) |
| Sponsor Detection | `disabled` | `sponsorblock` (YouTube only), `llm`, `both`, or `disabled` |
| Sponsor Action | `mark` | `mark` (tag only), `skip` (exclude from clips), `split_out` (separate clip files) |
| Dedup Threshold | `0.85` | Cosine similarity threshold for the Dedup page (0–1) |

### Paths

| Setting | Default | Description |
|---------|---------|-------------|
| Video Library Path | `/data/downloads` | Where StoryEngine reads videos from (read-only) |
| Output Directory | `/segments` | Where split clip files are saved |

---

## Sponsor block detection

StoryEngine can identify sponsored, self-promotional, intro, outro, and filler segments in two ways:

**SponsorBlock** (YouTube videos only)
- Queries the public [SponsorBlock API](https://sponsor.ajay.app) using the YouTube video ID parsed from the filename (e.g. `My Video [dQw4w9WgXcQ].mp4`)
- Categories: sponsor, selfpromo, interaction, intro, outro, preview, filler

**LLM detection** (any video)
- Sends the transcript to your LLM and asks it to identify promotional language
- Works for non-YouTube content but is less precise than crowdsourced data

**Actions:**
- `mark` — sponsor segments appear as yellow bars on the video timeline and are tagged in the stories list
- `skip` — excluded when auto-splitting (story clips only, no ads)
- `split_out` — saved as separate clip files in `segments/sponsors/`

---

## API

The backend exposes a REST API at `http://localhost:8100/api/v1`. Key endpoints:

```
GET  /api/v1/videos                  List all videos (paginated, filterable)
GET  /api/v1/videos/{id}             Video detail with metadata
GET  /api/v1/videos/{id}/transcript  Full transcript with segments

GET  /api/v1/stories                 List all stories (paginated, searchable)
GET  /api/v1/stories/{id}            Story detail

POST /api/v1/pipeline/scan           Trigger immediate library scan
POST /api/v1/pipeline/reprocess/{id} Re-run full pipeline on a video

POST /api/v1/export/stories/{id}/split   Split a single story into a clip
POST /api/v1/export/videos/{id}/split    Split all stories in a video
GET  /api/v1/export/stories/{id}/clip    Download the clip file

POST /api/v1/dedup/embed             Embed all unembedded stories
GET  /api/v1/dedup/clusters          Find duplicate story clusters
GET  /api/v1/dedup/similar/{id}      Stories similar to a given story

GET  /api/v1/settings                All settings
PUT  /api/v1/settings/{key}          Update a setting
GET  /api/v1/settings/ollama/models  List available Ollama models

GET  /health                         Service health (DB, Redis, Ollama, ffmpeg)
```

---

## Architecture

```
StoryEngine/
├── backend/                     # Python FastAPI + Celery
│   ├── app/
│   │   ├── api/                 # REST endpoints
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic response schemas
│   │   ├── services/            # scanner, transcriber, story_detector,
│   │   │                        #   splitter, embedder, dedup, sponsorblock
│   │   └── worker/tasks.py      # Celery pipeline tasks
│   └── alembic/versions/        # Database migrations
├── frontend/                    # Next.js App Router + Tailwind
│   └── src/app/
│       ├── page.tsx             # Dashboard + setup wizard
│       ├── videos/              # Video list + detail
│       ├── stories/             # Story list + detail
│       ├── dedup/               # Duplicate cluster browser
│       ├── jobs/                # Processing queue
│       └── settings/            # Runtime settings editor
└── docker/                      # Dockerfiles + entrypoints
```

**Tech stack:**

| Component | Technology |
|-----------|-----------|
| Transcription | faster-whisper (CTranslate2) + Silero VAD |
| Story detection | Ollama REST API (local LLM, JSON mode) |
| Embeddings | Ollama (nomic-embed-text or any embed model) |
| Dedup index | USearch HNSW |
| Video splitting | ffmpeg `-c copy` (lossless, keyframe-snapped) |
| Sponsor detection | SponsorBlock API + optional LLM fallback |
| Backend | FastAPI + Pydantic + SQLAlchemy (async) |
| Task queue | Celery + Redis |
| Database | PostgreSQL 16 |
| Frontend | Next.js 15 App Router + Tailwind CSS |
| Deploy | Docker Compose |

---

## Celery queues

Workers are split by resource profile:

| Queue | Concurrency | What runs there |
|-------|-------------|-----------------|
| `scan,pipeline` | 2 (configurable) | File scanning, ffmpeg audio extraction, clip splitting |
| `gpu` | 1 | Whisper transcription (serialised to avoid VRAM contention) |
| `llm` | 2 | Ollama story detection, LLM sponsor detection, embeddings |

---

## Development

```bash
# Run backend locally (requires postgres + redis)
cd backend
pip install -e ".[server,worker]"
uvicorn app.main:app --reload --port 8100

# Run frontend locally
cd frontend
npm install
npm run dev   # http://localhost:3000

# Run a worker locally
celery -A app.celery_app:celery worker -Q scan,pipeline,gpu,llm --loglevel=info

# Run migrations
alembic upgrade head
```

---

## Roadmap

- [x] Phase 1 — Transcription + story detection + web UI
- [x] Phase 2 — Lossless clip splitting + semantic dedup + sponsor detection
- [ ] Phase 3 — Playlist export, bulk download, channel-level dedup reports
