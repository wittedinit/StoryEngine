"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, StorySummary } from "@/lib/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = search ? `search=${encodeURIComponent(search)}` : "";
    api.getStories(params).then((r) => {
      setStories(r.items);
      setTotal(r.total);
    });
  }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Stories ({total})</h2>
        <input
          type="text"
          placeholder="Search stories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm w-64 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-2">
        {stories.map((s) => (
          <Link
            key={s.id}
            href={`/stories/${s.id}`}
            className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.title}</p>
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
          </Link>
        ))}
        {stories.length === 0 && (
          <p className="text-gray-500 text-center py-8">No stories found. Process some videos to detect stories.</p>
        )}
      </div>
    </div>
  );
}
