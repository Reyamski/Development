import asyncio
import configparser
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.request
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.rds_logs import (
    list_instances,
    get_log_files,
    get_instance_engine,
    stream_log_chunks,
    LogParser,
    apply_filters,
)
from utils.aws import get_aws_session
from utils.sse import sse_event, sse_keepalive

router = APIRouter(prefix="/api/rds")


@router.get("/profiles")
async def get_profiles():
    config_path = Path.home() / ".aws" / "config"
    if not config_path.exists():
        return {"profiles": []}

    parser = configparser.RawConfigParser(default_section=None)
    parser.read(str(config_path))

    profiles: list[str] = []
    for section in parser.sections():
        if section.startswith("profile "):
            profiles.append(section[len("profile "):])
        elif section == "default":
            profiles.append("default")

    return {"profiles": sorted(profiles)}


@router.get("/instances")
async def get_instances(profile: str = Query(...), region: str = Query(...)):
    instances = await asyncio.to_thread(list_instances, profile, region)
    # Surface sso_expired as a top-level flag so the frontend can show re-auth UI
    if instances and instances[0].get("errorType") == "sso_expired":
        return {"instances": [], "ssoExpired": True, "profile": profile, "error": instances[0]["error"]}
    return {"instances": instances}


def _get_sso_session_for_profile(profile: str) -> str | None:
    """Return the sso_session name if the profile uses the new sso-session format."""
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
    """Return the AWS CLI version as a tuple, e.g. (2, 13, 0)."""
    try:
        result = subprocess.run([aws_bin, "--version"], capture_output=True, text=True, timeout=5)
        # Output: "aws-cli/2.13.0 Python/3.11.6 ..."
        match = re.search(r"aws-cli/(\d+)\.(\d+)\.(\d+)", result.stdout + result.stderr)
        if match:
            return tuple(int(x) for x in match.groups())
    except Exception:
        pass
    return (0, 0, 0)


def _download_with_progress(url: str, dest: str, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
    """Download a file to dest, pushing log SSE events into the queue."""
    last_pct = [-1]

    def reporthook(count, block_size, total_size):
        if total_size <= 0:
            return
        pct = min(100, int(count * block_size * 100 / total_size))
        if pct != last_pct[0]:
            last_pct[0] = pct
            mb_done = count * block_size / 1_048_576
            mb_total = total_size / 1_048_576
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "log", "message": f"Downloading... {pct}% ({mb_done:.1f} / {mb_total:.1f} MB)"},
            )

    urllib.request.urlretrieve(url, dest, reporthook=reporthook)


def _install_windows(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
    url = "https://awscli.amazonaws.com/AWSCLIV2.msi"
    tmp = os.path.join(tempfile.gettempdir(), "AWSCLIV2.msi")
    loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": f"Downloading AWS CLI v2 for Windows..."})
    _download_with_progress(url, tmp, queue, loop)
    loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": "Download complete. Running installer (a UAC prompt may appear)..."})
    proc = subprocess.Popen(
        ["msiexec", "/i", tmp, "/passive", "/norestart"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    for line in proc.stdout:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": line.decode().rstrip()})
    proc.wait()
    try:
        os.unlink(tmp)
    except Exception:
        pass
    if proc.returncode == 0:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "done", "message": "AWS CLI installed! Restart the server to pick up the new PATH."})
    else:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": f"Installer exited with code {proc.returncode}. Try running the server as Administrator."})


def _install_mac(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
    brew = shutil.which("brew")
    if brew:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": "Homebrew detected. Running: brew install awscli"})
        proc = subprocess.Popen([brew, "install", "awscli"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for line in proc.stdout:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": line.decode().rstrip()})
        proc.wait()
        if proc.returncode == 0:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "done", "message": "AWS CLI installed via Homebrew!"})
        else:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": "brew install failed. Try: brew install awscli manually."})
        return

    # No brew — download universal PKG
    url = "https://awscli.amazonaws.com/AWSCLIV2.pkg"
    tmp = os.path.join(tempfile.gettempdir(), "AWSCLIV2.pkg")
    loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": "Downloading AWS CLI v2 for macOS..."})
    _download_with_progress(url, tmp, queue, loop)
    loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": "Running: sudo installer -pkg AWSCLIV2.pkg -target / (password may be required in terminal)"})
    proc = subprocess.Popen(["sudo", "installer", "-pkg", tmp, "-target", "/"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for line in proc.stdout:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "log", "message": line.decode().rstrip()})
    proc.wait()
    try:
        os.unlink(tmp)
    except Exception:
        pass
    if proc.returncode == 0:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "done", "message": "AWS CLI installed!"})
    else:
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": "Install failed. Run: sudo installer -pkg /tmp/AWSCLIV2.pkg -target / in your terminal."})


@router.get("/aws-cli/check")
async def check_aws_cli():
    aws_bin = shutil.which("aws")
    if not aws_bin:
        return {"installed": False, "version": None, "platform": sys.platform}
    version = _aws_cli_version(aws_bin)
    return {
        "installed": True,
        "version": ".".join(str(x) for x in version) if any(version) else "unknown",
        "platform": sys.platform,
    }


@router.get("/aws-cli/install/stream")
async def install_aws_cli():
    """Download and install AWS CLI for the current platform, streaming progress via SSE."""
    if sys.platform not in ("win32", "darwin"):
        async def unsupported():
            yield sse_event({"type": "error", "message": f"Auto-install not supported on {sys.platform}. Please install manually: https://aws.amazon.com/cli/"})
        return StreamingResponse(unsupported(), media_type="text/event-stream")

    async def generate():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        def _run():
            try:
                if sys.platform == "win32":
                    _install_windows(queue, loop)
                else:
                    _install_mac(queue, loop)
            except Exception as e:
                loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": str(e)})
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        threading.Thread(target=_run, daemon=True).start()

        while True:
            item = await queue.get()
            if item is None:
                break
            yield sse_event(item)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/sso-login/stream")
async def stream_sso_login(profile: str = Query(...)):
    """Stream output of aws sso login via SSE, using sso-session or legacy format as appropriate."""
    aws_bin = shutil.which("aws")
    if not aws_bin:
        async def no_aws():
            yield sse_event({"type": "error", "message": "aws CLI not found in PATH"})
        return StreamingResponse(no_aws(), media_type="text/event-stream")

    sso_session = _get_sso_session_for_profile(profile)
    cli_version = _aws_cli_version(aws_bin)
    # --sso-session flag requires AWS CLI >= 2.9.0
    supports_sso_session = cli_version >= (2, 9, 0)

    async def generate():
        # Choose the correct login command based on profile format and CLI version
        if sso_session and supports_sso_session:
            login_args = ["sso", "login", "--sso-session", sso_session]
            label = f"aws sso login --sso-session {sso_session}"
        elif sso_session and not supports_sso_session:
            # Old CLI + sso-session profile: warn and try --profile anyway
            yield sse_event({
                "type": "log",
                "message": f"Warning: AWS CLI {'.'.join(str(x) for x in cli_version)} detected. "
                           f"The sso-session format requires v2.9+. Please upgrade: https://aws.amazon.com/cli/",
            })
            login_args = ["sso", "login", "--profile", profile]
            label = f"aws sso login --profile {profile}"
        else:
            login_args = ["sso", "login", "--profile", profile]
            label = f"aws sso login --profile {profile}"

        # On Windows, .cmd/.bat files must be run via cmd /c
        if sys.platform == "win32" and aws_bin.lower().endswith((".cmd", ".bat")):
            cmd_args = ["cmd", "/c", aws_bin] + login_args
        else:
            cmd_args = [aws_bin] + login_args

        # Use subprocess.Popen + a reader thread so this works on any asyncio
        # event loop type (avoids Windows ProactorEventLoop requirement).
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
            queue: asyncio.Queue[bytes | None] = asyncio.Queue()

            def _read_output():
                for line in proc.stdout:
                    loop.call_soon_threadsafe(queue.put_nowait, line)
                loop.call_soon_threadsafe(queue.put_nowait, None)

            threading.Thread(target=_read_output, daemon=True).start()

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
            yield sse_event({"type": "error", "message": f"Unexpected error during re-auth: {e}"})
        finally:
            if proc:
                try:
                    proc.kill()
                except Exception:
                    pass

    return StreamingResponse(generate(), media_type="text/event-stream")


class LogStreamRequest(BaseModel):
    profile: str
    region: str
    instances: list[str]
    fromDate: str
    toDate: str
    filters: list[str] = []


@router.post("/logs/stream")
async def stream_logs(req: LogStreamRequest):
    async def generate():
        try:
            from_dt = datetime.fromisoformat(req.fromDate)
            to_dt = datetime.fromisoformat(req.toDate)
        except ValueError:
            yield sse_event({"type": "error", "message": "Invalid date format"})
            return

        from_ms = int(from_dt.timestamp() * 1000)
        to_ms = int(to_dt.timestamp() * 1000)

        session = get_aws_session(req.profile, req.region)
        rds = session.client("rds")

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        keepalive = asyncio.create_task(_keepalive_task(queue))

        async def fetch_all():
            try:
                for instance_id in req.instances:
                    engine = await asyncio.to_thread(get_instance_engine, rds, instance_id)

                    log_files = await asyncio.to_thread(
                        get_log_files, rds, instance_id, engine, from_ms, to_ms
                    )

                    if not log_files:
                        await queue.put(sse_event({
                            "type": "progress",
                            "instance": instance_id,
                            "message": "No log files found in date range",
                        }))
                        continue

                    for log_file in log_files:
                        await queue.put(sse_event({
                            "type": "progress",
                            "instance": instance_id,
                            "file": log_file["LogFileName"],
                        }))

                        parser = LogParser(engine, instance_id)
                        async for chunk in stream_log_chunks(rds, instance_id, log_file["LogFileName"]):
                            for entry in parser.feed(chunk):
                                if apply_filters(entry, req.filters):
                                    await queue.put(sse_event({"type": "entry", **entry}))

                        for entry in parser.flush():
                            if apply_filters(entry, req.filters):
                                await queue.put(sse_event({"type": "entry", **entry}))

                await queue.put(sse_event({"type": "done"}))
            except Exception as e:
                await queue.put(sse_event({"type": "error", "message": str(e)}))
            finally:
                await queue.put(None)

        task = asyncio.create_task(fetch_all())

        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            task.cancel()
            keepalive.cancel()

    return StreamingResponse(generate(), media_type="text/event-stream")


async def _keepalive_task(queue: asyncio.Queue):
    while True:
        await asyncio.sleep(15)
        await queue.put(sse_keepalive())
