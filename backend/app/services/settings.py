"""Runtime settings service.

Settings priority: DB value > environment variable > default.
The DB layer allows the dashboard to change config without restarting containers.
"""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.models.setting import Setting

logger = logging.getLogger(__name__)

# All configurable settings with their env default, type, and description.
# The key matches both the DB key and the SE_ env var (lowercased).
SETTING_DEFINITIONS: dict[str, dict[str, Any]] = {
    "ollama_url": {
        "label": "Ollama Endpoint",
        "default_from_env": lambda: env_settings.ollama_url,
        "type": "string",
        "description": "URL of your Ollama instance (e.g. http://192.168.1.50:11434)",
        "category": "llm",
        "restart_required": False,
        "placeholder": "http://192.168.1.x:11434",
    },
    "llm_model": {
        "label": "LLM Model",
        "default_from_env": lambda: env_settings.llm_model,
        "type": "ollama_model",
        "description": "Model used for story boundary detection and summarisation",
        "category": "llm",
        "restart_required": False,
    },
    "embed_model": {
        "label": "Embed Model",
        "default_from_env": lambda: env_settings.embed_model,
        "type": "ollama_model",
        "description": "Model used for semantic embeddings and deduplication",
        "category": "llm",
        "restart_required": False,
    },
    "whisper_model": {
        "label": "Whisper Model",
        "default_from_env": lambda: env_settings.whisper_model,
        "type": "select",
        "options": ["tiny", "base", "small", "medium", "large-v3", "distil-large-v3"],
        "description": "Model size for audio transcription — larger is more accurate but slower",
        "category": "transcription",
        "restart_required": True,
    },
    "whisper_device": {
        "label": "Compute Device",
        "default_from_env": lambda: env_settings.whisper_device,
        "type": "select",
        "options": ["auto", "cpu", "cuda", "metal"],
        "description": "Hardware for transcription: auto detects CUDA → Metal → CPU",
        "category": "transcription",
        "restart_required": True,
    },
    "whisper_compute_type": {
        "label": "Compute Precision",
        "default_from_env": lambda: env_settings.whisper_compute_type,
        "type": "select",
        "options": ["auto", "float16", "int8", "float32"],
        "description": "Numerical precision for Whisper (auto picks the best for your device)",
        "category": "transcription",
        "restart_required": True,
    },
    "scan_interval": {
        "label": "Scan Interval (seconds)",
        "default_from_env": lambda: str(env_settings.scan_interval),
        "type": "number",
        "description": "How often to check the video library for new or changed files",
        "category": "pipeline",
        "restart_required": False,
    },
    "dedup_threshold": {
        "label": "Dedup Threshold",
        "default_from_env": lambda: str(env_settings.dedup_threshold),
        "type": "number",
        "description": "Minimum cosine similarity (0–1) to consider two stories duplicates",
        "category": "pipeline",
        "restart_required": False,
    },
    "auto_split": {
        "label": "Auto-Split Clips",
        "default_from_env": lambda: "false",
        "type": "select",
        "options": ["true", "false"],
        "description": "Automatically create clip files for every story after processing",
        "category": "pipeline",
        "restart_required": False,
    },
    "auto_embed": {
        "label": "Auto-Embed Stories",
        "default_from_env": lambda: "false",
        "type": "select",
        "options": ["true", "false"],
        "description": "Automatically generate semantic embeddings after processing (required for dedup)",
        "category": "pipeline",
        "restart_required": False,
    },
    "sponsor_detection": {
        "label": "Sponsor Detection",
        "default_from_env": lambda: "disabled",
        "type": "select",
        "options": ["disabled", "sponsorblock", "llm", "both"],
        "description": "Detect sponsored segments — SponsorBlock uses crowdsourced data (YouTube only), LLM detects from transcript",
        "category": "pipeline",
        "restart_required": False,
    },
    "sponsor_action": {
        "label": "Sponsor Action",
        "default_from_env": lambda: "mark",
        "type": "select",
        "options": ["mark", "skip", "split_out"],
        "description": "What to do with sponsor segments: mark only, skip them when splitting, or export as separate clips",
        "category": "pipeline",
        "restart_required": False,
    },
    "downloads_dir": {
        "label": "Video Library Path",
        "default_from_env": lambda: str(env_settings.downloads_dir),
        "type": "string",
        "description": "Absolute path to your video library inside the container",
        "category": "paths",
        "restart_required": False,
        "placeholder": "/path/to/your/videos",
    },
    "segments_dir": {
        "label": "Output Directory",
        "default_from_env": lambda: str(env_settings.segments_dir),
        "type": "string",
        "description": "Where split clip files are saved (must be an accessible path inside the container)",
        "category": "paths",
        "restart_required": False,
        "placeholder": "/segments",
    },
}


async def is_setup_complete(db: AsyncSession) -> dict:
    """Check if the minimum required settings are configured and valid."""
    checks = {}

    # Check downloads_dir
    downloads = await get_setting(db, "downloads_dir")
    from pathlib import Path
    downloads_path = Path(downloads)
    checks["downloads_dir"] = {
        "configured": True,
        "valid": downloads_path.exists() and downloads_path.is_dir(),
        "value": downloads,
        "message": "Directory exists" if downloads_path.exists() else "Directory not found — set the path to your video library",
    }

    # Check Ollama connectivity
    ollama_url = await get_setting(db, "ollama_url")
    checks["ollama_url"] = {
        "configured": bool(ollama_url),
        "valid": False,  # Will be tested
        "value": ollama_url,
        "message": "Not tested yet",
    }
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ollama_url}/")
            checks["ollama_url"]["valid"] = resp.status_code == 200
            checks["ollama_url"]["message"] = "Connected" if resp.status_code == 200 else f"HTTP {resp.status_code}"
    except Exception as e:
        checks["ollama_url"]["message"] = f"Cannot connect — check the URL ({e})"

    all_valid = all(c["valid"] for c in checks.values())
    return {"ready": all_valid, "checks": checks}


async def get_all_settings(db: AsyncSession) -> dict[str, dict]:
    """Get all settings with their current values, defaults, and metadata."""
    db_settings = {}
    result = await db.execute(select(Setting))
    for s in result.scalars().all():
        db_settings[s.key] = s.value

    output = {}
    for key, defn in SETTING_DEFINITIONS.items():
        env_default = defn["default_from_env"]()
        db_value = db_settings.get(key)
        output[key] = {
            "key": key,
            "label": defn.get("label", key),
            "value": db_value if db_value is not None else env_default,
            "env_default": env_default,
            "is_overridden": db_value is not None,
            "type": defn["type"],
            "description": defn["description"],
            "category": defn["category"],
            "restart_required": defn.get("restart_required", False),
            "readonly": defn.get("readonly", False),
            "options": defn.get("options"),
            "placeholder": defn.get("placeholder"),
        }
    return output


async def get_setting(db: AsyncSession, key: str) -> str:
    """Get a single setting value (DB override or env default)."""
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        return setting.value

    defn = SETTING_DEFINITIONS.get(key)
    if defn:
        return defn["default_from_env"]()
    raise KeyError(f"Unknown setting: {key}")


async def update_setting(db: AsyncSession, key: str, value: str) -> dict:
    """Update a setting in the database."""
    defn = SETTING_DEFINITIONS.get(key)
    if not defn:
        raise KeyError(f"Unknown setting: {key}")
    if defn.get("readonly"):
        raise ValueError(f"Setting '{key}' is read-only (configured via Docker volume mount)")

    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()

    if setting:
        setting.value = value
    else:
        setting = Setting(
            key=key,
            value=value,
            description=defn["description"],
        )
        db.add(setting)

    await db.commit()
    logger.info("Setting updated: %s = %s", key, value)

    return {
        "key": key,
        "value": value,
        "restart_required": defn.get("restart_required", False),
    }


async def reset_setting(db: AsyncSession, key: str) -> dict:
    """Remove DB override, reverting to env default."""
    defn = SETTING_DEFINITIONS.get(key)
    if not defn:
        raise KeyError(f"Unknown setting: {key}")

    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        await db.delete(setting)
        await db.commit()

    return {
        "key": key,
        "value": defn["default_from_env"](),
        "reset": True,
    }


def get_setting_sync(db: Session, key: str) -> str:
    """Sync version for Celery workers."""
    setting = db.execute(select(Setting).where(Setting.key == key)).scalar_one_or_none()
    if setting:
        return setting.value
    defn = SETTING_DEFINITIONS.get(key)
    if defn:
        return defn["default_from_env"]()
    raise KeyError(f"Unknown setting: {key}")
