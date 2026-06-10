#Requires -Version 5.1
param(
  [string]$KeyPath = (Join-Path $env:USERPROFILE ".tauri\terranova-mccal.key"),
  [string]$Repo = "McCal-Codes/TerraNova"
)
<#
.SYNOPSIS
  Upload Tauri updater signing secrets to McCal-Codes/TerraNova (full private key file + password).

.DESCRIPTION
  The private key must be the ENTIRE .key file (including the untrusted comment line).
  Partial keys cause CI error: "Missing comment in secret key".

  Default key path: %USERPROFILE%\.tauri\terranova-mccal.key
  Generate first: pnpm tauri signer generate -w $env:USERPROFILE\.tauri\terranova-mccal.key --ci
#>
$ErrorActionPreference = "Stop"

if (-not (Test-Path $KeyPath)) {
  Write-Error "Missing private key at $KeyPath. Run: pnpm tauri signer generate -w `"$KeyPath`" --ci"
}

$password = Read-Host "Private key password (TAURI_SIGNING_PRIVATE_KEY_PASSWORD)" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

Write-Host "Setting TAURI_SIGNING_PRIVATE_KEY from $KeyPath ..."
Get-Content -Raw $KeyPath | gh secret set TAURI_SIGNING_PRIVATE_KEY -R $Repo

Write-Host "Setting TAURI_SIGNING_PRIVATE_KEY_PASSWORD ..."
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD -R $Repo -b $plain

Write-Host "Done. Verify pubkey in src-tauri/tauri.conf.json matches $KeyPath.pub"
