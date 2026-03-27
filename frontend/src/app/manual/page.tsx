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
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quick Start" },
  { id: "pipeline", label: "How the Pipeline Works" },
  { id: "videos", label: "Videos" },
  { id: "stories", label: "Stories" },
  { id: "player", label: "In-Browser Player" },
  { id: "splitting", label: "Splitting Clips" },
  { id: "sponsors", label: "Sponsor Detection" },
  { id: "search", label: "Transcript Search" },
  { id: "editing", label: "Editing Stories" },
  { id: "exports", label: "Thumbnails, SRT & NFO" },
  { id: "dedup", label: "Deduplication" },
  { id: "reports", label: "Channel Reports" },
  { id: "export", label: "Export & Download" },
  { id: "youtube", label: "YouTube Integration" },
  { id: "webhooks", label: "Webhooks" },
  { id: "batch", label: "Batch Operations" },
  { id: "settings", label: "Settings Reference" },
  { id: "gpu", label: "GPU Acceleration" },
  { id: "api", label: "API Reference" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function ManualPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">StoryEngine Manual</h2>
        <p className="text-sm text-gray-500 mt-1">Complete guide to using StoryEngine</p>
      </div>

      <div className="flex gap-8">
        {/* Table of contents */}
        <nav className="hidden lg:block w-44 shrink-0">
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

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-gray-400 mb-4">
              StoryEngine watches a folder of video files, transcribes them with Whisper, uses a local
              LLM (via Ollama) to detect natural story boundaries, and presents the results in this web UI.
            </p>
            <p className="text-gray-400 mb-4">
              Once stories are detected you can split them into individual lossless clip files, find
              duplicate content across your entire library, identify sponsor segments, and export playlists.
            </p>
            <Table
              headers={["Stage", "What happens"]}
              rows={[
                ["Scan", "Watches your video library folder every N minutes, detects new or changed files"],
                ["Transcribe", "Extracts audio and runs faster-whisper to produce a timestamped transcript"],
                ["Detect Stories", "Sends transcript to your local LLM to identify story boundaries, titles, and summaries"],
                ["Detect Sponsors", "Optionally queries SponsorBlock or asks the LLM to find sponsored segments"],
                ["Split", "Optionally cuts each story into a lossless clip file using ffmpeg -c copy"],
                ["Embed", "Optionally generates semantic embeddings for each story (used by Dedup)"],
                ["Dedup", "Finds stories with similar content across your entire library using HNSW"],
              ]}
            />
          </Section>

          {/* Quick start */}
          <Section id="quickstart" title="Quick Start">
            <SubSection title="1. Start the service">
              <p className="text-gray-400 text-sm mb-2">
                Run <Code>docker compose up -d</Code> from the StoryEngine directory.
                The UI will be available at <Code>http://localhost:3100</Code>.
              </p>
            </SubSection>
            <SubSection title="2. Configure Ollama">
              <p className="text-gray-400 text-sm mb-2">
                Go to <Link href="/settings" className="text-blue-400 hover:underline">Settings</Link> and
                enter your Ollama endpoint (e.g. <Code>http://192.168.1.60:11434</Code>). Click
                &ldquo;Test Connection&rdquo; — if connected, select a model from the dropdown.
              </p>
              <Note>
                Story detection works best with a capable model such as <Code>llama3.1:8b</Code> or larger.
                Smaller models may produce inaccurate story boundaries.
              </Note>
            </SubSection>
            <SubSection title="3. Set your video library path">
              <p className="text-gray-400 text-sm mb-2">
                Under <strong>Paths</strong> in Settings, set the <strong>Video Library Path</strong> to
                the folder inside the container where your videos are mounted (e.g. <Code>/videos</Code>).
                StoryEngine will never write to or delete files in this folder.
              </p>
            </SubSection>
            <SubSection title="4. Wait for automatic processing">
              <p className="text-gray-400 text-sm mb-2">
                StoryEngine scans the library every 5 minutes by default. You can trigger an immediate
                scan from the Dashboard with the <strong>Scan Now</strong> button. Watch progress on
                the <Link href="/jobs" className="text-blue-400 hover:underline">Jobs</Link> page.
              </p>
            </SubSection>
          </Section>

          {/* Pipeline */}
          <Section id="pipeline" title="How the Pipeline Works">
            <p className="text-gray-400 text-sm mb-4">
              Each video goes through a sequential Celery pipeline. Stages run on separate worker queues
              so GPU-intensive transcription never blocks other work.
            </p>
            <Table
              headers={["Queue", "Concurrency", "What runs here"]}
              rows={[
                ["scan, pipeline", "2 (configurable)", "File scanning, audio extraction, ffmpeg clip splitting, ZIP assembly"],
                ["gpu", "1 (serialised)", "Whisper transcription (prevents VRAM contention)"],
                ["llm", "2", "Ollama story detection, sponsor detection, embeddings"],
              ]}
            />
            <SubSection title="Stage statuses">
              <p className="text-gray-400 text-sm">
                Each stage shows one of: <Code>pending</Code> → <Code>running</Code> → <Code>completed</Code> / <Code>failed</Code>.
                If a stage fails, the pipeline stops and the video is marked <Code>failed</Code>. You can re-process
                any video from its detail page.
              </p>
            </SubSection>
          </Section>

          {/* Videos */}
          <Section id="videos" title="Videos">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/videos" className="text-blue-400 hover:underline">Videos</Link> page lists
              all media files found in your library. Each card shows the processing status,
              number of detected stories, and file format.
            </p>
            <SubSection title="Video statuses">
              <Table
                headers={["Status", "Meaning"]}
                rows={[
                  ["discovered", "File found, not yet processed"],
                  ["processing", "Pipeline is running"],
                  ["completed", "All pipeline stages finished successfully"],
                  ["failed", "At least one stage failed — see the Jobs page for details"],
                  ["ignored", "Manually excluded from processing"],
                ]}
              />
            </SubSection>
            <SubSection title="Channel detection">
              <p className="text-gray-400 text-sm">
                StoryEngine infers a channel name from the immediate parent directory of each video file.
                For example, <Code>/videos/TechChannel/video.mp4</Code> → channel <Code>TechChannel</Code>.
                Videos in the root library folder have no channel. Channel names are used by the
                <Link href="/reports" className="text-blue-400 hover:underline ml-1">Reports</Link> page.
              </p>
            </SubSection>
          </Section>

          {/* Stories */}
          <Section id="stories" title="Stories">
            <p className="text-gray-400 text-sm mb-4">
              Stories are segments of a video identified by the LLM as distinct topics or narratives.
              Each story has a title, a short summary, and a start/end timestamp.
            </p>
            <p className="text-gray-400 text-sm mb-4">
              On a video&apos;s detail page you will see a coloured timeline bar showing where each story
              falls within the video. Yellow segments are detected sponsor/non-content segments.
            </p>
            <Note>
              Story quality depends heavily on your LLM model and the transcript quality. If stories look
              wrong, try a larger model or re-process the video with a better Whisper model.
            </Note>
          </Section>

          {/* Player */}
          <Section id="player" title="In-Browser Player">
            <p className="text-gray-400 text-sm mb-4">
              When a video file is accessible from the backend container, a <strong>Player</strong> tab
              appears on the video detail page. The player streams the original file directly through
              the backend using byte-range requests, so seeking works instantly without buffering the
              whole file.
            </p>
            <SubSection title="Story navigation">
              <p className="text-gray-400 text-sm mb-2">
                Below the video element is a colour-coded timeline bar matching the one at the top of
                the page. Click anywhere on the bar to jump to that point in the video, or click a
                specific coloured segment to jump directly to the start of that story.
              </p>
              <p className="text-gray-400 text-sm">
                A story list below the bar lets you navigate by title — click any row to seek to
                that story&apos;s start time.
              </p>
            </SubSection>
            <Note>
              The Player tab is hidden if the video file path is not mounted and accessible inside
              the backend container. Ensure your <strong>Video Library Path</strong> is correctly
              configured and the volume is mounted.
            </Note>
          </Section>

          {/* Splitting */}
          <Section id="splitting" title="Splitting Clips">
            <p className="text-gray-400 text-sm mb-4">
              StoryEngine can cut each story into a separate video file using <Code>ffmpeg -c copy</Code>,
              which is completely lossless and very fast (no re-encoding). Clips are saved to the
              <strong> Output Directory</strong> configured in Settings (default: <Code>/segments</Code>).
            </p>
            <SubSection title="How to split">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>
                  <strong>One story:</strong> open a story detail page and click <strong>Split Clip</strong>
                </li>
                <li>
                  <strong>All stories in a video:</strong> open a video detail page and click <strong>Split All Stories</strong>
                </li>
                <li>
                  <strong>Automatically:</strong> enable <strong>Auto-Split Clips</strong> in Settings → Pipeline
                  to split every story as soon as it is detected
                </li>
                <li>
                  <strong>Bulk download:</strong> select multiple stories on the Stories page and click
                  <strong> Download ZIP</strong>
                </li>
              </ul>
            </SubSection>
            <SubSection title="Clip file naming">
              <p className="text-gray-400 text-sm">
                Clips are stored as <Code>{"{video_id}/{index:03d}_{title_slug}.{ext}"}</Code> relative to
                the output directory. The original file extension is preserved.
              </p>
            </SubSection>
            <Warn>
              The original video files are <strong>never modified or deleted</strong>. StoryEngine only reads
              them. Only split clips are written to the output directory.
            </Warn>
          </Section>

          {/* Search */}
          <Section id="search" title="Transcript Search">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/search" className="text-blue-400 hover:underline">Search</Link> page
              lets you search across every transcript in your library using PostgreSQL full-text search.
              Results are ranked by relevance and include a highlighted excerpt showing the matched
              passage in context.
            </p>
            <SubSection title="How to use">
              <p className="text-gray-400 text-sm mb-2">
                Type a word or phrase in the search box. Results appear as you type (after a short
                debounce). Each result links directly to the video detail page for that transcript.
              </p>
            </SubSection>
            <SubSection title="Search tips">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Multi-word queries find videos that contain <em>all</em> words, not necessarily adjacent</li>
                <li>Search is language-aware (English stemming by default) — searching <em>running</em> also matches <em>run</em></li>
                <li>Results are ranked by frequency and proximity of the search terms</li>
              </ul>
            </SubSection>
            <Note>
              Search only covers videos that have been fully transcribed. Videos still in the
              pipeline will not appear until transcription completes.
            </Note>
          </Section>

          {/* Editing stories */}
          <Section id="editing" title="Editing Stories">
            <p className="text-gray-400 text-sm mb-4">
              Story titles, summaries, and timestamps can be corrected manually. Open a story detail
              page and click <strong>Edit</strong> in the top-right corner.
            </p>
            <Table
              headers={["Field", "Notes"]}
              rows={[
                ["Title", "Free text — rename the story to anything you like"],
                ["Summary", "Free text — overwrite the LLM summary"],
                ["Start time (m:ss)", "Fractional seconds supported (e.g. 1:23.5)"],
                ["End time (m:ss)", "Must be after start time"],
              ]}
            />
            <Warn>
              Changing the start or end time clears the existing split clip and thumbnail for that
              story (they would be stale). Re-split the clip and regenerate the thumbnail after saving
              a timestamp edit.
            </Warn>
          </Section>

          {/* Thumbnails, SRT, NFO */}
          <Section id="exports" title="Thumbnails, SRT & NFO">
            <p className="text-gray-400 text-sm mb-4">
              Once a story has been split into a clip, additional export formats become available
              from the story detail page.
            </p>
            <SubSection title="Thumbnail">
              <p className="text-gray-400 text-sm mb-2">
                Click <strong>Generate Thumbnail</strong> to extract a JPEG frame from the video at
                the story&apos;s midpoint using <Code>ffmpeg -frames:v 1 -q:v 2</Code>. The thumbnail
                is stored alongside the clip and displayed at the top of the story detail page.
              </p>
              <p className="text-gray-400 text-sm">
                Click <strong>Regenerate Thumbnail</strong> at any time to replace it with a
                freshly extracted frame.
              </p>
            </SubSection>
            <SubSection title="SRT subtitles">
              <p className="text-gray-400 text-sm">
                Click <strong>SRT</strong> to download a subtitle file for the story clip. Timestamps
                are absolute (matching the clip file), so the subtitles sync correctly in any media
                player. Load the <Code>.srt</Code> file as an external subtitle track in VLC, Plex,
                Jellyfin, or any compatible player.
              </p>
            </SubSection>
            <SubSection title="NFO (Jellyfin / Kodi)">
              <p className="text-gray-400 text-sm">
                Click <strong>NFO</strong> to download an <Code>&lt;episodedetails&gt;</Code> XML file
                compatible with Jellyfin and Kodi. Place the <Code>.nfo</Code> file in the same
                folder as the clip with the same base name and your media server will automatically
                use the title, summary, and timestamps as metadata.
              </p>
            </SubSection>
          </Section>

          {/* Sponsor detection */}
          <Section id="sponsors" title="Sponsor Detection">
            <p className="text-gray-400 text-sm mb-4">
              StoryEngine can identify sponsor segments, intros, outros, and filler in two ways:
            </p>
            <SubSection title="SponsorBlock (YouTube videos only)">
              <p className="text-gray-400 text-sm mb-2">
                Queries the public SponsorBlock API using the YouTube video ID parsed from the filename
                (e.g. <Code>My Video [dQw4w9WgXcQ].mp4</Code>). This is highly accurate for popular
                YouTube content, as it uses crowdsourced timestamps.
              </p>
              <p className="text-gray-400 text-sm">
                Categories detected: <Code>sponsor</Code>, <Code>selfpromo</Code>, <Code>interaction</Code>,
                <Code> intro</Code>, <Code>outro</Code>, <Code>preview</Code>, <Code>filler</Code>
              </p>
            </SubSection>
            <SubSection title="LLM detection (any video)">
              <p className="text-gray-400 text-sm">
                Sends the transcript to your LLM and asks it to identify promotional language. Works for
                non-YouTube content but is less precise than crowdsourced data.
              </p>
            </SubSection>
            <SubSection title="Sponsor actions">
              <Table
                headers={["Action", "Behaviour"]}
                rows={[
                  ["mark", "Sponsor segments appear as yellow bars on the timeline and are tagged in story lists — no files are changed"],
                  ["skip", "Sponsor segments are excluded when auto-splitting (story clips only, no ads)"],
                  ["split_out", "Sponsor segments are saved as separate clip files in segments/sponsors/"],
                ]}
              />
            </SubSection>
          </Section>

          {/* Dedup */}
          <Section id="dedup" title="Deduplication">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/dedup" className="text-blue-400 hover:underline">Dedup</Link> page
              finds stories with similar content across your entire video library using semantic
              embeddings and an HNSW nearest-neighbour index.
            </p>
            <SubSection title="How it works">
              <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1">
                <li>Click <strong>Embed All Stories</strong> to generate vector embeddings for all stories via Ollama</li>
                <li>StoryEngine builds an HNSW index (USearch) from all embeddings</li>
                <li>Stories closer than the <strong>Similarity Threshold</strong> are grouped into clusters</li>
                <li>Adjust the threshold slider and click <strong>Apply</strong> to re-cluster without re-embedding</li>
              </ol>
            </SubSection>
            <SubSection title="Threshold guidance">
              <Table
                headers={["Threshold", "Sensitivity"]}
                rows={[
                  ["0.95+", "Near-identical — same clip re-uploaded"],
                  ["0.85–0.95", "Very similar topic and wording (default)"],
                  ["0.75–0.85", "Broadly similar topic, different wording"],
                  ["< 0.75", "May produce false positives"],
                ]}
              />
            </SubSection>
            <Note>
              Embeddings require Ollama to be configured with an embed model (default: <Code>nomic-embed-text</Code>).
              Enable <strong>Auto-Embed Stories</strong> in Settings to embed automatically after detection.
            </Note>
          </Section>

          {/* Reports */}
          <Section id="reports" title="Channel Reports">
            <p className="text-gray-400 text-sm mb-4">
              The <Link href="/reports" className="text-blue-400 hover:underline">Reports</Link> page
              provides per-channel breakdowns of your video library.
            </p>
            <SubSection title="Channel detection">
              <p className="text-gray-400 text-sm">
                Channels are inferred from the parent folder name of each video file. Videos in
                the root library folder are grouped under <Code>(root)</Code>.
              </p>
            </SubSection>
            <SubSection title="Per-channel dedup report">
              <p className="text-gray-400 text-sm mb-2">
                Click <strong>Dedup</strong> on any channel card to run a scoped duplicate analysis
                across only that channel&apos;s videos. This is useful for finding re-uploads or
                repeated segments within a single creator&apos;s content.
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
                Playlists can be exported from three places:
              </p>
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1 mb-2">
                <li>
                  <strong>Video detail page</strong> — export a playlist of all stories in that video
                </li>
                <li>
                  <strong>Stories page</strong> — select stories and export a custom playlist
                </li>
                <li>
                  <strong>Dedup page</strong> — export a playlist for a duplicate cluster
                </li>
              </ul>
              <p className="text-gray-400 text-sm">
                <strong>M3U8</strong> playlists work directly in VLC, mpv, and any media player that
                supports HTTP streams. They stream clips directly from StoryEngine over HTTP.
                <strong> JSON</strong> playlists are machine-readable manifests with full story metadata.
              </p>
              <Note>
                M3U8 playlists require StoryEngine to be running and accessible at the URL used when the
                playlist was exported. Only stories with split clips appear in the playlist.
              </Note>
            </SubSection>
            <SubSection title="Bulk ZIP download">
              <p className="text-gray-400 text-sm">
                Select multiple stories on the Stories page and click <strong>Download ZIP</strong>.
                StoryEngine assembles a ZIP archive of the clip files in the background.
                You will see a progress indicator; the download starts automatically when ready.
                Only stories that have already been split into clips are included.
              </p>
            </SubSection>
          </Section>

          {/* YouTube */}
          <Section id="youtube" title="YouTube Integration">
            <p className="text-gray-400 text-sm mb-4">
              StoryEngine can upload story clips to YouTube and organise them into playlists automatically.
              The <Link href="/youtube" className="text-blue-400 hover:underline">YouTube</Link> page
              manages the OAuth connection and bulk upload controls.
            </p>
            <SubSection title="Setup">
              <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1 mb-2">
                <li>
                  Create a project in{" "}
                  <strong>Google Cloud Console</strong>, enable the YouTube Data API v3, and create
                  OAuth 2.0 credentials (Desktop or Web App type)
                </li>
                <li>
                  Add <Code>http://localhost:8100/api/v1/youtube/oauth/callback</Code> as an
                  authorised redirect URI in Google Cloud Console
                </li>
                <li>
                  Go to <Link href="/settings" className="text-blue-400 hover:underline">Settings → YouTube</Link> and
                  enter your Client ID and Client Secret
                </li>
                <li>
                  Go to <Link href="/youtube" className="text-blue-400 hover:underline">YouTube</Link> and
                  click <strong>Connect YouTube</strong> to complete the OAuth flow
                </li>
              </ol>
            </SubSection>
            <SubSection title="Uploading clips">
              <Table
                headers={["Method", "How"]}
                rows={[
                  ["Single clip", "Open a story detail page → click Upload to YouTube"],
                  ["All unuploaded clips", "YouTube page → Upload All Clips to YouTube"],
                  ["Auto on split", "Enable Auto-Upload in Settings → YouTube"],
                ]}
              />
            </SubSection>
            <SubSection title="Playlist modes">
              <Table
                headers={["Mode", "Behaviour"]}
                rows={[
                  ["per_video", "Creates one YouTube playlist per source video title; each story clip is added to it"],
                  ["per_channel", "Creates one playlist per channel folder; all stories from that channel share it"],
                  ["none", "Clips are uploaded without being added to any playlist"],
                ]}
              />
            </SubSection>
            <SubSection title="Privacy">
              <p className="text-gray-400 text-sm">
                Configure the default privacy setting (<Code>public</Code>, <Code>unlisted</Code>, or
                <Code>private</Code>) in <Link href="/settings" className="text-blue-400 hover:underline">Settings → YouTube</Link>.
                This applies to all uploads from StoryEngine.
              </p>
            </SubSection>
            <Warn>
              YouTube upload is purely <strong>additive</strong>. Your original video files and local
              clip files are <strong>never deleted or modified</strong>. Uploads create a separate copy
              on YouTube. You control your local library and your YouTube channel independently.
            </Warn>
            <Note>
              Disconnect at any time via the YouTube page. Existing uploaded videos remain on YouTube
              after disconnecting — they are not deleted. The refresh token stored in Settings is
              removed, requiring a new OAuth flow to reconnect.
            </Note>
          </Section>

          {/* Webhooks */}
          <Section id="webhooks" title="Webhooks">
            <p className="text-gray-400 text-sm mb-4">
              Webhooks let StoryEngine send HTTP POST notifications to external services whenever
              pipeline events occur. Configure them on the{" "}
              <Link href="/webhooks" className="text-blue-400 hover:underline">Webhooks</Link> page.
            </p>
            <SubSection title="Supported events">
              <Table
                headers={["Event", "When it fires"]}
                rows={[
                  ["job_completed", "A full processing pipeline completes successfully for a video"],
                  ["job_failed", "A pipeline stage fails"],
                  ["story_detected", "Story detection finishes for a video (includes story count)"],
                  ["thumbnail_generated", "A thumbnail is generated for a story"],
                  ["youtube_uploaded", "A clip is successfully uploaded to YouTube"],
                ]}
              />
            </SubSection>
            <SubSection title="Payload format">
              <p className="text-gray-400 text-sm mb-2">
                All webhook calls send a JSON body with at minimum:
              </p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto mb-2">
                {`{
  "event": "job_completed",
  "timestamp": "2025-01-15T12:34:56Z",
  ...event-specific fields...
}`}
              </pre>
            </SubSection>
            <SubSection title="HMAC signature">
              <p className="text-gray-400 text-sm">
                If you configure a secret for a webhook, every call will include an
                <Code> X-StoryEngine-Signature</Code> header with a <Code>sha256=</Code>-prefixed
                hex digest. Compute <Code>HMAC-SHA256(secret, raw_body)</Code> on your server and
                compare to verify the request is genuine.
              </p>
            </SubSection>
            <SubSection title="Test button">
              <p className="text-gray-400 text-sm">
                Click <strong>Test</strong> on any webhook card to send a test payload immediately.
                The UI shows the HTTP status code returned or any network error, making it easy
                to verify your endpoint is reachable and accepting requests.
              </p>
            </SubSection>
          </Section>

          {/* Batch operations */}
          <Section id="batch" title="Batch Operations">
            <SubSection title="Batch reprocess">
              <p className="text-gray-400 text-sm mb-2">
                On the <Link href="/videos" className="text-blue-400 hover:underline">Videos</Link> page,
                click <strong>Select</strong> to enter selection mode. Check individual videos or use
                <strong> Select all</strong> to choose all visible videos. Then click
                <strong> Reprocess Selected</strong> to re-run the full pipeline on every selected video.
              </p>
              <p className="text-gray-400 text-sm">
                Useful after updating the Whisper model, LLM model, or pipeline settings — re-process
                a batch of videos to refresh their transcripts and stories.
              </p>
            </SubSection>
            <SubSection title="Bulk clip ZIP">
              <p className="text-gray-400 text-sm">
                On the <Link href="/stories" className="text-blue-400 hover:underline">Stories</Link> page,
                enter selection mode, choose the stories you want, and click <strong>Download ZIP</strong>.
                The backend assembles a ZIP of the clip files in the background. A progress indicator
                appears; when ready the browser downloads the file automatically.
              </p>
            </SubSection>
            <SubSection title="Split all clips in a video">
              <p className="text-gray-400 text-sm">
                On a video detail page, click <strong>Split All</strong> to queue clip splits for
                every story in that video. A spinner appears next to each story card as clips are
                created; the page polls for completion and updates the clip badges automatically.
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
                  ["LLM Model", "llama3.1:8b", "Model for story detection. Click 'Test Connection' to pick from available models"],
                  ["Embed Model", "nomic-embed-text", "Model used for semantic embeddings (required for Dedup)"],
                ]}
              />
            </SubSection>
            <SubSection title="Transcription">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Whisper Model", "base", "tiny / base / small / medium / large-v3 / distil-large-v3"],
                  ["Compute Device", "auto", "auto detects CUDA then Metal then CPU. Can be forced to cuda, metal, or cpu"],
                  ["Compute Precision", "auto", "float16 for GPU, int8 for CPU, float32 as a safe fallback"],
                ]}
              />
              <Warn>
                Changing the Whisper model or compute device requires a worker restart to reload the model into memory.
              </Warn>
            </SubSection>
            <SubSection title="Pipeline">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Scan Interval", "300", "Seconds between automatic library scans"],
                  ["Auto-Split Clips", "false", "Create clip files for every story automatically after detection"],
                  ["Auto-Embed Stories", "false", "Generate embeddings after detection (needed for Dedup)"],
                  ["Sponsor Detection", "disabled", "sponsorblock (YouTube only), llm, both, or disabled"],
                  ["Sponsor Action", "mark", "mark (tag only), skip (exclude from clips), split_out (separate clip files)"],
                  ["Dedup Threshold", "0.85", "Cosine similarity threshold used on the Dedup page (0–1)"],
                ]}
              />
            </SubSection>
            <SubSection title="Paths">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Video Library Path", "/data/downloads", "Where StoryEngine reads videos from — must be accessible inside the container"],
                  ["Output Directory", "/segments", "Where split clip files are saved"],
                ]}
              />
            </SubSection>
            <SubSection title="YouTube">
              <Table
                headers={["Setting", "Default", "Description"]}
                rows={[
                  ["Google OAuth Client ID", "(empty)", "From Google Cloud Console — required for YouTube upload"],
                  ["Google OAuth Client Secret", "(empty)", "From Google Cloud Console"],
                  ["Default Privacy", "private", "public, unlisted, or private — applies to all uploaded clips"],
                  ["Playlist Mode", "per_video", "per_video, per_channel, or none"],
                  ["Auto-Upload After Split", "false", "Automatically upload newly split clips to YouTube"],
                ]}
              />
              <Note>
                The OAuth refresh token is stored automatically after connecting via the YouTube page.
                It is displayed as read-only in Settings — do not edit it manually.
              </Note>
            </SubSection>
          </Section>

          {/* GPU */}
          <Section id="gpu" title="GPU Acceleration">
            <SubSection title="NVIDIA CUDA (Docker)">
              <p className="text-gray-400 text-sm mb-2">
                Run with the GPU overlay to pass all NVIDIA GPUs to the worker and Ollama:
              </p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto">
                docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
              </pre>
            </SubSection>
            <SubSection title="Apple Silicon (native only)">
              <p className="text-gray-400 text-sm mb-2">
                Docker Desktop on macOS cannot pass Metal through to containers. For GPU-accelerated
                transcription on Apple Silicon, run the worker natively:
              </p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto">
                {`cd backend
pip install ".[worker]"
SE_WHISPER_DEVICE=metal celery -A app.celery_app:celery worker -Q gpu --concurrency=1`}
              </pre>
            </SubSection>
            <SubSection title="Detection order">
              <p className="text-gray-400 text-sm">
                When <strong>Compute Device</strong> is set to <Code>auto</Code>, the worker detects:
                CUDA (if CTranslate2 reports CUDA devices) → Apple Metal → CPU. You can override this
                in Settings without restarting the whole stack — only a worker restart is needed.
              </p>
            </SubSection>
          </Section>

          {/* API */}
          <Section id="api" title="API Reference">
            <p className="text-gray-400 text-sm mb-4">
              The backend exposes a REST API at <Code>http://localhost:8100/api/v1</Code>.
              Full OpenAPI docs are available at <Code>http://localhost:8100/docs</Code>.
            </p>
            <Table
              headers={["Method + Path", "Description"]}
              rows={[
                ["GET /videos", "List all videos (paginated, filterable by status/search)"],
                ["GET /videos/{id}", "Video detail with metadata and stream_url"],
                ["GET /videos/{id}/transcript", "Full transcript with segments"],
                ["POST /pipeline/scan", "Trigger immediate library scan"],
                ["POST /pipeline/reprocess/{id}", "Re-run full pipeline on a video"],
                ["POST /pipeline/reprocess-batch", "Queue reprocessing for multiple video IDs"],
                ["GET /stories", "List all stories (paginated, searchable)"],
                ["GET /stories/{id}", "Story detail with transcript excerpt"],
                ["PATCH /stories/{id}", "Update story title, summary, or timestamps"],
                ["POST /export/stories/{id}/split", "Queue a clip split for one story"],
                ["POST /export/videos/{id}/split", "Queue clip splits for all stories in a video"],
                ["GET /export/stories/{id}/clip", "Download the clip file"],
                ["POST /export/stories/{id}/thumbnail", "Queue thumbnail generation"],
                ["GET /export/stories/{id}/thumbnail", "Download the thumbnail JPEG"],
                ["GET /export/stories/{id}/srt", "Download SRT subtitle file"],
                ["GET /export/stories/{id}/nfo", "Download NFO metadata file"],
                ["GET /export/videos/{id}/playlist", "Export M3U8 or JSON playlist for a video"],
                ["GET /export/stories/playlist?ids=…", "Export playlist for selected story IDs"],
                ["POST /export/zip", "Queue a bulk ZIP of clip files"],
                ["GET /export/zip/{task_id}/status", "Poll ZIP build status"],
                ["GET /export/zip/{task_id}/download", "Download completed ZIP"],
                ["GET /search/transcripts?q=…", "Full-text search across all transcripts"],
                ["GET /dedup/embed", "Embed all un-embedded stories"],
                ["GET /dedup/clusters", "Find duplicate story clusters"],
                ["GET /dedup/similar/{id}", "Stories similar to a given story"],
                ["GET /reports/channels", "List channels with aggregate stats"],
                ["GET /reports/channels/{name}/dedup", "Dedup report for a channel"],
                ["GET /reports/channels/{name}/videos", "List videos in a channel"],
                ["GET /webhooks", "List all webhooks"],
                ["POST /webhooks", "Create a webhook"],
                ["PUT /webhooks/{id}", "Update a webhook"],
                ["DELETE /webhooks/{id}", "Delete a webhook"],
                ["POST /webhooks/{id}/test", "Send a test call to a webhook"],
                ["GET /youtube/status", "Check YouTube connection status"],
                ["GET /youtube/auth-url", "Get the Google OAuth authorization URL"],
                ["GET /youtube/oauth/callback", "OAuth redirect handler (called by Google)"],
                ["POST /youtube/revoke", "Disconnect YouTube / remove stored token"],
                ["POST /youtube/upload/{story_id}", "Queue a story clip for YouTube upload"],
                ["POST /youtube/upload-all", "Queue all un-uploaded clips for YouTube"],
                ["GET /youtube/upload-status/{story_id}", "Check upload status for a story"],
                ["GET /settings", "All settings"],
                ["PUT /settings/{key}", "Update a setting"],
                ["GET /settings/ollama/models", "List available Ollama models"],
                ["GET /health", "Service health (DB, Redis, Ollama, ffmpeg)"],
              ]}
            />
          </Section>

          {/* Troubleshooting */}
          <Section id="troubleshooting" title="Troubleshooting">
            <SubSection title="Videos not being scanned">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Check that <strong>Video Library Path</strong> is set correctly in Settings → Paths</li>
                <li>Ensure the path is mounted inside the container (check <Code>docker-compose.yml</Code> volumes)</li>
                <li>Click <strong>Scan Now</strong> on the Dashboard to trigger an immediate scan</li>
                <li>Files with no audio track are automatically skipped</li>
              </ul>
            </SubSection>
            <SubSection title="Stories not being detected">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Verify Ollama is reachable — use <strong>Test Connection</strong> in Settings → LLM & Ollama</li>
                <li>Try a larger LLM model for better story detection accuracy</li>
                <li>Check the Jobs page for any error messages in the detect_stories stage</li>
                <li>Very short transcripts (under 30 seconds) may yield a single story</li>
              </ul>
            </SubSection>
            <SubSection title="Clip splitting fails">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Ensure <strong>Output Directory</strong> is set and writable inside the container</li>
                <li>Check that ffmpeg is available: the Docker image installs it automatically</li>
                <li>The original video file must still exist at its original path</li>
              </ul>
            </SubSection>
            <SubSection title="Embeddings / Dedup not working">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Ensure Ollama is configured and the <strong>Embed Model</strong> is loaded (e.g. <Code>nomic-embed-text</Code>)</li>
                <li>Run <Code>ollama pull nomic-embed-text</Code> on your Ollama host if not yet downloaded</li>
                <li>Check the Jobs page for failed embed stages</li>
              </ul>
            </SubSection>
            <SubSection title="YouTube upload fails">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Ensure the story has been split into a clip first — only clips can be uploaded</li>
                <li>Check that Client ID and Client Secret are correctly set in Settings → YouTube</li>
                <li>Re-connect via the YouTube page if the token has expired or been revoked</li>
                <li>Verify the redirect URI in Google Cloud Console exactly matches <Code>http://localhost:8100/api/v1/youtube/oauth/callback</Code></li>
                <li>Check the Jobs page for error details on the failed upload task</li>
              </ul>
            </SubSection>
            <SubSection title="Webhooks not firing">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Use the <strong>Test</strong> button on the Webhooks page to verify the endpoint is reachable</li>
                <li>Ensure the webhook is marked <strong>active</strong> (green dot)</li>
                <li>Confirm at least one event type is selected — a webhook with no events never fires</li>
                <li>Webhook calls have a 5-second timeout — ensure your endpoint responds promptly</li>
              </ul>
            </SubSection>
            <SubSection title="Transcription is slow">
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                <li>Use a smaller Whisper model (<Code>tiny</Code> or <Code>base</Code>) for faster results</li>
                <li>Enable GPU acceleration — see the <a href="#gpu" className="text-blue-400 hover:underline">GPU Acceleration</a> section</li>
                <li>The gpu worker queue is serialised (concurrency=1) by design to prevent VRAM contention</li>
              </ul>
            </SubSection>
          </Section>

        </div>
      </div>
    </div>
  );
}
