#!/bin/bash
# Watchdog: health-checks the bgr site and auto-repairs it.
export PATH="/Users/ignacio/.local/bin:/opt/homebrew/bin:/usr/bin:/bin"
cd /Users/ignacio/Downloads/bgr-main
node scripts/health-check.cjs >> logs/watchdog.log 2>&1
