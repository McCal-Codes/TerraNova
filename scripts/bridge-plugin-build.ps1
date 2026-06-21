# Build TerraNova.Bridge JVM plugin (requires JDK 25 — matches maven.hytale.com Server API).
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginDir = Join-Path $repoRoot "tools\terranova-bridge-plugin"
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    $candidates = @(
        "C:\Program Files\Eclipse Adoptium\jdk-25.0.3.9-hotspot",
        "C:\Program Files\Java\jdk-25",
        "C:\Program Files\Java\jdk-21.0.11"
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "bin\java.exe")) {
            $env:JAVA_HOME = $c
            break
        }
    }
}
if (-not $env:JAVA_HOME) {
    Write-Error "Set JAVA_HOME to JDK 25 (Hytale Server API requires Java 25)."
}
if (-not (Test-Path -LiteralPath $pluginDir)) {
    Write-Error "Plugin directory not found: $pluginDir"
}

$wrapper = Join-Path $pluginDir "gradlew.bat"
if (Test-Path -LiteralPath $wrapper) {
    $gradleCmd = $wrapper
    $gradleArgs = @("jar", "--no-daemon")
} else {
    $gradle = Get-Command gradle -ErrorAction SilentlyContinue
    if (-not $gradle) {
        Write-Error "Gradle wrapper missing. Run gradle wrapper in tools/terranova-bridge-plugin once."
    }
    $gradleCmd = $gradle.Source
    $gradleArgs = @("jar")
}

Push-Location $pluginDir
try {
    & $gradleCmd @gradleArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $jar = Get-ChildItem -Path (Join-Path $pluginDir "build\libs") -Filter "TerraNova.Bridge*.jar" |
        Where-Object { $_.Name -notmatch "-plain" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($jar) {
        Write-Host "Built: $($jar.FullName)"

        # Bundle into Tauri assets for in-app Deploy Plugin
        $bundleDir = Join-Path $repoRoot "src-tauri\assets\bridge-plugin"
        New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null
        $bundleDest = Join-Path $bundleDir "TerraNova.Bridge.jar"
        Copy-Item -LiteralPath $jar.FullName -Destination $bundleDest -Force
        Write-Host "Bundled: $bundleDest"

        # Auto-deploy to Hytale Mods folder if it exists
        $modsDir = Join-Path $env:APPDATA "Hytale\UserData\Mods"
        if (Test-Path -LiteralPath $modsDir) {
            $dest = Join-Path $modsDir $jar.Name
            Copy-Item -LiteralPath $jar.FullName -Destination $dest -Force
            Write-Host "Deployed: $dest"
            Write-Host "Enable 'TerraNova: Bridge' on your save in Hytale, then run: pnpm bridge:run"
        } else {
            Write-Host "Hytale Mods folder not found at: $modsDir"
            Write-Host "Copy $($jar.Name) there manually once Hytale has been launched at least once."
        }
    }
} finally {
    Pop-Location
}
