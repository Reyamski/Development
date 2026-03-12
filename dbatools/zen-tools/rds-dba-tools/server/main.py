import asyncio
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

# On Windows, uvicorn's reloader spawns a worker process that may default to
# SelectorEventLoop, which does not support subprocess operations.
# Force ProactorEventLoop so asyncio.create_subprocess_exec works correctly.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from routes.sso import router as sso_router
from routes.rds import router as rds_router
from routes.metrics import router as metrics_router

app = FastAPI(title="RDS DBA Tools")

app.include_router(sso_router)
app.include_router(rds_router)
app.include_router(metrics_router)

_HTML_PATH = Path(__file__).parent.parent / "client" / "index.html"


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    return HTMLResponse(content=_HTML_PATH.read_text())
