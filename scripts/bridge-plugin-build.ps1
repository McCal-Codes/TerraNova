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
    }
} finally {
    Pop-Location
}
