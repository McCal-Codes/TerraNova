#Requires -Version 5.1
<#
.SYNOPSIS
  Removes gitignored local-only paths from repository history (maintainer use).

.DESCRIPTION
  Uses git-filter-repo with scripts/filter-repo-commit-callback.py to drop
  local-only paths (see .gitignore) and normalize commit metadata.

  Does NOT push. After verify: git push origin main --force && git push origin --force --tags
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (git status --porcelain) {
  Write-Error "Working tree must be clean before history rewrite."
}

$filterRepo = Get-Command git-filter-repo -ErrorAction SilentlyContinue
if (-not $filterRepo) {
  Write-Error "git-filter-repo not found. Install: pip install git-filter-repo"
}

$callbackPath = Join-Path $Root "scripts/filter-repo-commit-callback.py"
if (-not (Test-Path $callbackPath)) {
  Write-Error "Missing callback: $callbackPath"
}

git branch "backup/pre-artifact-purge-$(Get-Date -Format yyyyMMdd-HHmmss)" 2>$null

git filter-repo --force `
  --commit-callback $callbackPath `
  --path AGENTS.md --invert-paths `
  --path docs/AI_TRANSPARENCY.md --invert-paths `
  --path docs/planning --invert-paths `
  --path .cursor --invert-paths

Write-Host ""
Write-Host "Rewrite complete. Verify with: git log main --oneline -20"
Write-Host ""
Write-Host "Next (manual, destructive):"
Write-Host "  git push origin main --force"
Write-Host "  git push origin --force --tags"
