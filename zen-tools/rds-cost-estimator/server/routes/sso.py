"""SSO re-authentication route — runs `aws sso login` for an expired profile."""
import asyncio
import configparser
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from utils.sse import sse_event

router = APIRouter(prefix="/api/sso")


@router.get("/login/stream")
async def stream_sso_login(profile: str = Query(...)):
    """Stream `aws sso login` output as SSE to re-authenticate an expired profile."""
    aws_bin = shutil.which("aws")
    if not aws_bin:
        async def no_aws():
            yield sse_event({"type": "error", "message": "aws CLI not found in PATH"})
        return StreamingResponse(no_aws(), media_type="text/event-stream")

    sso_session = _get_sso_session(profile)
    cli_ver = _aws_cli_version(aws_bin)
    supports_sso_session = cli_ver >= (2, 9, 0)

    async def generate():
        if sso_session and supports_sso_session:
            login_args = ["sso", "login", "--sso-session", sso_session]
            label = f"aws sso login --sso-session {sso_session}"
        elif sso_session and not supports_sso_session:
            yield sse_event({
                "type": "log",
                "message": (
                    f"Warning: AWS CLI {'.'.join(str(x) for x in cli_ver)} detected. "
                    "sso-session format requires v2.9+. Trying --profile fallback."
                ),
            })
            login_args = ["sso", "login", "--profile", profile]
            label = f"aws sso login --profile {profile}"
        else:
            login_args = ["sso", "login", "--profile", profile]
            label = f"aws sso login --profile {profile}"

        if sys.platform == "win32" and aws_bin.lower().endswith((".cmd", ".bat")):
            cmd_args = ["cmd", "/c", aws_bin] + login_args
        else:
            cmd_args = [aws_bin] + login_args

        proc = None
        try:
            try:
                proc = subprocess.Popen(
                    cmd_args,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                )
            except Exception as e:
                yield sse_event({"type": "error", "message": f"Failed to start aws sso login: {e}"})
                return

            yield sse_event({"type": "log", "message": f"Running: {label}"})

            loop = asyncio.get_running_loop()
            queue: asyncio.Queue = asyncio.Queue()

            def _read():
                for line in proc.stdout:
                    loop.call_soon_threadsafe(queue.put_nowait, line)
                loop.call_soon_threadsafe(queue.put_nowait, None)

            threading.Thread(target=_read, daemon=True).start()

            while True:
                try:
                    line = await asyncio.wait_for(queue.get(), timeout=180.0)
                except asyncio.TimeoutError:
                    proc.kill()
                    yield sse_event({"type": "error", "message": "Login timed out after 3 minutes"})
                    return
                if line is None:
                    break
                yield sse_event({"type": "log", "message": line.decode().rstrip()})

            proc.wait()
            if proc.returncode == 0:
                yield sse_event({"type": "done"})
            else:
                yield sse_event({"type": "error", "message": f"aws sso login exited with code {proc.returncode}"})
        except Exception as e:
            yield sse_event({"type": "error", "message": f"Unexpected error: {e}"})
        finally:
            if proc:
                try:
                    proc.kill()
                except Exception:
                    pass

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _get_sso_session(profile: str) -> str | None:
    """Return the sso_session name if the profile uses the sso-session format."""
    config_path = Path.home() / ".aws" / "config"
    if not config_path.exists():
        return None
    parser = configparser.RawConfigParser(default_section=None)
    parser.read(str(config_path))
    section = f"profile {profile}" if profile != "default" else "default"
    if parser.has_section(section):
        return parser.get(section, "sso_session", fallback=None)
    return None


def _aws_cli_version(aws_bin: str) -> tuple[int, ...]:
    try:
        result = subprocess.run([aws_bin, "--version"], capture_output=True, text=True, timeout=5)
        match = re.search(r"aws-cli/(\d+)\.(\d+)\.(\d+)", result.stdout + result.stderr)
        if match:
            return tuple(int(x) for x in match.groups())
    except Exception:
        pass
    return (0, 0, 0)
