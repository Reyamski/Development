"""
RDS Monthly Cost Calculator

Computes current and proposed monthly costs for an RDS instance configuration.
All costs in USD. Monthly hours = 730.

Components:
  - instance   : instance class hourly rate × 730
  - storage    : per-GB-month (type-dependent)
  - iops       : provisioned IOPS monthly charge (io1/io2/gp3 above free baseline)
  - replicas   : each read replica = single-AZ instance + storage
  - backup     : storage above 100 % of allocated GB × $0.095/GB
  - monitoring : PI long-term retention (optional, rough estimate)

RI pricing options returned as a separate grid:
  On-Demand | 1yr No Upfront | 1yr Partial Upfront | 1yr All Upfront |
  3yr No Upfront | 3yr Partial Upfront | 3yr All Upfront
"""
from __future__ import annotations

from typing import Any

import services.pricing_service as ps

HOURS_PER_MONTH = 730.0

RI_OPTIONS = [
    ("1yr", "No Upfront"),
    ("1yr", "Partial Upfront"),
    ("1yr", "All Upfront"),
    ("3yr", "No Upfront"),
    ("3yr", "Partial Upfront"),
    ("3yr", "All Upfront"),
]


def calculate(
    config: dict[str, Any],
    pricing_cache: dict[str, Any],
    components: set[str],
) -> dict[str, Any]:
    """
    config keys:
        instanceClass, engine, storageType, allocatedGB,
        iops, throughputMBps, multiAZ, replicaCount,
        backupRetentionDays, piEnabled, piRetentionDays

    components: set of enabled cost keys, e.g.
        {"instance", "storage", "iops", "backup", "monitoring"}

    Returns:
        {
          line_items: [{label, monthly}],
          total_monthly: float,
          ri_grid: [{term, option, monthly_equiv, upfront, savings_vs_od_pct}],
          od_monthly_instance_only: float,  // for RI savings % calc
        }
    """
    instance_class   = config.get("instanceClass", "")
    engine           = config.get("engine", "mysql")
    storage_type     = config.get("storageType", "gp2")
    allocated_gb     = float(config.get("allocatedGB",      0))
    iops             = int(config.get("iops",               0))
    throughput_mbps  = float(config.get("throughputMBps",   0))
    multi_az         = bool(config.get("multiAZ",           False))
    replica_count    = int(config.get("replicaCount",       0))
    backup_days      = int(config.get("backupRetentionDays",0))
    pi_enabled       = bool(config.get("piEnabled",         False))
    pi_retention     = int(config.get("piRetentionDays",    7))

    line_items: list[dict] = []
    total = 0.0

    # ── Instance ──────────────────────────────────────────────────
    od_hourly = ps.lookup_od_hourly(pricing_cache, instance_class, engine, multi_az)
    instance_monthly = 0.0
    if "instance" in components:
        if od_hourly is not None:
            instance_monthly = round(od_hourly * HOURS_PER_MONTH, 2)
        line_items.append({"label": f"Instance ({instance_class}, {'Multi-AZ' if multi_az else 'Single-AZ'})",
                           "monthly": instance_monthly})
        total += instance_monthly

    od_monthly_instance_only = round((od_hourly or 0) * HOURS_PER_MONTH, 2)

    # ── Storage ───────────────────────────────────────────────────
    if "storage" in components:
        storage_monthly = _storage_cost(storage_type, allocated_gb, iops, throughput_mbps,
                                        multi_az, pricing_cache)
        line_items.append({"label": f"Storage ({storage_type}, {int(allocated_gb)} GB{'  Multi-AZ ×2' if multi_az and storage_type != 'aurora' else ''})",
                           "monthly": storage_monthly})
        total += storage_monthly

    # ── IOPS (separate line for io1/io2/gp3 above free baseline) ─
    if "iops" in components:
        iops_monthly = _iops_cost(storage_type, iops, throughput_mbps, pricing_cache)
        if iops_monthly > 0:
            line_items.append({"label": f"Provisioned IOPS ({iops:,})", "monthly": iops_monthly})
            total += iops_monthly

    # ── Read replicas ─────────────────────────────────────────────
    if "replicas" in components and replica_count > 0:
        # Each replica is billed as a single-AZ instance + storage
        rep_od_hourly = ps.lookup_od_hourly(pricing_cache, instance_class, engine, False)
        rep_instance  = round((rep_od_hourly or 0) * HOURS_PER_MONTH, 2)
        rep_storage   = _storage_cost(storage_type, allocated_gb, iops, throughput_mbps,
                                      False, pricing_cache)
        rep_monthly   = round((rep_instance + rep_storage) * replica_count, 2)
        line_items.append({"label": f"Read Replicas (×{replica_count})", "monthly": rep_monthly})
        total += rep_monthly

    # ── Backup storage ────────────────────────────────────────────
    if "backup" in components and backup_days > 0:
        backup_monthly = _backup_cost(allocated_gb, backup_days, pricing_cache)
        if backup_monthly > 0:
            line_items.append({"label": f"Backup Storage (retention {backup_days}d)", "monthly": backup_monthly})
            total += backup_monthly

    # ── Performance Insights long-term retention ──────────────────
    if "monitoring" in components and pi_enabled and pi_retention > 7:
        vcpu = ps.lookup_vcpu(pricing_cache, instance_class, engine)
        pi_monthly = round(vcpu * ps.PI_RATE_PER_VCPU_HOUR * HOURS_PER_MONTH, 2)
        line_items.append({"label": f"Performance Insights (>{pi_retention}d retention)", "monthly": pi_monthly})
        total += pi_monthly

    total = round(total, 2)

    # ── RI pricing grid ───────────────────────────────────────────
    ri_grid = []
    for term, option in RI_OPTIONS:
        ri = ps.lookup_ri(pricing_cache, instance_class, engine, multi_az, term, option)
        if ri:
            ri_monthly = ri["monthly_equivalent"]
            # RI covers instance cost only; add storage/iops/etc back on top
            non_instance = round(total - instance_monthly, 2)
            effective_total = round(ri_monthly + non_instance, 2)
            savings_pct = (
                round((1 - ri_monthly / od_monthly_instance_only) * 100, 1)
                if od_monthly_instance_only > 0 else 0
            )
            ri_grid.append({
                "term":          term,
                "option":        option,
                "ri_monthly":    round(ri_monthly, 2),
                "upfront":       ri["upfront"],
                "effective_total_monthly": effective_total,
                "savings_pct":   savings_pct,
            })

    return {
        "lineItems":             line_items,
        "totalMonthly":          total,
        "totalAnnual":           round(total * 12, 2),
        "riGrid":                ri_grid,
        "odMonthlyInstanceOnly": od_monthly_instance_only,
    }


def compare(
    current: dict[str, Any],
    proposed: dict[str, Any],
    pricing_cache: dict[str, Any],
    components: set[str],
) -> dict[str, Any]:
    """
    Returns both cost breakdowns plus a delta summary.
    """
    current_cost  = calculate(current,  pricing_cache, components)
    proposed_cost = calculate(proposed, pricing_cache, components)

    delta_monthly = round(proposed_cost["totalMonthly"] - current_cost["totalMonthly"], 2)
    delta_annual  = round(delta_monthly * 12, 2)
    delta_pct     = (
        round(delta_monthly / current_cost["totalMonthly"] * 100, 1)
        if current_cost["totalMonthly"] else 0
    )

    return {
        "current":      current_cost,
        "proposed":     proposed_cost,
        "deltaMonthly": delta_monthly,
        "deltaAnnual":  delta_annual,
        "deltaPct":     delta_pct,
    }


# ─────────────────────────────────────────────────────────────────
# Storage cost helpers
# ─────────────────────────────────────────────────────────────────

def _storage_cost(
    storage_type: str,
    gb: float,
    iops: int,
    throughput_mbps: float,
    multi_az: bool,
    pricing_cache: dict,
) -> float:
    rates = pricing_cache.get("storage", ps.STORAGE_RATES)
    az_mult = 2.0 if multi_az and storage_type not in ("aurora",) else 1.0

    st = storage_type.lower()
    if st == "gp2":
        r = rates.get("gp2", {})
        return round(gb * r.get("per_gb_month", 0.115) * az_mult, 2)

    if st == "gp3":
        r = rates.get("gp3", {})
        return round(gb * r.get("per_gb_month", 0.115) * az_mult, 2)
        # Note: gp3 IOPS above 3000 handled in _iops_cost

    if st == "io1":
        r = rates.get("io1", {})
        return round(gb * r.get("per_gb_month", 0.125) * az_mult, 2)

    if st == "io2":
        r = rates.get("io2", {})
        return round(gb * r.get("per_gb_month", 0.125) * az_mult, 2)

    if st == "aurora":
        r = rates.get("aurora", {})
        return round(gb * r.get("per_gb_month", 0.10), 2)

    # magnetic / standard
    r = rates.get("magnetic", {})
    return round(gb * r.get("per_gb_month", 0.10) * az_mult, 2)


def _iops_cost(
    storage_type: str,
    iops: int,
    throughput_mbps: float,
    pricing_cache: dict,
) -> float:
    """Returns additional IOPS/throughput cost (above free baselines)."""
    rates = pricing_cache.get("storage", ps.STORAGE_RATES)
    st = storage_type.lower()

    if st == "gp3":
        r       = rates.get("gp3", {})
        base_i  = r.get("included_iops",                3000)
        base_t  = r.get("included_throughput_mbps",      125)
        rate_i  = r.get("per_extra_iops_month",         0.02)
        rate_t  = r.get("per_extra_throughput_month",   0.04)
        extra_i = max(0, iops - base_i)
        extra_t = max(0, throughput_mbps - base_t)
        return round(extra_i * rate_i + extra_t * rate_t, 2)

    if st == "io1":
        r = rates.get("io1", {})
        return round(iops * r.get("per_iops_month", 0.10), 2)

    if st == "io2":
        r  = rates.get("io2", {})
        t1 = r.get("t1_limit", 32_000)
        t2 = r.get("t2_limit", 64_000)
        r1 = r.get("per_iops_month_t1", 0.10)
        r2 = r.get("per_iops_month_t2", 0.065)
        r3 = r.get("per_iops_month_t3", 0.046)
        cost  = min(iops, t1)            * r1
        cost += max(0, min(iops, t2) - t1) * r2
        cost += max(0, iops - t2)          * r3
        return round(cost, 2)

    return 0.0


def _backup_cost(allocated_gb: float, retention_days: int, pricing_cache: dict) -> float:
    """
    Backup storage is free up to 100 % of provisioned DB size.
    Rough estimate: assume backups consume retention_days/30 × allocated_gb total,
    then subtract the free 100 % tier.
    """
    rate = pricing_cache.get("backup_per_gb", ps.BACKUP_RATE_PER_GB)
    estimated_backup_gb = allocated_gb * (retention_days / 30)
    billable = max(0.0, estimated_backup_gb - allocated_gb)
    return round(billable * rate, 2)
