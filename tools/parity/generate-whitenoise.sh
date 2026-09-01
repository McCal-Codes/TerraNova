#!/usr/bin/env bash
# Regenerate the noise parity fixture from the real Hytale V2 implementation.
#
# Requires a local Hytale install and a JDK. The generated fixture is committed,
# so contributors without the game can still run the parity test.
#
#   ./tools/parity/generate.sh [path/to/HytaleServer.jar]
#
# Default jar location is the macOS pre-release patchline. Override by passing a
# path, or by setting HYTALE_SERVER_JAR.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
OUT_FILE="$REPO_ROOT/src/utils/density/__tests__/fixtures/whiteNoiseParity.json"

DEFAULT_JAR="$HOME/Library/Application Support/Hytale/install/pre-release/package/game/latest/Server/HytaleServer.jar"
JAR="${1:-${HYTALE_SERVER_JAR:-$DEFAULT_JAR}}"

if [[ ! -f "$JAR" ]]; then
  echo "error: HytaleServer.jar not found at:" >&2
  echo "  $JAR" >&2
  echo >&2
  echo "Pass a path or set HYTALE_SERVER_JAR. On macOS the jar lives under:" >&2
  echo "  ~/Library/Application Support/Hytale/install/<patchline>/package/game/latest/Server/" >&2
  exit 1
fi

if ! command -v javac >/dev/null 2>&1; then
  echo "error: javac not found on PATH. Install a JDK (e.g. brew install openjdk)." >&2
  exit 1
fi

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

echo "Compiling parity harness against:"
echo "  $JAR"
javac -nowarn -cp "$JAR" -d "$BUILD_DIR" "$HERE/WhiteNoiseParity.java"

mkdir -p "$(dirname "$OUT_FILE")"
echo "Sampling the real WhiteNoiseDensity..."
java -cp "$JAR:$BUILD_DIR" com.hypixel.hytale.builtin.hytalegenerator.density.WhiteNoiseParity > "$OUT_FILE"

echo "Wrote $OUT_FILE ($(wc -c < "$OUT_FILE" | tr -d ' ') bytes)"
echo "Now run: pnpm vitest run src/utils/density/__tests__/whiteNoiseParity.test.ts"
