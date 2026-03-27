"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ChannelDedupReport } from "@/lib/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type Tab = "videos" | "dedup";

export default function ChannelReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const channelName = decodeURIComponent(params.name as string);

  const [activeTab, setActiveTab] = useState<Tab>(
    searchParams.get("tab") === "dedup" ? "dedup" : "videos"
  );
  const [videos, setVideos] = useState<any[]>([]);
  const [dedup, setDedup] = useState<ChannelDedupReport | null>(null);
  const [threshold, setThreshold] = useState(0.85);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingDedup, setLoadingDedup] = useState(false);

  useEffect(() => {
    setLoadingVideos(true);
    api.getChannelVideos(channelName)
      .then((r) => setVideos(r.videos))
      .catch(console.error)
      .finally(() => setLoadingVideos(false));
  }, [channelName]);

  const loadDedup = async (t = threshold) => {
    setLoadingDedup(true);
    try {
      const r = await api.getChannelDedup(channelName, t);
      setDedup(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDedup(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dedup" && !dedup) {
      loadDedup();
    }
  }, [activeTab]);

  const exportDedupCsv = () => {
    if (!dedup) return;
    const rows = [["Cluster", "Story Title", "Video", "Duration"]];
    dedup.clusters.forEach((cluster, i) => {
      cluster.forEach((s) => {
        rows.push([String(i + 1), s.title, s.video_title, formatTime(s.duration)]);
      });
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${channelName}_dedup_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          &larr; Back to Reports
        </Link>
        <h2 className="text-2xl font-bold">{channelName}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800 mb-6">
        <button
          onClick={() => setActiveTab("videos")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "videos" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Videos ({videos.length})
        </button>
        <button
          onClick={() => setActiveTab("dedup")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dedup" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Dedup Analysis
        </button>
      </div>

      {/* Videos tab */}
      {activeTab === "videos" && (
        <div>
          {loadingVideos ? (
            <p className="text-gray-500 text-center py-8">Loading...</p>
          ) : (
            <div className="space-y-2">
              {videos.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos/${v.id}`}
                  className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{v.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{v.filename}</p>
                  </div>
                  <div className="text-sm text-gray-500 shrink-0 ml-4 text-right">
                    {v.duration ? formatDuration(v.duration) : "—"}
                    <div className={`text-xs mt-0.5 ${v.status === "completed" ? "text-green-500" : "text-gray-600"}`}>
                      {v.status}
                    </div>
                  </div>
                </Link>
              ))}
              {videos.length === 0 && (
                <p className="text-gray-500 text-center py-8">No videos found in this channel.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dedup tab */}
      {activeTab === "dedup" && (
        <div>
          <div className="flex items-center gap-4 mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">
              {dedup ? `${dedup.total_embedded} stories embedded` : "—"}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm text-gray-400">Threshold:</label>
              <input
                type="number"
                min={0.5}
                max={1.0}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
              />
              <button
                onClick={() => loadDedup(threshold)}
                disabled={loadingDedup}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                {loadingDedup ? "..." : "Apply"}
              </button>
              {dedup && dedup.clusters.length > 0 && (
                <button
                  onClick={exportDedupCsv}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-sm rounded transition-colors"
                >
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {dedup?.message && (
            <p className="text-sm text-yellow-500 mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              {dedup.message}
            </p>
          )}

          {loadingDedup ? (
            <p className="text-gray-500 text-center py-8">Analysing duplicates...</p>
          ) : dedup && dedup.clusters.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-2">No duplicate clusters found.</p>
              {(dedup.total_embedded ?? 0) < 2 ? (
                <p className="text-sm">
                  Embed stories first via the{" "}
                  <Link href="/dedup" className="text-blue-400 hover:underline">Dedup</Link> page.
                </p>
              ) : (
                <p className="text-sm">
                  All {dedup.total_embedded} embedded stories appear unique at {((dedup.threshold ?? threshold) * 100).toFixed(0)}% threshold.
                </p>
              )}
            </div>
          ) : dedup && dedup.clusters.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {dedup.clusters.length} cluster{dedup.clusters.length !== 1 ? "s" : ""} found
                across {dedup.total_embedded} embedded stories
              </p>
              {dedup.clusters.map((cluster, i) => (
                <div key={i} className="bg-gray-900 border border-yellow-900/50 rounded-lg p-4">
                  <p className="text-xs text-yellow-500 mb-3">
                    Cluster {i + 1} — {cluster.length} similar stories
                  </p>
                  <div className="space-y-2">
                    {cluster.map((story) => (
                      <Link
                        key={story.id}
                        href={`/stories/${story.id}`}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{story.title}</p>
                            {story.has_clip && (
                              <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded text-xs shrink-0">clip</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{story.video_title}</p>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 ml-3">{formatTime(story.duration)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
