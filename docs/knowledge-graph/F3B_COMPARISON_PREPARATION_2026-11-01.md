# F3b comparison preparation — November 1, 2026

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
