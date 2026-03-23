"""
Teleport integration: login flows + MySQL DBA query via tsh proxy.

Flow for querying an instance:
  1. tsh login --proxy=<proxy>          (if not already logged in)
  2. tsh db login <tsh_db_name>         (obtain local DB certs)
  3. tsh proxy db <tsh_db_name> \
       --tunnel --port <free_port>      (start local proxy in background)
  4. pymysql connect to 127.0.0.1:<port> as <db_user>
  5. Query dba.events_statements_summary_by_digest_history
  6. Terminate proxy process
"""
from __future__ import annotations

import asyncio
import socket
from datetime import datetime
from typing import Any, AsyncGenerator

import pymysql
import pymysql.cursors

from utils.sse import sse_event


# ---------------------------------------------------------------------------
# Status check
# ---------------------------------------------------------------------------

async def check_tsh_status(proxy: str) -> dict[str, Any]:
    """Returns whether the user is currently logged into Teleport."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "tsh", "status", "--proxy", proxy,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        logged_in = proc.returncode == 0
        return {
            "loggedIn": logged_in,
            "detail": stdout.decode(errors="replace").strip() if logged_in else stderr.decode(errors="replace").strip(),
        }
    except asyncio.TimeoutError:
        return {"loggedIn": False, "detail": "tsh status timed out"}
    except FileNotFoundError:
        return {"loggedIn": False, "detail": "tsh not found — is Teleport installed?"}
    except Exception as exc:
        return {"loggedIn": False, "detail": str(exc)}


# ---------------------------------------------------------------------------
# tsh login stream
# ---------------------------------------------------------------------------

async def stream_tsh_login(proxy: str) -> AsyncGenerator[str, None]:
    """
    Runs 'tsh login --proxy=<proxy>' and streams output as SSE.
    Teleport opens a browser for SSO; we surface the URL in the log.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "tsh", "login", f"--proxy={proxy}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            yield sse_event({"log": line}, "log")

        await proc.wait()
        if proc.returncode == 0:
            yield sse_event({"status": "success"}, "done")
        else:
            yield sse_event({"status": "error", "message": "tsh login exited with non-zero status"}, "done")
    except FileNotFoundError:
        yield sse_event({"status": "error", "message": "tsh not found — is Teleport installed?"}, "done")
    except Exception as exc:
        yield sse_event({"status": "error", "message": str(exc)}, "done")


# ---------------------------------------------------------------------------
# tsh db login stream
# ---------------------------------------------------------------------------

async def stream_db_login(proxy: str, tsh_db_name: str) -> AsyncGenerator[str, None]:
    """Runs 'tsh db login <db>' and streams output as SSE."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "tsh", "db", "login", tsh_db_name, f"--proxy={proxy}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            yield sse_event({"log": line}, "log")

        await proc.wait()
        if proc.returncode == 0:
            yield sse_event({"status": "success"}, "done")
        else:
            yield sse_event({"status": "error", "message": "tsh db login failed"}, "done")
    except Exception as exc:
        yield sse_event({"status": "error", "message": str(exc)}, "done")


# ---------------------------------------------------------------------------
# DBA query
# ---------------------------------------------------------------------------

async def query_dba(
    proxy: str,
    tsh_db_name: str,
    db_user: str,
    from_dt: str,
    to_dt: str,
    limit: int = 100,
) -> dict[str, Any]:
    """
    Start a tsh proxy db tunnel, connect via pymysql, query the
    dba.events_statements_summary_by_digest_history table, and return rows.

    Timer columns (SUM_TIMER_WAIT etc.) are stored in picoseconds;
    we convert to milliseconds (divide by 1e9).
    """
    port = _free_port()
    proxy_proc = await asyncio.create_subprocess_exec(
        "tsh", "proxy", "db", tsh_db_name,
        f"--proxy={proxy}",
        "--tunnel",
        "--port", str(port),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    # Give the proxy a moment to bind
    await asyncio.sleep(2.5)

    try:
        rows = await asyncio.to_thread(
            _run_query, port, db_user, from_dt, to_dt, limit
        )
        return {"rows": rows, "count": len(rows)}
    except Exception as exc:
        return {"rows": [], "count": 0, "error": str(exc)}
    finally:
        proxy_proc.terminate()
        try:
            await asyncio.wait_for(proxy_proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proxy_proc.kill()


def _run_query(port: int, db_user: str, from_dt: str, to_dt: str, limit: int) -> list[dict]:
    conn = pymysql.connect(
        host="127.0.0.1",
        port=port,
        user=db_user,
        password="",          # Teleport handles auth via local certs
        database="dba",
        connect_timeout=10,
        cursorclass=pymysql.cursors.DictCursor,
        ssl_disabled=True,    # tsh proxy terminates TLS on our behalf
    )
    sql = """
        SELECT
            AsOfDate,
            SCHEMA_NAME,
            DIGEST,
            LEFT(DIGEST_TEXT, 500)           AS DIGEST_TEXT,
            COUNT_STAR,
            ROUND(SUM_TIMER_WAIT  / 1e9, 2) AS SUM_LATENCY_MS,
            ROUND(AVG_TIMER_WAIT  / 1e9, 2) AS AVG_LATENCY_MS,
            ROUND(MAX_TIMER_WAIT  / 1e9, 2) AS MAX_LATENCY_MS,
            ROUND(SUM_LOCK_TIME   / 1e9, 2) AS SUM_LOCK_MS,
            SUM_ERRORS,
            SUM_ROWS_AFFECTED,
            SUM_ROWS_SENT,
            SUM_ROWS_EXAMINED,
            SUM_CREATED_TMP_DISK_TABLES,
            SUM_CREATED_TMP_TABLES,
            SUM_SELECT_FULL_JOIN,
            SUM_SELECT_SCAN,
            SUM_NO_INDEX_USED,
            SUM_NO_GOOD_INDEX_USED,
            ROUND(QUANTILE_95  / 1e9, 2)    AS P95_MS,
            ROUND(QUANTILE_99  / 1e9, 2)    AS P99_MS,
            ROUND(QUANTILE_999 / 1e9, 2)    AS P999_MS,
            FIRST_SEEN,
            LAST_SEEN
        FROM dba.events_statements_summary_by_digest_history
        WHERE AsOfDate BETWEEN %s AND %s
        ORDER BY SUM_TIMER_WAIT DESC
        LIMIT %s
    """
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (from_dt, to_dt, limit))
            rows = cur.fetchall()
        return [_serialize(r) for r in rows]
    finally:
        conn.close()


def _serialize(row: dict) -> dict:
    """Convert datetime/Decimal values to JSON-safe types."""
    out: dict = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif hasattr(v, "__float__"):
            out[k] = float(v)
        else:
            out[k] = v
    return out


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]
