"use client";

import { useEffect, useState } from "react";
import { api, Webhook } from "@/lib/api";

const EVENT_LABELS: Record<string, string> = {
  job_completed: "Job Completed",
  job_failed: "Job Failed",
  story_detected: "Story Detected",
  thumbnail_generated: "Thumbnail Generated",
  youtube_uploaded: "YouTube Uploaded",
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [validEvents, setValidEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  // Form state
  const [formUrl, setFormUrl] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<Set<string>>(new Set(["job_completed", "job_failed"]));
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getWebhooks();
      setWebhooks(r.webhooks);
      setValidEvents(r.valid_events);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormUrl("");
    setFormLabel("");
    setFormSecret("");
    setFormEvents(new Set(["job_completed", "job_failed"]));
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (hook: Webhook) => {
    setFormUrl(hook.url);
    setFormLabel(hook.label || "");
    setFormSecret("");
    setFormEvents(new Set(hook.events));
    setEditingId(hook.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formUrl.trim()) return;
    setSaving(true);
    try {
      const payload = {
        url: formUrl.trim(),
        label: formLabel.trim() || null,
        secret: formSecret.trim() || null,
        events: Array.from(formEvents),
        active: true,
      };
      if (editingId) {
        await api.updateWebhook(editingId, payload);
      } else {
        await api.createWebhook(payload);
      }
      await load();
      resetForm();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    await api.deleteWebhook(id);
    await load();
  };

  const handleToggleActive = async (hook: Webhook) => {
    await api.updateWebhook(hook.id, { active: !hook.active });
    await load();
  };

  const handleTest = async (id: string) => {
    setTestResults((r) => ({ ...r, [id]: "Sending..." }));
    const r = await api.testWebhook(id);
    setTestResults((prev) => ({
      ...prev,
      [id]: r.success ? `OK (HTTP ${r.status_code})` : `Failed: ${r.error}`,
    }));
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) => {
      const next = new Set(prev);
      next.has(event) ? next.delete(event) : next.add(event);
      return next;
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Webhooks</h2>
          <p className="text-sm text-gray-500 mt-1">
            Send HTTP notifications to external services when pipeline events occur
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add Webhook
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="mb-6 p-4 bg-gray-900 border border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-white mb-4">
            {editingId ? "Edit Webhook" : "New Webhook"}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">URL <span className="text-red-400">*</span></label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://your-service.com/webhook"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Label (optional)</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Slack notifications"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Secret (optional — used for HMAC-SHA256 signature)</label>
              <input
                type="password"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder={editingId ? "Leave blank to keep existing secret" : "Optional HMAC secret"}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Events</label>
              <div className="flex flex-wrap gap-2">
                {validEvents.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      formEvents.has(event)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {EVENT_LABELS[event] || event}
                  </button>
                ))}
              </div>
              {formEvents.size === 0 && (
                <p className="text-xs text-gray-500 mt-1">No events selected — webhook will not fire</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !formUrl.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading webhooks...</p>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No webhooks configured.</p>
          <p className="text-sm mt-1">Add one to receive HTTP notifications when pipeline events occur.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((hook) => (
            <div key={hook.id} className={`p-4 bg-gray-900 border rounded-lg ${hook.active ? "border-gray-800" : "border-gray-900 opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hook.active ? "bg-green-500" : "bg-gray-600"}`}></span>
                    {hook.label && <span className="text-sm font-medium text-white">{hook.label}</span>}
                    <span className="text-xs font-mono text-gray-400 truncate">{hook.url}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {hook.events.map((e) => (
                      <span key={e} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">
                        {EVENT_LABELS[e] || e}
                      </span>
                    ))}
                    {hook.events.length === 0 && (
                      <span className="text-xs text-gray-600">No events</span>
                    )}
                  </div>
                  {hook.secret && (
                    <p className="text-xs text-gray-600 mt-1">HMAC signature enabled</p>
                  )}
                  {testResults[hook.id] && (
                    <p className={`text-xs mt-1 ${testResults[hook.id].startsWith("OK") ? "text-green-400" : "text-red-400"}`}>
                      {testResults[hook.id]}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleTest(hook.id)}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs rounded transition-colors"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleToggleActive(hook)}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs rounded transition-colors"
                  >
                    {hook.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => startEdit(hook)}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(hook.id)}
                    className="px-2.5 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-xs rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
