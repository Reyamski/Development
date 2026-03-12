"""Infrastructure routes — list instances and compute current costs."""
from __future__ import annotations

import configparser
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

import services.cost_calculator as calc
import services.pricing_service as ps
import services.rds_service as rds_svc

router = APIRouter()


class CostRequest(BaseModel):
    profile: str
    region:  str
    components: list[str] = ["instance", "storage", "iops", "replicas"]


@router.get("/api/infra/profiles")
async def list_profiles():
    cfg_path = Path.home() / ".aws" / "config"
    profiles = []
    if cfg_path.exists():
        cfg = configparser.ConfigParser()
        cfg.read(cfg_path)
        for section in cfg.sections():
            if section == "default":
                profiles.append("default")
            elif section.startswith("profile "):
                profiles.append(section[8:])
    return {"profiles": profiles}


@router.get("/api/infra/instances")
async def list_instances(profile: str, region: str):
    try:
        instances = await rds_svc.list_instances(profile, region)

        cache = ps.load_cache(region)
        if cache:
            components = {"instance", "storage", "iops", "replicas", "backup"}
            for inst in instances:
                try:
                    cost = calc.calculate(
                        _inst_to_config(inst), cache, components
                    )
                    inst["currentCost"] = cost
                except Exception as exc:
                    inst["currentCost"] = {"error": str(exc), "totalMonthly": 0}
        else:
            for inst in instances:
                inst["currentCost"] = None

        return {"instances": instances, "pricingCacheExists": cache is not None}
    except Exception as exc:
        err = str(exc)
        sso_expired = "token" in err.lower() or "expired" in err.lower() or "sso" in err.lower()
        return {"instances": [], "error": err, "ssoExpired": sso_expired}


@router.post("/api/infra/estimate")
async def estimate_cost(body: dict):
    """
    body:
      profile, region, current: {...}, proposed: {...}, components: [...]
    """
    profile    = body.get("profile", "")
    region     = body.get("region",  "us-east-1")
    current    = body.get("current",  {})
    proposed   = body.get("proposed", {})
    components = set(body.get("components", ["instance", "storage", "iops", "replicas"]))

    cache = ps.load_cache(region)
    if not cache:
        return {"error": "No pricing cache found. Please refresh pricing first."}

    try:
        result = calc.compare(current, proposed, cache, components)
        return result
    except Exception as exc:
        return {"error": str(exc)}


@router.post("/api/infra/estimate-batch")
async def estimate_batch(body: dict):
    """
    body:
      profile, region, instances: [{current, proposed}], components: [...]
    Returns list of compare results in same order.
    """
    region     = body.get("region", "us-east-1")
    items      = body.get("instances", [])
    components = set(body.get("components", ["instance", "storage", "iops", "replicas"]))

    cache = ps.load_cache(region)
    if not cache:
        return {"error": "No pricing cache found. Please refresh pricing first."}

    results = []
    total_delta = 0.0
    for item in items:
        try:
            r = calc.compare(item["current"], item["proposed"], cache, components)
            results.append({"instanceId": item.get("instanceId"), **r})
            total_delta += r["deltaMonthly"]
        except Exception as exc:
            results.append({"instanceId": item.get("instanceId"), "error": str(exc)})

    return {
        "results":          results,
        "totalDeltaMonthly": round(total_delta, 2),
        "totalDeltaAnnual":  round(total_delta * 12, 2),
    }


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _inst_to_config(inst: dict) -> dict:
    return {
        "instanceClass":      inst.get("instanceClass", ""),
        "engine":             inst.get("engine", "mysql"),
        "storageType":        inst.get("storageType", "gp2"),
        "allocatedGB":        inst.get("allocatedGB", 0),
        "iops":               inst.get("iops", 0),
        "throughputMBps":     inst.get("throughputMBps", 0),
        "multiAZ":            inst.get("multiAZ", False),
        "replicaCount":       inst.get("replicaCount", 0),
        "backupRetentionDays": inst.get("backupRetentionDays", 0),
        "piEnabled":          inst.get("piEnabled", False),
        "piRetentionDays":    inst.get("piRetentionDays", 7),
    }
