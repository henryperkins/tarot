# F3b comparison preparation — November 1, 2026

## Current: rebased onto common narrative 1.6.13, revised stop rule

**Prepared offline; no reading was generated.** The owner chose to leave the D02 unfinished-plan failure open and move F3b to 1.6.13.

- **Rebase.** `wip/f3b-retrieval-20261101` was rebased onto `fix/symbolic-deficit-grounding-20261101` at `76de5e7a`, giving `7d226594`. The old head is kept as the local tag `archive/f3b-retrieval-20261101-on-99238712`.
- **Byte identity.** The ten retrieval code and test files and this document are byte-identical to the old head. Every 1.6.12/1.6.13 narrative file is byte-identical to the narrative branch.
- **Arms.** The frozen arm snapshots differ in exactly those ten files: baseline is `76de5e7a`, candidate is `7d226594`.

**Offline results:**
- Root suite 6,277 pass / 0 fail / 2 skipped.
- 184 focused retrieval, grounding and launcher checks; 70 Worker tests; 874 fixtures / 2,541 prompt builds; build, lint and docs pass.
- All 50 retrieval cases replay identically to the 1.6.11 preparation in both arms: 7/7, 19/19 and 12/12 positives, with no new false positives and no cap or weak-floor regressions.
- All 92 final prompts equal their 1.6.11 predecessors plus only the 1.6.12 symbol label and the 1.6.13 edits.
- The partition is unchanged: 23 changed-prompt pairs and 23 identical-prompt pairs.
- Questions are byte-exact and GraphRAG is retained in every prompt. No provider call, authentication or embedding request was made.

**Revised stop rule.** The hard checks and quality scales are byte-identical to the previous protocol.

- **Identical-prompt pairs** are settled offline: the retrieval change cannot alter what the model receives, so they are not generated. REL05's failure remains a narrative defect, not an F3b result.
- **Changed-prompt pairs** are reviewed blind. After unblinding, each candidate hard fault is classified against that pair's frozen prompt diff. It is attributable if it draws on candidate-only prompt content; a disputed classification counts as attributable.
- **Dispatch stops** on an attributable candidate hard fault, an attributable material quality loss, or a transport, capture or rendering failure. Non-attributable faults are recorded as narrative residuals and do not stop dispatch.
- **Pilot:** REL01, FRESH14, FRESH15, FRESH05 and HOLD2_03, 10 outputs in one batch.
- **Remaining:** 18 pairs (36 outputs), only after a passing pilot and separate authorization. The maximum is 46 outputs instead of 92. Authorized outputs: zero.

Evidence: `~/.local/state/tarot/f3b-comparison-v1613-20261101T124726Z` (`review-protocol.md`, `experiment-plan.json`, `source-manifest.json`, `retrieval-replay.json`, `prompt-comparisons.json`, `diffs/`, `zero-dispatch-receipt.json`).

## Superseded: preparation on common narrative 1.6.11

**Prepared offline; no new generation or content pass.** The retrieval candidate was rebased from `75fc1ea3` to `f264bf74` on the qualified local integration revision `99238712`. All eleven files in the prior candidate delta are byte-identical after the rebase. The four runtime retrieval modules remain the same candidate; no score, label, threshold, cap or acceptance criterion changed.

Both comparison arms use the same prompt **1.6.11**, scene validator/renderer, Unicode safeguards, request validation and dependency lockfiles. The separate 1.6.12 symbol-scope fix is excluded from both. Source snapshots and hashes prevent later worktree edits from silently changing the experiment.

## Offline results

- All 50 immutable retrieval cases replay with the real cached vectors. Original positives: **7/7**; seen corpus: **19/19**; former blind holdout: **12/12**. There are no new judged false positives, recall losses, cap violations or weak-floor regressions. Both arms' selected IDs, scores and weak flags exactly reproduce the previous split replay. The holdout is now seen regression evidence.
- The four invalid card-count tuples, REL03/04/06/07, remain retrieval-only. All **46 eligible pairs** build actual final provider prompts: **23 changed-prompt pairs and 23 identical-prompt stochastic controls**. Derived system context differs in FRESH15 and PHASE2_07; the narrative-builder source is identical.
- All **92 final prompts** use semantic retrieval and retain GraphRAG context. Accepted questions survive byte-for-byte in the final user-context boundary. Missing frozen vectors fail; no live embedding fallback is allowed.
- The 171 focused retrieval/grounding/launcher checks pass on the combined dependency installation. The previous 6,264-pass root result belongs to the prior dependency baseline; it is not described as a fresh full-suite run here. The integration baseline separately passes 6,238 root tests and its affected dependency/browser checks.
- Preparation blocks fetch, Node network transports and child-process dispatch. The guard's explicit refusal checks pass. Actual preparation records zero provider calls, authentication attempts and new embedding requests.

## Proposed next experiment

The six hard checks, four quality scales, relative acceptance and Japanese prose-quality-only waiver remain unchanged. Equivalent specific shared faults are recorded; similar categories cannot cancel different false claims. A candidate-only/worse hard fault or material per-case quality loss stops dispatch. Unresolved differences do not pass. All 46 complete reviewed pairs are necessary for full coverage. The separate absolute standard-content gate is not reintroduced as a retrieval prerequisite.

The fixed five-pair pilot remains REL05, REL08, REL10, FRESH10 and HOLD2_09. The new narrative baseline makes historical output reuse inappropriate. Preparation therefore accounts for **10 pilot readings**, then **82 further readings** only after a complete passing blind pilot and authorization to continue: **92 total**. The current authorization remains **zero new readings**. No launcher was invoked and no subscription access was tested.

Provider settings remain the owner's Claude subscription, `claude-opus-5-5`, `xhigh`, 32,000 maximum output tokens, one attempt per output, at most two concurrent, no paid fallback and no new embeddings. Interrupted attempts count and retain their partial evidence; no automatic retry or preferred-output substitution is permitted. Original failed pairs and judgments are immutable and cannot be replaced by this experiment.

The current protocol updates execution context from the historical a030 baseline and 12-output reuse plan; the review instructions, hard checks, quality anchors and acceptance section are byte-identical. Blind A/B assignments, prompt hashes, source snapshots, input hashes, execution order and call accounting are frozen in the private evidence root. Before any later dispatch, verify this freeze, the existing owned launcher/capture safeguards, actual provider settings and explicit generation authorization. This preparation does not establish live transport or release readiness.

Evidence: `/home/ubuntu/.local/state/tarot/integration-grounding-20261101T051522Z/comparison/`, including `experiment-plan.json`, `current-review-protocol.md`, `source-manifest.json`, `external-inputs.json`, `retrieval-replay-guarded.json`, `prompt-comparisons.json` and `zero-dispatch-receipt.json`.
