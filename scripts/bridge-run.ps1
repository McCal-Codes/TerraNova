# Start TerraNova Bridge sidecar for the user's active Hytale save (release build).
param(
    [string]$Save
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$bridgePort = 7854

function Get-BridgePortOwnerPid {
    param(
        [int]$Port
    )

    $connection = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -eq $connection) { return $null }
    return $connection.OwningProcess
}

function Ensure-BridgePortAvailable {
    param(
        [int]$Port
    )

    $ownerPid = Get-BridgePortOwnerPid -Port $Port
    if ($null -eq $ownerPid) { return }

    $owner = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    if ($null -eq $owner) {
        Start-Sleep -Milliseconds 200
        $ownerPid = Get-BridgePortOwnerPid -Port $Port
        if ($null -eq $ownerPid) { return }
        throw "Bridge port $Port is in use by PID $ownerPid."
    }

    if ($owner.ProcessName -notlike "terranova-bridge*") {
        throw "Bridge port $Port is already in use by process '$($owner.ProcessName)' (PID $ownerPid). Stop it, or run Bridge on a different port."
    }

    Write-Host "Found existing terranova-bridge (PID $ownerPid) on port $Port; restarting..."
    Stop-Process -Id $ownerPid -Force

    $maxAttempts = 20
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        Start-Sleep -Milliseconds 100
        if ($null -eq (Get-BridgePortOwnerPid -Port $Port)) { return }
    }

    throw "Failed to release bridge port $Port after stopping PID $ownerPid."
}

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

if ($Save -and (Test-Path -LiteralPath $Save)) {
    $save = (Resolve-Path -LiteralPath $Save).Path
} else {
    if ($Save) {
        Write-Warning "Save path not found: $Save - falling back to default save discovery."
    }
    $save = Get-DefaultHytaleSavePath
}
if (-not $save) {
    Write-Error "No Hytale save found under $(Join-Path $env:APPDATA 'Hytale\UserData\Saves'). Create a world or pass -Save to bridge-run.ps1."
}

Ensure-BridgePortAvailable -Port $bridgePort

Push-Location (Join-Path $repoRoot "tools\terranova-bridge")
try {
    $env:CARGO_TARGET_DIR = Join-Path $repoRoot "tools\terranova-bridge\target"
    $releaseExe = Join-Path $repoRoot "tools\terranova-bridge\target\release\terranova-bridge.exe"
    if (Test-Path -LiteralPath $releaseExe) {
        & $releaseExe --save $save @args
    } else {
        cargo run --release -- --save $save @args
    }
} finally {
    Pop-Location
}
