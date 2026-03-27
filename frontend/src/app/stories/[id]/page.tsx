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

function toTimeInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.toString().padStart(4, "0")}`;
}

function fromTimeInput(val: string): number {
  const parts = val.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(val);
}

export default function StoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState("");
  const [similar, setSimilar] = useState<SimilarStory[]>([]);

  // Edit modal
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [saving, setSaving] = useState(false);

  // Thumbnail
  const [generatingThumb, setGeneratingThumb] = useState(false);

  // YouTube
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

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

  // Poll for YouTube upload completion
  useEffect(() => {
    if (!uploading) return;
    const t = setInterval(() => {
      api.getStory(id).then((s) => {
        if (s.youtube_video_id) {
          setStory(s);
          setUploading(false);
          setUploadMsg("Uploaded to YouTube!");
          clearInterval(t);
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [uploading, id]);

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

  const openEdit = () => {
    if (!story) return;
    setEditTitle(story.title);
    setEditSummary(story.summary);
    setEditStart(toTimeInput(story.start_time));
    setEditEnd(toTimeInput(story.end_time));
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.patchStory(id, {
        title: editTitle,
        summary: editSummary,
        start_time: fromTimeInput(editStart),
        end_time: fromTimeInput(editEnd),
      });
      setStory(updated);
      setEditing(false);
    } catch (e: any) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    setGeneratingThumb(true);
    try {
      await api.generateThumbnail(id);
      // Poll until thumbnail appears
      const poll = setInterval(async () => {
        const s = await api.getStory(id).catch(() => null);
        if (s?.thumbnail_path) {
          setStory(s);
          setGeneratingThumb(false);
          clearInterval(poll);
        }
      }, 3000);
    } catch {
      setGeneratingThumb(false);
    }
  };

  const handleUploadYouTube = async () => {
    setUploading(true);
    setUploadMsg("Queued for upload...");
    try {
      await api.uploadToYouTube(id);
    } catch (e: any) {
      setUploading(false);
      setUploadMsg(`Error: ${e?.message}`);
    }
  };

  if (!story) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <Link href="/stories" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
        &larr; Back to Stories
      </Link>

      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
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
          <button
            onClick={openEdit}
            className="shrink-0 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Story</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Summary</label>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Start (m:ss)</label>
                  <input
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">End (m:ss)</label>
                  <input
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Changing timestamps clears the split clip and thumbnail — re-split after saving.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail */}
      {story.thumbnail_path && (
        <div className="mb-4">
          <img
            src={api.getThumbnailUrl(id)}
            alt="Story thumbnail"
            className="rounded-lg max-h-48 object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
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

        {story.has_clip && (
          <>
            <a
              href={api.getSrtUrl(id)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              SRT
            </a>
            <a
              href={api.getNfoUrl(id)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              NFO
            </a>
            <button
              onClick={handleGenerateThumbnail}
              disabled={generatingThumb}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors"
            >
              {generatingThumb ? "Generating..." : story.thumbnail_path ? "Regenerate Thumbnail" : "Generate Thumbnail"}
            </button>
          </>
        )}

        {story.has_clip && !story.youtube_video_id && (
          <button
            onClick={handleUploadYouTube}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
            </svg>
            {uploading ? "Uploading..." : "Upload to YouTube"}
          </button>
        )}

        {story.youtube_video_id && (
          <span className="inline-flex items-center gap-2 px-3 py-2 bg-red-900/30 text-red-400 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
            </svg>
            On YouTube
          </span>
        )}

        {splitMsg && <span className="text-sm text-gray-400">{splitMsg}</span>}
        {uploadMsg && (
          <span className={`text-sm ${uploadMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {uploadMsg}
          </span>
        )}
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
