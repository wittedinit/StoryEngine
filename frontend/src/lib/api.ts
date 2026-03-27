const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface VideoSummary {
  id: string;
  filename: string;
  title: string;
  youtube_id: string | null;
  duration: number | null;
  format: string | null;
  status: string;
  story_count: number;
  created_at: string;
}

export interface VideoDetail extends VideoSummary {
  file_path: string;
  file_size: number;
  metadata_json: Record<string, unknown> | null;
}

export interface TranscriptSegment {
  start_time: number;
  end_time: number;
  text: string;
  confidence: number | null;
}

export interface Transcript {
  id: string;
  language: string;
  full_text: string;
  word_count: number;
  duration: number;
  model_used: string;
  segments: TranscriptSegment[];
}

export interface StorySummary {
  id: string;
  video_id: string;
  title: string;
  summary: string;
  start_time: number;
  end_time: number;
  duration: number;
  story_index: number;
  confidence: number | null;
  video_title: string;
  has_clip: boolean;
  has_embedding: boolean;
  segment_type: string;
  created_at: string;
}

export interface StoryDetail extends StorySummary {
  transcript_excerpt: string;
  llm_model: string;
  clip_path: string | null;
}

export interface DedupCluster {
  id: string;
  title: string;
  video_id: string;
  video_title: string;
  duration: number;
  has_clip: boolean;
}

export interface SimilarStory {
  id: string;
  similarity: number;
  title: string;
  video_title: string;
  has_clip: boolean;
}

export interface JobStage {
  stage: string;
  status: string;
  order: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface JobSummary {
  id: string;
  video_id: string | null;
  job_type: string;
  status: string;
  progress_pct: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  video_title: string;
}

export interface JobDetail extends JobSummary {
  celery_task_id: string | null;
  stages: JobStage[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface Stats {
  total_videos: number;
  completed_videos: number;
  total_stories: number;
  pending_jobs: number;
  failed_jobs: number;
}

export const api = {
  getStats: () => fetchAPI<Stats>("/api/v1/stats"),
  getVideos: (params?: string) =>
    fetchAPI<PaginatedResponse<VideoSummary>>(`/api/v1/videos${params ? `?${params}` : ""}`),
  getVideo: (id: string) => fetchAPI<VideoDetail>(`/api/v1/videos/${id}`),
  getTranscript: (videoId: string) => fetchAPI<Transcript>(`/api/v1/videos/${videoId}/transcript`),
  getStories: (params?: string) =>
    fetchAPI<PaginatedResponse<StorySummary>>(`/api/v1/stories${params ? `?${params}` : ""}`),
  getStory: (id: string) => fetchAPI<StoryDetail>(`/api/v1/stories/${id}`),
  getJobs: (params?: string) =>
    fetchAPI<PaginatedResponse<JobSummary>>(`/api/v1/jobs${params ? `?${params}` : ""}`),
  getJob: (id: string) => fetchAPI<JobDetail>(`/api/v1/jobs/${id}`),
  triggerScan: () => fetchAPI<{ detail: string }>("/api/v1/pipeline/scan", { method: "POST" }),
  reprocessVideo: (id: string) =>
    fetchAPI<{ detail: string }>(`/api/v1/pipeline/reprocess/${id}`, { method: "POST" }),
  getSettings: () => fetchAPI<{ settings: Record<string, any>; categories: Record<string, any[]> }>("/api/v1/settings"),
  updateSetting: (key: string, value: string) =>
    fetchAPI<{ key: string; value: string; restart_required: boolean }>(`/api/v1/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  resetSetting: (key: string) => fetchAPI<{ key: string }>(`/api/v1/settings/${key}`, { method: "DELETE" }),
  getOllamaModels: () =>
    fetchAPI<{ models: string[]; connected: boolean; error?: string }>("/api/v1/settings/ollama/models"),
  getHealth: () => fetchAPI<{ status: string; checks: Record<string, string> }>("/health"),
  getSetupStatus: () =>
    fetchAPI<{
      ready: boolean;
      checks: Record<string, { configured: boolean; valid: boolean; value: string; message: string }>;
    }>("/api/v1/settings/setup"),

  // Phase 2 — splitting
  splitStory: (id: string) =>
    fetchAPI<{ detail: string; task_id: string }>(`/api/v1/export/stories/${id}/split`, { method: "POST" }),
  splitVideoStories: (videoId: string) =>
    fetchAPI<{ detail: string; task_id: string }>(`/api/v1/export/videos/${videoId}/split`, { method: "POST" }),
  getClipUrl: (storyId: string) => `/api/v1/export/stories/${storyId}/clip`,

  // Phase 2 — dedup
  triggerEmbed: () =>
    fetchAPI<{ detail: string; task_id: string }>("/api/v1/dedup/embed", { method: "POST" }),
  getDedupClusters: (threshold?: number) =>
    fetchAPI<{ clusters: DedupCluster[][]; total_embedded: number; total_clusters: number; threshold: number }>(
      `/api/v1/dedup/clusters${threshold !== undefined ? `?threshold=${threshold}` : ""}`
    ),
  getSimilarStories: (storyId: string) =>
    fetchAPI<{ similar: SimilarStory[] }>(`/api/v1/dedup/similar/${storyId}`),
};
