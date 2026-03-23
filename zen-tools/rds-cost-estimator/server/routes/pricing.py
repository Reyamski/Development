"""Pricing cache management routes."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

import services.pricing_service as ps

router = APIRouter()


@router.get("/api/pricing/cache")
async def cache_info(region: str = "us-east-1"):
    return ps.get_cache_info(region)


@router.get("/api/pricing/refresh/stream")
async def refresh_pricing(profile: str, region: str = "us-east-1"):
    """SSE stream — yields progress events then a 'done' event."""
    return StreamingResponse(
        ps.refresh_pricing(profile, region),
        media_type="text/event-stream",
    )


@router.get("/api/pricing/instance-classes")
async def instance_classes(region: str = "us-east-1"):
    cache = ps.load_cache(region)
    if not cache:
        return {"classes": [], "error": "No pricing cache. Run a refresh first."}
    return {"classes": ps.get_available_instance_classes(cache)}
