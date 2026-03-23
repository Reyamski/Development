#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/server"
"$ROOT/.venv/bin/python" -m uvicorn main:app --reload --port 3002 --host 0.0.0.0
