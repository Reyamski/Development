"""Cross-platform launcher — finds .venv and starts uvicorn."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).parent
venv = root / ".venv"
if not venv.exists():
    print("No .venv found. Run:\n  python3 -m venv .venv\n  .venv/bin/pip install -r server/requirements.txt")
    sys.exit(1)

python = venv / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
subprocess.run([str(python), "-m", "uvicorn", "main:app", "--port", "3003", "--reload"],
               cwd=root / "server")
