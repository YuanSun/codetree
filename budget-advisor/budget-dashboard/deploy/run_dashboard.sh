#!/bin/bash
# Launched by the launchd service (see install_macos_service.sh). Runs the
# app from its own venv so this doesn't depend on any ambient shell state.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

exec "$APP_DIR/.venv/bin/streamlit" run app.py \
    --server.address 0.0.0.0 \
    --server.port 8501 \
    --server.headless true
