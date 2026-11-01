# PR #121 disposition — November 1, 2026

## Decision

The older [PR #121](https://github.com/henryperkins/tarot/pull/121) implementation is superseded by current master. No missing production behavior was identified in this comparison that warrants copying from the stale branch. Retain its branch and exact history for recovery, retire its idle local worktree after verified archival, and propose closing the PR as superseded when remote publication is authorized. This record does not close the PR or qualify either implementation for release.

Compared source identities:

- Current master: `19be91abd8a3f90e4f9fcea84423231e5aa17e08`.
- PR #121: `8546284b884dcb56466f247a38f5d5b974e2f078`, branch `codex/knowledge-graph-context-20261022`; five non-merge commits remain patch-unique.
- Current separate F3b WIP: `75fc1ea3e39eab2b213406263028fadb99c4a2af`. This comparison does not rely on that unmerged candidate to declare PR #121's original behavior superseded.

All 79 paths changed by PR #121 exist on master. Nine files are byte-identical; the other 70 contain later changes. Those counts are inventory, not the behavioral proof. The table below records the source and regression comparison.

## Behavior mapping

| PR #121 behavior | Current master evidence | Disposition |
| --- | --- | --- |
| Canonical numeric keys for all 30 partial Major pairs, matched/missing membership, neutral fallback | `knowledgeGraph.js`, `knowledgeGraphData.js`, `knowledgeGraphPartialTriads.test.mjs`; current code additionally rejects duplicate/noncanonical membership and ties narrative evidence to drawn card indices | Covered and strengthened; retain current implementation |
| Analyze each current question/reflection/card note before the bounded retrieval query | `readingContextSources.js`, `contextDetection.js`, `readingRetrievalQuery.js` and corresponding tests; current code adds explicit topic exclusions, current-source precedence and grapheme-safe cuts | Covered; later context selection supersedes the old projection |
| Explicit/inferred A/B options, one-sided labels, clears/replacements, local fallback, jobs and evaluation | `decisionPathContext.js`, `tarot-reading.js`, `narrativeBackends.js`, `readingJob.js`; all 30 literal named decision-path tests remain, including effective-label language screening and clear/replacement controls | Covered; do not restore older prompt role wording |
| Selected-deck projections, source attribution, separation of display prose from meaning and imagery | `graphRAGProjection.js`, `knowledgeBase.js`, `shared/passageSource.js`, deck-projection/provenance tests; current projection rebuilds editorial fields from verified registry rows, binds partial/minor subsets, adapts card names and rejects unapproved enrichment projections | Superseded by stricter provenance and subset checks |
| Every eligible passage variant competes before selection/caps; zero cap, deterministic ties, fallback and enablement | `graphRAG.js`, `graphRAGCandidates.js`, candidate-selection/enablement tests; current master adds bounded semantic execution, lexical safeguards and final reference-integrity checks | Covered by the later GraphRAG stack; the further F3b candidate remains separate |
| Subject-safe age/birthday memory, bounded candidate loading, three-note cap, no access writes during candidate loading | `readingMemorySelection.js`, `userPersonalization.js`, selection/access tests; infant-age, measurement, decimal/fraction/range guards remain. Later code additionally preserves temporal scope/polarity, checks retractions and explicit memory opt-out | Covered and intentionally more conservative |
| Stamp only memory retained by the successful reading; ordinary list reads stay owner-scoped and within D1 binding limits | `userMemory.js`, direct-route and durable-job access tests; ordinary access tests are byte-identical. Current durable receipts acknowledge persistence only on success and retain retry state | Covered and strengthened; no old access implementation to salvage |
| Distinguish candidate/selected/final retained references and current-input use across provider, local fallback and reader UI | `narrative/sourceUsage.js`, `shared/readingSourceUsage.js`, `sourceUsageSummary.js` and input-usage/summary tests; current code adds bounded integrity and context diagnostics without public text/private IDs | Covered; preserve later final-prompt accounting |
| Frozen qualification fixtures, prompt/evaluator metadata and historical editorial checklist | The original case fixture, sample-reference-time test, request limits, passage-source contract, stream bridge and enablement policy/tests remain byte-identical. Current prompt 1.6.11 and qualification records supersede older version numbers and status prose | Historical evidence retained; no version or qualification-status rollback |

Relevant runtime and test paths are under `functions/lib/`, `functions/api/`, `src/worker/`, `shared/` and `tests/` as named above. The complete 79-file identity list and per-file diffs are saved in the private evidence root below.

## Deliberate differences, not missing behavior

- Current age admission requires compatible polarity and temporal scope. The old broad age/token admission must not be restored just because its permissive example selected a memory.
- Arbitrary legacy passages without registry identity are rejected. The old delimiter-escaping and separate-index tests now exercise verified registry fixtures; their assertions remain covered without admitting unverified prose.
- Older ordinary-duration memory examples were replaced by conservative factual-admission tests. Infant age and measurement guards remain exercised, including direct/job prompt exclusion and access behavior.
- Current source accounting includes caller interpretations and final integrity diagnostics. Older files would remove those later safeguards.
- Current prompt role/scene/Unicode fixes are already on master. PR #121's old prompt wording and version are historical, not salvage candidates.

## Verification and limits

Fresh credential-free execution of fourteen focused suites on the exact current-master code passed **733 tests, zero failures, zero skips**. Coverage includes decision paths, memory selection/access, ordinary memory reads, personalization, context sources/query projection, input/source accounting, partial triads, deck projection, candidate selection, enablement and prompt integrity. No application source was changed for this disposition, and no provider, generated-reading or embedding call was made.

The nine byte-identical files are `codexReadingStream.js`, `evalGatePolicy.js`, `shared/contracts/readingRequestLimits.js`, `shared/passageSource.js`, `tests/fixtures/knowledge-graph-context-cases.json`, `graphRAGEnablement.test.mjs`, `narrativeSampleReferenceTime.test.mjs`, `userMemory.test.mjs` and `userMemoryAccess.test.mjs` (server files under `functions/lib/`, test basenames under `tests/`).

PR #121's failed/unfinished subscription comparison and original 145-item human editorial checklist remain historical evidence. This disposition does not mark them passed. Current F3b content qualification remains open, the historical REL01 paired failure and creative-project unsupported unfinished-plan finding remain open, and Japanese prose quality alone remains waived. A fresh comparison would require its own identified source and authorization.

## Proposed PR closure text

> Superseded by the current master implementation at `19be91ab`. The original partial-pair, current-source, decision-path, deck-projection, memory-ownership/access and source-use behaviors are covered by later code and regression tests. The November 1 comparison identified no production-code salvage from this stale branch; 733 focused current-master tests pass. Original branch history and qualification evidence are preserved. Closing this superseded implementation does not clear historical content failures or qualify the separate F3b candidate.

This is prepared text only. The PR and its remote branch remain unchanged.

## Recovery

Private evidence: `/home/ubuntu/.local/state/tarot/reconciliation-cleanup/20261101T030802Z/continuation/task5/`.

`pr121-file-comparison.json` and `diffs/` contain the comparison; `github-pr-metadata.json` records the observed draft/open PR head. `recovery/worktree-01/` preserves all 170 unique ignored entries, including the old execution evidence and dependency symlink. The original commit history remains in the existing `all-refs.bundle` and restored `recovery/history.git` one directory above the continuation root. Local and remote feature branches are retained. Restoration must use a separate checkout at the saved head, not a whole-tree overlay onto master.
