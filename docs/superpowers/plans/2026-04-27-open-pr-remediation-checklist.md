# Open PR Remediation Checklist

> Snapshot source: `gh pr list --repo henryperkins/tarot --state open --limit 100 --json number,title,isDraft,mergeable,reviewDecision,baseRefName,headRefName,author,updatedAt,statusCheckRollup,additions,deletions,changedFiles,url`
>
> Snapshot date: 2026-04-27 UTC

## Current Findings (2026-04-27 follow-up investigation)

> Investigated 2026-04-27 from a clean local working tree (font self-hosting WIP stashed). Local `npm test` ran 1443/1443 unit tests green (~26s). Re-ran `gh pr view` for fresh SHAs and check rollups. Findings supersede stale "old CI" notes in the per-PR sections below where they conflict.

### Master baseline (matters for all PRs)

- **Master is broken on its own CI.** Latest workflow runs on `master`:
  - `Build` workflow → `SonarQube` job fails because `SONAR_TOKEN` is rejected (HTTP 403 / authorization). Same root cause as the Global Blocker.
  - `CI` workflow → `build` job passes Set Up / Install / Unit tests / Deploy tests / lint:cloudflare / **Vision QA gate** but fails at **Narrative QA gate**. Local `npm run gate:narrative` *passes*; failure is in `npm run eval:narrative` (`runNarrativeSamples.js`) which calls the live narrative backend, so it needs Azure/OpenAI creds the CI runner doesn't have.
  - `Playwright` workflow does not run on `master` pushes (only on `pull_request`), so master's e2e health is invisible from CI alone.
- **Implication:** Every PR inherits these two failures (`SonarQube` + `build`) regardless of what the PR changes. Treat them as global blockers, not per-PR regressions.
- **Branch is unprotected** (`gh api repos/.../branches/master/protection` → 404). Required-checks rule isn't enforced server-side; you can technically merge over red.
- **Verified scripts exist on master:** `gate:vision`, `gate:narrative`, `gate:design`, `ci:vision-check`, `ci:narrative-check`, `lint:cloudflare`, `test:deploy`. **`gate:rws-grounding` does NOT exist on master** — it is added by PR #59 itself, so the original checklist's "run `npm run gate:rws-grounding`" can only be done after #59 is checked out or merged.

### Per-PR verdicts (refreshed 2026-04-27)

| PR | SHA | Mergeable | Verdict | One-line reason |
|----|-----|-----------|---------|-----------------|
| **#59** | `75ef82d3` | ✅ (draft) | **Hold** until token + e2e triage | 39-file product PR. Workflow rewrite is sound but doesn't fix token. 37 e2e fails span flows the PR doesn't directly touch — needs human Playwright triage; can't auto-diff vs master because Playwright doesn't run on master. |
| **#52** | `6161647b` | ✅ | **Merge after token rotation** | Trivial dep bump. *Title says* `qs 6.14.1 → 6.14.2`, *actual diff* is `6.14.1 → 6.15.0` (Dependabot rebased). Single-line lockfile change. |
| **#55** | `0e274dec` | ✅ | **Merge after token rotation (priority: security)** | Hono 4.12.5 + @hono/node-server 1.19.10 patch security CVEs (auth bypass, SSE injection, cookie injection). Sub-trees only, root unaffected. |
| **#57** | `649f3013` | ✅ | **Merge after token rotation (priority: security)** | picomatch 2.3.2 patches CVE-2026-33671/33672. yaml + path-to-regexp bumps in native + plugins sub-trees. Touches `native/package-lock.json` so #46 / #49 will need rebase if merged after this. |
| **#58** | `83da8449` | ❌ conflict | **Close as superseded** | Master already carries `AZURE_OPENAI_REASONING_EFFORT=xhigh` and `OPENAI_MODEL=gpt-5.4` (full, not -mini); README rewritten. Only stale bits left: `gpt-5.1` strings in `scripts/setup-secrets.sh:49` and `scripts/setup-my-secrets.sh:45` — open a small follow-up if those matter. |
| **#46** | `1542e111` | ✅ | **Hold for major-version review** | ⚠️ *Title says* `7.11.0 → 7.12.0`, *actual diff* is `^7.11.0 → ^8.3.0` (MAJOR). Affects ROOT `package.json`. Need sentry-react-native v8 migration review before merge. |
| **#49** | `507831c0` | ❌ conflict | **Rebase via Dependabot or close** | Trivial `expo-file-system 55.0.4 → 55.0.5` patch. Not superseded; rebase needed. Low value if held. |
| **#47** | `63d1b63e` | ✅ | **Defer until queue clears** | ESLint 9.39.2 → 10.0.2 MAJOR. Need to verify peer ranges of eslint-plugin-react@7.37.5, eslint-plugin-react-hooks@7.0.1, eslint-plugin-react-refresh@0.4.24 against ESLint 10. Treat as a focused migration. |
| **#50** | `127e0a89` | ✅ (draft) | **Recommend close** | Vendor pitch (app/vercel) adding `@vercel/analytics`. Already running Sentry; no clear product owner ask. |
| **#51** | `3383a309` | ✅ (draft) | **Close — zero diff** | 0 files / 0 commits beyond an "Initial plan" placeholder. Body literally says "_No code changes in this PR._" |
| **#39** | `f4714932` | ✅ | **Close as not-a-real-migration** | Lockfile-only Tailwind v3 → v4 bump with no config / directive / plugin migration. Vercel + Workers Builds + CI build all fail. Replace with a deliberate migration tracking issue. |

### Action items split by who can do them

**Henry (or anyone with admin / business context) — required to unblock most of the queue:**

- [ ] Rotate the SonarCloud token: log in to SonarCloud → `henryperkins_tarot` project → User → Generate Token (Execute Analysis scope). Update GitHub repo secret `SONAR_TOKEN` (`gh secret set SONAR_TOKEN`). This unblocks **every PR** in this list.
- [ ] Verify SonarCloud project `henryperkins_tarot` exists and the token's user has *Browse* + *Execute Analysis* on it.
- [ ] Decide product question: do you want Vercel Web Analytics in production (PR #50)?
- [ ] Decide product question: are setup-script defaults (`gpt-5.4-mini` vs `gpt-5.4`) worth a follow-up PR after closing #58?
- [ ] Confirm closure plan for #50, #51, #58, #39 (all four are recommend-close per above table).

**Henry + reviewer — needs human judgment:**

- [ ] PR #59: triage the 37 Playwright failures. Recommended: check out the branch, run `npm run test:e2e -- --grep "complete single-card reading flow"` first (single fast test). If it fails on the branch but passes on master, the PR introduced a regression in the prompt-assembly path; if it fails on master too, the e2e suite is master-broken too. If unsure, a `npm run test:e2e:ui` session is the fastest way to see what's actually breaking.
- [ ] PR #59: investigate the master-side Narrative QA gate failure separately. Most likely fix: gate the CI step on whether Azure/OpenAI creds are available, OR provide creds to CI, OR replace `eval:narrative` with a deterministic-only variant for CI. (This is the root cause of every PR's `build` failure.)
- [ ] PR #46: review @sentry/react-native v7 → v8 breaking changes against current Sentry init in `src/`.
- [ ] PR #47: run `npm run lint` on a checked-out copy of #47 to enumerate ESLint-10 violations; fix only those in the PR.

**Safe to do without further input — claim by anyone (including a follow-up agent run):**

- [ ] After token rotation, rerun checks on PRs #52, #55, #57 (`gh pr checks --repo henryperkins/tarot <n>` then `gh workflow run` or comment `/dependabot rebase` on #49).
- [ ] After confirming closure plan, close #51 with comment "Zero-diff placeholder — closing per #51 review on 2026-04-27. Open a fresh issue if a UX review is still wanted."
- [ ] After confirming closure plan, close #50 with comment summarizing the vendor-pitch reasoning.
- [ ] After confirming closure plan, close #58 as superseded; optionally open a tiny follow-up to fix `gpt-5.1` strings in setup scripts.
- [ ] After confirming closure plan, close #39 and open issue "Tailwind 4 migration plan" with config / directive / plugin / visual-QA scope.

### Local-environment notes

- Working tree had an in-progress font self-hosting refactor (`@fontsource-variable/inter` + `@fontsource-variable/source-serif-4`, ~15 files). Stashed as `stash@{0}` with message *"WIP: self-hosted Inter + Source Serif 4 fonts, 2026-04-27 PR remediation work"*.
- **Recovery is NOT a plain `git stash pop`.** The `-u` flag captured untracked files including this very plan dir (`docs/superpowers/`), and the plan was then re-restored and edited. A naïve `git stash pop` will refuse to overwrite the edited plan files. To recover the font work safely:
  ```bash
  # 1. Move the edited plan dir out of the way
  mv docs/superpowers /tmp/superpowers-edited
  # 2. Pop the stash (restores font work + original untracked plans)
  git stash pop
  # 3. Replace the restored stale plan with the edited one
  rm -rf docs/superpowers
  mv /tmp/superpowers-edited docs/superpowers
  ```
  Alternatively, commit `docs/superpowers/` first (`git add docs/superpowers && git commit -m "docs: PR remediation checklist"`), then `git stash pop` will only restore the font-work files.
- Local branch is at `b6dba4d` (`yup`), in sync with `origin/master`.

---

## Merge Readiness Rule

Do not merge a PR until every item below is true:

- [ ] PR is not draft.
- [ ] PR is mergeable and has no conflicts.
- [ ] Required GitHub checks are passing or intentionally waived with a written reason.
- [ ] SonarCloud analysis is unblocked for the repo.
- [ ] Local or CI verification relevant to the PR is recorded in the PR.
- [ ] PR body accurately describes the final diff and any deployment/config impact.

## Global Blocker: SonarCloud

Current state: most open PRs fail `SonarQube`. PR #59 proved the workflow can pass repo configuration to the scanner, but SonarCloud rejects `SONAR_TOKEN` with HTTP 403.

- [ ] Generate a fresh SonarCloud token for `henryperkins_tarot` with analysis permission.
- [ ] Update GitHub repo secret `SONAR_TOKEN`.
- [ ] Rerun SonarQube on PR #59 first because it contains the latest workflow fix.
- [ ] Confirm the scanner reaches analysis instead of failing on `GET https://api.sonarcloud.io/analysis/engine`.
- [ ] Rerun failed Sonar checks on the dependency PRs after the token fix.
- [ ] If Sonar still fails after token rotation, inspect whether the token owner has Browse and Execute Analysis access on the SonarCloud project.

## Recommended Merge Order

1. #59 RWS vision narrative grounding
2. #52 `qs` 6.14.2
3. #55 MCP/tableau adapter npm group
4. #57 native npm group
5. #58 Azure OpenAI default update
6. #46 Sentry React Native
7. #49 Expo file system
8. #47 ESLint 10
9. #50 Vercel Web Analytics
10. #51 UX review doc
11. #39 Tailwind 4

## PR #59: Add RWS Vision Narrative Grounding Foundation

URL: https://github.com/henryperkins/tarot/pull/59

Current state:
- Draft.
- Mergeable.
- SonarQube failing due shared token authorization.
- `build` and `test` checks still in progress at snapshot time.
- Large product PR: 39 files, 1162 additions, 15 deletions.

Checklist:

- [ ] Fix the shared SonarCloud token blocker.
- [ ] Rerun the SonarQube check and confirm it passes or reaches a real quality-gate result.
- [ ] Recheck `build`; if it is still stuck in `Vision QA gate`, inspect the job log and decide whether `ci:vision-check` needs runtime optimization or a timeout split.
- [ ] Recheck `test`; if Playwright remains in progress, inspect the job log and uploaded report.
- [ ] Run or confirm these local gates against the final branch:
  - [ ] `npm test`
  - [ ] `npm run gate:rws-grounding`
  - [ ] `npm run gate:vision`
  - [ ] `npm run gate:narrative`
  - [ ] `npm run test:deploy`
  - [ ] `npm run build`
- [ ] Confirm generated evaluation artifacts are not dirty unless intentionally refreshed.
- [ ] Update the PR body with the final workflow and narrative-eval remediation notes.
- [ ] Mark ready for review only after all required checks are green.
- [ ] Merge first once clean because later dependency PRs should rebase onto the workflow/eval-gate fixes.

## PR #52: Bump `qs` from 6.14.1 to 6.14.2

URL: https://github.com/henryperkins/tarot/pull/52

Current state:
- Not draft.
- Mergeable.
- Smallest dependency update: 1 file, 3 additions, 3 deletions.
- Build passed.
- SonarQube and Playwright failed on old CI.

Checklist:

- [ ] Wait until the global SonarCloud token blocker is fixed.
- [ ] Rebase or update the branch from `master` after #59 merges.
- [ ] Inspect the diff and confirm only the intended lockfile/package metadata changed.
- [ ] Rerun GitHub checks.
- [ ] If Playwright still fails, inspect whether the failure reproduces on `master`; treat it as unrelated only with evidence.
- [ ] Run `npm test` locally if the branch is checked out for manual verification.
- [ ] Merge after Sonar, build, and Playwright are green.

## PR #55: MCP/Tableau Adapter npm Group

URL: https://github.com/henryperkins/tarot/pull/55

Current state:
- Not draft.
- Mergeable.
- Dependency group update: 4 files, 43 additions, 43 deletions.
- Build passed.
- SonarQube and Playwright failed on old CI.

Checklist:

- [ ] Merge #52 first unless #55 supersedes the same dependency update.
- [ ] Update from `master` after #59 and #52.
- [ ] Inspect changed package trees with `gh pr diff 55 --repo henryperkins/tarot --name-only`.
- [ ] Run the affected package-tree install/test commands discovered from each changed `package.json`.
- [ ] Rerun full PR checks.
- [ ] If Playwright fails again, compare the failure with #52 and `master` before changing dependency code.
- [ ] Merge after Sonar, build, Playwright, and affected package checks are green.

## PR #57: Native npm Group

URL: https://github.com/henryperkins/tarot/pull/57

Current state:
- Not draft.
- Mergeable.
- Dependency group update: 3 files, 18 additions, 18 deletions.
- SonarQube, build, and Playwright failed.

Checklist:

- [ ] Merge #52 and #55 first if they are clean, then update this branch from `master`.
- [ ] Inspect changed package trees with `gh pr diff 57 --repo henryperkins/tarot --name-only`.
- [ ] Identify whether the updates are in `native/`, root, or another package tree.
- [ ] Run the affected package-tree install/test/build commands from the relevant `package.json`.
- [ ] Rerun CI after rebasing.
- [ ] Investigate any build failure from the latest run before assuming it is the same stale failure.
- [ ] Merge after Sonar, build, Playwright, and affected package checks are green.

## PR #58: Update Azure OpenAI Defaults

URL: https://github.com/henryperkins/tarot/pull/58

Current state:
- Not draft.
- Conflicting.
- Small runtime/provider change: 8 files, 48 additions, 31 deletions.
- SonarQube, build, and Playwright failed.

Checklist:

- [ ] Rebase after #59 because both touch narrative/provider/runtime surfaces.
- [ ] Resolve merge conflicts manually; do not accept either side wholesale for provider defaults.
- [ ] Review changed defaults for:
  - [ ] `judas2`
  - [ ] `gpt-5.4-mini`
  - [ ] `xhigh` reasoning
  - [ ] Azure/OpenAI provider labeling and fallback behavior
- [ ] Confirm docs and environment examples match the final defaults.
- [ ] Run provider/narrative-focused tests:
  - [ ] `npm test`
  - [ ] `npm run gate:narrative`
  - [ ] `npm run build`
- [ ] Rerun full PR checks after conflict resolution.
- [ ] Merge only after a focused runtime review confirms the new defaults are intended for production.

## PR #46: Bump `@sentry/react-native`

URL: https://github.com/henryperkins/tarot/pull/46

Current state:
- Not draft.
- Mergeable.
- Native dependency update: 2 files, 76 additions, 178 deletions.
- SonarQube, build, and Playwright failed.

Checklist:

- [ ] Update from `master` after smaller dependency PRs are resolved.
- [ ] Inspect whether this overlaps with #57 native dependency changes.
- [ ] If #57 changes the same lockfile/package tree, resolve #57 first and let Dependabot recreate or update #46.
- [ ] Run native package install/build/test commands from `native/package.json`.
- [ ] Run root `npm test` if root lockfiles changed.
- [ ] Rerun CI.
- [ ] Merge after native checks and full CI are green.

## PR #49: Bump `expo-file-system`

URL: https://github.com/henryperkins/tarot/pull/49

Current state:
- Not draft.
- Conflicting.
- Small native dependency update: 2 files, 5 additions, 5 deletions.
- SonarQube and build failed.

Checklist:

- [ ] Resolve after #57 and #46 because they may update the same native dependency tree.
- [ ] If the version bump is already included by #57 or another newer dependency PR, close this PR as superseded.
- [ ] Otherwise, rebase from `master` and resolve conflicts.
- [ ] Run native package install/build/test commands from `native/package.json`.
- [ ] Rerun CI.
- [ ] Merge only if it is still needed and clean after the native dependency stack settles.

## PR #47: Bump ESLint from 9.39.2 to 10.0.0

URL: https://github.com/henryperkins/tarot/pull/47

Current state:
- Not draft.
- Mergeable.
- Tooling major update: 2 files, 136 additions, 160 deletions.
- SonarQube, build, and Playwright failed.

Checklist:

- [ ] Defer until product and smaller dependency PRs are merged.
- [ ] Check ESLint 10 migration notes and current repo config compatibility.
- [ ] Run `npm run lint` on `master` first and record existing failures, especially `wp-content/plugins/lakefront-content-kit/...`.
- [ ] Rebase the PR after earlier merges.
- [ ] Run `npm install` or `npm ci` and inspect lockfile churn.
- [ ] Run:
  - [ ] `npm run lint`
  - [ ] `npm test`
  - [ ] `npm run build`
- [ ] Fix only ESLint-10-related failures in this PR.
- [ ] Merge after lint, unit tests, build, and required CI are green.

## PR #50: Set Up Vercel Web Analytics

URL: https://github.com/henryperkins/tarot/pull/50

Current state:
- Draft.
- Mergeable.
- Old bot PR: 3 files, 42 additions.
- SonarQube, build, and Playwright failed.

Checklist:

- [ ] Decide whether Vercel Web Analytics is still desired.
- [ ] If not desired, close the PR.
- [ ] If desired, recreate or refresh the branch after #59 and dependency cleanup.
- [ ] Inspect whether the analytics package/config conflicts with existing telemetry or privacy expectations.
- [ ] Confirm any required env/config changes are documented.
- [ ] Run:
  - [ ] `npm test`
  - [ ] `npm run build`
  - [ ] `npm run test:e2e`
- [ ] Mark ready for review only after it is no longer draft and CI is green.

## PR #51: Document UX Review Scope and Surface CI Blockers

URL: https://github.com/henryperkins/tarot/pull/51

Current state:
- Draft.
- Mergeable.
- 0 changed files.
- Only lightweight checks are present and passing.

Checklist:

- [ ] Confirm whether the PR intentionally has no diff.
- [ ] If it is a stale no-op, close it.
- [ ] If the branch should contain a document, recover or recreate the missing commit.
- [ ] If recreated, add the document to the repo and run relevant markdown/doc checks.
- [ ] Mark ready only if there is a meaningful diff and checks are green.

## PR #39: Bump TailwindCSS from 3.4.19 to 4.1.18

URL: https://github.com/henryperkins/tarot/pull/39

Current state:
- Not draft.
- Mergeable.
- Major styling/tooling migration: 2 files, 6 additions, 544 deletions.
- SonarQube, build, Playwright, Vercel, and Workers Builds failed.

Checklist:

- [ ] Defer until all smaller PRs are merged or closed.
- [ ] Treat this as a dedicated Tailwind 4 migration, not a routine dependency bump.
- [ ] Decide whether to close and recreate from current `master`; prefer recreation if the branch is stale.
- [ ] Inventory current Tailwind usage:
  - [ ] `tailwind.config.js`
  - [ ] `src/styles/tailwind.css`
  - [ ] `src/styles/theme.css`
  - [ ] component class usage affected by Tailwind 4
- [ ] Build a migration branch with explicit visual QA.
- [ ] Run:
  - [ ] `npm run build`
  - [ ] `npm run test:contrast`
  - [ ] `npm run test:wcag`
  - [ ] `npm run test:e2e`
- [ ] Capture screenshots for changed UI surfaces.
- [ ] Merge only after visual, accessibility, build, Workers, Vercel, and Playwright checks are green.

## Close or Recreate Candidates

- [ ] #51: Close if the zero-file diff is intentional or stale.
- [ ] #50: Close/recreate unless Vercel Analytics is still a near-term goal.
- [ ] #39: Prefer close/recreate as a dedicated Tailwind 4 migration.
- [ ] #49: Close if superseded by #57 or #46.

## Standard Commands

Use these commands while working through the checklist:

```bash
gh pr view <number> --repo henryperkins/tarot --json number,title,isDraft,mergeable,statusCheckRollup,reviewDecision,headRefName,baseRefName
gh pr checks <number> --repo henryperkins/tarot
gh pr diff <number> --repo henryperkins/tarot --name-only
gh pr checkout <number> --repo henryperkins/tarot
npm test
npm run build
```

