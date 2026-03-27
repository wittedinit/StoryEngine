"use client";

import Link from "next/link";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h3 className="text-xl font-bold text-white mb-4 pb-2 border-b border-gray-800">{title}</h3>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h4 className="text-base font-semibold text-gray-200 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 pr-6 text-gray-400 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-900">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 pr-6 align-top ${j === 0 ? "font-mono text-blue-300 whitespace-nowrap" : "text-gray-400"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 px-4 py-3 bg-blue-900/20 border border-blue-800/40 rounded-lg text-sm text-blue-300">
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 px-4 py-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg text-sm text-yellow-300">
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 bg-gray-800 rounded font-mono text-xs text-gray-300">{children}</code>;
}

const toc = [
  { id: "what-is-storyengine", label: "What is StoryEngine?" },
  { id: "quickstart", label: "Installation & Quick Start" },
  { id: "first-run", label: "First Run Setup" },
  { id: "pipeline", label: "How the Pipeline Works" },
  { id: "media", label: "Media Library (Audio & Video)" },
  { id: "stories", label: "Stories" },
  { id: "player", label: "In-Browser Player" },
  { id: "splitting", label: "Splitting Clips" },
  { id: "exports", label: "Thumbnails, SRT & NFO" },
  { id: "search", label: "Transcript Search" },
  { id: "editing", label: "Editing Stories" },
  { id: "sponsors", label: "Sponsor Detection" },
  { id: "dedup", label: "Deduplication" },
  { id: "reports", label: "Channel Reports" },
  { id: "export", label: "Export & Download" },
  { id: "youtube", label: "YouTube Integration" },
  { id: "webhooks", label: "Webhooks" },
  { id: "batch", label: "Batch Operations" },
  { id: "settings", label: "Settings Reference" },
  { id: "gpu", label: "GPU Acceleration" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function ManualPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">StoryEngine Manual</h2>
        <p className="text-sm text-gray-500 mt-1">Complete guide — installation, setup, and all features</p>
      </div>

      <div className="flex gap-8">
        {/* Table of contents */}
        <nav className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contents</p>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors block py-0.5"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* What is StoryEngine */}
          <Section id="what-is-storyengine" title="What is StoryEngine?">
            <p className="text-gray-400 mb-4">
              StoryEngine automatically turns your audio and video library into a searchable, navigable collection of stories.
            </p>
            <p className="text-gray-400 mb-4">
              Point it at a folder — podcasts, recorded lectures, YouTube downloads, interviews, meetings, films, anything — and it will:
            </p>
            <ol className="list-decimal list-inside text-gray-400 text-sm space-y-2 mb-4">
              <li><strong className="text-gray-200">Transcribe</strong> every file automatically using Whisper (local, private, no API cost)</li>
              <li><strong className="text-gray-200">Detect stories</strong> — ask a local LLM to read the transcript and identify where topics change, producing a titled, summarised story for each segment</li>
              <li><strong className="text-gray-200">Present the results</strong> in this web UI so you can browse, search, and navigate your entire library by topic rather than by file</li>
              <li><strong className="text-gray-200">Split clips</strong> — cut each story into its own file with no quality loss</li>
              <li><strong className="text-gray-200">Find duplicates</strong> — identify when the same topic appears across many different files</li>
            </ol>
            <Note>
              StoryEngine works equally well with audio files (podcasts, music, recordings) and video files (YouTube downloads, films, recorded meetings). Mix both freely in the same folder.
            </Note>
            <Table
              headers={["Supported formats", ""]}
              rows={[
                ["Audio", ".mp3, .m4a, .opus, .flac, .wav"],
                ["Video", ".mp4, .mkv, .webm, .avi, .mov"],
              ]}
            />
          </Section>

          {/* Installation & Quick Start */}
          <Section id="quickstart" title="Installation & Quick Start">
            <SubSection title="Requirements">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1 mb-3">
                <li><strong className="text-gray-200">Docker</strong> — Docker Desktop, OrbStack, or any Docker-compatible runtime</li>
                <li><strong className="text-gray-200">Ollama</strong> — running on your local network or machine, with at least one LLM model loaded (e.g. <Code>llama3.1:8b</Code>)</li>
                <li>A folder of audio/video files to analyse</li>
              </ul>
              <p className="text-gray-400 text-sm">No GPU is required. Everything runs on CPU. A GPU makes transcription significantly faster but is entirely optional.</p>
            </SubSection>

            <SubSection title="Step 1 — Clone and start">
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto">
{`git clone https://github.com/wittedinit/StoryEngine.git
cd StoryEngine
docker compose up -d`}
              </pre>
              <p className="text-gray-400 text-sm mt-2">
                This starts six containers: PostgreSQL, Redis, Ollama, backend API, Celery worker, and the Next.js frontend.
                The first boot downloads images and may take a minute or two.
              </p>
            </SubSection>

            <SubSection title="Step 2 — Open the dashboard">
              <p className="text-gray-400 text-sm mb-2">
                Visit <Code>http://localhost:3100</Code> in your browser.
                A setup wizard will appear asking for two settings — complete those and you're ready.
              </p>
            </SubSection>

            <SubSection title="Step 3 — Mount your media folder">
              <p className="text-gray-400 text-sm mb-2">
                Your media files must be accessible inside the Docker containers. Edit <Code>docker-compose.yml</Code> and add a volume mount to both the <Code>backend</Code> and <Code>worker</Code> services:
              </p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto">
{`services:
  backend:
    volumes:
      - /your/host/media:/media:ro   # :ro = read-only (StoryEngine never writes here)

  worker:
    volumes:
      - /your/host/media:/media:ro`}
              </pre>
              <p className="text-gray-400 text-sm mt-2">
                Then set <strong>Media Library Path</strong> to <Code>/media</Code> in Settings → Paths, or in the setup wizard.
              </p>
              <Note>
                Using UYTDownloader? Mount its downloads volume directly:{" "}
                <Code>uytdownloader_downloads:/media:ro</Code>
              </Note>
            </SubSection>

            <SubSection title="Step 4 — Wait for processing">
              <p className="text-gray-400 text-sm">
                StoryEngine scans your library automatically every 5 minutes. Trigger an immediate scan from the Dashboard with <strong>Scan Downloads</strong>. Watch progress on the <Link href="/jobs" className="text-blue-400 hover:underline">Jobs</Link> page — each file goes through transcription then story detection.
              </p>
            </SubSection>

            <SubSection title="Ports">
              <Table
                headers={["Service", "Default port"]}
                rows={[
                  ["Web UI", "http://localhost:3100"],
                  ["API", "http://localhost:8100"],
                  ["API docs (OpenAPI)", "http://localhost:8100/docs"],
                ]}
              />
              <p className="text-gray-400 text-sm">
                To change ports, copy <Code>.env.default</Code> to <Code>.env</Code> and set <Code>SE_PORT</Code> and <Code>SE_FRONTEND_PORT</Code> before starting.
              </p>
            </SubSection>
          </Section>

          {/* First run setup */}
          <Section id="first-run" title="First Run Setup">
            <p className="text-gray-400 text-sm mb-4">
              On first visit the setup wizard asks for two settings. Both can also be changed later in{" "}
              <Link href="/settings" className="text-blue-400 hover:underline">Settings</Link>.
            </p>

            <SubSection title="1. Ollama URL">
              <p className="text-gray-400 text-sm mb-2">
                Enter the URL of your Ollama instance — e.g. <Code>http://192.168.1.60:11434</Code> if Ollama is running on another machine, or <Code>http://ollama:11434</Code> if you're using the bundled Ollama container.
              </p>
              <p className="text-gray-400 text-sm mb-2">
                In <Link href="/settings" className="text-blue-400 hover:underline">Settings → LLM & Ollama</Link>, click <strong>Test Connection</strong> to verify connectivity and choose a model from the dropdown.
              </p>
              <Note>
                Story detection quality scales with model capability. <Code>llama3.1:8b</Code> gives good results. Larger models (13b, 70b) give better story boundaries but are slower. Smaller models (3b) may produce inaccurate results.
              </Note>
            </SubSection>

            <SubSection title="2. Media Library Path">
              <p className="text-gray-400 text-sm">
                The absolute path <em>inside the container</em> where your audio/video files are mounted (e.g. <Code>/media</Code>). StoryEngine only reads from this location — it never writes or deletes files here.
              </p>
            </SubSection>
          </Section>

          {/* Pipeline */}
          <Section id="pipeline" title="How the Pipeline Works">
            <p className="text-gray-400 text-sm mb-4">
              Each file is processed through a sequential pipeline. Stages run on separate worker queues so GPU-heavy transcription never blocks lightweight tasks.
            </p>
            <Table
              headers={["Stage", "What happens"]}
              rows={[
                ["Scan", "File discovered, hash computed, added to database as 'discovered'"],
                ["Extract audio", "ffmpeg extracts a 16kHz mono WAV to a temporary work directory"],
                ["Transcribe", "faster-whisper + Silero VAD produces a word-level timestamped transcript"],
                ["Detect stories", "Transcript sent to Ollama LLM in chunks; returns titled, summarised stories with timestamps"],
                ["Detect sponsors", "(Optional) SponsorBlock API or LLM identifies sponsored/non-content segments"],
                ["Split clips", "(Optional) ffmpeg -c copy cuts each story into its own file — lossless, instant"],
                ["Embed", "(Optional) Ollama generates semantic vectors for each story, enabling dedup"],
              ]}
            />
            <SubSection title="Worker queues">
              <Table
                headers={["Queue", "Concurrency", "Runs"]}
                rows={[
                  ["scan, pipeline", "2 (configurable)", "Scanning, ffmpeg extraction, clip splitting, thumbnails, ZIP, YouTube uploads"],
                  ["gpu", "1 (serialised)", "Whisper transcription — serialised to prevent VRAM contention"],
                  ["llm", "2", "Ollama story detection, sponsor detection, embeddings"],
                ]}
              />
            </SubSection>
            <SubSection title="Job statuses">
              <p className="text-gray-400 text-sm">
                Watch the <Link href="/jobs" className="text-blue-400 hover:underline">Jobs</Link> page to see every stage progressing through{" "}
                <Code>pending</Code> → <Code>running</Code> → <Code>completed</Code> or <Code>failed</Code>.
                If a stage fails, the pipeline stops and the file is marked <Code>failed</Code>. Fix the issue (usually an Ollama or ffmpeg problem) then re-process from the file detail page.
              </p>
            </SubSection>
          </Section>

          {/* Media library */}
          <Section id="media" title="Media Library (Audio & Video)">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/videos" className="text-blue-400 hover:underline">Media</Link> page lists every file StoryEngine has found. Audio and video files are treated identically throughout the pipeline.
            </p>

            <SubSection title="Supported file types">
              <p className="text-gray-400 text-sm mb-2">
                By default StoryEngine picks up: <Code>.mp4</Code> <Code>.mkv</Code> <Code>.webm</Code> <Code>.avi</Code> <Code>.mov</Code> <Code>.m4a</Code> <Code>.mp3</Code> <Code>.opus</Code> <Code>.flac</Code> <Code>.wav</Code>
              </p>
              <p className="text-gray-400 text-sm">
                Files without an audio stream (silent video, corrupt files) are detected via ffprobe and silently skipped.
              </p>
            </SubSection>

            <SubSection title="File statuses">
              <Table
                headers={["Status", "Meaning"]}
                rows={[
                  ["discovered", "Found on disk, not yet processed"],
                  ["processing", "Pipeline is currently running for this file"],
                  ["completed", "All pipeline stages finished successfully"],
                  ["failed", "One or more stages failed — check Jobs for the error"],
                  ["ignored", "Manually excluded from processing"],
                ]}
              />
            </SubSection>

            <SubSection title="Channel detection">
              <p className="text-gray-400 text-sm mb-2">
                StoryEngine infers a <strong>channel</strong> from each file's immediate parent folder name. This is how podcast feeds, YouTube channels, or recording series are grouped automatically.
              </p>
              <p className="text-gray-400 text-sm mb-2">Examples:</p>
              <Table
                headers={["File path", "Channel"]}
                rows={[
                  ["/media/Lex Fridman/ep123.mp4", "Lex Fridman"],
                  ["/media/My Podcast/S01E04.mp3", "My Podcast"],
                  ["/media/lecture.mp4", "(none — root level)"],
                ]}
              />
              <p className="text-gray-400 text-sm">
                Channels appear in the <Link href="/reports" className="text-blue-400 hover:underline">Reports</Link> section.
              </p>
            </SubSection>

            <SubSection title="Re-processing a file">
              <p className="text-gray-400 text-sm">
                Open a file's detail page and click <strong>Reprocess</strong> to re-run the full pipeline. Useful after changing the Whisper model, LLM model, or pipeline settings.
                For bulk re-processing, use the multi-select mode on the Media page.
              </p>
            </SubSection>
          </Section>

          {/* Stories */}
          <Section id="stories" title="Stories">
            <p className="text-gray-400 text-sm mb-4">
              A <strong>story</strong> is a segment of a file that the LLM has identified as a distinct topic or narrative. Each story gets:
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-1 mb-4">
              <li>A <strong>title</strong> and short <strong>summary</strong> written by the LLM</li>
              <li>A <strong>start time</strong> and <strong>end time</strong> within the source file</li>
              <li>An optional <strong>type</strong> tag — <Code>story</Code>, <Code>sponsor</Code>, <Code>intro</Code>, <Code>outro</Code>, etc.</li>
            </ul>
            <p className="text-gray-400 text-sm mb-4">
              On a file's detail page you'll see a colour-coded timeline bar showing where stories fall. Yellow segments are non-content (sponsors, intros, outros).
            </p>
            <Note>
              Story quality depends on your LLM model and transcript quality. A larger model produces better story boundaries. If stories look wrong, try re-processing with a stronger model.
            </Note>
          </Section>

          {/* Player */}
          <Section id="player" title="In-Browser Player">
            <p className="text-gray-400 text-sm mb-4">
              When a media file is accessible inside the container, a <strong>Player</strong> tab appears on the file detail page. The player streams the original file using HTTP byte-range requests — seeking works instantly.
            </p>
            <SubSection title="Navigating by story">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Click anywhere on the story timeline bar to jump to that point</li>
                <li>Click a coloured story segment on the bar to jump to that story's start</li>
                <li>Click any row in the story list below the bar to seek directly to it</li>
              </ul>
            </SubSection>
            <Note>
              The Player tab only appears when <strong>Media Library Path</strong> is set and the file is accessible from inside the backend container. Audio-only files play fine — the browser's built-in audio player is used instead of a video element.
            </Note>
          </Section>

          {/* Splitting */}
          <Section id="splitting" title="Splitting Clips">
            <p className="text-gray-400 text-sm mb-4">
              StoryEngine can cut each story into its own file using <Code>ffmpeg -c copy</Code> — completely lossless and very fast (no re-encoding). The original file format and quality are preserved. Audio files produce audio clips; video files produce video clips.
            </p>
            <SubSection title="How to split">
              <Table
                headers={["Method", "How"]}
                rows={[
                  ["One story", "Open a story detail page → click Split Clip"],
                  ["All stories in a file", "Open a file detail page → click Split All"],
                  ["Automatically after detection", "Enable Auto-Split Clips in Settings → Pipeline"],
                  ["Bulk download", "Select stories on the Stories page → Download ZIP"],
                ]}
              />
            </SubSection>
            <SubSection title="Output location">
              <p className="text-gray-400 text-sm">
                Clips are saved to the <strong>Output Directory</strong> (default <Code>/segments</Code>, configurable in Settings → Paths). They are stored as <Code>{"{file_id}/{index:03d}_{title_slug}.{ext}"}</Code> preserving the original extension.
              </p>
            </SubSection>
            <Warn>
              The original audio/video files are <strong>never modified or deleted</strong>. StoryEngine only reads them. Clips are new files written to the Output Directory.
            </Warn>
          </Section>

          {/* Thumbnails, SRT, NFO */}
          <Section id="exports" title="Thumbnails, SRT & NFO">
            <p className="text-gray-400 text-sm mb-4">
              Once a story has been split into a clip, additional export formats are available from the story detail page. These are useful for getting clips into media servers like Jellyfin, Kodi, or Plex.
            </p>
            <SubSection title="Thumbnail">
              <p className="text-gray-400 text-sm">
                Click <strong>Generate Thumbnail</strong> to extract a JPEG frame at the story's midpoint using ffmpeg. For audio-only clips, thumbnails will not be generated (no video frame to extract). Regenerate at any time to replace the existing image.
              </p>
            </SubSection>
            <SubSection title="SRT subtitles">
              <p className="text-gray-400 text-sm">
                Download a <Code>.srt</Code> subtitle file for the clip. Timestamps are absolute and aligned with the clip file, so they sync in any media player (VLC, Plex, Jellyfin). Load as an external subtitle track.
              </p>
            </SubSection>
            <SubSection title="NFO metadata">
              <p className="text-gray-400 text-sm">
                Download a <Code>.nfo</Code> file in Kodi/Jellyfin <Code>&lt;episodedetails&gt;</Code> format. Place it in the same folder as the clip with the same base filename and your media server will use the StoryEngine title and summary as metadata.
              </p>
            </SubSection>
          </Section>

          {/* Search */}
          <Section id="search" title="Transcript Search">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/search" className="text-blue-400 hover:underline">Search</Link> page lets you find any spoken word or phrase across all transcribed files instantly, using PostgreSQL full-text search.
            </p>
            <SubSection title="How to use it">
              <p className="text-gray-400 text-sm mb-2">
                Type any word or phrase. Results appear live as you type. Each result shows the file name and a highlighted excerpt with the matched words in bold. Click a result to open that file's detail page.
              </p>
            </SubSection>
            <SubSection title="Tips">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Multi-word queries find files containing <em>all</em> the words (in any order, not necessarily adjacent)</li>
                <li>Search is stemmed — searching <em>running</em> also matches <em>run</em>, <em>runs</em></li>
                <li>Results are ranked by term frequency and proximity</li>
                <li>Only files that have been fully transcribed appear in results</li>
              </ul>
            </SubSection>
          </Section>

          {/* Editing */}
          <Section id="editing" title="Editing Stories">
            <p className="text-gray-400 text-sm mb-4">
              LLM-generated titles, summaries, and timestamps can all be corrected manually. Open a story detail page and click <strong>Edit</strong> in the top-right corner.
            </p>
            <Table
              headers={["Field", "Notes"]}
              rows={[
                ["Title", "Rename the story to anything you like"],
                ["Summary", "Overwrite the LLM-generated summary"],
                ["Start time (m:ss)", "Use decimal seconds — e.g. 12:34.5"],
                ["End time (m:ss)", "Must be after the start time"],
              ]}
            />
            <Warn>
              Changing start or end timestamps clears the existing split clip and thumbnail for that story (they would be out of sync). Re-split and regenerate the thumbnail after saving a timestamp edit.
            </Warn>
          </Section>

          {/* Sponsors */}
          <Section id="sponsors" title="Sponsor Detection">
            <p className="text-gray-400 text-sm mb-4">
              StoryEngine can identify sponsored, promotional, intro, outro, and filler segments and either tag, exclude, or save them separately.
            </p>
            <SubSection title="SponsorBlock (YouTube files only)">
              <p className="text-gray-400 text-sm mb-2">
                When a file's name contains a YouTube ID (e.g. <Code>My Video [dQw4w9WgXcQ].mp4</Code>), StoryEngine queries the public SponsorBlock API for crowdsourced sponsor timestamps. This is highly accurate for popular YouTube content.
              </p>
              <p className="text-gray-400 text-sm">
                Categories: <Code>sponsor</Code>, <Code>selfpromo</Code>, <Code>interaction</Code>, <Code>intro</Code>, <Code>outro</Code>, <Code>preview</Code>, <Code>filler</Code>
              </p>
            </SubSection>
            <SubSection title="LLM detection (any file)">
              <p className="text-gray-400 text-sm">
                For podcasts, audio recordings, and any file without a YouTube ID, the LLM reads the transcript and identifies promotional language. Less precise than crowdsourced data but works on any content.
              </p>
            </SubSection>
            <SubSection title="Sponsor actions">
              <Table
                headers={["Action", "Behaviour"]}
                rows={[
                  ["mark", "Sponsor segments appear as yellow bars on the timeline and are tagged in lists — files unchanged"],
                  ["skip", "Sponsor segments are excluded when auto-splitting (clips contain story content only)"],
                  ["split_out", "Sponsor segments are saved as separate clip files in segments/sponsors/"],
                ]}
              />
            </SubSection>
          </Section>

          {/* Dedup */}
          <Section id="dedup" title="Deduplication">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/dedup" className="text-blue-400 hover:underline">Dedup</Link> page finds stories with similar content across your entire library using semantic embeddings. It's useful for finding re-runs, reposts, or the same topic covered multiple times across different shows.
            </p>
            <SubSection title="How it works">
              <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1">
                <li>Click <strong>Embed All Stories</strong> — this sends each story's text to Ollama to generate a semantic vector</li>
                <li>StoryEngine builds an HNSW nearest-neighbour index from all vectors</li>
                <li>Stories closer than the <strong>Similarity Threshold</strong> are grouped into clusters</li>
                <li>Adjust the threshold slider and click <strong>Apply</strong> to re-cluster without re-embedding</li>
              </ol>
            </SubSection>
            <SubSection title="Threshold guidance">
              <Table
                headers={["Threshold", "What it finds"]}
                rows={[
                  ["0.95+", "Near-identical — same clip re-uploaded or duplicated"],
                  ["0.85–0.95", "Very similar topic and wording (default)"],
                  ["0.75–0.85", "Broadly similar topic, different phrasing"],
                  ["< 0.75", "May produce false positives"],
                ]}
              />
            </SubSection>
            <Note>
              Embeddings require Ollama to have an embed model available (default: <Code>nomic-embed-text</Code>). Run <Code>ollama pull nomic-embed-text</Code> on your Ollama host first. Enable <strong>Auto-Embed Stories</strong> in Settings to embed automatically after each detection run.
            </Note>
          </Section>

          {/* Reports */}
          <Section id="reports" title="Channel Reports">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/reports" className="text-blue-400 hover:underline">Reports</Link> page shows per-channel breakdowns: how many files, stories, and split clips each channel has, and the total duration.
            </p>
            <SubSection title="Scoped dedup">
              <p className="text-gray-400 text-sm mb-2">
                Click <strong>Dedup</strong> on any channel card to run a duplicate analysis scoped to just that channel. This is useful for finding re-runs or repeated segments within a single podcast or creator's content.
              </p>
              <p className="text-gray-400 text-sm">
                The report can be exported as a CSV file for external analysis.
              </p>
            </SubSection>
          </Section>

          {/* Export */}
          <Section id="export" title="Export & Download">
            <SubSection title="Playlist export (M3U8 / JSON)">
              <p className="text-gray-400 text-sm mb-2">
                Export playlists from three places:
              </p>
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1 mb-2">
                <li><strong>File detail page</strong> — export a playlist of all stories in that file</li>
                <li><strong>Stories page</strong> — select stories and export a custom playlist</li>
                <li><strong>Dedup page</strong> — export a playlist for a duplicate cluster</li>
              </ul>
              <p className="text-gray-400 text-sm">
                <strong>M3U8</strong> playlists stream clips directly from StoryEngine over HTTP — open in VLC, mpv, or any IPTV player. <strong>JSON</strong> playlists are machine-readable manifests with full story metadata.
              </p>
            </SubSection>
            <SubSection title="Bulk ZIP download">
              <p className="text-gray-400 text-sm">
                Select multiple stories on the Stories page and click <strong>Download ZIP</strong>. The backend assembles the ZIP in the background and the browser downloads it automatically when ready. Only stories with split clips are included.
              </p>
            </SubSection>
          </Section>

          {/* YouTube */}
          <Section id="youtube" title="YouTube Integration">
            <p className="text-gray-400 text-sm mb-4">
              StoryEngine can upload story clips to YouTube and organise them into playlists automatically. Manage the connection on the <Link href="/youtube" className="text-blue-400 hover:underline">YouTube</Link> page.
            </p>
            <SubSection title="Setup (one-time)">
              <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1 mb-3">
                <li>In <a href="https://console.cloud.google.com" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">Google Cloud Console</a>, create a project, enable the YouTube Data API v3, and create OAuth 2.0 credentials</li>
                <li>Add <Code>http://localhost:8100/api/v1/youtube/oauth/callback</Code> as an authorised redirect URI</li>
                <li>In <Link href="/settings" className="text-blue-400 hover:underline">Settings → YouTube</Link>, enter your Client ID and Client Secret</li>
                <li>On the <Link href="/youtube" className="text-blue-400 hover:underline">YouTube page</Link>, click <strong>Connect YouTube</strong> and complete the Google OAuth flow</li>
              </ol>
            </SubSection>
            <SubSection title="Uploading">
              <Table
                headers={["Method", "How"]}
                rows={[
                  ["Single clip", "Story detail page → Upload to YouTube"],
                  ["All unuploaded clips", "YouTube page → Upload All Clips to YouTube"],
                  ["Automatically on split", "Enable Auto-Upload in Settings → YouTube"],
                ]}
              />
            </SubSection>
            <SubSection title="Playlist modes">
              <Table
                headers={["Mode", "Behaviour"]}
                rows={[
                  ["per_video", "One YouTube playlist per source file title"],
                  ["per_channel", "One playlist per channel folder"],
                  ["none", "Clips uploaded with no playlist assignment"],
                ]}
              />
            </SubSection>
            <Warn>
              YouTube upload is purely <strong>additive</strong>. Your original audio/video files and local clip files are <strong>never deleted or modified</strong>. Uploads are a copy. You control your local library and YouTube independently.
            </Warn>
          </Section>

          {/* Webhooks */}
          <Section id="webhooks" title="Webhooks">
            <p className="text-gray-400 text-sm mb-4">
              Webhooks let StoryEngine POST notifications to any external URL when pipeline events occur. Configure them on the <Link href="/webhooks" className="text-blue-400 hover:underline">Webhooks</Link> page.
            </p>
            <Table
              headers={["Event", "When it fires"]}
              rows={[
                ["job_completed", "Full pipeline completes successfully for a file"],
                ["job_failed", "A pipeline stage fails"],
                ["story_detected", "Story detection finishes (includes story count)"],
                ["thumbnail_generated", "A thumbnail is generated for a story"],
                ["youtube_uploaded", "A clip is uploaded to YouTube"],
              ]}
            />
            <SubSection title="HMAC signing (optional)">
              <p className="text-gray-400 text-sm">
                Set a secret on a webhook to enable HMAC-SHA256 request signing. Every call will include an <Code>X-StoryEngine-Signature: sha256=...</Code> header. On your server, compute <Code>HMAC-SHA256(secret, raw_body)</Code> and compare to verify the request is genuine.
              </p>
            </SubSection>
            <SubSection title="Testing">
              <p className="text-gray-400 text-sm">
                Click <strong>Test</strong> on any webhook card to send a test payload immediately and see the HTTP response code.
              </p>
            </SubSection>
          </Section>

          {/* Batch */}
          <Section id="batch" title="Batch Operations">
            <SubSection title="Batch reprocess">
              <p className="text-gray-400 text-sm">
                On the <Link href="/videos" className="text-blue-400 hover:underline">Media</Link> page, click <strong>Select</strong> to enter multi-select mode. Choose individual files or <strong>Select all</strong>, then click <strong>Reprocess Selected</strong> to re-run the full pipeline on all selected files. Useful after updating your Whisper or LLM model settings.
              </p>
            </SubSection>
            <SubSection title="Bulk ZIP">
              <p className="text-gray-400 text-sm">
                On the <Link href="/stories" className="text-blue-400 hover:underline">Stories</Link> page, enter select mode, choose stories, and click <strong>Download ZIP</strong>. The browser downloads the ZIP automatically when it's ready.
              </p>
            </SubSection>
            <SubSection title="Split all clips in a file">
              <p className="text-gray-400 text-sm">
                On a file detail page, click <strong>Split All</strong> to queue clip splits for every story at once. Story cards update with a clip badge as each split completes.
              </p>
            </SubSection>
          </Section>

          {/* Settings */}
          <Section id="settings" title="Settings Reference">
            <SubSection title="LLM & Ollama">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Ollama Endpoint", "(empty)", "URL of your Ollama instance, e.g. http://192.168.1.60:11434"],
                  ["LLM Model", "llama3.1:8b", "Model used for story detection. Click 'Test Connection' to pick from available models."],
                  ["Embed Model", "nomic-embed-text", "Model used for semantic embeddings (required for Dedup). Run 'ollama pull nomic-embed-text' first."],
                ]}
              />
            </SubSection>
            <SubSection title="Transcription">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Whisper Model", "base", "tiny / base / small / medium / large-v3 / distil-large-v3. Larger = more accurate but slower."],
                  ["Compute Device", "auto", "auto detects CUDA → Metal → CPU. Force with: cuda, metal, or cpu."],
                  ["Compute Precision", "auto", "float16 for GPU, int8 for CPU, float32 as a safe fallback."],
                ]}
              />
              <Warn>Changing Whisper settings requires a worker restart to reload the model into memory.</Warn>
            </SubSection>
            <SubSection title="Pipeline">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Scan Interval", "300", "Seconds between automatic library scans. Set lower to catch new files faster."],
                  ["Auto-Split Clips", "false", "Automatically split every story into a clip file after detection."],
                  ["Auto-Embed Stories", "false", "Automatically generate embeddings after detection. Required for Dedup to work automatically."],
                  ["Sponsor Detection", "disabled", "sponsorblock (YouTube files only), llm (any file), both, or disabled."],
                  ["Sponsor Action", "mark", "mark — tag only. skip — exclude from auto-split clips. split_out — save as separate clip files."],
                  ["Dedup Threshold", "0.85", "Cosine similarity threshold used on the Dedup page (0–1)."],
                ]}
              />
            </SubSection>
            <SubSection title="Paths">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Media Library Path", "/data/downloads", "Where StoryEngine reads your audio/video files from. Must be accessible inside the container."],
                  ["Output Directory", "/segments", "Where split clip files are saved. Must be writable inside the container."],
                ]}
              />
            </SubSection>
            <SubSection title="YouTube">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Google OAuth Client ID", "(empty)", "From Google Cloud Console — required for YouTube upload."],
                  ["Google OAuth Client Secret", "(empty)", "From Google Cloud Console."],
                  ["Default Privacy", "private", "public, unlisted, or private — applies to all uploaded clips."],
                  ["Playlist Mode", "per_video", "per_video, per_channel, or none."],
                  ["Auto-Upload After Split", "false", "Automatically upload newly split clips to YouTube."],
                ]}
              />
            </SubSection>
          </Section>

          {/* GPU */}
          <Section id="gpu" title="GPU Acceleration">
            <p className="text-gray-400 text-sm mb-4">
              GPU acceleration dramatically speeds up Whisper transcription. Ollama also benefits from GPU when running larger LLM models.
            </p>
            <SubSection title="NVIDIA (Docker)">
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto">
                docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
              </pre>
              <p className="text-gray-400 text-sm mt-2">
                This passes all NVIDIA GPUs to both the Celery worker (Whisper) and the Ollama container.
              </p>
            </SubSection>
            <SubSection title="Apple Silicon (native worker only)">
              <p className="text-gray-400 text-sm mb-2">
                Docker Desktop on macOS cannot expose Apple Metal to containers. Run the GPU worker natively instead:
              </p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto">
{`cd backend
pip install ".[worker]"
SE_WHISPER_DEVICE=metal celery -A app.celery_app:celery worker -Q gpu --concurrency=1`}
              </pre>
            </SubSection>
          </Section>

          {/* Troubleshooting */}
          <Section id="troubleshooting" title="Troubleshooting">
            <SubSection title="Files are not being found">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Check <strong>Media Library Path</strong> in Settings → Paths matches the container mount point exactly</li>
                <li>Ensure the volume is mounted in both <Code>backend</Code> and <Code>worker</Code> services in docker-compose.yml</li>
                <li>Click <strong>Scan Downloads</strong> on the Dashboard to trigger an immediate scan</li>
                <li>Files without any audio track are silently skipped</li>
              </ul>
            </SubSection>
            <SubSection title="Stories not being detected">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Use <strong>Test Connection</strong> in Settings → LLM & Ollama to verify Ollama is reachable</li>
                <li>Ensure the chosen model is downloaded on your Ollama host (<Code>ollama pull llama3.1:8b</Code>)</li>
                <li>Try a larger model — smaller models (&lt;3b) often produce poor story boundaries</li>
                <li>Check the Jobs page for error details in the detect_stories stage</li>
              </ul>
            </SubSection>
            <SubSection title="Transcription is slow">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Use a smaller Whisper model (<Code>tiny</Code> or <Code>base</Code>) for faster results with acceptable accuracy</li>
                <li>Enable GPU acceleration — see the <a href="#gpu" className="text-blue-400 hover:underline">GPU Acceleration</a> section above</li>
                <li>Transcription is serialised (1 at a time) by design to prevent VRAM contention</li>
              </ul>
            </SubSection>
            <SubSection title="Clip splitting fails">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Ensure <strong>Output Directory</strong> is set and writable inside the container</li>
                <li>Add a writable volume mount for the output directory in docker-compose.yml</li>
                <li>The original source file must still exist at its original path</li>
              </ul>
            </SubSection>
            <SubSection title="Dedup / embeddings not working">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Ensure the embed model is downloaded: <Code>ollama pull nomic-embed-text</Code></li>
                <li>Check that Ollama is reachable from the worker container</li>
                <li>Check Jobs for failed embed stages</li>
              </ul>
            </SubSection>
            <SubSection title="YouTube upload fails">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>The story must have a split clip first — clips are what get uploaded</li>
                <li>Verify Client ID and Client Secret are set correctly in Settings → YouTube</li>
                <li>Re-connect via the YouTube page if the OAuth token has expired</li>
                <li>Confirm the redirect URI in Google Cloud Console exactly matches <Code>http://localhost:8100/api/v1/youtube/oauth/callback</Code></li>
              </ul>
            </SubSection>
            <SubSection title="Webhooks not firing">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Use the <strong>Test</strong> button on the Webhooks page to verify the endpoint is reachable</li>
                <li>Check the webhook is <strong>active</strong> (green dot) and has at least one event selected</li>
                <li>Webhook calls have a 5-second timeout — ensure your endpoint responds promptly</li>
              </ul>
            </SubSection>
          </Section>

        </div>
      </div>
    </div>
  );
}
