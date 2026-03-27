"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface SettingValue {
  key: string;
  label: string;
  value: string;
  env_default: string;
  is_overridden: boolean;
  type: string;
  description: string;
  category: string;
  restart_required: boolean;
  readonly: boolean;
  options?: string[];
  placeholder?: string;
}

const categoryLabels: Record<string, string> = {
  llm: "LLM & Ollama",
  transcription: "Transcription",
  pipeline: "Pipeline",
  paths: "Paths",
};

const categoryOrder = ["llm", "transcription", "pipeline", "paths"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [categories, setCategories] = useState<Record<string, SettingValue[]>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [testingOllama, setTestingOllama] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings(data.settings);
      setCategories(data.categories);
      const vals: Record<string, string> = {};
      for (const [key, s] of Object.entries(data.settings)) {
        vals[key] = s.value;
      }
      setEditValues(vals);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Auto-fetch Ollama models if URL is already configured
  useEffect(() => {
    if (settings.ollama_url?.value) {
      fetchOllamaModels();
    }
  }, [settings.ollama_url?.value]);

  const fetchOllamaModels = async () => {
    try {
      const r = await api.getOllamaModels();
      if (r.connected && r.models.length > 0) {
        setOllamaModels(r.models);
        setOllamaStatus("connected");
      } else {
        setOllamaModels([]);
        setOllamaStatus("error");
      }
    } catch {
      setOllamaModels([]);
      setOllamaStatus("error");
    }
  };

  const testAndFetchModels = async () => {
    setTestingOllama(true);
    // Save the current URL first if it changed
    if (editValues.ollama_url !== settings.ollama_url?.value) {
      await saveSetting("ollama_url");
    }
    await fetchOllamaModels();
    setTestingOllama(false);
  };

  const saveSetting = async (key: string) => {
    const value = editValues[key];
    if (value === settings[key]?.value) return;

    setSaving((s) => ({ ...s, [key]: true }));
    setMessages((m) => ({ ...m, [key]: "" }));

    try {
      const result = await api.updateSetting(key, value);
      setMessages((m) => ({
        ...m,
        [key]: result.restart_required ? "Saved — worker restart needed" : "Saved",
      }));
      await loadSettings();
    } catch (e) {
      setMessages((m) => ({ ...m, [key]: `Error: ${e}` }));
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const resetSetting = async (key: string) => {
    try {
      await api.resetSetting(key);
      setMessages((m) => ({ ...m, [key]: "Reset to default" }));
      await loadSettings();
    } catch (e) {
      setMessages((m) => ({ ...m, [key]: `Error: ${e}` }));
    }
  };

  const renderInput = (s: SettingValue) => {
    if (s.readonly) {
      return <p className="flex-1 text-sm text-gray-400 font-mono py-2">{s.value}</p>;
    }

    // Ollama model picker — show dropdown when models are fetched, fallback to text
    if (s.type === "ollama_model") {
      return (
        <div className="flex-1 flex gap-2">
          {ollamaModels.length > 0 ? (
            <select
              value={editValues[s.key] || ""}
              onChange={(e) => setEditValues((v) => ({ ...v, [s.key]: e.target.value }))}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              {!ollamaModels.includes(editValues[s.key]) && editValues[s.key] && (
                <option value={editValues[s.key]}>{editValues[s.key]}</option>
              )}
              {ollamaModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={editValues[s.key] || ""}
              onChange={(e) => setEditValues((v) => ({ ...v, [s.key]: e.target.value }))}
              placeholder={s.placeholder || "e.g. llama3.1:8b"}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
            />
          )}
        </div>
      );
    }

    if (s.type === "select" && s.options) {
      return (
        <select
          value={editValues[s.key] || ""}
          onChange={(e) => setEditValues((v) => ({ ...v, [s.key]: e.target.value }))}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          {s.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={s.type === "number" ? "number" : "text"}
        value={editValues[s.key] || ""}
        onChange={(e) => setEditValues((v) => ({ ...v, [s.key]: e.target.value }))}
        placeholder={s.placeholder}
        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
      />
    );
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      {categoryOrder.map((cat) => {
        const items = categories[cat];
        if (!items) return null;
        return (
          <div key={cat} className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-300">
              {categoryLabels[cat] || cat}
            </h3>

            {/* Ollama status banner */}
            {cat === "llm" && (
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 text-sm ${
                ollamaStatus === "connected"
                  ? "bg-green-900/30 border border-green-800 text-green-400"
                  : ollamaStatus === "error"
                  ? "bg-red-900/30 border border-red-800 text-red-400"
                  : "bg-gray-900 border border-gray-800 text-gray-500"
              }`}>
                <span>
                  {ollamaStatus === "connected"
                    ? `Connected — ${ollamaModels.length} model${ollamaModels.length !== 1 ? "s" : ""} available`
                    : ollamaStatus === "error"
                    ? "Cannot reach Ollama — check the endpoint URL"
                    : "Ollama not tested yet"}
                </span>
                <button
                  onClick={testAndFetchModels}
                  disabled={testingOllama}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-xs transition-colors"
                >
                  {testingOllama ? "Testing..." : "Test Connection"}
                </button>
              </div>
            )}

            <div className="space-y-4">
              {items.map((s) => (
                <div key={s.key} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <label className="text-sm font-medium text-gray-200">{s.label}</label>
                      <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                    </div>
                    {s.is_overridden && !s.readonly && (
                      <button
                        onClick={() => resetSetting(s.key)}
                        className="text-xs text-gray-500 hover:text-gray-300 shrink-0 ml-4"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {renderInput(s)}

                    {!s.readonly && (
                      <button
                        onClick={() => saveSetting(s.key)}
                        disabled={saving[s.key] || editValues[s.key] === s.value}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors shrink-0"
                      >
                        {saving[s.key] ? "..." : "Save"}
                      </button>
                    )}
                  </div>

                  {s.is_overridden && !s.readonly && (
                    <p className="text-xs text-gray-600 mt-1">
                      Default: <span className="font-mono">{s.env_default || "(empty)"}</span>
                    </p>
                  )}

                  {messages[s.key] && (
                    <p className={`text-xs mt-1 ${messages[s.key].startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                      {messages[s.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
