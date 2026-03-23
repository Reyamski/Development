import asyncio
import re
import threading
from datetime import datetime
from typing import AsyncGenerator

from utils.aws import get_aws_session


def is_sso_token_error(e: Exception) -> bool:
    msg = str(e).lower()
    return "token has expired" in msg or "sso token" in msg or "refreshed" in msg or "ssotoken" in msg


# ──────────────────────────────────────────────
# Filter pattern registry
# ──────────────────────────────────────────────

FILTER_PATTERNS: dict[str, list[re.Pattern]] = {
    "errors": [
        re.compile(p, re.IGNORECASE)
        for p in [r"\bERROR\b", r"\bFATAL\b", r"\bPANIC\b", r"\bCRITICAL\b"]
    ],
    "deadlocks": [
        re.compile(p, re.IGNORECASE)
        for p in [r"Deadlock found", r"deadlock detected", r"DEADLOCK"]
    ],
    "connections": [
        re.compile(p, re.IGNORECASE)
        for p in [
            r"Too many connections",
            r"authentication failed",
            r"Access denied",
            r"max_connections",
        ]
    ],
    "slow_query": [
        re.compile(p, re.IGNORECASE)
        for p in [r"Query_time:", r"Slow query", r"long running query"]
    ],
    "replication": [
        re.compile(p, re.IGNORECASE)
        for p in [
            r"\b(Slave|Replica)\b.*error",
            r"Got fatal error from (master|primary)",
        ]
    ],
    "storage": [
        re.compile(p, re.IGNORECASE)
        for p in [
            r"InnoDB.*error",
            r"disk full",
            r"Out of disk space",
            r"table.*corrupt",
        ]
    ],
}


def apply_filters(entry: dict, filters: list[str]) -> bool:
    if not filters:
        return True
    text = (entry.get("message") or "") + " " + (entry.get("raw") or "")
    for f in filters:
        for pattern in FILTER_PATTERNS.get(f, []):
            if pattern.search(text):
                return True
    return False


# ──────────────────────────────────────────────
# Instance discovery
# ──────────────────────────────────────────────

def list_instances(profile: str | None, region: str) -> list[dict]:
    session = get_aws_session(profile, region)
    rds = session.client("rds")
    results: list[dict] = []

    # Standard RDS instances
    try:
        paginator = rds.get_paginator("describe_db_instances")
        for page in paginator.paginate():
            for db in page["DBInstances"]:
                engine = db["Engine"]
                if engine == "docdb":
                    continue  # handled via clusters below
                results.append({
                    "id": db["DBInstanceIdentifier"],
                    "engine": engine,
                    "engineVersion": db.get("EngineVersion", ""),
                    "status": db.get("DBInstanceStatus", ""),
                    "type": "instance",
                })
    except Exception as e:
        if is_sso_token_error(e):
            return [{"error": f"Could not list RDS instances: {e}", "errorType": "sso_expired"}]
        results.append({"error": f"Could not list RDS instances: {e}"})

    # DocumentDB clusters → member instances
    try:
        paginator = rds.get_paginator("describe_db_clusters")
        for page in paginator.paginate(
            Filters=[{"Name": "engine", "Values": ["docdb"]}]
        ):
            for cluster in page["DBClusters"]:
                for member in cluster.get("DBClusterMembers", []):
                    results.append({
                        "id": member["DBInstanceIdentifier"],
                        "engine": "docdb",
                        "engineVersion": cluster.get("EngineVersion", ""),
                        "status": "available",
                        "type": "docdb-member",
                        "clusterId": cluster["DBClusterIdentifier"],
                    })
    except Exception:
        pass  # DocDB may not be present in all regions

    return results


def get_instance_engine(rds, instance_id: str) -> str:
    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=instance_id)
        return resp["DBInstances"][0]["Engine"]
    except Exception:
        return "mysql"  # safe default


# ──────────────────────────────────────────────
# Log file discovery
# ──────────────────────────────────────────────

def get_log_files(rds, instance_id: str, engine: str, from_ms: int, to_ms: int) -> list[dict]:
    if "postgres" in engine:
        filename_filter = "postgresql"
    else:
        filename_filter = "error"

    files: list[dict] = []
    marker = None
    while True:
        kwargs: dict = {
            "DBInstanceIdentifier": instance_id,
            "FilenameContains": filename_filter,
            "FileLastWritten": from_ms,
        }
        if marker:
            kwargs["Marker"] = marker

        try:
            resp = rds.describe_db_log_files(**kwargs)
        except Exception:
            break

        for f in resp.get("DescribeDBLogFiles", []):
            if f.get("LastWritten", 0) <= to_ms:
                files.append(f)

        if not resp.get("Marker"):
            break
        marker = resp["Marker"]

    return sorted(files, key=lambda f: f.get("LastWritten", 0))


# ──────────────────────────────────────────────
# Log download
# ──────────────────────────────────────────────

def _download_log_file_sync(rds, instance_id: str, log_file_name: str, chunk_queue: asyncio.Queue, loop):
    """Runs in a thread. Downloads all chunks and puts them into the asyncio queue."""
    marker = "0"
    try:
        while True:
            try:
                resp = rds.download_db_log_file_portion(
                    DBInstanceIdentifier=instance_id,
                    LogFileName=log_file_name,
                    Marker=marker,
                    NumberOfLines=1000,
                )
            except Exception as e:
                asyncio.run_coroutine_threadsafe(
                    chunk_queue.put(("error", str(e))), loop
                )
                break

            data = resp.get("LogFileData", "")
            if data:
                asyncio.run_coroutine_threadsafe(
                    chunk_queue.put(("data", data)), loop
                )

            if not resp.get("AdditionalDataPending", False):
                break
            new_marker = resp.get("Marker", "0")
            if new_marker == marker or new_marker == "0":
                break
            marker = new_marker
    finally:
        asyncio.run_coroutine_threadsafe(chunk_queue.put(("done", None)), loop)


async def stream_log_chunks(rds, instance_id: str, log_file_name: str) -> AsyncGenerator[str, None]:
    """Async generator yielding raw log text chunks."""
    loop = asyncio.get_event_loop()
    q: asyncio.Queue = asyncio.Queue()

    thread = threading.Thread(
        target=_download_log_file_sync,
        args=(rds, instance_id, log_file_name, q, loop),
        daemon=True,
    )
    thread.start()

    while True:
        kind, value = await q.get()
        if kind == "done":
            break
        if kind == "data":
            yield value
        # "error" kind is silently swallowed — the generator just ends


# ──────────────────────────────────────────────
# Log parsing
# ──────────────────────────────────────────────

# MySQL/Aurora/DocDB: 2024-01-15T10:23:45.123456Z 42 [ERROR] [MY-010058] [Server] msg
MYSQL_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|UTC)?)"
    r"\s+\d+\s+\[(\w+)\]"
    r"(?:\s+\[[\w-]+\])?"
    r"(?:\s+\[[\w]+\])?"
    r"\s+(.*)"
)

# PostgreSQL: 2024-01-15 10:23:45.123 UTC [12345]: [1-1] user=...,db=... LEVEL: msg
PG_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?\s*\w*)"
    r"\s+\[\d+\]:\s+\[\d+-\d+\]"
    r"(?:\s+\S+)?"
    r"\s+(\w+):\s+(.*)"
)

# Simpler PostgreSQL fallback: 2024-01-15 10:23:45 UTC LEVEL:  msg
PG_SIMPLE_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?\s*(?:UTC|GMT)?)"
    r"\s+(\w+):\s+(.*)"
)


class LogParser:
    """Stateful log parser that handles multi-line log entries."""

    def __init__(self, engine: str, instance_id: str):
        self.engine = engine
        self.instance_id = instance_id
        self._buffer = ""
        self._current: dict | None = None

    def feed(self, chunk: str) -> list[dict]:
        """Feed a text chunk, return list of complete parsed entries."""
        self._buffer += chunk
        lines = self._buffer.split("\n")
        self._buffer = lines.pop()  # keep incomplete last line

        results: list[dict] = []
        for line in lines:
            entry = self._parse_line(line)
            if entry:
                if self._current:
                    results.append(self._current)
                self._current = entry
            elif self._current and line.strip():
                # Continuation of multi-line entry
                self._current["message"] += " " + line.strip()
                self._current["raw"] += "\n" + line

        return results

    def flush(self) -> list[dict]:
        """Flush any buffered incomplete entry."""
        results: list[dict] = []
        if self._buffer.strip():
            entry = self._parse_line(self._buffer)
            if entry:
                if self._current:
                    results.append(self._current)
                self._current = entry
        if self._current:
            results.append(self._current)
            self._current = None
        self._buffer = ""
        return results

    def _parse_line(self, line: str) -> dict | None:
        if "postgres" in self.engine:
            return self._parse_pg(line)
        return self._parse_mysql(line)

    def _parse_mysql(self, line: str) -> dict | None:
        m = MYSQL_RE.match(line)
        if not m:
            return None
        ts, level, message = m.group(1), m.group(2), m.group(3)
        return {
            "instance": self.instance_id,
            "timestamp": ts.strip(),
            "level": level.upper(),
            "category": _categorize(level, message),
            "message": message.strip(),
            "raw": line,
        }

    def _parse_pg(self, line: str) -> dict | None:
        for regex in (PG_RE, PG_SIMPLE_RE):
            m = regex.match(line)
            if m:
                ts, level, message = m.group(1), m.group(2), m.group(3)
                return {
                    "instance": self.instance_id,
                    "timestamp": ts.strip(),
                    "level": level.upper(),
                    "category": _categorize(level, message),
                    "message": message.strip(),
                    "raw": line,
                }
        return None


def _categorize(level: str, message: str) -> str:
    level_upper = level.upper()
    msg_lower = message.lower()

    if any(kw in msg_lower for kw in ("deadlock", "lock wait timeout")):
        return "deadlock"
    if any(kw in msg_lower for kw in ("too many connections", "max_connections", "authentication failed", "access denied")):
        return "connection"
    if any(kw in msg_lower for kw in ("query_time:", "slow query", "long running")):
        return "slow_query"
    if any(kw in msg_lower for kw in ("slave", "replica", "replication", "binlog")):
        return "replication"
    if any(kw in msg_lower for kw in ("disk full", "out of disk", "innodb", "corrupt")):
        return "storage"
    if level_upper in ("FATAL", "PANIC"):
        return "fatal"
    if level_upper == "ERROR":
        return "error"
    return "info"
