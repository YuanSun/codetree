#!/bin/bash
set -euo pipefail

LABEL="com.budgetdashboard.streamlit"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl unload "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "Uninstalled $LABEL (service stopped, plist removed)."
