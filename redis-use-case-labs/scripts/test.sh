#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up -d --wait
pip install -q -r requirements-dev.txt
pytest tests/ -v
