# Repository Reconciliation and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Native execution is recommended because the tasks share Git state; do not run concurrent branch/worktree mutations.

**Goal:** Leave a clean primary checkout and a small, explicit set of active workstreams while preserving every unique change and all qualification evidence.

**Architecture:** Archive and verify first, separate outstanding work onto current-master branches, then retire proven duplicates. Treat feature qualification, dependency updates, and remote publication as distinct outcomes; cleanup does not require shipping the unfinished retrieval candidate.

**Tech Stack:** Git, Python 3, SHA-256 manifests, tar archives, Node/npm, Playwright, and GitHub PR metadata.

**Spec:** Owner request to plan cleanup of the November 1 inventory. The source inventory is /home/ubuntu/.local/state/tarot/remaining-work-audit-20261101T024205Z/{audit-result,branches,dirty-comparison,github-pr-status,historical-refs}.json. Read the [qualification status](../../knowledge-graph/QUALIFICATION_STATUS.md), [split report](../../knowledge-graph/GRAPHRAG_SPLIT_QUALIFICATION_2026-10-31.md), and [latest narrative diagnostic](../../knowledge-graph/NARRATIVE_FOUR_CASE_DIAGNOSTIC_2026-11-01.md) for acceptance limits.

## Global constraints

- This document is a plan. Creating it authorizes no cleanup, commit, merge, push, PR closure, or branch deletion.
- master is the trunk. The verified starting local and remote tip is 19be91abd8a3f90e4f9fcea84423231e5aa17e08. Refresh this at execution time; never assume main is the trunk.
- Preserve unrelated work, ignored evidence, stash contents, recovery refs, exact failed outputs, and original review judgments. No reset --hard, git clean, blanket stash application, or whole-tree copying from stale worktrees.
- No deployment, new generated reading, live embedding request, or paid narrative API call belongs to this cleanup plan. Existing content halts remain enforced. Japanese prose quality alone remains waived.
- The narrative checkpoint already on master still has the creative-project unsupported unfinished-plan finding. F3b remains unqualified for integration. Neither becomes a pass because a branch is archived or a PR is closed.
- Once execution scope is authorized, carry out the included steps without repeatedly requesting the same permission. Remote publication/deletion and PR closure must be included in that authorization; prior completed push requests are not blanket authorization for new actions.
- Use exact path/ref allowlists, expected commit IDs, and before/after hashes. A moved ref or changed file stops only its affected operation until the new state is reconciled.
- Keep recovery material private and outside the repository. Do not print credentials or commit private configuration. Preserve active local configuration in place.

## Review focus

1. A branch can be integrated through rebase/cherry-pick without being an ancestor: Tasks 1 and 4 require patch IDs plus content checks.
2. A dirty worktree can contain only already-integrated work: Tasks 2–4 compare owned hunks and exact files before retaining or removing anything.
3. An apparently clean worktree can contain unique ignored evidence: Tasks 1 and 4 inventory ignored paths and owned processes before removal.
4. Copying the F3b worktree wholesale would regress current narrative coverage: Task 3 retains the Unicode test and canonical-scene manifest entry already on master.
5. Stale dependency PRs overlap, and remote refs can move after review: Tasks 6 and 7 consolidate sharp once and recheck exact remote tips before publication or deletion.

## Baseline and proposed disposition

The audited state has 17 worktrees, five dirty worktrees, 133 dirty-file entries, nine open PRs, and one stash. The main checkout has the journal performance-test diff and 31 untracked files. The new plan is an additional file to account for at execution time.

| Item | Proposed disposition |
| --- | --- |
| Journal performance test | Qualify in a dedicated branch; keep its thresholds; create a separate local commit. |
| F3b retrieval candidate | Extract only its outstanding changes onto current master and checkpoint as WIP; keep qualification open. |
| Old combined GraphRAG worktree | Archive its complete state, verify the retrieval copy and superseded narrative changes, then retire it. |
| Original mobile and cold-start worktrees | Archive and retire after proving their useful changes are integrated. |
| Other integrated branches/worktrees | Retire from an explicit manifest after reachability/patch and ignored-file checks. |
| PR #121 | Review for remaining unique behavior; salvage small changes if necessary, then propose closing the competing implementation as superseded. |
| PR #109 / Spacefast | Park the branch and draft PR with blockers recorded; archive/remove its idle worktree rather than attempting the port during cleanup. |
| Seven Dependabot PRs | Refresh in isolated batches against current master; implement the shared sharp update once. |
| Stash and recovery snapshot | Reconcile selectively, retain verified archives, and remove the stash only when every item has a recorded disposition. |
| Existing archive tags, tool checkpoints, PR screenshot branch | Retain. They are not active feature branches to merge or a cleanup quota to eliminate. |

## Task 1: Build and verify the recovery set

**Files:** Create a private directory under /home/ubuntu/.local/state/tarot/reconciliation-cleanup/<UTC>/ containing inventory.json, disposition.json, all-refs.bundle, per-worktree patches/indexes/archives, loose-file manifests, checks/, and recovery-verification.json. Set its permissions to 0700 and use TAROT_CLEANUP_ROOT for its absolute path in commands below. Existing evidence roots remain in place.

**Consumes:** The audited inventory and current repository state. **Produces:** A recoverable snapshot and a disposition row for each branch, worktree, stash, and loose-file group.

- [ ] Fetch all remotes without pruning, recursion, or writing FETCH_HEAD; verify origin/HEAD, local master, and actual remote master. Record any drift from 19be91ab.
- [ ] Inventory every local/remote branch, worktree HEAD/status/index, stash, recovery/backup/archive/tool ref, and tracked/untracked dirty file. Record hash, size, mode, and symlink target where applicable.
- [ ] Before retiring each worktree, enumerate ignored paths and processes using it. Preserve unique logs, frozen inputs, generated readings, screenshots, and private configuration; omit only identified reproducible caches such as node_modules and dist. Retain anything uncertain.
- [ ] Create a history bundle that includes all inventoried refs, plus per-worktree staged/unstaged binary patches, exact indexes, and dirty/unique ignored-file archives. Record retained external evidence locations rather than copying or deleting all historical evidence indiscriminately.
- [ ] Verify the bundle with git bundle verify. Reconstruct dirty files outside the working repositories and compare every archived member's hash/mode to its manifest. Verify the stash's tracked and untracked parents are recoverable.
- [ ] Write disposition.json entries with source identity, proposed action, recovery location, integration/redundancy proof, and verification state. Record local and remote deletion candidates separately.

**Exit condition:** Every potentially removed byte/ref is recoverable, all recovery checks pass, and no existing working file or branch has changed.

## Task 2: Isolate the journal performance test

**Files:** e2e/journal-remediation.spec.js only; evidence goes to the new recovery root.

**Consumes:** Task 1's exact primary patch. **Produces:** Branch test/journal-performance-20261101 in .worktrees/journal-performance-20261101 and one scoped local test commit, if execution authorizes commits. Set TAROT_JOURNAL_TREE to that worktree's absolute path.

- [ ] Create the branch/worktree from the freshly verified master. Apply only the saved journal-test hunks, preserving any intervening master changes.
- [ ] Verify the transferred test matches the preserved change: 1,000 entries; fewer than 3,000 initial reads; fewer than 2,000 first-search reads; matching result rendered in less than 500 ms. Do not loosen thresholds or retry until a run passes.
- [ ] Run the entire journal-remediation spec, because its shared fixture helper also changes. Use the repository's credential-free supervisor with a fresh evidence root and one explicit attempt:

    python3 scripts/evaluation/qualification/run-check.py "$TAROT_CLEANUP_ROOT" journal-spec "$TAROT_JOURNAL_TREE" npm run test:e2e -- e2e/journal-remediation.spec.js --project=chromium --workers=1 --retries=0

- [ ] If it passes, create a scoped local commit, proposed subject: test: cover large journal search performance. If it fails, preserve the result and checkpoint the test explicitly as WIP; do not turn cleanup into an unapproved performance rewrite.
- [ ] Compare the committed patch and file against the recovery copy. Only after the durable copy is verified, remove those exact owned hunks from the primary checkout. Leave any newly discovered unrelated hunks untouched.

**Exit condition:** The journal test is preserved on its own branch, its result is explicit, and primary no longer depends on an uncommitted copy. This step does not merge or push the test.

## Task 3: Establish one current F3b worktree

**Files:** Runtime: functions/lib/graphRAG.js, graphRAGCandidates.js, graphRAGRanking.js, readingContextVocabulary.js. Evaluation/tests: scripts/evaluation/verifyGraphRAGRelevance.js; tests/contextDetection.test.mjs, graphRAGCandidateSelection.test.mjs, graphRAGPatternRanking.test.mjs; tests/fixtures/graph-rag-relevance-cosines.json. Also reconcile scripts/lib/readingCueValidationSource.json and append a dated status entry to docs/knowledge-graph/QUALIFICATION_STATUS.md.

**Consumes:** The preserved retrieval-only worktree and current master. **Produces:** Branch wip/f3b-retrieval-20261101 in .worktrees/f3b-retrieval-20261101, with one local checkpoint and explicit pending qualification.

- [ ] Create a new worktree from current master; keep the original retrieval-only and combined worktrees unchanged until the new copy is verified.
- [ ] Port the four runtime files' outstanding hunks and the five evaluation/test changes. Preserve current-master narrative files and the existing Unicode-preservation test in contextDetection.test.mjs.
- [ ] Add graphRAGRanking.js to the validation source manifest while retaining canonicalSceneEvidence.js and every other current-master entry. Do not copy the old manifest or old qualification status wholesale.
- [ ] Verify all four retrieval runtime files match the preserved candidate where their bases are unchanged; explain any necessary reconciliation rather than silently changing policy. Preserve score composition, relevance threshold, caps, lexical safeguards, weak-floor treatment, corpus labels, and question bytes.
- [ ] Run focused offline tests through the credential-free supervisor:

    node --test --test-concurrency=2 tests/contextDetection.test.mjs tests/graphRAGCandidateSelection.test.mjs tests/graphRAGPatternRanking.test.mjs tests/graphRAGPromptIntegrity.test.mjs tests/conditionalScopeGrounding.test.mjs tests/narrativeSpineMultilingual.test.mjs tests/qualificationLauncher.test.mjs

- [ ] Run the following remaining checks once for the reconciled candidate through the same credential-free supervisor, with separate labels. Run scoped ESLint on the nine runtime/evaluation/test files listed above, excluding the JSON fixture. Record the source hash and results. Any cached-vector runtime replay must use a fresh output directory and immutable existing vectors; no provider request or historical run resumption.

    node --test functions/__tests__/knowledgeGraph.test.js functions/__tests__/spreadAnalysis.test.js functions/__tests__/graphRAGAlerts.test.mjs
    node scripts/evaluation/verifyNarrativePromptAssembly.js --json
    npm run build
    npm run docs:check
    npm test
- [ ] Append a dated status entry distinguishing the new source baseline from historical content results. The old paired failure remains; a comparison using master’s newer narrative prompts would be a new experiment, not a continuation of the halted one.
- [ ] Create a local WIP checkpoint, proposed subject: wip: preserve F3b retrieval candidate on current master. Do not merge it, clear a halt, start readings, or describe it as release-qualified.

**Exit condition:** One current worktree owns every outstanding retrieval change; original candidate bytes and history remain recoverable. Ten already-integrated files from the old 21-file overlay are not duplicated as new work.

## Task 4: Retire proven redundant local worktrees and branches

**Files:** Task 1's disposition.json, recovery-verification.json, and a generated local-retirement-manifest.json. No application edits.

**Consumes:** Verified archives and Tasks 2–3 checkpoints. **Produces:** A smaller local checkout set with exact per-item retirement receipts.

- [ ] Mark the integrated clean worktrees for retirement: journal-release, follow-up-conversation-ux, graphrag-complete-remediation, journal-entry-card, detached journal-reachability, mobile-adaptation-integration, narrative-grounding, pr126-integration, release-graphrag, and retrieval-variant-gating. Resolve their actual absolute paths from git worktree list; do not use directory-name wildcards.
- [ ] Mark the old cold-start and original mobile worktrees for retirement after hunk-level proof. Both cold-start dirty files equal master. Nine mobile files equal master; the other three retain older PR #126/manifest context, so raw full-file differences are not evidence of new mobile work.
- [ ] Retire the old combined GraphRAG and old retrieval-only worktrees only after Task 3 proves the replacement and the full historical overlays are archived. Keep the PR #121 worktree through its review in Task 5.
- [ ] Stop only identified owned processes. Recheck HEAD, index, dirty hashes, and ignored evidence immediately before removing each worktree. Prefer normal git worktree remove; any forced removal must name one archived dirty worktree whose complete recovery has passed.
- [ ] Delete the corresponding local branches only after checking the exact expected tip and recording ancestry or patch/content equivalence. Non-ancestor rebased branches need explicit proof; git cherry's merge-base limitation must not misclassify 3c511ede, whose patch is on master as 2c7cc8a4.
- [ ] Retire local main after confirming it is still wholly ancestral to master. Keep archive tags and tool-owned refs. Removing a local branch never implies deleting its remote counterpart.
- [ ] Re-run preservation checks after every small batch. Reconstruct from the archive if a removed worktree's recovery proof fails; do not continue retiring others.

**Exit condition:** Routine worktrees are primary master, journal performance, and the new F3b candidate, with PR #121 retained temporarily for review. Spacefast may be parked without a worktree after Task 5.

## Task 5: Give the older feature PRs a recorded disposition

**Files:** Create docs/knowledge-graph/PR121_DISPOSITION_2026-11-01.md in a separate review branch; review spacefast/INTEGRATION-STATUS.md on the preserved Spacefast branch. Save supporting comparisons in the recovery root.

**Consumes:** PR #121's five unique commits, the current master implementation, and PR #109's recorded blockers. **Produces:** A finite salvage list and a parked Spacefast workstream.

- [ ] For PR #121, classify each changed behavior as already covered, superseded, or still useful and missing. Check its decision-path language, memory ownership/age guards, source-use accounting, and graph projection changes against current code/tests; the 33-file overlap alone proves neither equivalence nor remaining value.
- [ ] Put genuinely missing behavior into small, named follow-up changes based on current master, with a test that fails for the missing behavior. Preserve the original branch until each item is either extracted or explicitly archived with rationale. Do not merge the 79-file stale implementation wholesale.
- [ ] Prepare a concrete proposal to close PR #121 as superseded once that list is covered or deliberately deferred. Closing the PR does not convert its old pending qualification into a pass.
- [ ] For PR #109, retain the unique branch and draft PR, record the broker/SQL and preview-access blockers, and retain its dependent older compatibility history in the archive. Remove the idle worktree only after the ignored-file and process checks; do not attempt a new remote port during cleanup.
- [ ] Retire the PR #121 worktree after its source and disposition are durable. Apply PR closure or remote branch retirement only within the authorized publication scope.

**Exit condition:** Neither old feature branch is an ambiguous merge candidate. PR #121 has a documented replacement/salvage decision; Spacefast is explicitly parked and recoverable.

## Task 6: Refresh and consolidate dependency work separately

**Files:** Current root package.json/package-lock.json and affected plugin manifests/lockfiles, limited to the selected dependency batch. Preserve old PR heads in the recovery bundle.

**Consumes:** Open PRs #113–117, #119, and #120. **Produces:** Independently verified updates or documented blocked/deferred changes; no automatic merge of stale lockfiles.

- [ ] Re-read current package versions and each PR diff. Build updates from current master, preserving intervening changes and reviewing engine/peer/API compatibility.
- [ ] Implement sharp once in a dedicated batch. Carry the other four #120 updates separately; after their replacements are integrated, propose closing the overlapping old PRs as superseded. Do not apply both old sharp lockfile diffs.
- [ ] Keep the ephemeris/plugin group separate from the root package changes. Keep Sentry, tsParticles, and the Vite React plugin upgrades independently reviewable because their worker/runtime/build compatibility differs. Axe can use its own small batch.
- [ ] For each batch, run the relevant package tests, root tests when root dependencies change, build, and the affected local smoke check. Use image processing checks for sharp, Worker build/error-path checks for Sentry, browser rendering for particles, and the frontend/build test lane for Vite/React. Add tests only where a concrete behavior needs coverage.
- [ ] Prepare exact commits, validation results, and old-PR replacement mappings before any requested publication. Preserve failed checks and defer a blocked upgrade rather than enlarging cleanup into a platform migration.

**Exit condition:** Each dependency PR is linked to a qualified replacement, a still-active current change, or a documented deferral. Publishing these changes and closing their PRs are separate from making the local checkout tidy.

## Task 7: Reconcile loose files, stash, recovery refs, and remote leftovers

**Files:** Existing primary untracked files; stash 8faad906612ff34cecdb62f11ae68cfd5ec33acb; recovery snapshot 40f480d53bf4193da1c583b659d2968ff77e411e; Task 1's manifests. Create a final cleanup report in a dedicated documentation branch.

**Consumes:** Verified archive/disposition evidence and any completed feature/dependency decisions. **Produces:** A clean primary checkout and an explicit remote cleanup proposal or receipt.

- [ ] Classify the two older untracked plans, temporary navigation probe, ZIPs, and plugin-review tree as maintained documentation, useful test, or historical artifact. Search for references before moving anything. Promote useful files in scoped commits; move archived-only copies out of primary only after exact recovery verification. Preserve active local configuration.
- [ ] Account for the ignored historical audit directory .superpowers/reading-prompt-audit-20261024-9c354374. The planning-time primary docs check reports three broken links in its plan-revision-2/previous/plan-revision-1.md. If the audit directory is inactive, archive and rehome it with its original bytes and relative-path manifest; otherwise retain it and record the baseline failure. Do not rewrite frozen audit evidence or weaken the link checker to manufacture a pass.
- [ ] Save this plan and the final report on the documentation branch. If publication is not authorized, their verified local commit is sufficient to remove duplicate loose copies from primary; report that branch as pending rather than claiming master contains them.
- [ ] Reconcile the stash's 182 tracked-path changes and 56 untracked files against current master and the archive. Classify by exact match, superseded change, useful missing change, or intentionally archived artifact. Extract only useful missing hunks into isolated branches; do not pop/apply the entire stash.
- [ ] Review the 17 journal/Journey paths in 40f480d5 similarly, including any relationship to the preserved journal test. Keep the recovery ref until every item has a disposition. Existing archive tags and tool-owned checkpoints remain retained.
- [ ] Drop the stash only if its complete content is verified recoverable and its disposition is approved. Resolve its current stash selector by the expected SHA immediately before dropping; never assume stash@{0} still names it.
- [ ] Prepare an explicit remote branch retirement list with expected SHAs and PR/default-branch checks. Include integrated/duplicate feature branches and consider stale main only after checking branch rules and external consumers. Preserve Spacefast, active PR branches, and the PR #124 screenshot branch; its URLs may still depend on that ref.
- [ ] If remote cleanup is authorized, refresh the remote tips immediately and delete only listed refs using an atomic push with per-ref expected-tip leases. Reject drift. Do not force-update master or delete tags; prune obsolete remote-tracking refs only after server-side results are verified.
- [ ] Verify final status, local/remote master parity or explicitly reported pending commits, active worktree list, every retained branch, archive hashes, and all untouched paths. Record PR states and the unchanged narrative/F3b acceptance limits separately.

**Exit condition:** Primary is clean; no unique work depends solely on an unexplained dirty checkout or stash; the remaining branches/worktrees have owners and stated purposes; preserved evidence is discoverable and recoverable.

## Execution order and completion report

Execute Tasks 1–4 first. These remove the immediate loss risk and most local clutter without requiring either F3b qualification or dependency upgrades to finish. Task 5 can then park/supersede old work, Task 6 handles dependency maintenance in separate batches, and Task 7 closes the local and remote inventory. Task 7's loose-file and stash analysis may proceed earlier, but deletion depends on its verification and authorization conditions.

The final report must list: old/new master tips; local and remote changes separately; retained active branches and why; removed worktrees/branches with recovery locations; stash/recovery disposition; exact tests actually run and any pre-existing check failures; remaining content failures; and deployment/model-call counts of zero for this cleanup. A tidy checkout is not a claim that all code is qualified or deployed.
