[CmdletBinding()]
param(
  [ValidateSet('Baseline', 'Stash', 'PlanSyntax')]
  [string]$Mode = 'Baseline'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$evidencePath = Join-Path $PSScriptRoot '2026-09-23-unmerged-work-evidence.json'
$planPath = Join-Path $PSScriptRoot '2026-09-23-unmerged-work-integration.md'
$evidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json

function Read-Git {
  param([string]$Directory, [string[]]$Arguments)
  $result = @(& git --no-optional-locks -C $Directory @Arguments)
  if ($LASTEXITCODE -ne 0) { throw "Git failed: $($Arguments -join ' ')" }
  return $result
}

if ($Mode -eq 'PlanSyntax') {
  $markdown = Get-Content -LiteralPath $planPath -Raw
  $blocks = [regex]::Matches($markdown, '(?ms)^```powershell\r?\n(.*?)^```')
  if ($blocks.Count -eq 0) { throw 'No PowerShell blocks found.' }
  $blockNumber = 0
  foreach ($block in $blocks) {
    $blockNumber++
    $parseTokens = $null
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseInput(
      $block.Groups[1].Value, [ref]$parseTokens, [ref]$parseErrors
    )
    if ($parseErrors.Count -gt 0) {
      throw "Block $blockNumber has syntax errors: $($parseErrors.Message -join '; ')"
    }
  }
  Write-Output "PASS: $blockNumber PowerShell blocks parse; none were executed."
  exit 0
}

if ($Mode -eq 'Stash') {
  $stashIds = @(Read-Git $evidence.root @('stash', 'list', '--format=%H'))
  $verified = 0
  foreach ($stash in $evidence.stashes) {
    if ($stash.sha -notin $stashIds) { throw "Recorded stash is no longer present: $($stash.sha)" }
    foreach ($file in $stash.files) {
      $revision = if ($file.kind -eq 'untracked') { "$($stash.sha)^3" } else { $stash.sha }
      $saved = Read-Git $evidence.root @('rev-parse', ('{0}:{1}' -f $revision, $file.path))
      $current = Read-Git $evidence.root @('rev-parse', ('origin/master:{0}' -f $file.path))
      if ($saved -ne $current) { throw "Stash differs from origin/master: $($file.path)" }
      $verified++
    }
  }
  Write-Output "PASS: $verified saved file blobs equal origin/master. Stashes retained."
  exit 0
}

$master = Read-Git $evidence.root @('rev-parse', 'master')
$tracking = Read-Git $evidence.root @('rev-parse', 'origin/master')
if ($master -ne $evidence.master -or $tracking -ne $evidence.originMaster) {
  throw 'Master changed. Re-audit before executing snapshot-specific tasks.'
}
$planArtifacts = @(
  'docs/superpowers/plans/2026-09-23-unmerged-work-integration.md',
  'docs/superpowers/plans/2026-09-23-unmerged-work-evidence.json',
  'docs/superpowers/plans/2026-09-23-unmerged-work-verify.ps1'
)
$fileCount = 0
foreach ($worktree in $evidence.worktrees) {
  if (-not (Test-Path -LiteralPath $worktree.path -PathType Container)) {
    throw "Missing worktree: $($worktree.path)"
  }
  $head = Read-Git $worktree.path @('rev-parse', 'HEAD')
  if ($head -ne $worktree.head) { throw "HEAD changed: $($worktree.path)" }
  $currentStatus = @(Read-Git $worktree.path @('status', '--porcelain=v1', '--untracked-files=all'))
  $isPrimary = [IO.Path]::GetFullPath($worktree.path) -eq [IO.Path]::GetFullPath($evidence.root)
  if ($isPrimary) {
    $currentStatus = @($currentStatus | Where-Object { $_.Substring(3) -notin $planArtifacts })
  }
  $recordedStatus = @($worktree.files | ForEach-Object { '{0} {1}' -f $_.status, $_.path })
  if (($currentStatus -join "`n") -ne ($recordedStatus -join "`n")) {
    throw "Git status changed: $($worktree.path)"
  }
  foreach ($file in $worktree.files) {
    $fullPath = Join-Path $worktree.path $file.path
    if ($null -ne $file.sha256) {
      if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing file: $fullPath" }
      $actualHash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actualHash -ne $file.sha256) { throw "Content changed: $fullPath" }
    }
    $fileCount++
  }
}
Write-Output "PASS: $($evidence.worktrees.Count) worktrees and $fileCount dirty-file fingerprints match the recorded baseline."
