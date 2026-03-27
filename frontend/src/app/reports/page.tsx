"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ChannelSummary } from "@/lib/api";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ReportsPage() {
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChannels()
      .then((r) => setChannels(r.channels))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Channel Reports</h2>
        <p className="text-sm text-gray-500 mt-1">
          Per-channel breakdown of videos, stories, and duplicate analysis
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading channels...</p>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No channels found.</p>
          <p className="text-sm">
            Channels are automatically detected from folder names in your video library.<br />
            e.g. <code className="font-mono text-gray-400">/videos/ChannelName/video.mp4</code>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <div
              key={ch.channel}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white truncate">{ch.channel}</h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                    <span>{ch.video_count} video{ch.video_count !== 1 ? "s" : ""}</span>
                    <span>{ch.story_count} stor{ch.story_count !== 1 ? "ies" : "y"}</span>
                    <span>{ch.clip_count} clip{ch.clip_count !== 1 ? "s" : ""}</span>
                    {ch.total_duration > 0 && (
                      <span>{formatDuration(ch.total_duration)} total</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/reports/channels/${encodeURIComponent(ch.channel)}`}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    href={`/reports/channels/${encodeURIComponent(ch.channel)}?tab=dedup`}
                    className="px-3 py-1.5 bg-purple-700/40 hover:bg-purple-700/60 text-purple-300 text-sm rounded-lg transition-colors"
                  >
                    Dedup
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
