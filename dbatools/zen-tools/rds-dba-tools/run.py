#!/usr/bin/env python3
"""Cross-platform launcher for rds-dba-tools server. Works on macOS, Linux, and Windows."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent

if sys.platform == "win32":
    python = ROOT / ".venv" / "Scripts" / "python.exe"
else:
    python = ROOT / ".venv" / "bin" / "python"

if not python.exists():
    sys.exit(
        f"Virtual environment not found at {python}\n"
        f"Run: python -m venv {ROOT / '.venv'} && {python} -m pip install -r {ROOT / 'server' / 'requirements.txt'}"
    )

subprocess.run(
    [str(python), "-m", "uvicorn", "main:app", "--reload", "--port", "3002", "--host", "0.0.0.0"],
    cwd=ROOT / "server",
)
