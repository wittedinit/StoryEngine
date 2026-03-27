"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api, TranscriptSearchResult } from "@/lib/api";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TranscriptSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.searchTranscripts(q);
      setResults(r.results);
      setTotal(r.total);
      setSearched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Transcript Search</h2>
        <p className="text-sm text-gray-500 mt-1">
          Full-text search across all transcripts — audio and video
        </p>
      </div>

      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          autoFocus
          placeholder="Search transcripts… (e.g. 'climate change', 'product launch')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {searched && (
        <p className="text-sm text-gray-500 mb-4">
          {total === 0 ? "No results found" : `${total} file${total !== 1 ? "s" : ""} matched`}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <Link
              key={r.video_id}
              href={`/videos/${r.video_id}`}
              className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{r.video_title}</p>
                  <p className="text-xs text-gray-600 mb-2">{r.video_filename}</p>
                  {/* Highlighted excerpt from PostgreSQL ts_headline */}
                  <p
                    className="text-sm text-gray-400 leading-relaxed [&_b]:text-white [&_b]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                  />
                </div>
                <div className="text-right shrink-0">
                  {r.video_duration && (
                    <p className="text-xs text-gray-500">{formatDuration(r.video_duration)}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">{(r.rank * 100).toFixed(0)}% match</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p>No transcripts matched &ldquo;{query}&rdquo;</p>
          <p className="text-sm mt-2">Try different keywords or check that files have been transcribed</p>
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-gray-600">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p>Type at least 2 characters to search</p>
        </div>
      )}
    </div>
  );
}
