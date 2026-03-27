"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, DedupCluster } from "@/lib/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function DedupPage() {
  const [clusters, setClusters] = useState<DedupCluster[][]>([]);
  const [totalEmbedded, setTotalEmbedded] = useState(0);
  const [threshold, setThreshold] = useState(0.85);
  const [loading, setLoading] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [embedMsg, setEmbedMsg] = useState("");

  const loadClusters = async (t = threshold) => {
    setLoading(true);
    try {
      const r = await api.getDedupClusters(t);
      setClusters(r.clusters);
      setTotalEmbedded(r.total_embedded);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleEmbed = async () => {
    setEmbedding(true);
    setEmbedMsg("Queued — embedding all stories...");
    try {
      await api.triggerEmbed();
      // Poll until embedding is done
      const poll = setInterval(async () => {
        const r = await api.getDedupClusters(threshold).catch(() => null);
        if (r && r.total_embedded > totalEmbedded) {
          setTotalEmbedded(r.total_embedded);
          setClusters(r.clusters);
          setEmbedding(false);
          setEmbedMsg("");
          clearInterval(poll);
        }
      }, 5000);
    } catch {
      setEmbedding(false);
      setEmbedMsg("Embedding failed. Check jobs for details.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Deduplication</h2>
          <p className="text-sm text-gray-500 mt-1">
            Find stories with similar content across your video library
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEmbed}
            disabled={embedding}
            className="inline-flex items-center gap-2 px-3 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors"
          >
            {embedding ? "Embedding..." : "Embed All Stories"}
          </button>
          <button
            onClick={() => loadClusters(threshold)}
            disabled={loading}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {embedMsg && (
        <p className="text-sm text-gray-400 mb-4">{embedMsg}</p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 p-3 bg-gray-900 border border-gray-800 rounded-lg">
        <span className="text-sm text-gray-400">{totalEmbedded} stories embedded</span>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-400">Similarity threshold:</label>
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
            onClick={() => loadClusters(threshold)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Clusters */}
      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading clusters...</p>
      ) : clusters.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No duplicate clusters found.</p>
          {totalEmbedded === 0 ? (
            <p className="text-sm">Click "Embed All Stories" to generate semantic embeddings first.</p>
          ) : (
            <p className="text-sm">All {totalEmbedded} embedded stories appear to be unique at {(threshold * 100).toFixed(0)}% threshold.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{clusters.length} duplicate cluster{clusters.length !== 1 ? "s" : ""} found</p>
          {clusters.map((cluster, i) => (
            <div key={i} className="bg-gray-900 border border-yellow-900/50 rounded-lg p-4">
              <p className="text-xs text-yellow-500 mb-3">Cluster {i + 1} — {cluster.length} similar stories</p>
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
      )}
    </div>
  );
}
