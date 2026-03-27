"use client";

import { useEffect, useState } from "react";
import { api, JobSummary } from "@/lib/api";

const statusColors: Record<string, string> = {
  pending: "text-gray-400",
  running: "text-yellow-400",
  completed: "text-green-400",
  failed: "text-red-400",
  cancelled: "text-gray-500",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);

  const loadJobs = () =>
    api.getJobs().then((r) => {
      setJobs(r.items);
      setTotal(r.total);
    });

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Processing Jobs ({total})</h2>

      <div className="space-y-2">
        {jobs.map((j) => (
          <div
            key={j.id}
            className="p-4 bg-gray-900 border border-gray-800 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium">{j.video_title || "Unknown"}</p>
                <p className="text-xs text-gray-500">{j.job_type}</p>
              </div>
              <span className={`text-sm font-medium ${statusColors[j.status]}`}>
                {j.status}
              </span>
            </div>

            {j.status === "running" && (
              <div className="mt-2">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${j.progress_pct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{j.progress_pct.toFixed(0)}%</p>
              </div>
            )}

            {j.error_message && (
              <p className="text-sm text-red-400 mt-2 truncate">{j.error_message}</p>
            )}

            <p className="text-xs text-gray-600 mt-2">
              {j.started_at ? new Date(j.started_at).toLocaleString() : "Queued"}
              {j.finished_at && ` — ${new Date(j.finished_at).toLocaleString()}`}
            </p>
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="text-gray-500 text-center py-8">No jobs in the queue.</p>
        )}
      </div>
    </div>
  );
}
