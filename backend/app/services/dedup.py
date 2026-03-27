"""Semantic deduplication using USearch HNSW index."""
import logging
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)


def _uuid_to_key(story_id: str) -> int:
    """Convert UUID string to a 63-bit integer key for USearch."""
    return uuid.UUID(story_id).int & 0x7FFFFFFFFFFFFFFF


def find_clusters(
    story_embeddings: list[tuple[str, list[float]]],
    threshold: float,
) -> list[list[str]]:
    """
    Find clusters of semantically similar stories.

    Args:
        story_embeddings: List of (story_id, embedding_vector) tuples.
        threshold: Cosine similarity threshold (0–1). 0.85 is a good default.

    Returns:
        List of clusters, each cluster is a list of story_id strings (≥2 members).
    """
    if len(story_embeddings) < 2:
        return []

    try:
        import numpy as np
        from usearch.index import Index
    except ImportError:
        logger.warning("usearch not installed — dedup unavailable")
        return []

    dims = len(story_embeddings[0][1])
    index = Index(ndim=dims, metric="cos")
    key_to_id: dict[int, str] = {}

    for story_id, embedding in story_embeddings:
        key = _uuid_to_key(story_id)
        key_to_id[key] = story_id
        index.add(key, np.array(embedding, dtype=np.float32))

    visited: set[str] = set()
    clusters: list[list[str]] = []

    for story_id, embedding in story_embeddings:
        if story_id in visited:
            continue

        vec = np.array(embedding, dtype=np.float32)
        matches = index.search(vec, min(20, len(story_embeddings)))

        cluster = []
        for match in matches:
            # USearch cosine metric returns distance (0=identical, 1=orthogonal)
            similarity = 1.0 - float(match.distance)
            if similarity >= threshold:
                sid = key_to_id.get(int(match.key))
                if sid and sid not in visited:
                    cluster.append(sid)
                    visited.add(sid)

        if len(cluster) > 1:
            clusters.append(cluster)

    return clusters


def find_similar_to(
    embedding: list[float],
    story_embeddings: list[tuple[str, list[float]]],
    threshold: float,
    limit: int = 10,
    exclude_id: str | None = None,
) -> list[tuple[str, float]]:
    """
    Find stories similar to a given embedding.
    Returns list of (story_id, similarity_score) sorted by similarity descending.
    """
    if not story_embeddings:
        return []

    try:
        import numpy as np
        from usearch.index import Index
    except ImportError:
        return []

    dims = len(embedding)
    index = Index(ndim=dims, metric="cos")
    key_to_id: dict[int, str] = {}

    for story_id, emb in story_embeddings:
        if story_id == exclude_id:
            continue
        key = _uuid_to_key(story_id)
        key_to_id[key] = story_id
        index.add(key, np.array(emb, dtype=np.float32))

    if not key_to_id:
        return []

    vec = np.array(embedding, dtype=np.float32)
    matches = index.search(vec, min(limit + 1, len(key_to_id)))

    results = []
    for match in matches:
        similarity = 1.0 - float(match.distance)
        if similarity >= threshold:
            sid = key_to_id.get(int(match.key))
            if sid:
                results.append((sid, round(similarity, 4)))

    return sorted(results, key=lambda x: x[1], reverse=True)[:limit]
