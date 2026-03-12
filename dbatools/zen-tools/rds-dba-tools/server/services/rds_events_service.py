"""
Fetch RDS events relevant to performance degradation and system outages.

Uses describe_events with categories tied to availability, failure,
failover, maintenance, recovery, and configuration changes.
"""
from __future__ import annotations

import asyncio
from datetime import datetime

from utils.aws import get_aws_session

# Event categories we care about for operational / performance analysis.
# "configuration change" is included because param group or option group
# changes can directly cause performance shifts.
RELEVANT_CATEGORIES: set[str] = {
    "availability",
    "failure",
    "failover",
    "maintenance",
    "notification",
    "read replica",
    "recovery",
    "restoration",
    "configuration change",
}

# Map categories → severity for UI colour-coding
_SEVERITY_MAP: dict[str, str] = {
    "failure":   "critical",
    "failover":  "critical",
    "availability": "warning",
    "recovery":  "warning",
    "restoration": "warning",
    "read replica": "warning",
    "maintenance": "info",
    "configuration change": "info",
    "notification": "info",
}


async def fetch_rds_events(
    profile: str,
    region: str,
    instance_ids: list[str],
    from_dt: datetime,
    to_dt: datetime,
) -> list[dict]:
    """
    Returns all relevant RDS events across the given instances, sorted by time.
    Runs per-instance lookups concurrently.
    """
    session = get_aws_session(profile, region)
    rds = session.client("rds")

    tasks = [
        asyncio.to_thread(_fetch_for_instance, rds, iid, from_dt, to_dt)
        for iid in instance_ids
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_events: list[dict] = []
    for iid, res in zip(instance_ids, results):
        if isinstance(res, Exception):
            all_events.append({
                "instance": iid,
                "date": from_dt.isoformat(),
                "message": f"Could not fetch events: {res}",
                "categories": [],
                "severity": "info",
            })
        else:
            all_events.extend(res)

    all_events.sort(key=lambda e: e["date"])
    return all_events


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _fetch_for_instance(rds, instance_id: str, from_dt: datetime, to_dt: datetime) -> list[dict]:
    events: list[dict] = []
    paginator = rds.get_paginator("describe_events")

    for page in paginator.paginate(
        SourceIdentifier=instance_id,
        SourceType="db-instance",
        StartTime=from_dt,
        EndTime=to_dt,
    ):
        for ev in page.get("Events", []):
            cats: list[str] = ev.get("EventCategories", [])
            if not any(c in RELEVANT_CATEGORIES for c in cats):
                continue

            severity = _classify_severity(cats, ev.get("Message", ""))
            events.append({
                "instance": instance_id,
                "date": ev["Date"].isoformat(),
                "message": ev.get("Message", ""),
                "categories": cats,
                "severity": severity,
            })

    return events


def _classify_severity(cats: list[str], message: str) -> str:
    msg_lower = message.lower()
    # Escalate based on message content even if category is mild
    if any(w in msg_lower for w in ("error", "fail", "crash", "abort", "unavailable")):
        return "critical"
    for cat in cats:
        sev = _SEVERITY_MAP.get(cat)
        if sev == "critical":
            return "critical"
    for cat in cats:
        sev = _SEVERITY_MAP.get(cat)
        if sev == "warning":
            return "warning"
    return "info"
