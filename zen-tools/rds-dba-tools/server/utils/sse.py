import json
from typing import Any


def sse_event(data: Any, event: str | None = None) -> str:
    """Format a single SSE message."""
    payload = json.dumps(data)
    lines: list[str] = []
    if event:
        lines.append(f"event: {event}")
    lines.append(f"data: {payload}")
    lines.append("")
    lines.append("")
    return "\n".join(lines)


def sse_keepalive() -> str:
    return ": keepalive\n\n"
