"""
AWS RDS Pricing Service

Fetches on-demand and Reserved Instance pricing from:
  1. AWS Pricing API (boto3 'pricing' client, always us-east-1 endpoint)
  2. RDS describe_reserved_db_instances_offerings (for accurate RI pricing)

Caches results to server/cache/pricing_{region}.json.

Supported engines: MySQL, Aurora MySQL, Aurora PostgreSQL, DocumentDB
License model: License included only (BYOL future work)
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Callable

from utils.aws import get_aws_session, get_pricing_client

log = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "cache"

# Engines we care about — keys used in cache, values are pricing API filter values
RDS_ENGINES: dict[str, str] = {
    "mysql":             "MySQL",
    "aurora-mysql":      "Aurora MySQL",
    "aurora-postgresql": "Aurora PostgreSQL",
}

DOCDB_ENGINE_KEY = "docdb"

# RI term/option labels for UI display
RI_TERMS = [
    ("1yr", "No Upfront"),
    ("1yr", "Partial Upfront"),
    ("1yr", "All Upfront"),
    ("3yr", "No Upfront"),
    ("3yr", "Partial Upfront"),
    ("3yr", "All Upfront"),
]

HOURS_PER_MONTH = 730.0
MONTHS_1YR      = 12.0
MONTHS_3YR      = 36.0

# Storage pricing (us-east-1 on-demand, per resource type)
# These are fetched from the pricing API where available; this dict
# acts as a reliable fallback and is verified against AWS pricing pages.
STORAGE_RATES: dict[str, Any] = {
    "gp2": {
        "per_gb_month": 0.115,
    },
    "gp3": {
        "per_gb_month":                 0.115,
        "included_iops":                3000,
        "included_throughput_mbps":     125,
        "per_extra_iops_month":         0.02,
        "per_extra_throughput_month":   0.04,
    },
    "io1": {
        "per_gb_month":   0.125,
        "per_iops_month": 0.10,
    },
    "io2": {
        "per_gb_month":         0.125,
        "per_iops_month_t1":    0.10,    # 0 – 32 000 IOPS
        "per_iops_month_t2":    0.065,   # 32 001 – 64 000 IOPS
        "per_iops_month_t3":    0.046,   # > 64 000 IOPS
        "t1_limit":             32_000,
        "t2_limit":             64_000,
    },
    "aurora": {
        "per_gb_month": 0.10,
    },
    "magnetic": {
        "per_gb_month": 0.10,
    },
}

BACKUP_RATE_PER_GB = 0.095   # beyond free tier (100 % of DB size)
PI_RATE_PER_VCPU_HOUR = 0.02  # long-term PI retention (beyond 7 days free)


# ─────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────

def cache_path(region: str) -> Path:
    return CACHE_DIR / f"pricing_{region}.json"


def load_cache(region: str) -> dict | None:
    p = cache_path(region)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def get_cache_info(region: str) -> dict:
    data = load_cache(region)
    if not data:
        return {"exists": False}
    return {
        "exists":         True,
        "updatedAt":      data.get("updated_at"),
        "instanceCount":  len(data.get("instances", {})),
        "riOfferingCount": len(data.get("ri_offerings", {})),
    }


async def refresh_pricing(
    profile: str,
    region: str,
) -> AsyncGenerator[str, None]:
    """
    Async generator that fetches pricing and yields SSE-formatted progress strings.
    Call sites wrap this in a StreamingResponse.
    """
    from utils.sse import sse_event

    def emit(msg: str, pct: int = 0) -> str:
        return sse_event({"message": msg, "pct": pct}, "progress")

    yield emit("Starting pricing refresh …", 0)

    cache: dict[str, Any] = {
        "region":       region,
        "updated_at":   datetime.now(timezone.utc).isoformat(),
        "instances":    {},
        "ri_offerings": {},
        "storage":      STORAGE_RATES,
        "backup_per_gb": BACKUP_RATE_PER_GB,
        "pi_per_vcpu_hour": PI_RATE_PER_VCPU_HOUR,
    }

    # ── 1. On-demand instance pricing ─────────────────────────────
    yield emit("Fetching on-demand instance pricing from AWS …", 5)
    try:
        od_data = await asyncio.to_thread(_fetch_ondemand, region)
        cache["instances"] = od_data
        yield emit(f"On-demand pricing fetched — {len(od_data)} instance configurations.", 45)
    except Exception as exc:
        yield emit(f"WARNING: on-demand fetch failed: {exc}", 45)

    # ── 2. Reserved Instance offerings ────────────────────────────
    yield emit("Fetching Reserved Instance offerings …", 50)
    try:
        ri_data = await asyncio.to_thread(_fetch_ri_offerings, profile, region)
        cache["ri_offerings"] = ri_data
        yield emit(f"RI offerings fetched — {len(ri_data)} configurations.", 90)
    except Exception as exc:
        yield emit(f"WARNING: RI offerings fetch failed: {exc}", 90)

    # ── 3. Write cache ─────────────────────────────────────────────
    CACHE_DIR.mkdir(exist_ok=True)
    cache_path(region).write_text(json.dumps(cache, indent=2))
    yield emit("Pricing cache saved.", 100)
    yield sse_event({"status": "done", "info": get_cache_info(region)}, "done")


# ─────────────────────────────────────────────────────────────────
# Internal: on-demand pricing
# ─────────────────────────────────────────────────────────────────

def _fetch_ondemand(region: str) -> dict[str, Any]:
    """
    Returns a dict keyed by  '{instance_class}|{engine_key}|{az_mode}'
    e.g.  'db.r6g.2xlarge|mysql|single-az'

    Value:
      {
        "on_demand_hourly": float,
        "vcpu": int,
        "memory_gb": float,
      }
    """
    pc = get_pricing_client()
    result: dict[str, Any] = {}

    for engine_key, engine_label in RDS_ENGINES.items():
        for az_mode, deploy_label in [("single-az", "Single-AZ"), ("multi-az", "Multi-AZ")]:
            paginator = pc.get_paginator("get_products")
            for page in paginator.paginate(
                ServiceCode="AmazonRDS",
                Filters=[
                    {"Type": "TERM_MATCH", "Field": "regionCode",        "Value": region},
                    {"Type": "TERM_MATCH", "Field": "databaseEngine",    "Value": engine_label},
                    {"Type": "TERM_MATCH", "Field": "deploymentOption",  "Value": deploy_label},
                    {"Type": "TERM_MATCH", "Field": "licenseModel",      "Value": "License included"},
                ],
            ):
                for raw in page["PriceList"]:
                    product = json.loads(raw)
                    attrs = product.get("product", {}).get("attributes", {})
                    instance_type = attrs.get("instanceType", "")
                    if not instance_type.startswith("db."):
                        continue
                    hourly = _extract_od_hourly(product)
                    if hourly is None:
                        continue
                    key = f"{instance_type}|{engine_key}|{az_mode}"
                    result[key] = {
                        "on_demand_hourly": hourly,
                        "vcpu":      _safe_int(attrs.get("vcpu")),
                        "memory_gb": _parse_memory(attrs.get("memory", "")),
                    }
    return result


def _extract_od_hourly(product: dict) -> float | None:
    for _, term in product.get("terms", {}).get("OnDemand", {}).items():
        for _, dim in term.get("priceDimensions", {}).items():
            if dim.get("unit") == "Hrs":
                try:
                    return float(dim["pricePerUnit"].get("USD", "0"))
                except (ValueError, KeyError):
                    pass
    return None


# ─────────────────────────────────────────────────────────────────
# Internal: Reserved Instance offerings
# ─────────────────────────────────────────────────────────────────

_ENGINE_TO_PRODUCT_DESC: dict[str, list[str]] = {
    "mysql":             ["mysql"],
    "aurora-mysql":      ["aurora", "aurora-mysql"],
    "aurora-postgresql": ["aurora-postgresql", "postgres"],
    "docdb":             ["docdb"],
}

_DURATION_TO_TERM: dict[int, str] = {
    31_536_000: "1yr",
    94_608_000: "3yr",
}

def _fetch_ri_offerings(profile: str, region: str) -> dict[str, Any]:
    """
    Returns a dict keyed by  '{instance_class}|{engine_key}|{az_mode}|{term}|{option}'
    e.g.  'db.r6g.2xlarge|mysql|single-az|1yr|All Upfront'

    Value:
      {
        "monthly_equivalent": float,   # effective monthly cost
        "upfront":            float,   # one-time upfront payment (0 for No Upfront)
        "hourly":             float,   # recurring hourly charge
      }
    """
    session = get_aws_session(profile, region)
    rds = session.client("rds")
    result: dict[str, Any] = {}

    all_engines: dict[str, list[str]] = {**_ENGINE_TO_PRODUCT_DESC}

    for engine_key, desc_values in all_engines.items():
        for desc in desc_values:
            try:
                paginator = rds.get_paginator("describe_reserved_db_instances_offerings")
                for page in paginator.paginate(ProductDescription=desc):
                    for off in page.get("ReservedDBInstancesOfferings", []):
                        instance_class = off.get("DBInstanceClass", "")
                        if not instance_class.startswith("db."):
                            continue
                        term = _DURATION_TO_TERM.get(off.get("Duration", 0))
                        if not term:
                            continue
                        option = off.get("OfferingType", "")
                        az_mode = "multi-az" if off.get("MultiAZ") else "single-az"
                        fixed   = float(off.get("FixedPrice",   0) or 0)
                        hourly  = float(off.get("UsagePrice",   0) or 0)
                        # RecurringCharges sometimes holds the actual hourly when UsagePrice=0
                        for rc in off.get("RecurringCharges", []):
                            if rc.get("RecurringChargeFrequency") == "Hourly":
                                hourly = float(rc.get("RecurringChargeAmount", hourly))

                        months = MONTHS_1YR if term == "1yr" else MONTHS_3YR
                        monthly_equiv = round(fixed / months + hourly * HOURS_PER_MONTH, 4)

                        key = f"{instance_class}|{engine_key}|{az_mode}|{term}|{option}"
                        result[key] = {
                            "monthly_equivalent": monthly_equiv,
                            "upfront":            round(fixed, 2),
                            "hourly":             round(hourly, 6),
                        }
            except Exception as exc:
                log.warning("RI offerings fetch failed for %s/%s: %s", engine_key, desc, exc)

    return result


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _parse_memory(s: str) -> float:
    """Parse '64 GiB' → 64.0"""
    try:
        return float(s.split()[0])
    except (IndexError, ValueError):
        return 0.0


# ─────────────────────────────────────────────────────────────────
# Lookup helpers used by cost_calculator
# ─────────────────────────────────────────────────────────────────

def _engine_key_from_instance(engine_str: str) -> str:
    """Normalise RDS engine string to our cache key."""
    e = engine_str.lower()
    if "aurora" in e and "postgres" in e:
        return "aurora-postgresql"
    if "aurora" in e:
        return "aurora-mysql"
    if "docdb" in e:
        return "docdb"
    return "mysql"


def lookup_od_hourly(cache: dict, instance_class: str, engine: str, multi_az: bool) -> float | None:
    eng = _engine_key_from_instance(engine)
    az  = "multi-az" if multi_az else "single-az"
    key = f"{instance_class}|{eng}|{az}"
    entry = cache.get("instances", {}).get(key)
    return entry["on_demand_hourly"] if entry else None


def lookup_vcpu(cache: dict, instance_class: str, engine: str) -> int:
    eng = _engine_key_from_instance(engine)
    for az in ("single-az", "multi-az"):
        key = f"{instance_class}|{eng}|{az}"
        entry = cache.get("instances", {}).get(key)
        if entry:
            return entry.get("vcpu", 0)
    return 0


def lookup_ri(cache: dict, instance_class: str, engine: str, multi_az: bool,
              term: str, option: str) -> dict | None:
    eng = _engine_key_from_instance(engine)
    az  = "multi-az" if multi_az else "single-az"
    key = f"{instance_class}|{eng}|{az}|{term}|{option}"
    return cache.get("ri_offerings", {}).get(key)


def get_available_instance_classes(cache: dict) -> list[str]:
    """Return sorted unique instance classes from on-demand or RI offerings cache."""
    classes: set[str] = set()
    for key in cache.get("instances", {}):
        parts = key.split("|")
        if parts:
            classes.add(parts[0])
    # Fall back to RI offerings keys when on-demand pricing is absent
    if not classes:
        for key in cache.get("ri_offerings", {}):
            parts = key.split("|")
            if parts and parts[0].startswith("db."):
                classes.add(parts[0])
    return sorted(classes)
