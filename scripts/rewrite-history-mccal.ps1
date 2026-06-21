#Requires -Version 5.1
<#
.SYNOPSIS
  Rewrites unlisted commit identities to McCal; preserves listed human contributors.

.DESCRIPTION
  Keeps commits authored by:
    McCal, nmang004, ZenithDevHQ, LeoWherle, derrickmehaffy
  (matched by email allowlist in scripts/filter-repo-commit-callback.py)

  Any other author/committer not on the allowlist is re-attributed to
  McCal <business@mcc-cal.com>.

  YOU must force-push afterward — this script does not push.

  Requires: pip install git-filter-repo  OR  git filter-repo on PATH
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (git status --porcelain) {
  Write-Error "Working tree must be clean before history rewrite."
}

$origin = git remote get-url origin 2>$null
if ($origin -notmatch "McCal-Codes/TerraNova") {
  Write-Warning "origin is '$origin' — expected McCal-Codes/TerraNova"
  $confirm = Read-Host "Continue anyway? (y/N)"
  if ($confirm -ne "y") { exit 1 }
}

git branch backup/pre-selective-rewrite 2>$null
Write-Host "Backup ref: backup/pre-selective-rewrite"

$filterRepo = Get-Command git-filter-repo -ErrorAction SilentlyContinue
if (-not $filterRepo) {
  Write-Error "git-filter-repo not found. Install: pip install git-filter-repo"
}

$callbackPath = Join-Path $Root "scripts/filter-repo-commit-callback.py"
if (-not (Test-Path $callbackPath)) {
  Write-Error "Missing callback: $callbackPath"
}

git filter-repo --force --commit-callback $callbackPath

Write-Host ""
Write-Host "Rewrite complete. Expected authors (GitHub contributors):"
Write-Host "  McCal-Codes, nmang004, ZenithDevHQ, LeoWherle, derrickmehaffy"
Write-Host ""
Write-Host "Verify:"
git shortlog -sne --all
Write-Host ""
Write-Host "Next (manual):"
Write-Host "  git push origin main --force"
Write-Host "  git push origin --force --tags"
