"""
Saved scenario CRUD.

Scenarios are stored as individual JSON files under server/scenarios/.
Each file is named {uuid}.json.

This endpoint is gated by a feature flag in the UI (disabled by default).
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

SCENARIOS_DIR = Path(__file__).parent.parent / "scenarios"


@router.get("/api/scenarios")
async def list_scenarios():
    SCENARIOS_DIR.mkdir(exist_ok=True)
    scenarios = []
    for f in sorted(SCENARIOS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text())
            scenarios.append({
                "id":          data.get("id"),
                "name":        data.get("name"),
                "createdAt":   data.get("createdAt"),
                "region":      data.get("region"),
                "instanceCount": len(data.get("changes", [])),
                "totalDeltaMonthly": data.get("totalDeltaMonthly"),
            })
        except Exception:
            pass
    return {"scenarios": scenarios}


@router.post("/api/scenarios")
async def save_scenario(body: dict):
    SCENARIOS_DIR.mkdir(exist_ok=True)
    scenario_id = str(uuid.uuid4())
    payload = {
        "id":               scenario_id,
        "name":             body.get("name", "Unnamed scenario"),
        "createdAt":        datetime.now(timezone.utc).isoformat(),
        "region":           body.get("region", "us-east-1"),
        "profile":          body.get("profile", ""),
        "changes":          body.get("changes", []),
        "components":       body.get("components", []),
        "totalDeltaMonthly": body.get("totalDeltaMonthly", 0),
    }
    (SCENARIOS_DIR / f"{scenario_id}.json").write_text(json.dumps(payload, indent=2))
    return {"id": scenario_id, "saved": True}


@router.get("/api/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str):
    f = SCENARIOS_DIR / f"{scenario_id}.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Scenario not found")
    return json.loads(f.read_text())


@router.delete("/api/scenarios/{scenario_id}")
async def delete_scenario(scenario_id: str):
    f = SCENARIOS_DIR / f"{scenario_id}.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Scenario not found")
    f.unlink()
    return {"deleted": True}
