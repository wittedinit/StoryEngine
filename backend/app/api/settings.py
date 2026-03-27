from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.settings import get_all_settings, is_setup_complete, reset_setting, update_setting

router = APIRouter(prefix="/settings", tags=["settings"])


class UpdateSettingRequest(BaseModel):
    value: str


@router.get("/setup")
async def setup_status(db: AsyncSession = Depends(get_db)):
    """Check if StoryEngine is configured and ready to process."""
    return await is_setup_complete(db)


@router.get("")
async def list_settings(db: AsyncSession = Depends(get_db)):
    """Get all settings grouped by category."""
    all_settings = await get_all_settings(db)

    # Group by category
    categories: dict[str, list] = {}
    for setting in all_settings.values():
        cat = setting["category"]
        categories.setdefault(cat, []).append(setting)

    return {"settings": all_settings, "categories": categories}


@router.put("/{key}")
async def update_setting_endpoint(
    key: str,
    body: UpdateSettingRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update a setting value."""
    try:
        return await update_setting(db, key, body.value)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown setting: {key}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{key}")
async def reset_setting_endpoint(key: str, db: AsyncSession = Depends(get_db)):
    """Reset a setting to its environment default."""
    try:
        return await reset_setting(db, key)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown setting: {key}")


@router.get("/ollama/models")
async def list_ollama_models(db: AsyncSession = Depends(get_db)):
    """Fetch available models from the configured Ollama instance."""
    from app.services.settings import get_setting
    ollama_url = await get_setting(db, "ollama_url")
    if not ollama_url:
        return {"models": [], "error": "Ollama URL not configured"}

    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models, "connected": True}
    except Exception as e:
        return {"models": [], "connected": False, "error": str(e)}
