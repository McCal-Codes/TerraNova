#!/usr/bin/env bash
# TerraNova development launcher (Linux wrapper).
#
#     ./dev.sh            desktop dev build
#     ./dev.sh --lab      open straight into Dev Lab
#     ./dev.sh --web      browser-only Vite
#
# All logic lives in scripts/dev-launcher.mjs.
set -euo pipefail
cd "$(dirname "$0")"
exec pnpm start "$@"
