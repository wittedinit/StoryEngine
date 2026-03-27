"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, YouTubeStatus } from "@/lib/api";

export default function YouTubePage() {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadAllResult, setUploadAllResult] = useState<string | null>(null);

  // Handle redirect back from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      window.history.replaceState({}, "", "/youtube");
      loadStatus();
    } else if (params.get("error")) {
      window.history.replaceState({}, "", "/youtube");
    }
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await api.getYouTubeStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const r = await api.getYouTubeAuthUrl();
      window.location.href = r.auth_url;
    } catch (e: any) {
      alert(e?.message || "Failed to start OAuth flow. Check YouTube credentials in Settings.");
      setConnecting(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Disconnect YouTube? Existing uploads will remain on YouTube.")) return;
    setRevoking(true);
    try {
      await api.revokeYouTube();
      await loadStatus();
    } finally {
      setRevoking(false);
    }
  };

  const handleUploadAll = async () => {
    setUploadingAll(true);
    setUploadAllResult(null);
    try {
      const r = await api.uploadAllToYouTube();
      setUploadAllResult(`Queued ${r.queued} upload${r.queued !== 1 ? "s" : ""}. Check Jobs for progress.`);
    } catch (e: any) {
      setUploadAllResult(`Error: ${e?.message}`);
    } finally {
      setUploadingAll(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">YouTube Integration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload story clips to YouTube and manage playlists automatically
        </p>
      </div>

      {/* Setup instructions */}
      {!status?.connected && (
        <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400">
          <p className="font-medium text-white mb-2">Setup required</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <Link href="/settings#youtube" className="text-blue-400 hover:underline">Settings → YouTube</Link> and enter your Google OAuth Client ID and Client Secret</li>
            <li>In Google Cloud Console, add <code className="bg-gray-800 px-1 rounded text-xs">http://localhost:8100/api/v1/youtube/oauth/callback</code> as an authorised redirect URI</li>
            <li>Click Connect below to authorise StoryEngine</li>
          </ol>
        </div>
      )}

      {/* Connection status */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
        {loading ? (
          <p className="text-gray-500 text-sm">Checking connection...</p>
        ) : status?.connected ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm font-medium text-white">Connected</span>
              </div>
              {status.channel && (
                <p className="text-sm text-gray-400">
                  Channel: <span className="text-white">{status.channel.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm rounded-lg transition-colors"
            >
              {revoking ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
              <span className="text-sm text-gray-400">
                {status?.error ? `Error: ${status.error}` : "Not connected"}
              </span>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {connecting ? "Opening Google..." : "Connect YouTube"}
            </button>
          </div>
        )}
      </div>

      {/* Upload controls (only when connected) */}
      {status?.connected && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-200 mb-2">Upload settings</h3>
            <p className="text-xs text-gray-500 mb-3">
              Configure privacy, playlist mode, and auto-upload in{" "}
              <Link href="/settings" className="text-blue-400 hover:underline">Settings → YouTube</Link>.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleUploadAll}
                disabled={uploadingAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {uploadingAll ? "Queuing uploads..." : "Upload All Clips to YouTube"}
              </button>
              <span className="text-xs text-gray-500">Uploads all clips that haven&apos;t been uploaded yet</span>
            </div>
            {uploadAllResult && (
              <p className={`text-xs mt-2 ${uploadAllResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                {uploadAllResult}
              </p>
            )}
          </div>

          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-200 mb-2">Per-story uploads</h3>
            <p className="text-xs text-gray-500">
              To upload individual stories, open a{" "}
              <Link href="/stories" className="text-blue-400 hover:underline">story detail page</Link>{" "}
              and use the Upload to YouTube button.
            </p>
          </div>

          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-200 mb-2">Local files are always kept</h3>
            <p className="text-xs text-gray-500">
              YouTube upload is additive — your original video files and split clips are <strong className="text-gray-400">never deleted</strong>.
              Uploads are a copy. You control both the local library and what appears on YouTube independently.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
