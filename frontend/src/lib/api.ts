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
  channel_name: string | null;
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
  stream_url: string | null;
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
  thumbnail_path: string | null;
  youtube_video_id: string | null;
  youtube_playlist_id: string | null;
}

// Phase 4 — Search
export interface TranscriptSearchResult {
  video_id: string;
  video_title: string;
  video_filename: string;
  video_duration: number | null;
  excerpt: string;
  rank: number;
}

// Phase 4 — Webhooks
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  label: string | null;
  active: boolean;
  created_at: string;
}

// Phase 4 — YouTube
export interface YouTubeStatus {
  connected: boolean;
  channel: { name: string; id: string } | null;
  error?: string;
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

// Phase 3 — Reports

export interface ChannelSummary {
  channel: string;
  video_count: number;
  total_duration: number;
  story_count: number;
  clip_count: number;
}

export interface ChannelDedupReport {
  channel: string;
  clusters: DedupCluster[][];
  total_stories: number;
  total_embedded: number;
  total_clusters: number;
  threshold: number;
  message?: string;
}

// Phase 3 — Bulk ZIP

export interface ZipStatus {
  state: string;
  ready: boolean;
  download_url?: string;
  error?: string;
  progress?: number;
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

  // Phase 3 — playlist export
  getVideoPlaylistUrl: (videoId: string, format: "m3u8" | "json" = "m3u8") =>
    `/api/v1/export/videos/${videoId}/playlist?format=${format}`,
  getStoriesPlaylistUrl: (storyIds: string[], format: "m3u8" | "json" = "m3u8") =>
    `/api/v1/export/stories/playlist?ids=${storyIds.join(",")}&format=${format}`,

  // Phase 3 — bulk ZIP
  requestBulkZip: (storyIds: string[]) =>
    fetchAPI<{ task_id: string; detail: string }>("/api/v1/export/zip", {
      method: "POST",
      body: JSON.stringify({ story_ids: storyIds }),
    }),
  getBulkZipStatus: (taskId: string) =>
    fetchAPI<ZipStatus>(`/api/v1/export/zip/${taskId}/status`),
  getBulkZipDownloadUrl: (taskId: string) => `/api/v1/export/zip/${taskId}/download`,

  // Phase 4 — story editing
  patchStory: (id: string, payload: { title?: string; summary?: string; start_time?: number; end_time?: number }) =>
    fetchAPI<StoryDetail>(`/api/v1/stories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Phase 4 — SRT, NFO, thumbnail
  getSrtUrl: (storyId: string) => `/api/v1/export/stories/${storyId}/srt`,
  getNfoUrl: (storyId: string) => `/api/v1/export/stories/${storyId}/nfo`,
  getThumbnailUrl: (storyId: string) => `/api/v1/export/stories/${storyId}/thumbnail`,
  generateThumbnail: (storyId: string) =>
    fetchAPI<{ detail: string; task_id: string }>(`/api/v1/export/stories/${storyId}/thumbnail`, { method: "POST" }),

  // Phase 4 — transcript search
  searchTranscripts: (q: string, page = 1, perPage = 20) =>
    fetchAPI<{ results: TranscriptSearchResult[]; total: number; page: number; per_page: number; query: string }>(
      `/api/v1/search/transcripts?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`
    ),

  // Phase 4 — webhooks
  getWebhooks: () => fetchAPI<{ webhooks: Webhook[]; valid_events: string[] }>("/api/v1/webhooks"),
  createWebhook: (payload: Partial<Webhook>) =>
    fetchAPI<Webhook>("/api/v1/webhooks", { method: "POST", body: JSON.stringify(payload) }),
  updateWebhook: (id: string, payload: Partial<Webhook>) =>
    fetchAPI<Webhook>(`/api/v1/webhooks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWebhook: (id: string) => fetchAPI<{ deleted: boolean }>(`/api/v1/webhooks/${id}`, { method: "DELETE" }),
  testWebhook: (id: string) => fetchAPI<{ success: boolean; status_code?: number; error?: string }>(`/api/v1/webhooks/${id}/test`, { method: "POST" }),

  // Phase 4 — batch reprocess
  reprocessBatch: (videoIds: string[]) =>
    fetchAPI<{ queued: number; task_ids: string[] }>("/api/v1/pipeline/reprocess-batch", {
      method: "POST",
      body: JSON.stringify({ video_ids: videoIds }),
    }),

  // Phase 4 — YouTube
  getYouTubeStatus: () => fetchAPI<YouTubeStatus>("/api/v1/youtube/status"),
  getYouTubeAuthUrl: () => fetchAPI<{ auth_url: string }>("/api/v1/youtube/oauth/authorize"),
  revokeYouTube: () => fetchAPI<{ disconnected: boolean }>("/api/v1/youtube/oauth/revoke", { method: "DELETE" }),
  uploadToYouTube: (storyId: string) =>
    fetchAPI<{ detail: string; task_id: string }>(`/api/v1/youtube/upload/${storyId}`, { method: "POST" }),
  uploadAllToYouTube: () =>
    fetchAPI<{ queued: number; task_ids: string[] }>("/api/v1/youtube/upload-all", { method: "POST" }),
  getYouTubeUploadStatus: (taskId: string) =>
    fetchAPI<{ state: string; ready: boolean; youtube_video_id?: string; youtube_url?: string; error?: string }>(
      `/api/v1/youtube/upload/${taskId}/status`
    ),

  // Phase 3 — channel reports
  getChannels: () => fetchAPI<{ channels: ChannelSummary[]; total: number }>("/api/v1/reports/channels"),
  getChannelDedup: (channelName: string, threshold?: number) =>
    fetchAPI<ChannelDedupReport>(
      `/api/v1/reports/channels/${encodeURIComponent(channelName)}/dedup${threshold !== undefined ? `?threshold=${threshold}` : ""}`
    ),
  getChannelVideos: (channelName: string) =>
    fetchAPI<{ channel: string; videos: any[]; total: number }>(
      `/api/v1/reports/channels/${encodeURIComponent(channelName)}/videos`
    ),
};
