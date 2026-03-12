"""
RDS infrastructure discovery.

Fetches all RDS instances (MySQL, Aurora MySQL, Aurora PostgreSQL) and
DocumentDB cluster members, along with active Reserved Instance coverage.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from utils.aws import get_aws_session


async def list_instances(profile: str, region: str) -> list[dict[str, Any]]:
    """Return all RDS instances + DocDB cluster members with normalised config."""
    session = get_aws_session(profile, region)
    rds = session.client("rds")

    rds_task   = asyncio.to_thread(_fetch_rds_instances, rds)
    docdb_task = asyncio.to_thread(_fetch_docdb_instances, rds)
    ri_task    = asyncio.to_thread(_fetch_active_ris, rds)

    rds_instances, docdb_instances, ri_map = await asyncio.gather(rds_task, docdb_task, ri_task)

    all_instances = rds_instances + docdb_instances

    # Attach RI coverage
    for inst in all_instances:
        ri = _match_ri(inst, ri_map)
        inst["riCoverage"] = ri

    return all_instances


async def get_ri_coverage(profile: str, region: str) -> dict[str, Any]:
    """Return active RI map: {offering_id: ri_detail}"""
    session = get_aws_session(profile, region)
    rds = session.client("rds")
    return await asyncio.to_thread(_fetch_active_ris, rds)


# ─────────────────────────────────────────────────────────────────
# Internal fetchers
# ─────────────────────────────────────────────────────────────────

def _fetch_rds_instances(rds) -> list[dict]:
    instances = []
    paginator = rds.get_paginator("describe_db_instances")
    for page in paginator.paginate():
        for db in page.get("DBInstances", []):
            engine = db.get("Engine", "").lower()
            if not _is_supported_engine(engine):
                continue
            instances.append(_normalise_rds(db))
    return instances


def _fetch_docdb_instances(rds) -> list[dict]:
    """DocDB cluster members are returned by describe_db_instances with engine=docdb."""
    instances = []
    try:
        paginator = rds.get_paginator("describe_db_instances")
        for page in paginator.paginate(
            Filters=[{"Name": "engine", "Values": ["docdb"]}]
        ):
            for db in page.get("DBInstances", []):
                instances.append(_normalise_rds(db))
    except Exception:
        pass
    return instances


def _fetch_active_ris(rds) -> list[dict]:
    """Return list of active reserved instances."""
    ris = []
    try:
        paginator = rds.get_paginator("describe_reserved_db_instances")
        for page in paginator.paginate(Filters=[{"Name": "state", "Values": ["active"]}]):
            for ri in page.get("ReservedDBInstances", []):
                start = ri.get("StartTime")
                duration_secs = ri.get("Duration", 0)
                months_remaining = None
                if start and duration_secs:
                    end_ts = start.timestamp() + duration_secs
                    now_ts = datetime.now(timezone.utc).timestamp()
                    months_remaining = max(0, round((end_ts - now_ts) / (30 * 86400), 1))

                ris.append({
                    "reservedId":        ri.get("ReservedDBInstanceId"),
                    "instanceClass":     ri.get("DBInstanceClass"),
                    "productDesc":       ri.get("ProductDescription", "").lower(),
                    "multiAZ":           ri.get("MultiAZ", False),
                    "offeringType":      ri.get("OfferingType"),
                    "duration":          ri.get("Duration"),
                    "termLabel":         "1yr" if ri.get("Duration", 0) <= 31_536_001 else "3yr",
                    "count":             ri.get("DBInstanceCount", 1),
                    "state":             ri.get("State"),
                    "monthsRemaining":   months_remaining,
                    "startTime":         start.isoformat() if start else None,
                    "fixedPrice":        ri.get("FixedPrice"),
                    "recurringCharges":  ri.get("RecurringCharges", []),
                })
    except Exception:
        pass
    return ris


# ─────────────────────────────────────────────────────────────────
# Normalisation
# ─────────────────────────────────────────────────────────────────

def _normalise_rds(db: dict) -> dict[str, Any]:
    engine = db.get("Engine", "").lower()

    # Storage details
    storage_type  = db.get("StorageType", "gp2")
    allocated_gb  = db.get("AllocatedStorage", 0)
    iops          = db.get("Iops") or 0
    throughput    = db.get("StorageThroughput") or 0
    multi_az      = db.get("MultiAZ", False)

    # Replica count: number of read replicas pointing to this primary
    replica_ids = db.get("ReadReplicaDBInstanceIdentifiers", [])

    # PI / monitoring
    pi_enabled       = db.get("PerformanceInsightsEnabled", False)
    pi_retention     = db.get("PerformanceInsightsRetentionPeriod", 7)
    enhanced_mon_ivl = db.get("MonitoringInterval", 0)

    backup_retention = db.get("BackupRetentionPeriod", 0)

    return {
        "id":              db.get("DBInstanceIdentifier"),
        "arn":             db.get("DBInstanceArn"),
        "engine":          engine,
        "engineVersion":   db.get("EngineVersion", ""),
        "instanceClass":   db.get("DBInstanceClass", ""),
        "status":          db.get("DBInstanceStatus", ""),
        "multiAZ":         multi_az,
        "storageType":     storage_type,
        "allocatedGB":     allocated_gb,
        "iops":            iops,
        "throughputMBps":  throughput,
        "replicaCount":    len(replica_ids),
        "isReplica":       bool(db.get("ReadReplicaSourceDBInstanceIdentifier")),
        "backupRetentionDays": backup_retention,
        "piEnabled":       pi_enabled,
        "piRetentionDays": pi_retention,
        "enhancedMonitoringInterval": enhanced_mon_ivl,
        "availabilityZone": db.get("AvailabilityZone", ""),
        "riCoverage":      None,   # filled in later
    }


def _is_supported_engine(engine: str) -> bool:
    return any(e in engine for e in ("mysql", "aurora", "postgres", "docdb"))


def _match_ri(inst: dict, ri_list: list[dict]) -> dict | None:
    """Find the best-matching active RI for this instance."""
    engine = inst["engine"]
    for ri in ri_list:
        if ri["instanceClass"] != inst["instanceClass"]:
            continue
        if ri["multiAZ"] != inst["multiAZ"]:
            continue
        desc = ri["productDesc"]
        if "aurora" in engine and "aurora" not in desc:
            continue
        if "docdb" in engine and "docdb" not in desc:
            continue
        if engine in ("mysql", "mariadb") and "aurora" in desc:
            continue
        return {
            "term":            ri["termLabel"],
            "offeringType":    ri["offeringType"],
            "monthsRemaining": ri["monthsRemaining"],
            "startTime":       ri["startTime"],
            "count":           ri["count"],
        }
    return None
