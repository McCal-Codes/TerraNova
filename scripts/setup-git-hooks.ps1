#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

git config core.hooksPath .githooks
git config user.name "McCal-Codes"
git config user.email "business@mcc-cal.com"

Write-Host "Git hooks path set to .githooks for this repository."
Write-Host "Local git identity set to: McCal-Codes <business@mcc-cal.com>"
Write-Host "prepare-commit-msg strips Co-authored-by trailers (McCal-Codes-only policy)."
