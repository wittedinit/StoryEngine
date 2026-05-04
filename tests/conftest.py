"""Smoke test fixtures.

The tests assume the StoryEngine compose stack is already running with the
test override (`docker compose -f docker-compose.yml -f docker-compose.test.yml
up -d --build`).

Configuration is via environment so CI and local runs can share defaults:
  SE_TEST_BASE_URL    - Backend base URL (default http://localhost:8100)
  SE_TEST_DOWNLOADS   - Host path mounted as /data/downloads in the backend
                        (default ./data/downloads relative to repo root)
  SE_TEST_TIMEOUT     - Seconds to wait for pipeline completion (default 600)
"""
from __future__ import annotations

import os
import shutil
import time
from pathlib import Path
from typing import Iterator

import httpx
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.environ.get("SE_TEST_BASE_URL", "http://localhost:8100")


@pytest.fixture(scope="session")
def downloads_dir() -> Path:
    raw = os.environ.get("SE_TEST_DOWNLOADS")
    path = Path(raw) if raw else REPO_ROOT / "data" / "downloads"
    path.mkdir(parents=True, exist_ok=True)
    return path


@pytest.fixture(scope="session")
def pipeline_timeout() -> int:
    return int(os.environ.get("SE_TEST_TIMEOUT", "600"))


@pytest.fixture(scope="session")
def client(base_url: str) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=base_url, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="session", autouse=True)
def _wait_for_backend(client: httpx.Client) -> None:
    """Block until the backend's /api/v1/stats endpoint is responsive."""
    deadline = time.time() + 120
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            r = client.get("/api/v1/stats")
            if r.status_code == 200:
                return
        except httpx.HTTPError as exc:
            last_error = exc
        time.sleep(2)
    raise RuntimeError(f"Backend never came up at {client.base_url} (last error: {last_error})")


@pytest.fixture
def fixture_audio(downloads_dir: Path) -> Iterator[Path]:
    """Copy the canonical test audio into the watched downloads directory.

    Uses a unique filename per test run so retries don't collide with the
    previous run's Video row (which the scanner skips on hash match).
    """
    src = FIXTURES / "test_audio.mp3"
    assert src.exists(), f"Missing fixture audio: {src}"

    dst = downloads_dir / f"smoke_{int(time.time())}.mp3"
    shutil.copy2(src, dst)
    try:
        yield dst
    finally:
        # Best-effort cleanup; leave the file if delete fails so the user
        # can inspect what went wrong.
        try:
            dst.unlink()
        except OSError:
            pass
