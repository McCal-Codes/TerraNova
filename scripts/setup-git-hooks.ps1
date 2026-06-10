#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
git config core.hooksPath .githooks
Write-Host "Git hooks path set to .githooks for this repository."
Write-Host "Commits must use: McCal <business@mcc-cal.com>"
