"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, VideoDetail, StorySummary, Transcript } from "@/lib/api";
// api used for playlist URL and split endpoints

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [activeTab, setActiveTab] = useState<"stories" | "transcript" | "player">("stories");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    api.getVideo(id).then(setVideo).catch(console.error);
    api.getStories(`video_id=${id}`).then((r) => setStories(r.items)).catch(console.error);
    api.getTranscript(id).then(setTranscript).catch(() => {});
  }, [id]);

  // Refresh stories periodically while splitting so clip badges appear
  useEffect(() => {
    if (!splitting) return;
    const t = setInterval(() => {
      api.getStories(`video_id=${id}`).then((r) => {
        setStories(r.items);
        if (r.items.every((s) => s.has_clip)) {
          setSplitting(false);
          clearInterval(t);
        }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [splitting, id]);

  const handleSplitAll = async () => {
    setSplitting(true);
    try {
      await api.splitVideoStories(id);
    } catch {
      setSplitting(false);
    }
  };

  if (!video) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/videos" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          &larr; Back to Media
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{video.title}</h2>
            <p className="text-sm text-gray-500">{video.filename}</p>
          </div>
          {stories.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleSplitAll}
                disabled={splitting}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                {splitting ? "Splitting..." : "Split All"}
              </button>
              <a
                href={api.getVideoPlaylistUrl(id, "m3u8")}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                title="Download M3U8 playlist"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Playlist
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Story timeline bar */}
      {video.duration && stories.length > 0 && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Story Timeline</p>
          <div className="relative h-8 bg-gray-800 rounded overflow-hidden">
            {stories.map((s, i) => {
              const left = (s.start_time / video.duration!) * 100;
              const width = (s.duration / video.duration!) * 100;
              const storyColors = ["bg-blue-600", "bg-green-600", "bg-purple-600", "bg-teal-600", "bg-pink-600"];
              const sponsorColor = "bg-yellow-500";
              const isSponsor = s.segment_type !== "story";
              const color = isSponsor ? sponsorColor : storyColors[i % storyColors.length];
              return (
                <div
                  key={s.id}
                  className={`absolute top-0 h-full ${color} opacity-80 hover:opacity-100 transition-opacity`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                  title={`${isSponsor ? "[Sponsor] " : ""}${s.title} (${formatTime(s.start_time)} - ${formatTime(s.end_time)})`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0:00</span>
            <span>{formatTime(video.duration)}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800 mb-4">
        <button
          onClick={() => setActiveTab("stories")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "stories" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Stories ({stories.length})
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "transcript" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Transcript
        </button>
        {video.stream_url && (
          <button
            onClick={() => setActiveTab("player")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "player" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Player
          </button>
        )}
      </div>

      {activeTab === "stories" && (
        <div className="space-y-3">
          {stories.map((s) => (
            <Link
              key={s.id}
              href={`/stories/${s.id}`}
              className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{s.title}</p>
                    {s.segment_type !== "story" && (
                      <span className="px-1.5 py-0.5 bg-yellow-900/40 text-yellow-400 rounded text-xs shrink-0">{s.segment_type}</span>
                    )}
                    {s.has_clip && (
                      <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded text-xs shrink-0">clip</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{s.summary}</p>
                </div>
                <span className="text-sm text-gray-500 shrink-0 ml-4">
                  {formatTime(s.start_time)} - {formatTime(s.end_time)}
                </span>
              </div>
            </Link>
          ))}
          {stories.length === 0 && (
            <p className="text-gray-500 text-center py-4">No stories detected yet.</p>
          )}
        </div>
      )}

      {activeTab === "transcript" && transcript && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>Language: {transcript.language}</span>
            <span>{transcript.word_count} words</span>
            <span>Model: {transcript.model_used}</span>
          </div>
          <div className="space-y-2">
            {transcript.segments.map((seg, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-xs text-gray-600 shrink-0 w-12 pt-0.5 text-right">
                  {formatTime(seg.start_time)}
                </span>
                <p className="text-sm text-gray-300">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "transcript" && !transcript && (
        <p className="text-gray-500 text-center py-4">Transcript not available.</p>
      )}

      {activeTab === "player" && video.stream_url && (
        <div>
          <video
            ref={videoRef}
            src={video.stream_url}
            controls
            className="w-full rounded-lg bg-black"
          />
          {stories.length > 0 && video.duration && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Click a story to jump to it</p>
              <div
                className="relative h-10 bg-gray-800 rounded overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  if (videoRef.current) videoRef.current.currentTime = pct * video.duration!;
                }}
              >
                {stories.map((s, i) => {
                  const left = (s.start_time / video.duration!) * 100;
                  const width = (s.duration / video.duration!) * 100;
                  const storyColors = ["bg-blue-600", "bg-green-600", "bg-purple-600", "bg-teal-600", "bg-pink-600"];
                  const color = s.segment_type !== "story" ? "bg-yellow-500" : storyColors[i % storyColors.length];
                  return (
                    <div
                      key={s.id}
                      className={`absolute top-0 h-full ${color} opacity-70 hover:opacity-100 transition-opacity`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                      title={`${s.title} (${formatTime(s.start_time)})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) videoRef.current.currentTime = s.start_time;
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0:00</span>
                <span>{formatTime(video.duration)}</span>
              </div>
              <div className="mt-3 space-y-1">
                {stories.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { if (videoRef.current) videoRef.current.currentTime = s.start_time; }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <span className="text-xs text-gray-500 w-12 shrink-0">{formatTime(s.start_time)}</span>
                    <span className="text-sm truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
