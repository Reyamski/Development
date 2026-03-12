import asyncio
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from routes.infra     import router as infra_router
from routes.pricing   import router as pricing_router
from routes.scenarios import router as scenarios_router
from routes.sso       import router as sso_router

app = FastAPI(title="RDS Cost Estimator")

app.include_router(sso_router)
app.include_router(infra_router)
app.include_router(pricing_router)
app.include_router(scenarios_router)

_HTML_PATH = Path(__file__).parent.parent / "client" / "index.html"


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    return HTMLResponse(content=_HTML_PATH.read_text())
