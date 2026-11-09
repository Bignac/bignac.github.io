#!/bin/bash
# Launch wrapper for the bgr (chroma-studio) dev server.
# Run under launchd so it survives restarts and keeps running.
export PATH="/Users/ignacio/.local/bin:/opt/homebrew/bin:/usr/bin:/bin"
cd /Users/ignacio/Downloads/bgr-main
exec npm run dev -- --host 127.0.0.1
