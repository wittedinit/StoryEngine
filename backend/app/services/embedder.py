import logging

import httpx

logger = logging.getLogger(__name__)


async def embed_text(text: str, model: str, ollama_url: str) -> list[float]:
    """Get text embedding from Ollama (async)."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{ollama_url}/api/embeddings",
            json={"model": model, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]


def embed_text_sync(text: str, model: str, ollama_url: str) -> list[float]:
    """Get text embedding from Ollama (sync, for Celery workers)."""
    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            f"{ollama_url}/api/embeddings",
            json={"model": model, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]
