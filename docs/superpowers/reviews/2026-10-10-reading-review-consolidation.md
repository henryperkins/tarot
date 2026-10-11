# Reading review branch consolidation — 2026-10-10

Step 1 consolidates the latest reading-cue remediation and current master into one local review branch. It does not complete the activation, recovery, artwork, model or physical-device acceptance work described in the [readiness record](2026-10-10-reading-cue-readiness.md).

## Source and branch

- Review branch: `codex/reading-review-consolidation-20261010`.
- Worktree: `/home/ubuntu/tarot/.worktrees/reading-review-consolidation-20261010`.
- Starting source: `codex/reading-cue-qualification-20261009`, HEAD `f24487d089748c60716d61fe5f8b6c3056ca6eb9`, plus its reviewed local remediation.
- Source checkpoint: `3178e5e` captures 122 owned paths (76 tracked modifications and 46 new files). Four historical-report header lines received whitespace-only presentation cleanup; the original bytes remain in the preservation snapshot.
- Master integrated: `58c8a33b8a93da8bb29c315dcaf821f5e751780a`, through merge `3b5fa11`. All 11 master commits absent from the original integration branch are included.
- The ancestor chain includes the original React bridge and clean UI integration branch. No cherry-pick or broad copy from the primary checkout was used.
- The branch is local. No push, PR, deployment, migration or live inference is part of this consolidation.

## Preservation and evidence

The primary checkout, original beta and original qualification checkout retain their HEADs, indexes, dirty files and untracked artifacts. Starting manifests, file hashes, a copy of the 122 owned source files, and command logs are stored in `/home/ubuntu/.cache/tableu-reading-consolidation-20261010/` with a private parent directory.

Raw evidence and scratch runtimes were deliberately preserved at their existing locations: 391 qualification artifacts, 3,482 scratch-runtime paths and 10 test-result files were excluded from the new source checkpoint. Ignored execution workspaces, private configuration and browser sessions were not copied. The three public [round closeout projections](2026-10-10-reading-cue-round-closeout.md) are included.

The [playback diagnosis](2026-10-10-reading-cue-playback-diagnosis.md) retains its historical results and artifact paths, now explicitly marked as historical references rather than broken links into omitted raw evidence. The original task workspace remains under the original qualification checkout; its task reports are historical evidence, not a workspace to mutate for this branch.

## Merge reconciliation

The Git merge completed without conflicts. The three overlapping code/configuration files preserve both feature lines:

- `functions/api/tarot-reading.js`: independent subscription streaming plus master's distinction between unavailable usage tracking and reading limits.
- `src/worker/readingJob.js`: visual source observation plus master's persisted reading error codes.
- `wrangler.jsonc`: public MCP access plus the visual Durable Object binding, with visual provider/model activation unset.

Master's refreshed `data/evaluations/narrative-samples.json` remains current. Historical cue labels need the prior exact corpus, so the old bytes are retained separately at `scripts/evaluation/fixtures/readingCueSources/narrative-samples.20261007.json` (SHA-256 `b30c506a81f7cb360fb457fc2bd4825059d558b3a1f8862d5f0ab23f383fbe49`). The evaluation loader accepts that archive only for this exact logical corpus path and expected digest; missing or modified archived bytes fail. Runtime, catalog and artwork hash mismatches continue to fail.

All three historical qualification manifests and their labels remain byte-identical to the copied source. The previous runtime freeze does not qualify the merged source: a new freeze and explicitly budgeted round are still required. The stale development manifest is intentionally not refreshed by Step 1.

## Verification

Fresh local checks completed on the consolidated source. Command logs and preservation receipts remain in the private directory above.

| Check | Result |
| --- | --- |
| Copied-source baseline, `npm test` | 3,722 passed, 2 opt-in skips, 0 failures. |
| Consolidated source, `npm test` | 3,751 passed, 2 opt-in skips, 0 failures across 521 suites. Includes all 10 archive source-binding tests. |
| Related qualification suites | 127 passed, 0 failures across four files. |
| `npm run build` | Passed. |
| Scoped ESLint | Passed for 96 owned source paths and the two overlapping merged JavaScript files. |
| Worker bundle, `wrangler deploy --dry-run` | Passed; no deployment or migration applied. |
| `npm run docs:check` | All local links resolve in 192 maintained Markdown files. |
| Additional superpowers document links | 48 documents, 214 links, 0 introduced missing links. One inherited Windows checkout link remains in the unrelated 2026-09-23 integration plan. |
| Master and qualification preservation | 53 master-only paths and all three historical qualification manifests retain their exact bytes; all four required source ancestors are present. |
| Original checkout preservation | Primary: 116 dirty paths; beta: 133; qualification: 4,005. HEAD, branch, status, index and every recorded dirty path are unchanged. |
| Original beta services | All four protected listeners retain their original process ownership. |
| Independent consolidation review | No blocking findings. |

This verifies local consolidation and bundle compatibility. Browser playback, real Pro, live model qualification, physical-device and production acceptance remain open; the historical round is still closed and unqualified.

## Continue here

Use this worktree for subsequent local implementation. The [Step 2 repair report](2026-10-11-reading-activation-recovery.md) records deletion retention, spending admission for initial visual jobs and explicit unavailable retry state. Step 3 remains playback and artwork acceptance. Keep production and live qualification disabled until their separately scoped gates are satisfied.
