"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api, StorySummary, ZipStatus } from "@/lib/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // ZIP state
  const [zipTaskId, setZipTaskId] = useState<string | null>(null);
  const [zipStatus, setZipStatus] = useState<ZipStatus | null>(null);
  const zipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const params = search ? `search=${encodeURIComponent(search)}` : "";
    api.getStories(params).then((r) => {
      setStories(r.items);
      setTotal(r.total);
    });
  }, [search]);

  // Clear selection when leaving select mode
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

  const selectAll = () => {
    setSelected(new Set(stories.map((s) => s.id)));
  };

  // ZIP download
  const handleDownloadZip = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    try {
      const r = await api.requestBulkZip(ids);
      setZipTaskId(r.task_id);
      setZipStatus({ state: "pending", ready: false });

      zipPollRef.current = setInterval(async () => {
        const status = await api.getBulkZipStatus(r.task_id).catch(() => null);
        if (!status) return;
        setZipStatus(status);
        if (status.ready) {
          clearInterval(zipPollRef.current!);
          window.location.href = api.getBulkZipDownloadUrl(r.task_id);
        } else if (status.state === "failure") {
          clearInterval(zipPollRef.current!);
        }
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Playlist export for selection
  const handleExportPlaylist = (format: "m3u8" | "json") => {
    if (selected.size === 0) return;
    window.location.href = api.getStoriesPlaylistUrl(Array.from(selected), format);
  };

  const zipBusy = zipStatus && !zipStatus.ready && zipStatus.state !== "failure";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Stories ({total})</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search stories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm w-56 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setSelectMode((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              selectMode
                ? "bg-blue-600 text-white"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300"
            }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <span className="text-sm text-gray-400">{selected.size} selected</span>
          <button onClick={selectAll} className="text-xs text-blue-400 hover:underline">
            Select all ({stories.length})
          </button>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleExportPlaylist("m3u8")}
              disabled={selected.size === 0}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-sm rounded-lg transition-colors"
            >
              M3U8 Playlist
            </button>
            <button
              onClick={() => handleExportPlaylist("json")}
              disabled={selected.size === 0}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-sm rounded-lg transition-colors"
            >
              JSON Playlist
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={selected.size === 0 || !!zipBusy}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
            >
              {zipBusy
                ? `Building ZIP${zipStatus?.progress ? ` ${zipStatus.progress}%` : "..."}`
                : "Download ZIP"}
            </button>
          </div>
        </div>
      )}

      {zipStatus?.state === "failure" && (
        <p className="text-sm text-red-400 mb-4">ZIP build failed: {zipStatus.error}</p>
      )}

      <div className="space-y-2">
        {stories.map((s) => {
          const isSelected = selected.has(s.id);
          const inner = (
            <div className="flex items-start justify-between">
              {selectMode && (
                <div className="mr-3 mt-0.5 shrink-0">
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.title}</p>
                  {s.segment_type !== "story" && (
                    <span className="px-1.5 py-0.5 bg-yellow-900/40 text-yellow-400 rounded text-xs shrink-0">{s.segment_type}</span>
                  )}
                  {s.has_clip && (
                    <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded text-xs shrink-0">clip</span>
                  )}
                  {s.has_embedding && (
                    <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-xs shrink-0">embedded</span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{s.summary}</p>
                <p className="text-xs text-gray-600 mt-2">
                  From: <span className="text-gray-500">{s.video_title}</span>
                </p>
              </div>
              <div className="text-sm text-gray-500 shrink-0 ml-4 text-right">
                <p>{formatTime(s.start_time)} - {formatTime(s.end_time)}</p>
                <p className="text-xs">{formatTime(s.duration)}</p>
              </div>
            </div>
          );

          if (selectMode) {
            return (
              <div
                key={s.id}
                onClick={() => toggleSelect(s.id)}
                className={`cursor-pointer p-4 bg-gray-900 border rounded-lg transition-colors ${
                  isSelected ? "border-blue-500" : "border-gray-800 hover:border-gray-600"
                }`}
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={s.id}
              href={`/stories/${s.id}`}
              className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
            >
              {inner}
            </Link>
          );
        })}
        {stories.length === 0 && (
          <p className="text-gray-500 text-center py-8">No stories found. Process some videos to detect stories.</p>
        )}
      </div>
    </div>
  );
}
