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

  useEffect(() => {
    const params = search ? `search=${encodeURIComponent(search)}` : "";
    api.getVideos(params).then((r) => {
      setVideos(r.items);
      setTotal(r.total);
    });
  }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Videos ({total})</h2>
        <input
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm w-64 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-2">
        {videos.map((v) => (
          <Link
            key={v.id}
            href={`/videos/${v.id}`}
            className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{v.title}</p>
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
          </Link>
        ))}
        {videos.length === 0 && (
          <p className="text-gray-500 text-center py-8">No videos found. Scan your downloads directory to get started.</p>
        )}
      </div>
    </div>
  );
}
