import asyncio

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.aws_sso import start_sso_flow, generate_aws_config
from utils.sse import sse_event, sse_keepalive

router = APIRouter(prefix="/api/sso")


class SSOStreamRequest(BaseModel):
    startUrl: str
    ssoRegion: str = "us-east-1"


class GenerateConfigRequest(BaseModel):
    accounts: list[dict]
    startUrl: str
    ssoRegion: str
    appRegion: str = "us-east-1"
    overwrite: bool = False
    format: str = "sso-session"


@router.post("/stream")
async def stream_sso(req: SSOStreamRequest):
    async def generate():
        keepalive_task = None
        last_event_time = [0.0]

        async def send_keepalives(queue: asyncio.Queue):
            while True:
                await asyncio.sleep(15)
                await queue.put(sse_keepalive())

        queue: asyncio.Queue[str] = asyncio.Queue()

        async def flow():
            async for event in start_sso_flow(req.startUrl, req.ssoRegion):
                await queue.put(sse_event(event))
            await queue.put(None)  # sentinel

        task = asyncio.create_task(flow())
        keepalive = asyncio.create_task(send_keepalives(queue))

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


@router.post("/generate-config")
async def generate_config(req: GenerateConfigRequest):
    result = await asyncio.to_thread(
        generate_aws_config,
        req.accounts,
        req.startUrl,
        req.ssoRegion,
        req.appRegion,
        req.overwrite,
        req.format,
    )
    return result
