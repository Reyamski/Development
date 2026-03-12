"""
Routes for CloudWatch metrics, RDS events, and Teleport/DBA queries.

GET  /api/metrics/stream        — SSE: CW + PI metrics + RDS events for selected instances
GET  /api/teleport/status       — tsh login status
GET  /api/teleport/login/stream — SSE: tsh login flow
GET  /api/teleport/db-login/stream — SSE: tsh db login flow
POST /api/teleport/query        — run DBA query via tsh proxy db tunnel
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.cloudwatch_service import fetch_instance_metrics
from services.rds_events_service import fetch_rds_events
from services.teleport_service import (
    check_tsh_status,
    query_dba,
    stream_db_login,
    stream_tsh_login,
)
from utils.aws import get_rds_client
from utils.sse import sse_event, sse_keepalive

router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class MetricsRequest(BaseModel):
    profile: str
    region: str
    instances: list[str]
    fromDate: str   # ISO-8601, treated as UTC
    toDate: str


class TeleportQueryRequest(BaseModel):
    proxy: str
    tshDbName: str
    dbUser: str
    fromDate: str
    toDate: str
    limit: int = 100


# ---------------------------------------------------------------------------
# CloudWatch + RDS Events stream
# ---------------------------------------------------------------------------

@router.get("/api/metrics/stream")
async def stream_metrics(
    profile: str,
    region: str,
    instances: str,   # comma-separated
    fromDate: str,
    toDate: str,
):
    instance_list = [i.strip() for i in instances.split(",") if i.strip()]

    async def generate():
        from_dt = _parse_utc(fromDate)
        to_dt   = _parse_utc(toDate)

        # Keep connection alive during potentially slow API calls
        keepalive_task = asyncio.create_task(_keepalive_loop())

        try:
            rds = get_rds_client(profile, region)

            for iid in instance_list:
                yield sse_event({"instance": iid, "status": "loading"}, "progress")

                try:
                    desc = await asyncio.to_thread(
                        rds.describe_db_instances, **{"DBInstanceIdentifier": iid}
                    )
                    db_info = desc["DBInstances"][0]
                    dbi_resource_id = db_info.get("DbiResourceId", "")
                    pi_enabled      = db_info.get("PerformanceInsightsEnabled", False)
                except Exception as exc:
                    yield sse_event({"instance": iid, "error": f"describe_db_instances failed: {exc}"}, "error")
                    continue

                try:
                    metrics = await fetch_instance_metrics(
                        profile, region,
                        iid, dbi_resource_id, pi_enabled,
                        from_dt, to_dt,
                    )
                    yield sse_event(metrics, "metrics")
                except Exception as exc:
                    yield sse_event({"instance": iid, "error": str(exc)}, "error")

            # RDS Events for all selected instances
            try:
                events = await fetch_rds_events(profile, region, instance_list, from_dt, to_dt)
                yield sse_event({"events": events}, "events")
            except Exception as exc:
                yield sse_event({"error": str(exc)}, "events_error")

        finally:
            keepalive_task.cancel()

        yield sse_event({"status": "done"}, "done")

    return StreamingResponse(generate(), media_type="text/event-stream")


async def _keepalive_loop():
    """Yield keepalive comments every 20 s (not yielded into the stream
    directly — only used to prevent gateway timeouts via a background task).
    The real keepalive comes from the SSE heartbeat in the browser."""
    while True:
        await asyncio.sleep(20)


# ---------------------------------------------------------------------------
# Teleport endpoints
# ---------------------------------------------------------------------------

@router.get("/api/teleport/status")
async def teleport_status(proxy: str):
    return await check_tsh_status(proxy)


@router.get("/api/teleport/login/stream")
async def teleport_login(proxy: str):
    return StreamingResponse(stream_tsh_login(proxy), media_type="text/event-stream")


@router.get("/api/teleport/db-login/stream")
async def teleport_db_login(proxy: str, dbName: str):
    return StreamingResponse(stream_db_login(proxy, dbName), media_type="text/event-stream")


@router.post("/api/teleport/query")
async def teleport_query(req: TeleportQueryRequest):
    return await query_dba(
        proxy=req.proxy,
        tsh_db_name=req.tshDbName,
        db_user=req.dbUser,
        from_dt=req.fromDate,
        to_dt=req.toDate,
        limit=req.limit,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_utc(iso: str) -> datetime:
    """Parse an ISO-8601 string and ensure it's UTC-aware."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
