"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Stats } from "@/lib/api";

interface SetupCheck {
  configured: boolean;
  valid: boolean;
  value: string;
  message: string;
}

interface SetupStatus {
  ready: boolean;
  checks: Record<string, SetupCheck>;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function SetupWizard({ setup, onRefresh }: { setup: SetupStatus; onRefresh: () => void }) {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Welcome to StoryEngine</h2>
        <p className="text-gray-400">
          Configure a couple of things to get started. StoryEngine will scan your video library,
          transcribe audio, and use an LLM to detect individual stories within each video.
        </p>
      </div>

      <div className="space-y-4">
        {/* Ollama URL */}
        <SetupItem
          title="Ollama URL"
          description="Point to your Ollama instance for LLM inference"
          placeholder="http://192.168.1.50:11434"
          settingKey="ollama_url"
          check={setup.checks.ollama_url}
          onSaved={onRefresh}
        />

        {/* Downloads Path */}
        <SetupItem
          title="Video Library Path"
          description="Absolute path to the directory containing your video files"
          placeholder="/path/to/your/videos"
          settingKey="downloads_dir"
          check={setup.checks.downloads_dir}
          onSaved={onRefresh}
        />
      </div>

      <div className="mt-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-sm text-gray-400">
          All settings can be changed later from the{" "}
          <Link href="/settings" className="text-blue-400 hover:text-blue-300">Settings page</Link>.
        </p>
      </div>
    </div>
  );
}

function SetupItem({
  title,
  description,
  placeholder,
  settingKey,
  check,
  onSaved,
}: {
  title: string;
  description: string;
  placeholder: string;
  settingKey: string;
  check: SetupCheck;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(check.value || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await api.updateSetting(settingKey, value.trim());
      setMessage("Saved");
      onSaved();
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${check.valid ? "bg-green-500" : "bg-yellow-500"}`} />
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-3">{description}</p>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button
          onClick={save}
          disabled={saving || !value.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>

      <p className={`text-xs mt-2 ${check.valid ? "text-green-400" : "text-gray-500"}`}>
        {message || check.message}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSetup = () =>
    api.getSetupStatus().then(setSetup).catch(console.error);

  const loadStats = () =>
    api.getStats().then(setStats).catch(console.error);

  useEffect(() => {
    Promise.all([loadSetup(), loadStats()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      loadStats();
      loadSetup();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await api.triggerScan();
      setTimeout(loadStats, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  if (loading) return <p className="text-gray-500">Connecting to StoryEngine...</p>;

  // Show setup wizard if not fully configured
  if (setup && !setup.ready) {
    return <SetupWizard setup={setup} onRefresh={loadSetup} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <button
          onClick={triggerScan}
          disabled={scanning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          {scanning ? "Scanning..." : "Scan Downloads"}
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Videos" value={stats.total_videos} color="text-white" />
          <StatCard label="Completed" value={stats.completed_videos} color="text-green-400" />
          <StatCard label="Stories Found" value={stats.total_stories} color="text-blue-400" />
          <StatCard label="In Queue" value={stats.pending_jobs} color="text-yellow-400" />
          <StatCard label="Failed" value={stats.failed_jobs} color="text-red-400" />
        </div>
      ) : (
        <p className="text-gray-500">Loading stats...</p>
      )}
    </div>
  );
}
