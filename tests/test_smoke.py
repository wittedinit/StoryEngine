"""End-to-end smoke test for the StoryEngine pipeline.

Drops a real audio fixture into the watched downloads directory, triggers a
scan via the API, then polls until processing completes. Asserts the full
chain wrote correct rows to the database (visible through the public API).

Run requirements:
  - The compose stack is up with the test override (ollama-mock + tiny
    whisper model). See conftest.py for env knobs.
  - The host's tests/fixtures/test_audio.mp3 is mounted into the backend
    via the docker-compose `./data:/data` volume.
"""
from __future__ import annotations

import time
from pathlib import Path

import httpx


def _poll_for_video(client: httpx.Client, filename: str, timeout: int) -> dict:
    """Poll the videos list until a video with `filename` reaches a terminal state."""
    deadline = time.time() + timeout
    last_status = None
    while time.time() < deadline:
        resp = client.get("/api/v1/videos", params={"per_page": 200})
        resp.raise_for_status()
        items = resp.json().get("items", [])
        match = next((v for v in items if v["filename"] == filename), None)
        if match:
            last_status = match["status"]
            if match["status"] in {"completed", "failed"}:
                return match
        time.sleep(3)
    raise AssertionError(
        f"Pipeline did not finish within {timeout}s "
        f"(last seen status={last_status!r}, looking for filename={filename!r})"
    )


def _job_for_video(client: httpx.Client, video_id: str) -> dict:
    """Return the most recent processing_job for a video, with stages expanded."""
    resp = client.get("/api/v1/jobs", params={"per_page": 200})
    resp.raise_for_status()
    jobs = [j for j in resp.json()["items"] if j["video_id"] == video_id]
    assert jobs, f"No processing_job found for video {video_id}"
    # Newest first
    jobs.sort(key=lambda j: j["created_at"], reverse=True)
    detail = client.get(f"/api/v1/jobs/{jobs[0]['id']}")
    detail.raise_for_status()
    return detail.json()


def test_smoke_full_pipeline(
    client: httpx.Client,
    fixture_audio: Path,
    pipeline_timeout: int,
) -> None:
    """Scan → extract_audio → transcribe → detect_stories → completed."""

    # 1. Trigger the scan. The scanner picks up the fresh fixture and
    #    dispatches a process_video task for it.
    scan_resp = client.post("/api/v1/pipeline/scan")
    assert scan_resp.status_code == 200, scan_resp.text

    # 2. Poll the videos endpoint until our fixture reaches a terminal state.
    video = _poll_for_video(client, fixture_audio.name, pipeline_timeout)

    assert video["status"] == "completed", (
        f"Video did not complete: {video!r}"
    )

    video_id = video["id"]

    # 3. Transcript exists and has non-empty text.
    transcript_resp = client.get(f"/api/v1/videos/{video_id}/transcript")
    assert transcript_resp.status_code == 200, transcript_resp.text
    transcript = transcript_resp.json()
    assert transcript["full_text"].strip(), "Transcript has no text"
    assert transcript["word_count"] > 0, "Transcript word_count must be positive"

    # 4. At least one story row was created.
    stories_resp = client.get("/api/v1/stories", params={"video_id": video_id})
    assert stories_resp.status_code == 200, stories_resp.text
    stories = stories_resp.json()["items"]
    assert len(stories) >= 1, f"Expected >=1 story for video {video_id}, got {len(stories)}"

    # 5. The processing_job is COMPLETED and every stage finished.
    job = _job_for_video(client, video_id)
    assert job["status"] == "completed", f"Job not completed: {job!r}"
    stages = job["stages"]
    assert stages, "Job has no stages"
    bad = [s for s in stages if s["status"] != "completed"]
    assert not bad, f"Some pipeline stages did not complete: {bad!r}"
