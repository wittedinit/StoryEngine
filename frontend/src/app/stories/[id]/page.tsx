"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, StoryDetail, SimilarStory } from "@/lib/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState("");
  const [similar, setSimilar] = useState<SimilarStory[]>([]);

  useEffect(() => {
    api.getStory(id).then(setStory).catch(console.error);
    api.getSimilarStories(id).then((r) => setSimilar(r.similar)).catch(() => {});
  }, [id]);

  // Poll for clip readiness after splitting
  useEffect(() => {
    if (!splitting) return;
    const t = setInterval(() => {
      api.getStory(id).then((s) => {
        if (s.has_clip) {
          setStory(s);
          setSplitting(false);
          setSplitMsg("");
          clearInterval(t);
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [splitting, id]);

  const handleSplit = async () => {
    setSplitting(true);
    setSplitMsg("Queued — splitting clip...");
    try {
      await api.splitStory(id);
    } catch {
      setSplitting(false);
      setSplitMsg("Split failed. Check jobs for details.");
    }
  };

  if (!story) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <Link href="/stories" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
        &larr; Back to Stories
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">{story.title}</h2>
        <div className="flex items-center gap-4 text-sm text-gray-500 mt-2 flex-wrap">
          <span>{formatTime(story.start_time)} — {formatTime(story.end_time)}</span>
          <span>Duration: {formatTime(story.duration)}</span>
          {story.confidence && <span>Confidence: {(story.confidence * 100).toFixed(0)}%</span>}
          <span>Model: {story.llm_model}</span>
          {story.has_embedding && (
            <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded text-xs">Embedded</span>
          )}
        </div>
      </div>

      {/* Clip actions */}
      <div className="flex items-center gap-3 mb-6">
        {story.has_clip ? (
          <a
            href={api.getClipUrl(id)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Clip
          </a>
        ) : (
          <button
            onClick={handleSplit}
            disabled={splitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            {splitting ? "Splitting..." : "Split Clip"}
          </button>
        )}
        {splitMsg && <span className="text-sm text-gray-400">{splitMsg}</span>}
      </div>

      <div className="space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Summary</p>
          <p className="text-gray-200">{story.summary}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Source Video</p>
          <Link href={`/videos/${story.video_id}`} className="text-blue-400 hover:text-blue-300">
            {story.video_title}
          </Link>
        </div>

        {story.transcript_excerpt && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-2">Transcript Excerpt</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {story.transcript_excerpt}
            </p>
          </div>
        )}

        {similar.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">Similar Stories</p>
            <div className="space-y-2">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  href={`/stories/${s.id}`}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-800 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.video_title}</p>
                  </div>
                  <span className="text-xs text-purple-400 shrink-0 ml-3">
                    {(s.similarity * 100).toFixed(0)}% match
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
