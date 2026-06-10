# Start TerraNova Bridge sidecar for the user's active Hytale save (release build).
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Get-DefaultHytaleSavePath {
    $userData = Join-Path $env:APPDATA "Hytale\UserData"
    $pointer = Join-Path $userData "bridge-active-save.txt"
    if (Test-Path -LiteralPath $pointer) {
        $p = (Get-Content -LiteralPath $pointer -Raw).Trim()
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    $savesRoot = Join-Path $userData "Saves"
    if (-not (Test-Path -LiteralPath $savesRoot)) { return $null }
    Get-ChildItem -LiteralPath $savesRoot -Directory |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

$save = Get-DefaultHytaleSavePath
if (-not $save) {
    Write-Error "No Hytale save found under $(Join-Path $env:APPDATA 'Hytale\UserData\Saves'). Create a world or pass --save to cargo run."
}

Push-Location (Join-Path $repoRoot "tools\terranova-bridge")
try {
    $env:CARGO_TARGET_DIR = Join-Path $repoRoot "tools\terranova-bridge\target"
    cargo run --release -- --save "$save" @args
} finally {
    Pop-Location
}
