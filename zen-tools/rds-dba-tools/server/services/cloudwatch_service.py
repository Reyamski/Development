"""
CloudWatch + Performance Insights metric fetching for RDS instances.

Metric groups are returned as structured data for Chart.js rendering.
Timer values from PI are in seconds (already normalized by AWS SDK).
CW latency metrics are in seconds — multiplied by 1000 for ms display.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from utils.aws import get_aws_session

# ---------------------------------------------------------------------------
# CloudWatch metric group definitions
# Each metric maps to a CloudWatch MetricName under namespace AWS/RDS.
# ---------------------------------------------------------------------------
CW_GROUPS: list[dict] = [
    {
        "id": "iops",
        "title": "IOPS (Read / Write)",
        "yLabel": "ops/s",
        "metrics": [
            {"id": "readiops",  "name": "ReadIOPS",  "label": "Read IOPS",  "color": "#60a5fa"},
            {"id": "writeiops", "name": "WriteIOPS", "label": "Write IOPS", "color": "#f87171"},
        ],
    },
    {
        "id": "latency",
        "title": "Latency (Read / Write)",
        "yLabel": "ms",
        "metrics": [
            {"id": "readlat",  "name": "ReadLatency",  "label": "Read (ms)",  "color": "#60a5fa", "scale": 1000},
            {"id": "writelat", "name": "WriteLatency", "label": "Write (ms)", "color": "#f87171", "scale": 1000},
        ],
    },
    {
        "id": "cpu_queue",
        "title": "CPU % & Disk Queue Depth",
        "yLabel": "%",
        "y2Label": "depth",
        "metrics": [
            {"id": "cpu",   "name": "CPUUtilization", "label": "CPU %",       "color": "#34d399"},
            {"id": "diskq", "name": "DiskQueueDepth", "label": "Disk Queue",  "color": "#fbbf24", "yAxisID": "y2"},
        ],
    },
    {
        "id": "connections",
        "title": "Database Connections",
        "yLabel": "count",
        "metrics": [
            {"id": "conns", "name": "DatabaseConnections", "label": "Connections", "color": "#a78bfa"},
        ],
    },
    {
        "id": "deadlocks",
        "title": "Deadlocks",
        "yLabel": "count/min",
        "metrics": [
            {"id": "deadlocks", "name": "Deadlocks", "label": "Deadlocks", "color": "#ef4444"},
        ],
    },
    {
        "id": "storage",
        "title": "Free Storage & Memory",
        "yLabel": "GB",
        "metrics": [
            {"id": "freestorage", "name": "FreeStorageSpace", "label": "Free Storage (GB)", "color": "#34d399", "scale": 1 / (1024 ** 3)},
            {"id": "freemem",    "name": "FreeableMemory",    "label": "Free Memory (GB)",  "color": "#818cf8", "scale": 1 / (1024 ** 3)},
        ],
    },
]

# ---------------------------------------------------------------------------
# Performance Insights counter metric groups (MySQL)
# Metric names use the RDS PI counter format: db.<group>.<counter>.<stat>
# ---------------------------------------------------------------------------
PI_GROUPS: list[dict] = [
    {
        "id": "threads",
        "title": "Threads Running",
        "yLabel": "threads",
        "metrics": [
            {"id": "threads_running", "metric": "db.Users.Threads_running.avg", "label": "Threads Running", "color": "#818cf8"},
        ],
    },
    {
        "id": "sql_ops",
        "title": "SQL Operations / sec",
        "yLabel": "ops/s",
        "metrics": [
            {"id": "selects", "metric": "db.SQL.Com_select.avg", "label": "SELECTs/s", "color": "#60a5fa"},
            {"id": "inserts", "metric": "db.SQL.Com_insert.avg", "label": "INSERTs/s", "color": "#34d399"},
            {"id": "updates", "metric": "db.SQL.Com_update.avg", "label": "UPDATEs/s", "color": "#fbbf24"},
            {"id": "deletes", "metric": "db.SQL.Com_delete.avg", "label": "DELETEs/s", "color": "#f87171"},
        ],
    },
    {
        "id": "locking",
        "title": "Lock Waits / sec",
        "yLabel": "waits/s",
        "metrics": [
            {"id": "lockwaits", "metric": "db.Locks.innodb_row_lock_waits.avg", "label": "Row Lock Waits/s", "color": "#fb923c"},
        ],
    },
    {
        "id": "slow_queries",
        "title": "Slow Queries / sec",
        "yLabel": "queries/s",
        "metrics": [
            {"id": "slow", "metric": "db.SQL.Slow_queries.avg", "label": "Slow Queries/s", "color": "#f43f5e"},
        ],
    },
    {
        "id": "db_load",
        "title": "DB Load (Active Sessions)",
        "yLabel": "sessions",
        "metrics": [
            {"id": "load", "metric": "db.load.avg", "label": "Active Sessions", "color": "#c084fc"},
        ],
    },
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def fetch_instance_metrics(
    profile: str,
    region: str,
    instance_id: str,
    dbi_resource_id: str,
    pi_enabled: bool,
    from_dt: datetime,
    to_dt: datetime,
) -> dict[str, Any]:
    """
    Returns grouped metric data for one RDS instance.
    Runs CloudWatch and (if enabled) Performance Insights queries concurrently.
    """
    session = get_aws_session(profile, region)

    cw_task = asyncio.to_thread(_fetch_cw, session, instance_id, from_dt, to_dt)

    if pi_enabled and dbi_resource_id:
        pi_task = asyncio.to_thread(_fetch_pi, session, region, dbi_resource_id, from_dt, to_dt)
        cw_raw, pi_raw = await asyncio.gather(cw_task, pi_task)
    else:
        cw_raw = await cw_task
        pi_raw = {}

    return {
        "instance": instance_id,
        "piEnabled": pi_enabled,
        "cwGroups": _build_cw_groups(cw_raw),
        "piGroups": _build_pi_groups(pi_raw),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch_cw(session, instance_id: str, from_dt: datetime, to_dt: datetime) -> dict:
    cw = session.client("cloudwatch")
    queries = []
    for grp in CW_GROUPS:
        for m in grp["metrics"]:
            queries.append({
                "Id": f"m_{m['id']}",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/RDS",
                        "MetricName": m["name"],
                        "Dimensions": [{"Name": "DBInstanceIdentifier", "Value": instance_id}],
                    },
                    "Period": 60,
                    "Stat": "Average",
                },
                "ReturnData": True,
            })

    results: dict[str, Any] = {}
    # GetMetricData handles up to 500 queries; paginate just in case
    token = None
    while True:
        kwargs: dict[str, Any] = {
            "MetricDataQueries": queries,
            "StartTime": from_dt,
            "EndTime": to_dt,
            "ScanBy": "TimestampAscending",
        }
        if token:
            kwargs["NextToken"] = token
        resp = cw.get_metric_data(**kwargs)
        for r in resp.get("MetricDataResults", []):
            results[r["Id"]] = {
                "timestamps": [t.isoformat() for t in r["Timestamps"]],
                "values": r["Values"],
            }
        token = resp.get("NextToken")
        if not token:
            break
    return results


def _fetch_pi(session, region: str, dbi_resource_id: str, from_dt: datetime, to_dt: datetime) -> dict:
    pi = session.client("pi", region_name=region)
    metric_queries = [{"Metric": m["metric"]} for grp in PI_GROUPS for m in grp["metrics"]]

    results: dict[str, Any] = {}
    try:
        resp = pi.get_resource_metrics(
            ServiceType="RDS",
            Identifier=dbi_resource_id,
            MetricQueries=metric_queries,
            StartTime=from_dt,
            EndTime=to_dt,
            PeriodInSeconds=60,
        )
        for r in resp.get("MetricList", []):
            key = r["Key"]["Metric"]
            results[key] = {
                "timestamps": [p["Timestamp"].isoformat() for p in r.get("DataPoints", [])],
                "values": [p.get("Value") or 0.0 for p in r.get("DataPoints", [])],
            }
    except Exception as exc:
        results["__error__"] = str(exc)
    return results


def _build_cw_groups(raw: dict) -> list[dict]:
    groups = []
    for grp in CW_GROUPS:
        built_metrics = []
        for m in grp["metrics"]:
            key = f"m_{m['id']}"
            data = raw.get(key, {"timestamps": [], "values": []})
            scale = m.get("scale", 1)
            built_metrics.append({
                "id": m["id"],
                "label": m["label"],
                "color": m["color"],
                "yAxisID": m.get("yAxisID", "y"),
                "timestamps": data["timestamps"],
                "values": [round(v * scale, 4) for v in data["values"]],
            })
        g = {"id": grp["id"], "title": grp["title"], "yLabel": grp.get("yLabel", ""), "metrics": built_metrics}
        if "y2Label" in grp:
            g["y2Label"] = grp["y2Label"]
        groups.append(g)
    return groups


def _build_pi_groups(raw: dict) -> list[dict]:
    if not raw or "__error__" in raw:
        return []
    groups = []
    for grp in PI_GROUPS:
        built_metrics = []
        for m in grp["metrics"]:
            data = raw.get(m["metric"], {"timestamps": [], "values": []})
            built_metrics.append({
                "id": m["id"],
                "label": m["label"],
                "color": m["color"],
                "yAxisID": "y",
                "timestamps": data.get("timestamps", []),
                "values": [round(v, 4) for v in data.get("values", [])],
            })
        groups.append({
            "id": grp["id"],
            "title": grp["title"],
            "yLabel": grp.get("yLabel", ""),
            "metrics": built_metrics,
        })
    return groups
