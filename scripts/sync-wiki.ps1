<#
.SYNOPSIS
  Publish the staged wiki/ pages to the GitHub Wiki repo.

.DESCRIPTION
  Mirrors the local wiki/ folder into a clone of
  https://github.com/baoloc7401/archive-of-experiments.wiki.git and pushes.

  One-time setup before first run:
    1. Repo Settings -> Features -> enable "Wikis".
    2. Open https://github.com/baoloc7401/archive-of-experiments/wiki and click
       "Create the first page" and Save (any content) - this initializes the
       .wiki git repo so it can be cloned.

  Then run this script from the repo root:  ./scripts/sync-wiki.ps1
#>
[CmdletBinding()]
param(
  [string]$WikiUrl   = "https://github.com/baoloc7401/archive-of-experiments.wiki.git",
  [string]$Message   = "docs: sync project wiki"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$staging  = Join-Path $repoRoot "wiki"
$clone    = Join-Path (Split-Path -Parent $repoRoot) "archive-of-experiments.wiki"

if (-not (Test-Path $staging)) { throw "No staging folder at $staging" }

if (Test-Path (Join-Path $clone ".git")) {
  Write-Host "Updating existing wiki clone at $clone"
  git -C $clone pull --ff-only
} else {
  Write-Host "Cloning wiki repo -> $clone"
  git clone $WikiUrl $clone
  if ($LASTEXITCODE -ne 0) {
    throw "Clone failed. Enable Wikis and create the first page in the browser (see script header), then retry."
  }
}

# Mirror staged pages into the clone, preserving the clone's .git directory.
Write-Host "Mirroring $staging -> $clone"
robocopy $staging $clone /MIR /XD ".git" | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

git -C $clone add -A
$pending = git -C $clone status --porcelain
if ([string]::IsNullOrWhiteSpace($pending)) {
  Write-Host "No changes to publish."
  return
}

git -C $clone commit -m $Message
git -C $clone push
Write-Host "Wiki published: https://github.com/baoloc7401/archive-of-experiments/wiki"
