# StoryEngine

**Automatically transcribe and split audio & video libraries into their individual stories.**

Point StoryEngine at a folder of audio or video files — podcasts, YouTube downloads, lectures, interviews, recorded meetings, films — and it will:

1. **Transcribe** every file with Whisper (local, private, no API costs)
2. **Detect stories** — ask a local LLM to identify where topics change, producing a titled, summarised story for each segment
3. **Present results** in a web UI so you can browse your entire library by story rather than by file
4. **Split clips** — cut each story into its own file, losslessly, using ffmpeg
5. **Find duplicates** — identify when the same topic appears across many different files

---

## Supported file types

| Type | Formats |
|------|---------|
| Audio | `.mp3` `.m4a` `.opus` `.flac` `.wav` |
| Video | `.mp4` `.mkv` `.webm` `.avi` `.mov` |

Mix audio and video freely in the same library folder. Both are processed identically.

---

## What's included

| Feature | Description |
|---------|-------------|
| **Media browser** | Browse all processed files, filter by status, search by title |
| **Story detection** | LLM identifies topic boundaries, generates titles and summaries |
| **In-browser player** | Stream the original file with a click-to-seek story timeline |
| **Transcript search** | Full-text search across every transcript in your library |
| **Clip splitting** | Lossless ffmpeg `-c copy` cuts — no re-encoding, instant |
| **Story editing** | Correct LLM-generated titles, summaries, and timestamps |
| **Thumbnails** | JPEG frame extracted at each story's midpoint |
| **SRT subtitles** | Download subtitles for each clip |
| **NFO metadata** | Jellyfin/Kodi compatible `<episodedetails>` export |
| **Sponsor detection** | SponsorBlock (YouTube) + LLM-based detection for any file |
| **Deduplication** | Semantic embeddings + HNSW index to find repeated stories |
| **Channel reports** | Per-folder breakdowns with scoped dedup analysis |
| **Playlist export** | M3U8 (VLC, mpv) and JSON playlists |
| **Bulk ZIP download** | Download multiple clips as a ZIP archive |
| **YouTube upload** | OAuth2 clip upload with automatic playlist management |
| **Webhooks** | HTTP notifications with HMAC-SHA256 signing |
| **Batch reprocess** | Multi-select to re-run the pipeline on many files at once |

---

## Requirements

- **Docker** and Docker Compose (Docker Desktop, OrbStack, or any compatible runtime)
- **Ollama** running on your local network with at least one LLM model pulled
  - Story detection: `llama3.1:8b` or any capable model (`ollama pull llama3.1:8b`)
  - Embeddings (for dedup): `nomic-embed-text` (`ollama pull nomic-embed-text`)
- A folder of audio and/or video files

> **No GPU required.** CPU works fine. A GPU makes Whisper transcription significantly faster but is entirely optional.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/wittedinit/StoryEngine.git
cd StoryEngine
```

### 2. Mount your media folder

Edit `docker-compose.yml` and add a volume mount to both the `backend` and `worker` services:

```yaml
services:
  backend:
    volumes:
      - /your/host/media:/media:ro   # :ro = read-only, StoryEngine never writes here

  worker:
    volumes:
      - /your/host/media:/media:ro
```

> **Using UYTDownloader?** Mount its downloads volume directly:
> ```yaml
> volumes:
>   - uytdownloader_downloads:/media:ro
> ```

### 3. Start the stack

```bash
docker compose up -d
```

First boot downloads images and may take a minute. Six containers will start: PostgreSQL, Redis, Ollama, backend API, Celery worker, and the Next.js frontend.

### 4. Open the UI and complete setup

Visit **http://localhost:3100** — a setup wizard will ask for two settings:

1. **Ollama URL** — e.g. `http://192.168.1.60:11434` (or `http://ollama:11434` if using the bundled container). Click **Test Connection** to verify and pick a model.
2. **Media Library Path** — the path *inside the container* where your files are mounted, e.g. `/media`

Once both are saved, StoryEngine scans your library automatically every 5 minutes. Trigger an immediate scan from the Dashboard.

---

## GPU acceleration

### NVIDIA (Docker)

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

Passes all NVIDIA GPUs to both the worker (Whisper/CUDA) and Ollama containers.

### Apple Silicon (native worker)

Docker Desktop cannot expose Apple Metal to containers. Run the GPU worker natively:

```bash
cd backend
pip install ".[worker]"
SE_WHISPER_DEVICE=metal celery -A app.celery_app:celery worker -Q gpu --concurrency=1
```

### Compute device setting

In Settings → Transcription, set **Compute Device**:
- `auto` — detects CUDA → Metal → CPU automatically (default)
- `cuda` — force NVIDIA GPU
- `metal` — force Apple GPU
- `cpu` — force CPU

Changing this setting requires a worker restart.

---

## Ports

| Service | Default | Change via |
|---------|---------|-----------|
| Web UI | `http://localhost:3100` | `SE_FRONTEND_PORT` in `.env` |
| API | `http://localhost:8100` | `SE_PORT` in `.env` |
| API docs (OpenAPI) | `http://localhost:8100/docs` | — |

These are intentionally offset from UYTDownloader's 3000/8000 so both can run side by side.

To change ports: copy `.env.default` to `.env`, set the values, then restart.

---

## Channel detection

StoryEngine infers a **channel** name from the immediate parent folder of each file. This is how podcast feeds, YouTube channels, or series are grouped automatically:

| File path | Channel |
|-----------|---------|
| `/media/Lex Fridman/ep123.mp4` | `Lex Fridman` |
| `/media/My Podcast/S01E04.mp3` | `My Podcast` |
| `/media/lecture.mp4` | *(none — root level)* |

Channel statistics appear in the **Reports** section.

---

## Settings reference

All settings are live-editable in the **Settings** page (no restart required unless noted).

### LLM & Ollama

| Setting | Default | Description |
|---------|---------|-------------|
| Ollama Endpoint | *(empty)* | URL of your Ollama instance |
| LLM Model | `llama3.1:8b` | Model for story detection — click Test Connection to pick from your available models |
| Embed Model | `nomic-embed-text` | Model for semantic embeddings (dedup). Pull it first: `ollama pull nomic-embed-text` |

### Transcription

| Setting | Default | Description |
|---------|---------|-------------|
| Whisper Model | `base` | `tiny` / `base` / `small` / `medium` / `large-v3` / `distil-large-v3`. Larger = more accurate but slower. |
| Compute Device | `auto` | `auto` (CUDA → Metal → CPU), `cuda`, `metal`, `cpu` |
| Compute Precision | `auto` | `float16` (GPU), `int8` (CPU), `float32` (safe fallback) |

> Changing Whisper settings requires a worker restart to reload the model.

### Pipeline

| Setting | Default | Description |
|---------|---------|-------------|
| Scan Interval | `300` | Seconds between automatic library scans |
| Auto-Split Clips | `false` | Automatically split every story into a clip after detection |
| Auto-Embed Stories | `false` | Automatically generate embeddings after detection (enables automatic dedup) |
| Sponsor Detection | `disabled` | `sponsorblock` (YouTube files only), `llm` (any file), `both`, or `disabled` |
| Sponsor Action | `mark` | `mark` (tag only), `skip` (exclude from splits), `split_out` (save as separate files) |
| Dedup Threshold | `0.85` | Cosine similarity threshold for duplicate detection (0–1) |

### Paths

| Setting | Default | Description |
|---------|---------|-------------|
| Media Library Path | `/data/downloads` | Where StoryEngine reads your audio/video files from (read-only) |
| Output Directory | `/segments` | Where split clip files are saved (must be writable) |

### YouTube

| Setting | Default | Description |
|---------|---------|-------------|
| Google OAuth Client ID | *(empty)* | From Google Cloud Console |
| Google OAuth Client Secret | *(empty)* | From Google Cloud Console |
| Default Privacy | `private` | `public`, `unlisted`, or `private` |
| Playlist Mode | `per_video` | `per_video` (one playlist per source file), `per_channel`, or `none` |
| Auto-Upload After Split | `false` | Automatically upload newly split clips to YouTube |

---

## YouTube setup

1. In [Google Cloud Console](https://console.cloud.google.com): create a project, enable the YouTube Data API v3, create OAuth 2.0 credentials
2. Add `http://localhost:8100/api/v1/youtube/oauth/callback` as an authorised redirect URI
3. In **Settings → YouTube**: enter your Client ID and Client Secret
4. On the **YouTube** page: click **Connect YouTube** and complete the OAuth flow

> YouTube upload is purely **additive** — original files and local clips are **never deleted**. You control your local library and YouTube channel independently.

---

## Sponsor detection

**SponsorBlock** (YouTube files only)
- Reads the YouTube video ID from the filename (e.g. `My Video [dQw4w9WgXcQ].mp4`)
- Queries the public [SponsorBlock API](https://sponsor.ajay.app) for crowdsourced timestamps
- Categories: `sponsor`, `selfpromo`, `interaction`, `intro`, `outro`, `preview`, `filler`

**LLM detection** (any audio or video file)
- Sends the transcript to your LLM and asks it to identify promotional language
- Works for podcasts, radio recordings, and any file without a YouTube ID

**Sponsor actions:**
- `mark` — yellow bars on the timeline, tagged in lists, no files changed
- `skip` — excluded when auto-splitting (clips contain only story content)
- `split_out` — saved as separate clip files in `segments/sponsors/`

---

## Webhooks

Configure HTTP notifications on the **Webhooks** page. Supported events:

| Event | When |
|-------|------|
| `job_completed` | Pipeline completes successfully for a file |
| `job_failed` | A pipeline stage fails |
| `story_detected` | Story detection finishes (includes story count) |
| `thumbnail_generated` | Thumbnail generated for a story |
| `youtube_uploaded` | Clip uploaded to YouTube |

All webhook calls POST JSON. Set a **secret** per webhook to enable HMAC-SHA256 request signing (`X-StoryEngine-Signature: sha256=...`).

---

## API

Backend API at `http://localhost:8100/api/v1`. Full OpenAPI docs at `http://localhost:8100/docs`.

```
# Media files
GET    /api/v1/videos                           List all files (paginated, filterable)
GET    /api/v1/videos/{id}                      File detail + stream_url for in-browser player
GET    /api/v1/videos/{id}/transcript           Full transcript with timestamped segments

# Stories
GET    /api/v1/stories                          List all stories (paginated, searchable)
GET    /api/v1/stories/{id}                     Story detail with transcript excerpt
PATCH  /api/v1/stories/{id}                     Edit title, summary, or timestamps

# Pipeline
POST   /api/v1/pipeline/scan                    Trigger an immediate library scan
POST   /api/v1/pipeline/reprocess/{id}          Re-run full pipeline on one file
POST   /api/v1/pipeline/reprocess-batch         Re-run pipeline on multiple file IDs

# Clips & exports
POST   /api/v1/export/stories/{id}/split        Split one story into a clip
POST   /api/v1/export/videos/{id}/split         Split all stories in a file
GET    /api/v1/export/stories/{id}/clip         Download the clip file
POST   /api/v1/export/stories/{id}/thumbnail    Generate a thumbnail
GET    /api/v1/export/stories/{id}/thumbnail    Download the thumbnail JPEG
GET    /api/v1/export/stories/{id}/srt          Download SRT subtitle file
GET    /api/v1/export/stories/{id}/nfo          Download NFO metadata file
GET    /api/v1/export/videos/{id}/playlist      Export M3U8 or JSON playlist for a file
GET    /api/v1/export/stories/playlist?ids=…    Export playlist for selected story IDs
POST   /api/v1/export/zip                       Queue a bulk ZIP of clips
GET    /api/v1/export/zip/{task_id}/status      Poll ZIP build progress
GET    /api/v1/export/zip/{task_id}/download    Download completed ZIP

# Search
GET    /api/v1/search/transcripts?q=…          Full-text search across all transcripts

# Dedup
POST   /api/v1/dedup/embed                      Embed all un-embedded stories
GET    /api/v1/dedup/clusters                   Find duplicate story clusters
GET    /api/v1/dedup/similar/{id}               Stories similar to a given story

# Reports
GET    /api/v1/reports/channels                 Channel list with aggregate stats
GET    /api/v1/reports/channels/{name}/dedup    Per-channel dedup report
GET    /api/v1/reports/channels/{name}/videos   Files in a channel

# Webhooks
GET    /api/v1/webhooks                         List webhooks
POST   /api/v1/webhooks                         Create webhook
PUT    /api/v1/webhooks/{id}                    Update webhook
DELETE /api/v1/webhooks/{id}                    Delete webhook
POST   /api/v1/webhooks/{id}/test               Send a test call

# YouTube
GET    /api/v1/youtube/status                   Connection status
GET    /api/v1/youtube/auth-url                 Get Google OAuth URL
POST   /api/v1/youtube/revoke                   Disconnect YouTube
POST   /api/v1/youtube/upload/{story_id}        Queue a clip for upload
POST   /api/v1/youtube/upload-all               Queue all un-uploaded clips
GET    /api/v1/youtube/upload-status/{id}       Check upload status

# Settings & health
GET    /api/v1/settings                         All settings
PUT    /api/v1/settings/{key}                   Update a setting
GET    /api/v1/settings/ollama/models           List available Ollama models
GET    /health                                  Health check (DB, Redis, Ollama, ffmpeg)
```

---

## Architecture

```
StoryEngine/
├── backend/                     # Python FastAPI + Celery
│   ├── app/
│   │   ├── api/                 # REST endpoints
│   │   │   ├── videos.py        # Media file list/detail + stream_url
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
│   │   └── services/            # scanner, transcriber, story_detector, splitter,
│   │                            #   embedder, dedup, sponsorblock, playlist,
│   │                            #   thumbnail, srt, nfo, webhook_fire, youtube_upload
│   └── alembic/versions/        # Database migrations
├── frontend/                    # Next.js App Router + Tailwind
│   └── src/app/
│       ├── page.tsx             # Dashboard + setup wizard
│       ├── videos/              # Media list + detail (player, timeline, stories)
│       ├── stories/             # Story list + detail (edit, thumbnail, upload)
│       ├── search/              # Full-text transcript search
│       ├── dedup/               # Duplicate cluster browser
│       ├── reports/             # Channel reports + CSV export
│       ├── youtube/             # YouTube OAuth + bulk upload
│       ├── webhooks/            # Webhook CRUD UI
│       ├── jobs/                # Processing queue viewer
│       ├── manual/              # Full in-app user manual
│       └── settings/            # Runtime settings editor
└── docker/                      # Dockerfiles + entrypoints
```

### Tech stack

| Component | Technology |
|-----------|-----------|
| Transcription | faster-whisper (CTranslate2) + Silero VAD |
| Story detection | Ollama REST API — local LLM, JSON mode, no cloud |
| Embeddings | Ollama (`nomic-embed-text` or any embed model) |
| Dedup index | USearch HNSW |
| Media splitting | ffmpeg `-c copy` — lossless, keyframe-snapped |
| Thumbnails | ffmpeg `-frames:v 1 -q:v 2` at story midpoint |
| Sponsor detection | SponsorBlock API + optional LLM fallback |
| YouTube | Google YouTube Data API v3 + OAuth2 |
| Webhooks | httpx + HMAC-SHA256 signing |
| Full-text search | PostgreSQL tsvector / tsquery + GIN index |
| Backend | FastAPI + Pydantic + SQLAlchemy async |
| Task queue | Celery + Redis |
| Database | PostgreSQL 16 |
| Frontend | Next.js 15 App Router + Tailwind CSS |
| Deploy | Docker Compose |

### Celery worker queues

| Queue | Concurrency | What runs here |
|-------|-------------|----------------|
| `scan, pipeline` | 2 (configurable) | File scanning, audio extraction, clip splitting, thumbnails, ZIP, YouTube uploads |
| `gpu` | 1 | Whisper transcription — serialised to prevent VRAM contention |
| `llm` | 2 | Ollama story detection, sponsor detection, embeddings |

---

## Development

```bash
# Backend (requires postgres + redis running)
cd backend
pip install -e ".[server,worker]"
uvicorn app.main:app --reload --port 8100

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:3000

# Celery worker
celery -A app.celery_app:celery worker -Q scan,pipeline,gpu,llm --loglevel=info

# Run migrations
alembic upgrade head
```

---

## Changelog

- **v1.0** — Transcription + story detection + web UI
- **v1.1** — Lossless clip splitting + semantic dedup + sponsor detection
- **v1.2** — Playlist export (M3U8/JSON), bulk ZIP download, channel reports
- **v1.3** — In-browser player, transcript search, story editing, thumbnails, SRT/NFO export, webhooks, YouTube integration, batch reprocess
