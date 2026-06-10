# Start TerraNova Bridge sidecar for Worldgen V1 (release build).
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$save = Join-Path $env:APPDATA "Hytale\UserData\Saves\Worldgen V1"
if (-not (Test-Path -LiteralPath $save)) {
    Write-Error "Save not found: $save"
}
Push-Location (Join-Path $repoRoot "tools\terranova-bridge")
try {
    $env:CARGO_TARGET_DIR = Join-Path $repoRoot "tools\terranova-bridge\target"
    cargo run --release -- --save "$save" @args
} finally {
    Pop-Location
}
