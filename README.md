# StoryEngine

**Automatically transcribe, analyse, and split video libraries into their individual stories.**

StoryEngine watches a folder of video files, transcribes them with Whisper, uses a local LLM to detect story boundaries, and presents the results in a web UI. You can then split individual stories into lossless clip files, search transcripts, upload clips to YouTube, identify duplicate content across your library, and detect sponsored segments.

---

## What it does

| Stage | What happens |
|-------|-------------|
| **Scan** | Watches your video library every N minutes, detects new or changed files |
| **Transcribe** | Extracts audio and runs faster-whisper to produce a timestamped transcript |
| **Detect Stories** | Sends the transcript to your local LLM (via Ollama) to identify story boundaries, titles, and summaries |
| **Detect Sponsors** | Optionally fetches sponsor timestamps from SponsorBlock (YouTube videos) or asks the LLM |
| **Split** | Optionally cuts each story into a lossless clip file using `ffmpeg -c copy` |
| **Embed** | Optionally generates semantic embeddings for each story (via Ollama) |
| **Dedup** | Finds stories with similar content across your entire library using USearch HNSW |

---

## Features

### Core pipeline
- Lossless clip splitting (`ffmpeg -c copy`) — fast, no re-encoding
- SponsorBlock integration + LLM-based sponsor detection
- Semantic deduplication across hundreds of videos
- Batch reprocessing (multi-select on the Videos page)

### Story management
- **In-browser video player** with story-boundary timeline and click-to-seek
- **Edit stories** — correct title, summary, and timestamps inline
- **Transcript full-text search** across your entire library
- **Thumbnail generation** — JPEG frame extracted at story midpoint
- **SRT subtitles** — download a subtitle file for each clip
- **NFO metadata** — Jellyfin/Kodi compatible `<episodedetails>` XML

### Export & playlists
- **M3U8 playlists** — stream clips in VLC, mpv, or any IPTV player
- **JSON playlists** — machine-readable manifests with full metadata
- **Bulk ZIP download** — select stories and download all clips as a ZIP
- **Per-video and per-channel dedup reports** — exportable as CSV

### YouTube integration
- OAuth2 connection to your YouTube channel
- Upload clips individually or in bulk
- Automatic playlist creation (`per_video`, `per_channel`, or `none`)
- Auto-upload after split
- Local files are **never deleted** — upload is purely additive

### Webhooks
- HTTP POST notifications on pipeline events (`job_completed`, `job_failed`, `story_detected`, `thumbnail_generated`, `youtube_uploaded`)
- Optional HMAC-SHA256 request signing
- Test button to verify endpoints without waiting for a real event

### Channel reports
- Per-channel video/story/clip counts
- Scoped dedup analysis within a single channel's content

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
- **Video Library Path** — absolute path to your video folder *inside the container* (see Mapping below)

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

All settings are configurable from **Settings** in the dashboard (no restart required unless noted).

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

> Changing Whisper settings requires a worker restart to reload the model.

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

### YouTube

| Setting | Default | Description |
|---------|---------|-------------|
| Google OAuth Client ID | *(empty)* | From Google Cloud Console |
| Google OAuth Client Secret | *(empty)* | From Google Cloud Console |
| Default Privacy | `private` | `public`, `unlisted`, or `private` |
| Playlist Mode | `per_video` | `per_video`, `per_channel`, or `none` |
| Auto-Upload After Split | `false` | Automatically upload newly split clips to YouTube |

---

## YouTube setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com), enable the **YouTube Data API v3**, and create OAuth 2.0 credentials
2. Add `http://localhost:8100/api/v1/youtube/oauth/callback` as an authorised redirect URI
3. Go to **Settings → YouTube** and enter your Client ID and Client Secret
4. Go to **YouTube** in the sidebar and click **Connect YouTube** to complete the OAuth flow

> Uploads are purely **additive** — your original video files and local clip files are never deleted or modified.

---

## Webhooks

Configure HTTP callbacks on the **Webhooks** page. Supported events:

| Event | When it fires |
|-------|--------------|
| `job_completed` | Full pipeline completes for a video |
| `job_failed` | A pipeline stage fails |
| `story_detected` | Story detection finishes (includes story count) |
| `thumbnail_generated` | Thumbnail generated for a story |
| `youtube_uploaded` | Clip successfully uploaded to YouTube |

Optionally configure a secret for HMAC-SHA256 request signing (`X-StoryEngine-Signature: sha256=...`).

---

## Sponsor detection

**SponsorBlock** (YouTube videos only)
- Queries the public [SponsorBlock API](https://sponsor.ajay.app) using the YouTube video ID parsed from the filename (e.g. `My Video [dQw4w9WgXcQ].mp4`)
- Categories: `sponsor`, `selfpromo`, `interaction`, `intro`, `outro`, `preview`, `filler`

**LLM detection** (any video)
- Sends the transcript to your LLM and asks it to identify promotional language
- Works for non-YouTube content but is less precise than crowdsourced data

**Actions:**
- `mark` — yellow bars on the timeline, tagged in story lists
- `skip` — excluded when auto-splitting (clips contain only content)
- `split_out` — saved as separate clip files in `segments/sponsors/`

---

## API

The backend exposes a REST API at `http://localhost:8100/api/v1`.
Full OpenAPI docs are at `http://localhost:8100/docs`.

```
GET    /api/v1/videos                           List videos (paginated, filterable)
GET    /api/v1/videos/{id}                      Video detail + stream_url for in-browser player
GET    /api/v1/videos/{id}/transcript           Full transcript with segments

GET    /api/v1/stories                          List stories (paginated, searchable)
GET    /api/v1/stories/{id}                     Story detail
PATCH  /api/v1/stories/{id}                     Edit story title/summary/timestamps

POST   /api/v1/pipeline/scan                    Trigger immediate library scan
POST   /api/v1/pipeline/reprocess/{id}          Re-run full pipeline on a video
POST   /api/v1/pipeline/reprocess-batch         Re-run pipeline for multiple video IDs

POST   /api/v1/export/stories/{id}/split        Split a single story into a clip
POST   /api/v1/export/videos/{id}/split         Split all stories in a video
GET    /api/v1/export/stories/{id}/clip         Download the clip file
POST   /api/v1/export/stories/{id}/thumbnail    Generate a thumbnail (queued)
GET    /api/v1/export/stories/{id}/thumbnail    Download the thumbnail JPEG
GET    /api/v1/export/stories/{id}/srt          Download SRT subtitle file
GET    /api/v1/export/stories/{id}/nfo          Download NFO metadata file
GET    /api/v1/export/videos/{id}/playlist      Export M3U8 or JSON playlist for a video
GET    /api/v1/export/stories/playlist?ids=…    Export playlist for selected story IDs
POST   /api/v1/export/zip                       Queue a bulk ZIP of clips
GET    /api/v1/export/zip/{task_id}/status      Poll ZIP build progress
GET    /api/v1/export/zip/{task_id}/download    Download completed ZIP

GET    /api/v1/search/transcripts?q=…          Full-text search across all transcripts

POST   /api/v1/dedup/embed                      Embed all un-embedded stories
GET    /api/v1/dedup/clusters                   Find duplicate story clusters
GET    /api/v1/dedup/similar/{id}               Stories similar to a given story

GET    /api/v1/reports/channels                 Channel list with aggregate stats
GET    /api/v1/reports/channels/{name}/dedup    Per-channel dedup report
GET    /api/v1/reports/channels/{name}/videos   Videos in a channel

GET    /api/v1/webhooks                         List webhooks
POST   /api/v1/webhooks                         Create webhook
PUT    /api/v1/webhooks/{id}                    Update webhook
DELETE /api/v1/webhooks/{id}                    Delete webhook
POST   /api/v1/webhooks/{id}/test               Send a test call

GET    /api/v1/youtube/status                   YouTube connection status
GET    /api/v1/youtube/auth-url                 Get Google OAuth URL
POST   /api/v1/youtube/revoke                   Disconnect YouTube
POST   /api/v1/youtube/upload/{story_id}        Queue a story clip for upload
POST   /api/v1/youtube/upload-all               Queue all un-uploaded clips
GET    /api/v1/youtube/upload-status/{id}       Check upload status

GET    /api/v1/settings                         All settings
PUT    /api/v1/settings/{key}                   Update a setting
GET    /api/v1/settings/ollama/models           List available Ollama models

GET    /health                                  Service health (DB, Redis, Ollama, ffmpeg)
```

---

## Architecture

```
StoryEngine/
├── backend/                     # Python FastAPI + Celery
│   ├── app/
│   │   ├── api/                 # REST endpoints
│   │   │   ├── videos.py        # Video list/detail + stream_url
│   │   │   ├── stories.py       # Story list/detail/patch
│   │   │   ├── export.py        # Clips, thumbnails, SRT, NFO, playlists, ZIP
│   │   │   ├── search.py        # Full-text transcript search
│   │   │   ├── pipeline.py      # Scan, reprocess, reprocess-batch
│   │   │   ├── reports.py       # Channel reports + dedup
│   │   │   ├── webhooks.py      # Webhook CRUD + test
│   │   │   ├── youtube.py       # OAuth + upload
│   │   │   ├── dedup.py         # Embedding + clusters
│   │   │   └── jobs.py          # Processing queue
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic response schemas
│   │   ├── services/            # scanner, transcriber, story_detector,
│   │   │                        #   splitter, embedder, dedup, sponsorblock,
│   │   │                        #   playlist, thumbnail, srt, nfo,
│   │   │                        #   webhook_fire, youtube_upload
│   │   └── worker/tasks.py      # Celery pipeline tasks
│   └── alembic/versions/        # Database migrations
├── frontend/                    # Next.js App Router + Tailwind
│   └── src/app/
│       ├── page.tsx             # Dashboard + setup wizard
│       ├── videos/              # Video list + detail (player, timeline, stories)
│       ├── stories/             # Story list + detail (edit, thumbnail, upload)
│       ├── search/              # Full-text transcript search
│       ├── dedup/               # Duplicate cluster browser
│       ├── reports/             # Channel reports + CSV export
│       ├── youtube/             # YouTube OAuth + bulk upload
│       ├── webhooks/            # Webhook CRUD UI
│       ├── jobs/                # Processing queue
│       ├── manual/              # Full in-app user manual
│       └── settings/            # Runtime settings editor
└── docker/                      # Dockerfiles + entrypoints
```

**Tech stack:**

| Component | Technology |
|-----------|-----------|
| Transcription | faster-whisper (CTranslate2) + Silero VAD |
| Story detection | Ollama REST API (local LLM, JSON mode) |
| Embeddings | Ollama (`nomic-embed-text` or any embed model) |
| Dedup index | USearch HNSW |
| Video splitting | ffmpeg `-c copy` (lossless, keyframe-snapped) |
| Thumbnail | ffmpeg `-frames:v 1 -q:v 2` at story midpoint |
| Sponsor detection | SponsorBlock API + optional LLM fallback |
| YouTube upload | Google YouTube Data API v3 + OAuth2 |
| Webhooks | httpx + HMAC-SHA256 signing |
| Full-text search | PostgreSQL tsvector / tsquery + GIN index |
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
| `scan,pipeline` | 2 (configurable) | File scanning, ffmpeg audio extraction, clip splitting, thumbnail generation, ZIP assembly, YouTube upload |
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
- [x] Phase 3 — Playlist export (M3U8/JSON), bulk ZIP download, channel reports
- [x] Phase 4 — In-browser player, transcript search, story editing, thumbnails, SRT/NFO, webhooks, YouTube integration, batch reprocess
