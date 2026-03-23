#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/server"
../.venv/bin/python -m uvicorn main:app --port 3003 --reload
