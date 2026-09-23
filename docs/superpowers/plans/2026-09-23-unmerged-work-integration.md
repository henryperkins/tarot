# Unmerged Work Preservation and Integration Implementation Plan

> Execution status: this is the preserved planning snapshot. See
> [the local integration checkpoint](2026-09-23-unmerged-work-integration-status.md)
> for actual candidates, checks, blockers and deferrals. Publication/release and
> cleanup remain pending; the initial baseline is not a claim about current state.

> **For agentic workers:** Use `superpowers:executing-plans` for sequential execution. Use `superpowers:using-git-worktrees` before creating the verification or guidance worktrees. Steps use checkbox syntax. Do not dispatch agents unless the execution instruction explicitly chooses that method.

**Goal:** Preserve every outstanding workstream, integrate narrative remediation first, reconcile the Worker MCP migration, evaluate Midnight Reading Room, refresh dependency updates, and remove only proven redundant Git state.

**Architecture:** Keep each feature independently reviewable. Preserve work in its existing worktree before integration, test committed candidates in separate verification worktrees, and distinguish local verification, GitHub publication, migration/deployment, and rendered production checks. This is an execution task list, not an instruction to run all external or destructive actions now.

**Tech Stack:** PowerShell 7, Git 2.55, Node 24, React/Vite, Node test runner, Playwright Chromium/WebKit, Cloudflare Worker/D1/KV, GitHub CLI. Source CI uses Node 24; older MCP notes mentioning Node 20 are stale.

**Spec:** The user's six-step recommendation request in this conversation, reproduced by Tasks 1–12 below; narrative behavior is governed by `C:/Users/htper/.codex/worktrees/narrative-remediation/tarot/docs/superpowers/specs/2026-09-23-personalized-narrative-remediation.md`. MCP architecture is governed by `C:/Users/htper/tarot-chatgpt-mcp/docs/superpowers/specs/2026-09-22-chatgpt-mcp-journal-design.md`, with the source-driven compatibility amendment in Task 5.

## Global constraints

- Target **master**, not main. Audited local/tracking/live SHA: `3946e1ada5fda13d93d82c34719ce267881f9825`.
- This planning delivery changes only this plan, its JSON evidence manifest, and its read-only verifier. Execute the checklist only when implementation is requested.
- No broad staging, force push, hard reset, `git clean`, blanket ours/theirs conflict resolution, or forced worktree removal.
- Preserve `.claude/settings.local.json` as a local preference. Do not publish credentials, `.dev.vars`, OAuth/PKCE state, local databases, or unrelated artifacts.
- The original checkout may hold documentation work. MCP implementation commands run in `C:/Users/htper/tarot-chatgpt-mcp`, respecting its existing plan's worktree constraint.
- Source `.github/workflows/deploy.yml` runs CI and Playwright, then migrations/deployment on a push to master. A GitHub merge is therefore a release operation, not housekeeping.
- Existing MCP Task 18 says: **“Ask the owner before each step and wait for a yes.”** Honor its separate infrastructure and push/PR steps, carrying forward any explicit session authorization. [Exact source](C:/Users/htper/tarot-chatgpt-mcp/docs/superpowers/plans/2026-09-23-chatgpt-mcp-journal.md).
- No provider-key setup or live model calls are needed for planning or focused tests. Full narrative/vision gates must state their backend and write outputs in a verification worktree. Do not assume synthetic/local evidence proves live model quality.
- All return codes matter. A collected browser test is not an executed test; a dry run is not a deployment; old test logs are not proof of an integrated candidate.

## Review focus

1. Dirty files change during execution: compare content hashes before preservation (Tasks 1–2).
2. Existing tests depend on an adapter the MCP branch deletes: port the browser fixture and update both workflow consumers (Task 6).
3. HTTP reflection behavior differs from MCP: protect whitespace, replacement, duplicate semantics, and concurrent writes explicitly (Task 5).
4. A pre-existing Vite server can make browser tests exercise the wrong checkout: require free ports and dedicated verification worktrees (Tasks 4, 7, 9).
5. Clean Git status does not protect ignored evidence/databases: inspect and preserve those separately before worktree removal (Task 12).

## Source and proof ledger

Machine-readable inventory, exact changed-file allowlists, content SHA-256 values, branch SHAs, and stash blob comparisons are in [the evidence manifest](2026-09-23-unmerged-work-evidence.json). Its timestamp is the authoritative snapshot time. The [verifier](2026-09-23-unmerged-work-verify.ps1) is read-only.

| Observation | Source or fresh proof | Consequence |
| --- | --- | --- |
| Narrative: 26 modified + 89 untracked files | Manifest worktree `codex/narrative-remediation`; HEAD `7e9170f` | Preserve all 115 files before updating its base. |
| Narrative tracked patch applies to current master | `git apply --check` in clean `tarot-astro-review-pr`: exit 0; 89 untracked paths have zero master collisions | Current integration is feasible; repeat if either side changes. This does not prove runtime compatibility. |
| Preservation staging rehearsed in temporary indexes | Narrative 115 paths, MCP 1, Midnight 1; all exact allowlist matches; real indexes untouched | Narrative's full whitespace check exits 2 for recorded document/CSS EOFs, Markdown hard breaks, and raw logs. Task 2 preserves these bytes; Task 3 handles the actionable EOFs without rewriting historical logs. |
| MCP: 22 ahead / 19 behind | `feat/chatgpt-mcp-journal` at `fdf3446` | Local feature plus one modified plan; no remote feature branch/PR. |
| MCP merge has 11 conflicted paths | `git merge-tree --write-tree --name-only origin/master feat/chatgpt-mcp-journal`: exit 1 | Use Task 5's resolution matrix; not a clean merge. |
| Midnight: 2 ahead / 30 behind | Local/remote branch at `57a0a94` | Preserve one untracked critique; evaluate separately. |
| Midnight merge has 5 conflicted paths | `git merge-tree --write-tree --name-only origin/master feat/midnight-reading-room`: exit 1 | Do not merge the entire redesign as a transition fix. |
| Narrative focused unit tests | Four named files in Task 4: **21 passed** | Existing local source proof only. |
| MCP focused unit tests | Four named files in Task 7: **68 passed** | Existing branch's own contract passes, not master compatibility. |
| Master journal/card compatibility tests | Three named files in Task 5: **16 passed** | Preserve these regressions during MCP integration. |
| Midnight focused unit tests | Three named files in Task 9: **21 passed** | Existing branch source proof only. |
| Playwright discovery | Narrative/follow-up/saved-intentions: **42 collected**; transition: **14 collected**; MCP OAuth: **1 collected** | Browser execution remains a future gate. Mobile transition CDP suspension is skipped at runtime. |
| Reflection incompatibility reproduced | MCP service stores `'  first\r\nsecond  '` differently, returns 400 for replace, and an 11-way append returned `200,200,200,409,409,409,409,409,409,409,409` | Task 5 is behavioral reconciliation, not just resolving conflict markers. |
| New migration regression executed against old branch | Task 5's exact three tests, with only import paths adjusted in a temporary file: **3 expected failures**, exit 1 | The test code is executable and detects the observed incompatibilities; these are red tests, not passing integration proof. |
| Shared master regression | `tests/journalWrites.integration.test.mjs:51` preserves whitespace; `:71` requires all 11 concurrent appends. `functions/api/journal/reflections.js:70` uses 32 attempts; `:183` supports replace | Do not discard these tests to make the new branch pass. |
| Branch service differences | MCP `functions/lib/journalReflections.js:11`, `:28`, `:160`, `:169` | Current service trims text, permits 3 attempts, and rejects mode. |
| Adapter still consumed by master | `e2e/journal-owner.spec.js:3`; `.github/workflows/ci.yml`; `.github/workflows/playwright.yml` | Removing the adapter requires replacement coverage and CI changes. |
| No unique stash work | Stash `5626d981e30c3bb6016838de718fa203dbf7a853`: 20 tracked + 6 untracked blobs equal master | Eligible for guarded cleanup later. |
| Duplicate references | 19 primary untracked files match narrative worktree copies byte-for-byte | Keep narrative copies canonical; remove primary duplicates only after preservation. |

Git merge simulation writes temporary Git objects but does not update files, index, or branches; see [Git merge-tree documentation](https://git-scm.com/docs/git-merge-tree). Wrangler commands below were checked against installed **4.71.0** help and the [official command reference](https://developers.cloudflare.com/workers/wrangler/commands/). No cloud resources were created.

## Dependency order and deliverables

`1 baseline -> 2 preservation -> 3 narrative integration -> 4 candidate gates -> 8 publication/release`

`2 MCP preservation -> 5 MCP reconciliation -> 6 test/CI migration -> 7 MCP gates -> 8 publication/release`

`4/8 narrative result -> 9 Midnight decision/transition fix -> 10 dependency refresh -> 11 documentation -> 12 cleanup`

Task 8 is a reusable release procedure for one reviewed candidate at a time. Task 11 can publish its already-preserved docs independently. Cleanup does not depend on shipping every feature, but it may remove only state proven redundant at that point.

## Task 1: Establish the executable baseline

**Files:** Read the evidence manifest, verifier, root `AGENTS.md`, package scripts, and the workflow sources above.

**Produces:** `$Evidence`, worktree paths, a fresh proof directory, and fail-fast command helpers. Run this bootstrap once in PowerShell 7; subsequent blocks share these variables.

- [ ] Run the bootstrap and baseline/stash checks. If a baseline hash or branch differs, update the inventory and path allowlists before continuing; do not overwrite the new work.

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$Root = 'C:\Users\htper\tarot'
$Nar = 'C:\Users\htper\.codex\worktrees\narrative-remediation\tarot'
$Mcp = 'C:\Users\htper\tarot-chatgpt-mcp'
$Midnight = 'C:\Users\htper\tarot-midnight-reading-room'
$PlanDir = Join-Path $Root 'docs/superpowers/plans'
$Verifier = Join-Path $PlanDir '2026-09-23-unmerged-work-verify.ps1'
$Evidence = Get-Content (Join-Path $PlanDir '2026-09-23-unmerged-work-evidence.json') -Raw | ConvertFrom-Json
$Proof = Join-Path ([IO.Path]::GetTempPath()) ('tarot-integration-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $Proof
function Invoke-Checked {
  param([string]$Program, [string[]]$ArgumentList)
  & $Program @ArgumentList
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $Program $($ArgumentList -join ' ')" }
}
function Invoke-Logged {
  param([string]$Name, [string]$Program, [string[]]$ArgumentList, [switch]$AllowFailure)
  $logPath = Join-Path $Proof ($Name + '.txt')
  & $Program @ArgumentList 2>&1 | Tee-Object -FilePath $logPath | Out-Host
  $commandExit = $LASTEXITCODE
  [pscustomobject]@{ name = $Name; exitCode = $commandExit; log = $logPath } |
    ConvertTo-Json -Compress | Add-Content (Join-Path $Proof 'commands.jsonl')
  if ($commandExit -ne 0 -and -not $AllowFailure) { throw "$Name failed; read $logPath" }
}
function Assert-FreePort {
  param([int]$Port)
  if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is occupied. Identify its owner; do not reuse an unknown server."
  }
}
Invoke-Checked git @('-C', $Root, 'fetch', '--all', '--no-prune', '--no-tags', '--no-write-fetch-head')
Invoke-Checked pwsh @('-NoProfile', '-File', $Verifier, '-Mode', 'Baseline')
Invoke-Checked pwsh @('-NoProfile', '-File', $Verifier, '-Mode', 'Stash')
Invoke-Checked pwsh @('-NoProfile', '-File', $Verifier, '-Mode', 'PlanSyntax')
Invoke-Checked node @('--version')
```

**Done when:** Baseline reports 8 worktrees / 140 dirty-file fingerprints; stash reports 26 identical blobs; Node major is 24. This exact baseline check is intentionally expected to fail after preservation commits; later tasks use their newly recorded SHAs.

## Task 2: Preserve outstanding work with exact allowlists

**Files:** Every manifest-listed narrative file; the MCP plan; the Midnight critique; the three primary guidance files. Preserve source, specs, and their linked evidence together. Review generated text/JSON/logs before publishing them; a local preservation commit is not publication approval.

**Produces:** Three preservation commits and a separate guidance branch. Original primary files and local settings remain intact.

- [ ] Confirm the three feature indexes are empty. Stage the exact manifest paths, compare staged names with the allowlist, inspect the staged diff, and commit each workstream separately.

```powershell
$PreservationEntries = @(
  @{ Path = $Nar; Message = 'feat: preserve verified narrative remediation and evidence' },
  @{ Path = $Mcp; Message = 'docs: preserve MCP journal plan amendments' },
  @{ Path = $Midnight; Message = 'docs: preserve midnight reading room critique' }
)
foreach ($entry in $PreservationEntries) {
  $directory = $entry.Path
  $record = $Evidence.worktrees | Where-Object { [IO.Path]::GetFullPath($_.path) -eq [IO.Path]::GetFullPath($directory) }
  $staged = @(& git -C $directory diff --cached --name-only)
  if ($LASTEXITCODE -ne 0 -or $staged.Count) { throw "Review existing index first: $directory" }
  $allowlist = @($record.files.path)
  Invoke-Checked git (@('-C', $directory, 'add', '--') + $allowlist)
  $actual = @(& git -C $directory diff --cached --name-only)
  if (Compare-Object ($allowlist | Sort-Object) ($actual | Sort-Object)) { throw 'Staged path mismatch' }
  if ($directory -eq $Nar) {
    Invoke-Logged 'narrative-preservation-whitespace' git @('-C', $directory, 'diff', '--cached', '--check') -AllowFailure
    # Compare diagnostics with the evidence manifest. Known formatting is preserved
    # byte-for-byte here; additional diagnostics require investigation before commit.
  } else {
    Invoke-Checked git @('-C', $directory, 'diff', '--cached', '--check')
  }
  Invoke-Checked git @('-C', $directory, 'diff', '--cached', '--stat')
}
```

- [ ] Inspect each staged diff, confirm the exact path/content review and the recorded narrative whitespace exceptions, then create the preservation commits. Staging and committing are intentionally separate executable blocks.

```powershell
foreach ($entry in $PreservationEntries) {
  $directory = $entry.Path
  Invoke-Checked git @('-C', $directory, 'commit', '-m', $entry.Message)
  Invoke-Checked git @('-C', $directory, 'status', '--short')
  & git -C $directory rev-parse HEAD | Add-Content (Join-Path $Proof 'preservation-shas.txt')
}
```

- [ ] Preserve primary guidance and this task package in a new documentation worktree. The path and branch must not already exist. Use the worktree skill's directory checks first.

```powershell
$Guidance = 'C:\Users\htper\.codex\worktrees\guidance-preservation\tarot'
if (Test-Path -LiteralPath $Guidance) { throw 'Guidance worktree path already exists' }
Invoke-Checked git @('-C', $Root, 'worktree', 'add', '-b', 'chore/preserve-agent-guidance', $Guidance, 'origin/master')
$GuidanceFiles = @(
  'CLAUDE.md', 'functions/CLAUDE.md', 'scripts/CLAUDE.md',
  'docs/superpowers/plans/2026-09-23-unmerged-work-integration.md',
  'docs/superpowers/plans/2026-09-23-unmerged-work-evidence.json',
  'docs/superpowers/plans/2026-09-23-unmerged-work-verify.ps1'
)
foreach ($relative in $GuidanceFiles) {
  $destination = Join-Path $Guidance $relative
  $null = New-Item -ItemType Directory -Force -Path (Split-Path $destination)
  Copy-Item -LiteralPath (Join-Path $Root $relative) -Destination $destination
}
Invoke-Checked git (@('-C', $Guidance, 'add', '--') + $GuidanceFiles)
Invoke-Checked git @('-C', $Guidance, 'diff', '--cached', '--check')
Invoke-Checked git @('-C', $Guidance, 'diff', '--cached', '--stat')
# Inspect the large CLAUDE.md reduction, including guidance moved or removed.
Invoke-Checked git @('-C', $Guidance, 'commit', '-m', 'docs: preserve scoped agent guidance and integration runbook')
```

**Done when:** Each preserved file is represented by a commit and the three feature worktrees are clean. Primary documentation copies remain uncommitted but are also preserved on the guidance branch; `.claude/settings.local.json` remains a local preference. Retain those copies until Task 12 verifies their committed equivalents. Do not remove duplicate references yet.

## Task 3: Integrate narrative remediation with current master

**Files:** The 115 preserved files, especially `FollowUpModal.jsx`, `FollowUpChat.jsx`, `useModalA11y.js`, `useKeyboardOffset.js`, `FeedbackPanel.jsx`, `MarkdownRenderer.jsx`, `ParticleLayer.jsx`, theme styles, source-usage model, and their tests. Exact paths come from the manifest, not directory-wide staging.

**Consumes:** Clean narrative preservation commit. **Produces:** A candidate containing current master plus only narrative work.

- [ ] Record the pre-integration SHA, fetch, then merge current master into the preserved narrative branch. Do not copy whole files from the old base over newer master changes.

```powershell
Set-Location -LiteralPath $Nar
$NarrativeBefore = (& git rev-parse HEAD).Trim()
if (@(& git status --porcelain).Count) { throw 'Narrative worktree must be clean' }
Invoke-Checked git @('fetch', 'origin', '--no-prune', '--no-tags', '--no-write-fetch-head')
Invoke-Checked git @('merge', '--no-edit', 'origin/master')
Invoke-Checked git @('diff', '--stat', 'origin/master...HEAD')
Invoke-Checked git @('merge-base', '--is-ancestor', 'origin/master', 'HEAD')
```

- [ ] Remove only the extra EOF blank lines in the two new reports and stylesheet. The preservation commit retains the original bytes. Keep intentional Markdown hard breaks in the specification and raw historical evidence logs; check those as explicit formatting exceptions, not a false full whitespace pass.

```powershell
$EofFiles = @(
  'docs/superpowers/plans/2026-09-23-narrative-semantics-report.md',
  'docs/superpowers/plans/2026-09-23-narrative-theme-report.md',
  'src/styles/follow-up.css'
)
foreach ($relative in $EofFiles) {
  $content = Get-Content -LiteralPath $relative -Raw
  [IO.File]::WriteAllText((Join-Path $Nar $relative), $content.TrimEnd("`r", "`n") + "`n", [Text.UTF8Encoding]::new($false))
}
Invoke-Checked git (@('add', '--') + $EofFiles)
Invoke-Checked git @('diff', '--cached', '--check')
Invoke-Checked git @('commit', '-m', 'style: normalize narrative source and report endings')
$NarrativeSpec = 'docs/superpowers/specs/2026-09-23-personalized-narrative-remediation.md'
Invoke-Checked git @('diff', '--check', 'origin/master...HEAD', '--', '.', ':(exclude)output/**', ":(exclude)$NarrativeSpec")
Invoke-Checked git @('-c', 'core.whitespace=-blank-at-eol', 'diff', '--check', 'origin/master...HEAD', '--', $NarrativeSpec)
$NarrativeCandidate = (& git rev-parse HEAD).Trim()
```

- [ ] Compare the candidate's changed paths with the narrative allowlist. If master advanced into the same files, resolve individual hunks while retaining master astronomy, card identity, owner-journal, workflow, and package changes.
- [ ] Review the actual diff against the narrative specification: one persistent chat portal; preserved draft/messages/consent/request identity; native feedback; contextual headings; mounted skip destinations; model-derived source states; particle cancellation ownership.

**Done when:** Master is an ancestor, no conflict markers remain, and the delta is limited to the preserved narrative scope. The earlier apply check is supporting evidence, not a substitute for this check.

## Task 4: Verify the narrative candidate from its exact commit

**Files:** Candidate package scripts; `tests/{narrativeFocusTarget,narrativeSemantics,particleLifecycle,sourceUsageSummary}.test.mjs`; `e2e/{narrative-remediation,follow-up-questions,saved-intentions-modal,accessibility,journal-owner}.spec.js`; `playwright*.config.js`.

**Produces:** Logs tied to `$NarrativeCandidate`, with full gates distinct from focused checks and historical reports.

- [ ] Create a clean detached verification worktree. Install the root and adapter dependencies required by current CI.

```powershell
$Verify = 'C:\Users\htper\.codex\worktrees\narrative-integration-verification\tarot'
if (Test-Path -LiteralPath $Verify) { throw 'Verification worktree already exists; inspect it first' }
Invoke-Checked git @('-C', $Nar, 'worktree', 'add', '--detach', $Verify, $NarrativeCandidate)
Set-Location -LiteralPath $Verify
Invoke-Logged 'narrative-install' npm.cmd @('ci')
Invoke-Logged 'adapter-install' npm.cmd @('ci', '--prefix', 'mcp/tableau-adapter')
Invoke-Logged 'narrative-focused' node @('--test', 'tests/narrativeFocusTarget.test.mjs', 'tests/narrativeSemantics.test.mjs', 'tests/particleLifecycle.test.mjs', 'tests/sourceUsageSummary.test.mjs')
Invoke-Logged 'narrative-unit' npm.cmd @('test')
Invoke-Logged 'adapter-unit' npm.cmd @('run', 'test:mcp')
Invoke-Logged 'deploy-unit' npm.cmd @('run', 'test:deploy')
Invoke-Logged 'cloudflare-lint' npm.cmd @('run', 'lint:cloudflare')
Invoke-Logged 'narrative-build' npm.cmd @('run', 'build')
Invoke-Logged 'design-gate' npm.cmd @('run', 'gate:design')
Invoke-Logged 'static-accessibility' npm.cmd @('run', 'test:a11y')
Invoke-Logged 'full-lint' npm.cmd @('run', 'lint') -AllowFailure
```

- [ ] Compare lint failures with a current-master baseline from a clean verification checkout if they remain. Do not accept an error-count comparison alone: identify files/rules and reject newly introduced failures. The old narrative report's 146 errors are historical, not a current allowance.
- [ ] Run browser gates with no unrelated server listening. Current frontend config uses port 5173; journal config uses 5176. The accessibility config always permits reuse, so the free-port check is mandatory even with CI set.

```powershell
$PreviousCI = $env:CI
try {
  $env:CI = '1'
  Assert-FreePort 5173
  Invoke-Logged 'narrative-browser' '.\node_modules\.bin\playwright.cmd' @('test', 'e2e/narrative-remediation.spec.js', 'e2e/follow-up-questions.spec.js', 'e2e/saved-intentions-modal.spec.js', '--workers=1', '--reporter=line')
  Assert-FreePort 5173
  Invoke-Logged 'rendered-accessibility' npm.cmd @('run', 'test:a11y:e2e', '--', '--workers=1', '--reporter=line')
  Assert-FreePort 5173
  Invoke-Logged 'frontend-browser-full' '.\node_modules\.bin\playwright.cmd' @('test', '--config=playwright.config.js', '--workers=1', '--reporter=line')
  Assert-FreePort 5176
  Invoke-Logged 'journal-browser' npm.cmd @('run', 'test:e2e:journal')
} finally { $env:CI = $PreviousCI }
```

- [ ] Run both QA gates required by `.github/workflows/ci.yml`. These write under `data/evaluations`; this is why they run in the disposable verification worktree. Record actual backend/provider and flagged samples. Inspect the environment by variable names/presence only; do not dump secrets. Use the established configured provider only when live-provider evaluation is authorized; otherwise explicitly select `NARRATIVE_EVAL_BACKEND=local-composer` and label it local proof. A failed gate blocks release until fixed or explicitly dispositioned; never lower thresholds to make the run green.

```powershell
Invoke-Logged 'vision-gate' npm.cmd @('run', 'ci:vision-check')
Invoke-Logged 'narrative-gate' npm.cmd @('run', 'ci:narrative-check')
Invoke-Checked git @('status', '--short')
Copy-Item -LiteralPath 'data/evaluations' -Destination (Join-Path $Proof 'evaluation-results') -Recurse
```

- [ ] Add a concise candidate verification record to the narrative worktree's existing implementation report, with exact commit, commands, counts, lint disposition, backend, screenshots, and limitations. Commit that report using its single explicit path, then verify the final source tree differs from the tested candidate only by this report. If executable files changed, repeat affected gates.

**Done when:** Required gates pass on the candidate; browser evidence covers 320/390/1440px, normal/reduced motion, short/200% text, nested-modal restoration, stale responses, and theme/source fixtures. Physical keyboard/device and spoken screen-reader evidence remain explicitly separate if unavailable. Continue with Task 8 for publication.

## Task 5: Reconcile MCP source and journal contracts

**Files:** The 11 conflict paths in the manifest, plus `functions/lib/journalReflections.js`, `functions/lib/journalEntries.js`, `functions/lib/mcp/tools/journal.js`, `functions/lib/journalAccess.js`, both journal test harnesses, `tests/journalWrites.integration.test.mjs`, and MCP spec/runbook.

**Consumes:** MCP plan preservation commit and current master. **Produces:** One consistent journal contract and a resolved integration candidate; no resource creation.

- [ ] Read the full MCP spec/plan in this worktree. Record an integration amendment: Worker OAuth/MCP remains the target; preserve current personal HTTP journal behavior while adding MCP's owner-bound/idempotent behavior. This amendment supersedes the old branch's whitespace normalization for reflections and its blanket removal of HTTP replacement behavior.
- [ ] Begin integration from a clean preserved MCP worktree. A merge exit of 1 with the known conflicts is an expected intermediate state, not permission to skip resolution.

```powershell
Set-Location -LiteralPath $Mcp
if (@(& git status --porcelain).Count) { throw 'Preserve MCP changes before integration' }
Invoke-Checked git @('fetch', 'origin', '--no-prune', '--no-tags', '--no-write-fetch-head')
$McpBefore = (& git rev-parse HEAD).Trim()
& git merge --no-commit --no-ff origin/master
if ($LASTEXITCODE -notin @(0, 1)) { throw 'Unexpected merge failure' }
Invoke-Checked git @('diff', '--name-only', '--diff-filter=U')
```

- [ ] Resolve these groups by behavior, staging each resolved path explicitly:

| Paths | Required resolution and regression |
| --- | --- |
| `functions/api/journal.js` | Use `saveAppJournalEntry` while preserving personal bearer/cookie identity, all saved metadata, owner-scoped seed dedupe, unseeded HTTP semantics, and current response fields. Keep master `tests/journalWrites.integration.test.mjs` assertions. |
| `functions/api/journal/reflections.js`, `functions/lib/journalReflections.js`, `tests/journalReflections.test.mjs` | Shared service must preserve submitted text verbatim; blank validation uses `trim()` only for emptiness. Retain HTTP append/replace and HTTP duplicate semantics; MCP is append-only and deduplicates exact retry operations. Preserve the flat index/`Overall` map. Raise contention handling to support the 11-way existing regression rather than the branch's 3-attempt limit. |
| `src/components/journal/entry-card/EntrySections/ReflectionsSection.jsx` | Combine branch card-position labels with master's rendering/card identity fixes; no raw numeric labels and no dropped reflection text. Preserve changes to `useEntryMetadata.js` and card display components that auto-merge. |
| `tarot-journal-actions.yaml` | Keep HTTP Actions contract aligned with HTTP behavior; document MCP snake_case tools separately. Do not apply an append-only HTTP schema while retaining replacement behavior. Parse YAML with the branch's explicit `js-yaml` dependency. |
| Adapter `.env.example`, README, package/lock, server; master-added adapter files | Complete retirement only after Task 6 replaces all runtime/test/workflow consumers. Delete the complete tracked adapter subtree, not just the five conflicted files, to avoid leaving an unusable partial package. |
| Root `package.json`, `package-lock.json` | Retain master additions needed by owner-journal regressions, add Worker MCP dependencies, remove retired adapter script entries, regenerate root lock with npm after resolving the manifest. Never hand-merge lock conflict blocks. |

- [ ] Use this explicit shared-service interface: extend `addJournalReflection({ env, user, entryId, input, policy = 'mcp' })` with an internal `policy` of `'http'` or `'mcp'`. The HTTP handler passes `'http'`; MCP tools pass `'mcp'`. Never accept policy from request JSON. Both preserve raw text and ownership. HTTP retains append/replace and normal repeated appends; MCP rejects `mode` and retains idempotent append outcomes. Preserve the master HTTP response shape. Apply the MCP cumulative limit only where the MCP contract requires it; do not silently add a new HTTP limit.
- [ ] Add `tests/journalContractMigration.test.mjs` with the following core regression. It deliberately fails against the current branch's service. Preserve all existing master journal/card tests; keep branch OAuth/job/idempotency tests, updating only assertions explicitly superseded by the recorded contract amendment.

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';
import { addJournalReflection } from '../functions/lib/journalReflections.js';

async function setup() {
  const DB = await createD1();
  await seedUser(DB);
  await seedEntry(DB);
  const user = { id: 'user-1', subscription_tier: 'plus', subscription_status: 'active' };
  const call = (input, policy = 'mcp') => addJournalReflection({
    env: { DB }, user, entryId: 'entry-1', input, policy
  });
  const notes = () => JSON.parse(DB.rows(
    'SELECT reflections_json FROM journal_entries WHERE id = ?', ['entry-1']
  )[0].reflections_json);
  return { call, notes };
}

test('MCP preserves exact reflection text and an identical retry adds nothing', async () => {
  const { call, notes } = await setup();
  const input = { scope: 'reading', text: '  first\r\nsecond  ' };
  assert.equal((await call(input)).status, 200);
  assert.equal(notes().Overall, input.text);
  assert.equal((await call(input)).status, 200);
  assert.equal(notes().Overall, input.text);
  assert.equal((await call({ ...input, mode: 'replace' })).status, 400);
});

test('HTTP replacement remains available without exposing it through MCP', async () => {
  const { call, notes } = await setup();
  await call({ scope: 'reading', text: 'original' }, 'http');
  const input = { scope: 'reading', text: '  replacement  ', mode: 'replace' };
  assert.equal((await call(input, 'http')).status, 200);
  assert.equal(notes().Overall, input.text);
});

test('all eleven distinct concurrent MCP appends survive contention', async () => {
  const { call, notes } = await setup();
  const results = await Promise.all(Array.from({ length: 11 }, (_, index) =>
    call({ scope: 'reading', text: `note-${index};` })
  ));
  assert.deepEqual(results.map(result => result.status), Array(11).fill(200));
  for (let index = 0; index < 11; index++) {
    assert.ok(notes().Overall.includes(`note-${index};`));
  }
});
```

- [ ] Run the new test red, implement the policy/raw-text/contention changes, then run it green together with `tests/journalWrites.integration.test.mjs`, `tests/journalCardIdentity.test.mjs`, `tests/readingRequestCards.test.mjs`, and branch journal tests. Add assertions that HTTP repeated append is not deduplicated, a JSON `policy` cannot enable replacement in MCP, and empty/overlong/foreign-owner cases retain their existing outcomes.
- [ ] Preserve the intentional synthetic-service-account denial (`service_account_journal_forbidden`) as a documented migration change. Replace the old test that permits synthetic journal writes with an explicit denial assertion; retain personal bearer/cookie success. Do not weaken authorization tests to resolve a conflict.

**Done when:** No unresolved Git entries remain in these groups and the compatibility tests prove both public HTTP and Worker MCP semantics. Task 6 must finish before committing the integration merge.

## Task 6: Replace retired adapter consumers and preserve CI coverage

**Files:** `.github/workflows/ci.yml`, `.github/workflows/playwright.yml`, `package.json`, `e2e/journal-owner.spec.js`, `tests/helpers/mcpClient.mjs`, `tests/helpers/fakeReadingJobs.mjs`, `tests/helpers/journalFixtures.mjs`, `playwright.journal.config.js`, `mcp/tableau-adapter/**`.

**Interfaces:** Existing `connectMcpClient(options)` returns `{ client, close() }` for `createTableuMcpServer`. Use `{ env, user, waitUntil }`, the SQLite D1 fixture, and `createFakeReadingJobs({ runReading: readingRunner({ reading: SAVED_READING.personalReading, requestId: 'fixture-reading' }) })`; see branch `tests/mcpJournalTools.test.mjs:21` for the working session setup. Do not simulate MCP with canned tool results.

- [ ] Port `e2e/journal-owner.spec.js` away from its line-3 adapter import. Keep all four width/deck cases (1440 RWS, 390 RWS, 320 RWS, 390 Thoth), actual MCP dispatch, app GET/render, narrative fidelity, reflection labels, and card images/orientation assertions.
- [ ] Map tool calls precisely: `drawTarotReading` -> `draw_tarot_reading`; wait for fake jobs to settle; `saveReadingToJournal` -> `save_reading_to_journal` with `jobId/jobToken`; `addReflectionToJournalEntry` -> `add_reflection_to_journal_entry` with `entryId`. Check `structuredContent.entry.id` and `outcome`; do not assume the retired adapter's `savePayload` response still exists.
- [ ] Seed the same owner and app session into the same DB used by MCP, route only journal/auth API calls into real production handlers, and stub only the expensive narrative provider/unrelated endpoints. Always close the MCP client and fixture in `finally`.
- [ ] In `ci.yml`, retain Node 24, root `npm test`, deploy tests, Cloudflare lint, vision gate, and narrative gate. Replace adapter installation/testing steps with Worker MCP coverage already included in root tests; retain explicit named MCP coverage if useful. In `playwright.yml`, remove adapter installation only after the journal fixture has migrated, and retain the separate journal browser run. Keep `playwright.config.js` excluding the separately configured journal spec.
- [ ] Enumerate `git ls-files mcp/tableau-adapter` and remove the reviewed tracked subtree with `git rm -r -- mcp/tableau-adapter`. Preserve ignored logs separately; do not delete the filesystem directory recursively. Remove obsolete package script entries and update active docs; historical specs may mention the retired adapter.
- [ ] Validate imports and collection before committing:

```powershell
Set-Location -LiteralPath $Mcp
Invoke-Logged 'mcp-install' npm.cmd @('install', '--package-lock-only')
Invoke-Logged 'mcp-ci-install' npm.cmd @('ci')
Invoke-Logged 'mcp-compatibility' node @('--test', 'tests/journalContractMigration.test.mjs', 'tests/journalWrites.integration.test.mjs', 'tests/journalCardIdentity.test.mjs', 'tests/readingRequestCards.test.mjs', 'tests/journalReflections.test.mjs')
Invoke-Logged 'migrated-journal-collection' '.\node_modules\.bin\playwright.cmd' @('test', '--config', 'playwright.journal.config.js', '--list')
Invoke-Logged 'oauth-collection' '.\node_modules\.bin\playwright.cmd' @('test', '--config', 'playwright.mcp.config.js', '--list')
Invoke-Checked git @('diff', '--check')
if (@(& git diff --name-only --diff-filter=U).Count) { throw 'Unresolved merge entries remain' }
```

- [ ] Review `rg -n 'mcp/tableau-adapter|tableau-adapter' .github package.json e2e tests src functions`; active imports/scripts/workflows must be absent. Review remaining documentation matches individually. Stage only the explicitly resolved/changed paths, inspect `git diff --cached`, then commit the merge with `feat: integrate Worker MCP with current journal contracts`.

**Done when:** A clean MCP candidate has both root and migrated journal tests discoverable; no workflow depends on the deleted package. Record `$McpCandidate = git rev-parse HEAD`.

## Task 7: Verify MCP locally before infrastructure/publication

**Files:** Candidate MCP/journal tests, `e2e/mcpOAuthRouting.integration.spec.js`, migrated journal spec, `wrangler.jsonc`, migrations 0030/0031, and `docs/integrations/openai/chatgpt-mcp.md`.

- [ ] In the clean MCP worktree, run the focused suite below, root `npm test`, `npm run test:deploy`, `npm run lint:cloudflare`, `npm run build`, and relevant frontend/journal browser suites. Run full CI QA gates in a separate detached verification worktree as in Task 4. The retired adapter must no longer be installed there.

```powershell
Set-Location -LiteralPath $Mcp
Invoke-Logged 'mcp-focused' node @('--test', 'tests/mcpOAuth.test.mjs', 'tests/mcpJournalTools.test.mjs', 'tests/readingJobPrincipal.test.mjs', 'tests/journalEntriesService.test.mjs')
Invoke-Logged 'mcp-unit' npm.cmd @('test')
Invoke-Logged 'mcp-deploy-tests' npm.cmd @('run', 'test:deploy')
Invoke-Logged 'mcp-cloudflare-lint' npm.cmd @('run', 'lint:cloudflare')
Invoke-Logged 'mcp-build' npm.cmd @('run', 'build')
Invoke-Logged 'mcp-worker-bundle' '.\node_modules\.bin\wrangler.cmd' @('deploy', '--dry-run', '--config', 'wrangler.jsonc', '--outdir', '.wrangler/integration-dry-run')
Assert-FreePort 5176
Invoke-Logged 'mcp-journal-browser' npm.cmd @('run', 'test:e2e:journal')
```

- [ ] Follow the exact **Local development** section of the candidate MCP runbook: generate its localhost config without the remote-only AI binding, preserve `assets.run_worker_first`, apply migrations **locally**, set up a local entitled fixture, and start Wrangler on port 8787. That runbook contains the complete config-generation and fixture commands. Do not use production user IDs or tokens.
- [ ] With that independently running local Worker, execute the browser routing test. Its config deliberately has **no webServer**; a plain test command without the Worker is incomplete.

```powershell
Set-Location -LiteralPath $Mcp
Invoke-Logged 'mcp-oauth-browser' '.\node_modules\.bin\playwright.cmd' @('test', '--config', 'playwright.mcp.config.js')
```

- [ ] Exercise owner OAuth -> eight tools -> draw/wait -> save/retry -> card/whole-reading reflection/retry -> signed-in journal rendering. Require identical account ownership, unchanged narrative/card orientation, reusable Thoth labels, no duplicate writes, and denial after removing the owner allowlist. Keep local credentials out of proof artifacts and remove temporary local auth material after verification.
- [ ] Record exact candidate SHA, results, configured resource URL, and remaining full-lint debt. Historical branch test counts are not the acceptance threshold for the integrated candidate.

**Done when:** Tests, real local OAuth navigation, authenticated tool flow, journal rendering, and Worker bundle dry run succeed. No cloud namespace or production migration is implied by this step.

## Task 8: Publish and release one verified candidate

**Scope:** Run only for a reviewed candidate and within the user's publication/release authorization. Preserve the existing MCP Task 18 confirmation boundaries. Do not create resources just to make a draft plan executable.

- [ ] For MCP only, first perform the owner-confirmed `OAUTH_KV` step from its existing plan. Check for an already-created namespace before creating another. The checked creation syntax is `npx wrangler kv namespace create OAUTH_KV`. Insert the actual returned ID into the binding, commit only `wrangler.jsonc`, then rerun its bundle dry run. Do not put a made-up ID in the config.
- [ ] Build a concrete PR body file containing scope, candidate SHA, current test outcomes, screenshots/evidence, known lint limitations, and deployment/config steps. For MCP explicitly describe adapter retirement, HTTP/MCP contract distinctions, migrations 0030/0031, OAuth KV, and allowlist behavior.
- [ ] Publish the narrative branch using the concrete commands below after its local gates. For MCP use its separately confirmed branch `feat/chatgpt-mcp-journal`, from `$Mcp`; do not reuse the narrative body.

```powershell
Set-Location -LiteralPath $Nar
$PublishSha = (& git rev-parse HEAD).Trim()
$BodyPath = Join-Path $Proof 'narrative-pr.md'
@'
Fix follow-up dialog lifecycle, narrative semantics, feedback controls, source-state theming, and particle cleanup.

Verification and rendered evidence are recorded in docs/superpowers/plans/2026-09-23-personalized-narrative-remediation-report.md for the candidate commit. Preserve its exact results and limitations during review.

Merging to master triggers the repository deployment workflow after CI and Playwright.
'@ | Set-Content -LiteralPath $BodyPath
Invoke-Checked git @('push', '-u', 'origin', 'codex/narrative-remediation')
Invoke-Checked gh @('pr', 'create', '--draft', '--base', 'master', '--head', 'codex/narrative-remediation', '--title', 'fix: complete narrative interaction and accessibility remediation', '--body-file', $BodyPath)
Invoke-Checked gh @('pr', 'view', 'codex/narrative-remediation', '--json', 'url,headRefOid,state,statusCheckRollup')
Invoke-Checked git @('ls-remote', 'origin', 'refs/heads/codex/narrative-remediation')
```

- [ ] If a PR already exists, update that PR's body using `gh pr edit --body-file` instead of creating a duplicate. Confirm local, remote, and PR head SHAs match. Complete review and required checks before marking ready.
- [ ] At the separately authorized release step, merge the reviewed exact head through GitHub; monitor CI, Playwright, migration/deployment logs, and then inspect the production UI/API affected by that feature. Use `gh pr checks`, `gh run list --workflow deploy.yml`, and `gh run view` to identify the run for the actual merged SHA. Do not trigger an extra direct local deployment.
- [ ] Record migration application, deployed version, and rendered live verification separately. A green Actions run does not prove the rendered reading/journal behavior. Do not change production subscription entitlements to reproduce a local fixture.

**Done when:** The PR state and deployed commit/version are known, required checks have succeeded, and the affected production behavior has been verified. If publication alone was authorized, stop at the published PR and record release as pending.

## Task 9: Separate the Midnight transition fix from the redesign

**Files:** Fix commit `57a0a94`: `src/components/AnimatedRoutes.jsx`, `PageTransition.jsx`, `Journal.jsx`, `src/pages/CardGalleryPage.jsx`, `src/styles/tailwind.css`, `e2e/page-transitions.spec.js`. Redesign commit `cba6387` additionally changes reading/ritual/reveal flow and `ReadingClothScene.jsx`.

- [ ] After narrative integration, create a fresh `fix/interrupted-page-transitions` worktree from current `origin/master`; retain the original Midnight worktree and its preserved critique.
- [ ] Copy only `e2e/page-transitions.spec.js` from the original branch into the candidate first. Run it against current master. If all applicable cases pass, record the fix as superseded and do not import older routing code.
- [ ] If the regression fails, port the six-file fix's necessary hunks. Preserve current route structure, reading scene layout, and tokens. Do not cherry-pick the whole redesign. Known full-branch conflicts are `AnimatedRoutes.jsx`, `PageTransition.jsx`, `ReadingSceneRouter.jsx`, `SceneShell.jsx`, and `tailwind.css`.

```powershell
$Transition = 'C:\Users\htper\.codex\worktrees\interrupted-page-transitions\tarot'
if (Test-Path -LiteralPath $Transition) { throw 'Transition worktree already exists' }
Invoke-Checked git @('-C', $Root, 'fetch', 'origin', '--no-prune', '--no-tags', '--no-write-fetch-head')
Invoke-Checked git @('-C', $Root, 'worktree', 'add', '-b', 'fix/interrupted-page-transitions', $Transition, 'origin/master')
Copy-Item -LiteralPath (Join-Path $Midnight 'e2e/page-transitions.spec.js') -Destination (Join-Path $Transition 'e2e/page-transitions.spec.js')
Set-Location -LiteralPath $Transition
Invoke-Logged 'transition-install' npm.cmd @('ci')
Assert-FreePort 5173
Invoke-Logged 'transition-red-or-superseded' '.\node_modules\.bin\playwright.cmd' @('test', 'e2e/page-transitions.spec.js', '--workers=1', '--reporter=line') -AllowFailure
```

- [ ] After any port, rerun the transition suite with failure treated as blocking, root unit/build, narrative/browser regressions from Task 4, and the full required CI checks. The 14 collected transition cases include one mobile CDP skip by design; account for that rather than claiming 14 executed passes.
- [ ] Evaluate the remaining reading-room redesign as a separate product change against current narrative UI. Keep the original branch preserved if it is deferred. If proceeding, create a separate redesign integration plan addressing deal/turn sequencing, ritual skip, mobile card focus, current reading stages, and the five conflict files; do not label the old critique's historical blank-page finding as still unfixed without reproducing it.

**Existing branch unit proof command:**

```powershell
Set-Location -LiteralPath $Midnight
Invoke-Logged 'midnight-baseline-unit' node @('--test', 'tests/mobileActionBarConstants.test.mjs', 'tests/readingBoardUtils.test.mjs', 'tests/sceneOrchestrator.test.mjs')
```

**Done when:** The transition fix is either independently verified/published or proven superseded; the broader redesign has an explicit proceed/defer decision and remains recoverable.

## Task 10: Refresh dependency changes against the chosen architecture

**Files:** Root package/lock, surviving plugin package locks, adapter files only if that package remains active. Existing PRs: [62](https://github.com/henryperkins/tarot/pull/62), [63](https://github.com/henryperkins/tarot/pull/63), [64](https://github.com/henryperkins/tarot/pull/64), [65](https://github.com/henryperkins/tarot/pull/65), [66](https://github.com/henryperkins/tarot/pull/66), [67](https://github.com/henryperkins/tarot/pull/67), [68](https://github.com/henryperkins/tarot/pull/68).

- [ ] Inspect each PR's current diff and package availability. Read official package migration/release notes before selecting versions; the old PR targets are historical proposals, not a recommendation to pin obsolete releases.

```powershell
Set-Location -LiteralPath $Root
foreach ($number in 62..68) {
  Invoke-Checked gh @('pr', 'view', "$number", '--json', 'number,title,state,headRefName,headRefOid,files,statusCheckRollup')
  Invoke-Checked gh @('pr', 'diff', "$number", '--name-only')
}
Invoke-Checked npm.cmd @('view', '@types/node', 'version')
Invoke-Checked npm.cmd @('view', 'react-router-dom', 'version', 'engines')
Invoke-Checked npm.cmd @('view', 'vite', 'version', 'engines')
Invoke-Checked npm.cmd @('view', '@playwright/test', 'version', 'engines')
Invoke-Checked npm.cmd @('view', 'focus-trap-react', 'version', 'peerDependencies')
```

- [ ] Keep runtime types aligned with Node 24 unless a documented runtime change is intended; PR #62 proposes Node 25 types. Resolve the Vite 7 update in #67 and Vite 8 in #64 as one version decision, not two blind merges.
- [ ] After MCP architecture is settled, split #68's surviving ephemeris/symbolism lock updates from the retired adapter update if necessary. Do not recreate a deleted package to merge its dependency PR.
- [ ] Prepare refreshed commits in clean branches from current master. Set the exact approved manifest versions, run `npm install --package-lock-only`, then `npm ci`; review the complete lock diff. Use the root CI suite plus focus/nested-modal tests for focus-trap, routing/transition tests for React Router, build/Worker dry run for Vite/Wrangler, and both browser projects for Playwright.
- [ ] For each old PR, record merge/update/superseded disposition with a replacement PR/commit link. Closing PRs or deleting remote branches is publication/cleanup work and happens only within the execution authorization.

**Done when:** All seven proposals have explicit dispositions and every accepted dependency change has current-master tests. No untouched stale lockfile is merged merely because its historical commit is unmerged.

## Task 11: Review and publish preserved guidance separately

**Files:** The six exact paths preserved in `$GuidanceFiles`; primary local settings remain excluded.

- [ ] Review the shortened `CLAUDE.md` against master to distinguish moved guidance from deleted guidance. Confirm `functions/CLAUDE.md` and `scripts/CLAUDE.md` contain their intended scoped instructions and no credential values.
- [ ] Correct instructions that contradict current package scripts, Node 24 workflows, master branch naming, or the final MCP architecture. Treat this task package as a dated historical execution record; refresh its status rather than pretending its initial snapshot is current forever.
- [ ] Run `git diff --check origin/master...HEAD` and the plan syntax verifier; inspect the exact documentation delta. Publish a separate documentation PR if it remains useful after feature work. Documentation-only verification does not need a new browser run.

**Done when:** Guidance has an explicit keep/update/discard decision with the preserved commit retained until that decision is complete.

## Task 12: Remove only freshly proven redundant state

**Files/state:** Stash, duplicate primary references, merged branches, clean detached worktrees, ignored artifacts. This is a separate cleanup task, not part of preservation or release.

- [ ] Fetch current remote refs without pruning, recheck ancestry and clean status, and inventory ignored files with `git ls-files --others --ignored --exclude-standard --directory`. Initial clean candidates are `reading-layout-release`, `tableu-owner-journal`, `tarot-astro-review-baseline`, and `tarot-astro-review-pr`; exact full paths are in the manifest. Preserve useful ignored logs/screenshots and local state before removing any worktree. A clean status alone is insufficient.
- [ ] Re-run the stash verifier immediately before dropping the exact recorded stash. Resolve its current selector by SHA; never assume it is still `stash@{0}`.

```powershell
Invoke-Checked pwsh @('-NoProfile', '-File', $Verifier, '-Mode', 'Stash')
$RecordedStash = '5626d981e30c3bb6016838de718fa203dbf7a853'
$StashRows = @(& git -C $Root stash list --format='%gd|%H')
$StashMatches = @($StashRows | Where-Object { $_.Split('|')[1] -eq $RecordedStash })
if ($StashMatches.Count -ne 1) { throw 'Exact recorded stash selector is ambiguous or missing' }
$Selector = $StashMatches[0].Split('|')[0]
# Run only within the authorized cleanup task, after the preceding parity proof.
Invoke-Checked git @('-C', $Root, 'stash', 'drop', $Selector)
```

- [ ] Remove primary duplicate references only after their canonical narrative versions are committed and backed up/published. Derive the candidate set by intersecting primary/narrative manifest paths (19 expected), recheck SHA-256 equality, and require each canonical path to exist in the preserved commit with `git cat-file -e`. Resolve absolute source paths beneath `$Root` before each `Remove-Item -LiteralPath`; delete individual verified files only. Do not recursively delete `output` or the entire specs directory.
- [ ] After guidance reaches master, verify primary documentation copies against the committed master versions before restoring/removing them. Keep the local settings preference unless the user chooses otherwise.
- [ ] For each obsolete worktree, require HEAD ancestry to `origin/master`, empty tracked/untracked status, resolved ignored-artifact disposition, and a resolved path matching the manifest. Then use `git worktree remove` without force. Do not use recursive shell deletion as a fallback.
- [ ] Delete only branches whose commits are ancestors of the current master. For the original audit this includes card reveal, owner journal, both astronomy branches, the three remote `claude/*` branches, visual modals, and GraphRAG coverage. Narrative becomes eligible only after its new preservation/integration commits land. MCP, Midnight, and dependency branches are ineligible until their own dispositions prove redundancy.
- [ ] Prefer `git branch -d` from a checkout at current master; use `git push origin --delete` only for individually reviewed merged remote refs and within cleanup authorization. Preserve feature refs if the work was deferred rather than merged. Re-list worktrees, refs, stashes, and remaining dirty files at the end.

**Done when:** Every removed item has a recorded preservation/parity/ancestry proof; every remaining item has an owner/workstream and next action. Unmerged/deferred work remains recoverable.

## Completion record to maintain during execution

For each task record: candidate SHA, changed path allowlist, command exit codes/log paths, actual browser cases/skips, backend used for evaluation, unresolved failures, PR URL/head SHA, and release state when applicable. Mark a checkbox complete only when its stated evidence exists. Do not treat this plan's 126 passing baseline tests or successful syntax parsing as proof that future integrations have passed.

## Validation of this task package

- Existing source: 126 focused tests passed across the four worktrees; all commands and counts are in the manifest.
- Proposed compatibility regression: the three supplied tests ran and failed for the three expected incompatibilities against the existing MCP branch. Only their import paths were redirected into that worktree for the temporary run.
- Browser command discovery: 42 narrative-related, 14 transition, and 1 OAuth test collected. None of these browser suites was executed during planning.
- Preservation rehearsal: three temporary Git indexes staged exactly 115 / 1 / 1 paths; real indexes and branch refs were untouched. The known narrative whitespace findings are captured and addressed above.
- Baseline verifier: 8 worktrees and 140 dirty-file hashes matched after plan creation. Stash verifier: 26 identical saved blobs. JavaScript test syntax and all PowerShell blocks parsed. The command helpers were exercised with successful and deliberately failing native commands.
- No integration, preservation commit, push, PR, cloud resource, migration, deployment, or deletion was performed. Only the three task-package files were created.
