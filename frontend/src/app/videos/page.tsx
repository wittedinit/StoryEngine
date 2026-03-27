"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, VideoSummary } from "@/lib/api";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const statusColors: Record<string, string> = {
  discovered: "bg-gray-600",
  processing: "bg-yellow-600",
  completed: "bg-green-600",
  failed: "bg-red-600",
  ignored: "bg-gray-700",
};

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState("");

  useEffect(() => {
    const params = search ? `search=${encodeURIComponent(search)}` : "";
    api.getVideos(params).then((r) => {
      setVideos(r.items);
      setTotal(r.total);
    });
  }, [search]);

  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchReprocess = async () => {
    if (selected.size === 0) return;
    setReprocessing(true);
    setReprocessMsg("");
    try {
      const r = await api.reprocessBatch(Array.from(selected));
      setReprocessMsg(`Queued ${r.queued} video${r.queued !== 1 ? "s" : ""} for reprocessing`);
      setSelectMode(false);
    } catch (e: any) {
      setReprocessMsg(`Error: ${e?.message}`);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Videos ({total})</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm w-56 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setSelectMode((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              selectMode ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"
            }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
        </div>
      </div>

      {/* Batch action bar */}
      {selectMode && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <span className="text-sm text-gray-400">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set(videos.map((v) => v.id)))}
            className="text-xs text-blue-400 hover:underline"
          >
            Select all ({videos.length})
          </button>
          <div className="ml-auto">
            <button
              onClick={handleBatchReprocess}
              disabled={selected.size === 0 || reprocessing}
              className="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
            >
              {reprocessing ? "Queuing..." : "Reprocess Selected"}
            </button>
          </div>
        </div>
      )}

      {reprocessMsg && (
        <p className={`text-sm mb-4 ${reprocessMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
          {reprocessMsg}
        </p>
      )}

      <div className="space-y-2">
        {videos.map((v) => {
          const isSelected = selected.has(v.id);
          const inner = (
            <>
              {selectMode && (
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600"
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 12 12" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8.5 2 5.5" />
                    </svg>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{v.title}</p>
                  {v.channel_name && (
                    <span className="text-xs text-gray-500 shrink-0">{v.channel_name}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{v.filename}</p>
              </div>
              <div className="text-sm text-gray-400 text-right shrink-0">
                {formatDuration(v.duration)}
              </div>
              <div className="text-sm text-blue-400 shrink-0">
                {v.story_count} {v.story_count === 1 ? "story" : "stories"}
              </div>
              <span className={`text-xs px-2 py-1 rounded ${statusColors[v.status] || "bg-gray-600"}`}>
                {v.status}
              </span>
            </>
          );

          if (selectMode) {
            return (
              <div
                key={v.id}
                onClick={() => toggleSelect(v.id)}
                className={`cursor-pointer flex items-center gap-4 p-4 bg-gray-900 border rounded-lg transition-colors ${
                  isSelected ? "border-blue-500" : "border-gray-800 hover:border-gray-600"
                }`}
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={v.id}
              href={`/videos/${v.id}`}
              className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
            >
              {inner}
            </Link>
          );
        })}
        {videos.length === 0 && (
          <p className="text-gray-500 text-center py-8">No videos found. Scan your downloads directory to get started.</p>
        )}
      </div>
    </div>
  );
}
