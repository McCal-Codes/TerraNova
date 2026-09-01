#!/usr/bin/env bash
# TerraNova development launcher (macOS double-click wrapper).
#
# Finder needs the executable bit before this will open on double-click:
#     chmod +x dev.command
#
# All logic lives in scripts/dev-launcher.mjs. Pass --lab for Dev Lab or --web
# for browser-only development.
set -euo pipefail
cd "$(dirname "$0")"

if ! pnpm start "$@"; then
  echo
  echo "TerraNova failed to start. For a diagnosis run:"
  echo "    pnpm dev:doctor"
  # Keep the Terminal window open so a double-click user can read the error.
  read -r -p "Press Return to close..." _
  exit 1
fi
