#!/bin/bash
# MacOS requires GUI elements to be run in standard terminals rather than silent system LaunchAgents
echo "Launching AI File Organizer Desktop App..."

# Unload the silent background agent so they don't clash
launchctl unload ~/Library/LaunchAgents/com.fileorganizer.agent.plist 2>/dev/null

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
./venv/bin/python3 -u main.py
