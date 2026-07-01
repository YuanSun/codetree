#!/bin/bash
# Installs the dashboard as a per-user launchd service: starts now, starts
# again on every login/reboot, and restarts automatically if it ever exits.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.budgetdashboard.streamlit"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs"

if [ ! -x "$APP_DIR/.venv/bin/streamlit" ]; then
    echo "error: $APP_DIR/.venv/bin/streamlit not found." >&2
    echo "Run this first: cd $APP_DIR && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
    exit 1
fi

mkdir -p "$LOG_DIR"
chmod +x "$APP_DIR/deploy/run_dashboard.sh"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$APP_DIR/deploy/run_dashboard.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$APP_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/budget-dashboard.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/budget-dashboard.error.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || echo "<your-mac-ip>")"

echo "Installed and started: $LABEL"
echo "  Plist:      $PLIST_PATH"
echo "  Logs:       $LOG_DIR/budget-dashboard.log (stdout), $LOG_DIR/budget-dashboard.error.log (stderr)"
echo "  Local URL:  http://localhost:8501"
echo "  LAN URL:    http://$LAN_IP:8501 (from other devices on your network; macOS may prompt to allow incoming connections the first time)"
