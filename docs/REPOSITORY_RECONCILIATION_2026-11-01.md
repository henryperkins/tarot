# Repository reconciliation — 2026-11-01

The approved local cleanup is complete. The primary checkout is clean, and four
worktrees remain. Local master and the freshly observed remote master are both
`19be91abd8a3f90e4f9fcea84423231e5aa17e08`, unchanged throughout cleanup. `master`
remains the default branch. All new commits are local; no merge, push, PR closure,
remote deletion, deployment, generated reading, or live embedding request occurred.

This report follows the [approved plan](superpowers/plans/2026-11-01-repository-reconciliation-cleanup.md).
The preserved plan checkboxes and older remediation plans are historical input;
the completion receipts and execution ledger below record actual execution.

## Remaining local work

| Branch / checkpoint | Purpose and state |
| --- | --- |
| `master` — `19be91ab` | Clean primary; synchronized with actual origin/master. |
| `test/journal-performance-20261101` — `f8fb1cfc` | Isolated 1,000-entry performance test, qualified locally; not integrated. Retains <3,000 initial reads, <2,000 first-search reads and <500 ms to the matching rendered result. |
| `wip/f3b-retrieval-20261101` — `75fc1ea3` | One current-master retrieval candidate. Offline checks pass; content qualification remains open. Not ready for integration. |
| `deps/sharp-20261101` — `89b79134` | Independently qualified root sharp update; local commit only. |
| `deps/root-group-20261101` — `ac2b0171` | Independently qualified MCP SDK, brace-expansion, DOMPurify and source-map-js updates; local commit only. |
| `deps/astro-plugins-20261101` — `e5770153` | Independently qualified ephemeris/symbolism lockfile updates; local commit only. |
| `docs/reconciliation-dispositions-20261101` | This report, dependency/old-feature dispositions and three preserved plans; local documentation branch. |
| `codex/knowledge-graph-context-20261022` — `8546284b` | Historical PR #121 source retained until its proposed superseded disposition is accepted on GitHub. No production salvage identified. |
| `codex/spacefast-current-20261017` — `10675fe2` | Parked PR #109; historical remote/runtime blockers remain. |
| `codex/spacefast-compatibility-20261009` — `1150983b` | Preserved ancestor of the parked Spacefast branch. |

The four worktrees are primary, `.worktrees/journal-performance-20261101`,
`.worktrees/f3b-retrieval-20261101`, and
`.worktrees/reconciliation-review-20261101`. The three dependency branches retain
their commits without idle installed worktrees. All four worktrees are clean.

The [PR #121 disposition](knowledge-graph/PR121_DISPOSITION_2026-11-01.md) compares
its five unique commits and 79 changed paths with current master, including the
late decision-language and personal-detail guards. It does not claim all old
patches are identical. The [Spacefast record](SPACEFAST_PARKED_2026-11-01.md) keeps
the migration, preview-access and remaining runtime gates explicit; no new port
or remote probe was attempted.

## Dependency results

The [dependency record](DEPENDENCY_RECONCILIATION_2026-11-01.md) maps all seven open
Dependabot PRs to three qualified replacements and four deferrals. Sharp appears
once, covering #115 and the overlapping part of #120. The other four #120 changes
and the two plugin lockfiles are separate branches.

Axe 4.14.0 fails three existing accessible-name checks that exact master passes.
Sentry 11.7.0 fails the existing Worker database-tracing assertion in isolation;
master passes it. Vite React plugin 6 needs Vite 8, and tsParticles slim 4 needs a
compatible engine/React adapter upgrade. Those four upgrades are deferred without
weakening assertions or introducing broader application changes. The successful
branches have not been tested together as a combined dependency graph.

## Local retirement and recovery

Tasks 1–4 retired 14 redundant worktrees and 17 local branches after archive,
patch/content and ignored-evidence verification. This continuation retired the
two idle PR #121/Spacefast worktrees and five task-created dependency worktrees.
The two empty task-created axe/Sentry branch refs were also removed after their
uncommitted candidates were archived. The original feature and Dependabot PR
branches were retained.

Across the full cleanup, 17 starting worktrees plus eight created for isolation
became four retained worktrees after 21 retirements. Exact paths, old tips,
integration proofs and archive locations are in `retired-worktrees.json`,
`local-retirement-manifest.json`, `continuation/task5/retirement-receipts.json`,
and `continuation/task6/retirement-receipts.json` under the private recovery root.
No blanket reset, clean, stash application or stale whole-tree replacement was used.

Private recovery root:
`/home/ubuntu/.local/state/tarot/reconciliation-cleanup/20261101T030802Z`.

The original history bundle, all stash parents, staged/unstaged patches, indexes,
dirty files and unique ignored evidence were independently restored and verified.
Incremental bundles preserve the journal/F3b checkpoints, new tool checkpoints,
dependency commits and documentation commits. `recovery/history.git` provides a
separate restored history. Per-file manifests retain hashes, modes and symlink
targets. Exact failed outputs and old review judgments remain private and intact.

## Loose files and ignored history

The two October 24 remediation plans and this cleanup plan were copied byte for
byte into local documentation commit `1042696b`. Their original loose copies,
two plugin ZIPs, the navigation measuring probe, the old plugin-review directory
and the inactive reading audit were then renamed intact into
`continuation/task7/rehome/`, preserving their original relative hierarchy.
No private audit content was committed.

The final recursive check found three additional ignored files inside the loose
plugin-review directory: `.mcp.json` and two historical test logs. It stopped
before moving anything. A supplemental archive reconstructed and verified all
three plus the directory modes before the rehome continued. The final selected
manifest covers 459 entries; the main archive and supplement are both retained.

The ignored audit's three broken historical links remain unchanged in its private
archive. Moving the inactive audit out of primary allows the maintained-document
check to pass without editing frozen evidence or weakening the checker. The
temporary navigation probe only measured/logged layout and was archived rather
than promoted as an assertion-bearing test. Existing maintained plugin submission
materials remain on master.

Before and after the moves, 10,247 unrelated ignored entries were hash/mode/target
checked, including active local configuration. Dependency/build caches and the
separately inventoried worktrees were excluded from that count. All other
worktrees, refs, the primary index and journal-test file identity were unchanged.

## Stash and journal recovery snapshot

Stash `8faad906612ff34cecdb62f11ae68cfd5ec33acb` is retained, not popped or dropped.
Its 182 tracked-path changes and 56 untracked files have explicit per-item
dispositions and independent recovery copies:

| Stash category | Count | Disposition |
| --- | ---: | --- |
| Exact current tracked content | 73 | Already represented; original retained. |
| Deletions already present on master | 13 | Already represented; original history retained. |
| Original tracked hunks found on master | 32 | Reverse-apply check succeeds in a temporary index; later file changes retained. |
| Divergent tracked source/doc/config history | 64 | Intentionally archived historical versions; semantic equivalence is not asserted. No automatic reapplication. |
| Exact current untracked-parent content | 14 | Already represented; original retained. |
| Earlier source/doc/test versions in untracked parent | 8 | Current master retained; older versions archived. |
| Historical session/review/build artifacts | 34 | Private archives retained. |

The read-only merge analysis found conflicts and no clean independent remaining
delta. That does not prove the divergent source has no useful idea; it is a reason
to retain the indexed historical versions for selective future review. No extra
runtime change was promoted from this stash, and this classification does not
authorize its deletion.

Recovery snapshot `40f480d53bf4193da1c583b659d2968ff77e411e` and its ref also remain.
Of its 17 journal/Journey paths, five are exact current content and four original
patches are already present. For the remaining eight, the large-journal test is
separately preserved on `f8fb1cfc`, six have concrete later implementation/test
improvements, and the older Journal component is intentionally archived beside
the substantially newer implementation. The saved test and the local test are
not byte-identical: the local version preserves all thresholds while measuring
the actual matching render and recording its timing evidence.

`continuation/task7/*-disposition.json`, `journal-snapshot-test-relation.json`,
and `recovery/historical-files/` provide the path-by-path record. All 242 historical
file blobs and 13 deletion records were reconstructed or accounted for. Archive
tags and tool-owned checkpoint refs remain retained.

## Remote proposal — not executed

All 24 observed remote heads are unchanged. Nine PRs remain open: #109, #121 and
#113–117/#119/#120. The first two remain drafts. The remote proposal lists these
11 integrated or duplicate feature refs as candidates, with exact expected tips:

| Remote branch | Expected SHA |
| --- | --- |
| `claude/design-extract-20261024` | `c1bd155dd7628eb39888a9b10b810f3785568ea8` |
| `claude/eval-false-positives-20261024` | `2c7cc8a41248024c55fbd0749bc9be669cce7e72` |
| `claude/graphrag-complete-remediation-20261024` | `31735cb11ff834ce4bc796586f6137adcf57fe14` |
| `claude/journal-entry-card-harden-20261026` | `ba91f1183a06fe998511f0d27a6bd8e4066e6211` |
| `claude/journal-reachability-20261024` | `d0f9c386f77964088a4fd6265389d686bb679b1d` |
| `codex/deepgram-default` | `ec484808f885229e89195c6ec61b9d8df7f9e707` |
| `codex/header-navigation-revamp-20261019` | `4f6ed43e6ba7d8035e4eb78c9927f6bae21a3be9` |
| `codex/reading-context-remediation-20261023` | `cfdd821b1f5ebfa4cb532dd65844073f464f915b` |
| `codex/reading-journey-p2` | `ac14077ea45dd45258090e4ae9c525486c1ad791` |
| `fix/follow-up-conversation-ux-20261026` | `a25e344034a369df57ce0ffdf9e22a18c344ac91` |
| `qualify/narrative-grounding-20261031` | `19be91abd8a3f90e4f9fcea84423231e5aa17e08` |

Any later deletion requires explicit remote authorization, fresh tip/PR/rules
checks and atomic per-ref leases. Remote `main` stays because external consumers
and branch rules have not been checked. Spacefast, all open PR branches, the
PR #124 screenshot branch and all tags stay. The concrete proposal and final
observations are in `continuation/task7/remote-retirement-proposal.json` and
`remote-verification.json`.

## Verification and unchanged qualification limits

Earlier cleanup evidence, reused by exact source identity: journal Chromium
19/19; F3b root 6,264 passed, 0 failed, 2 skipped; F3b focused 171/171, Worker
70/70, prompt assembly 874 fixtures / 2,541 builds, build/lint/docs passed.
Those tests were not repeated in this continuation.

Fresh continuation checks: PR #121 contract comparison 733/733; sharp and grouped
root dependencies each 6,238 passed, 0 failed, 2 skipped; plugin tests 88/88;
sharp pixel smoke and two root-group rendering cases passed. All five attempted
dependency builds passed. Axe/Sentry failures and passing exact-master baselines
are recorded as failures/deferrals, not converted into passes. Initial missing
native builds and the overlapping fixed-port run are retained with their corrected
setup and isolated rechecks. Maintained documentation checks pass after rehome.

The prompt 1.6.11 checkpoint is already on master, but its creative-project
diagnostic still fails the unsupported unfinished-plan premise. Historical REL01
failures remain immutable even though the later one-case diagnostic passed.
F3b still needs its separately authorized content qualification. The Japanese
prose-quality waiver alone remains; no other acceptance criterion changed.
See the [diagnostic](knowledge-graph/NARRATIVE_FOUR_CASE_DIAGNOSTIC_2026-11-01.md)
and [qualification status](knowledge-graph/QUALIFICATION_STATUS.md).

The execution ledger is `progress.md` in the private recovery root. Terminal
receipts are in its `checks/` and `continuation/checks/`; final preservation and
independent review records are under `continuation/`. Cleanup makes the remaining
work explicit and recoverable; it does not establish deployment, live-member,
physical-device, cross-platform dependency, or generated-reading qualification.
