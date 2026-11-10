# Narrative conditional-scope correction — October 31, 2026

Prompt **1.6.11** corrects the prompt scaffolding and conditional-scope instructions implicated by REL01 and the creative-project reading's unsupported available-help claim. The correction is qualified **offline only** in `qualify/narrative-grounding-20261031`, on unchanged HEAD `a030467351b2374a9c9a1d933eecc0498abcaca3`. Both original generated-output failures remain open. No new reading was generated, and no corrected output is being claimed.

The owner authorized these two fixes in the isolated narrative worktree, with offline qualification and preservation of unrelated work. The Japanese **prose-quality** waiver remains unchanged; other grounding, card/scene, structural, Unicode, supplied-context, budget and retrieval acceptance criteria are unchanged. No staging, commit, merge, push or deployment occurred. No hosted generation, provider authentication or embedding call was made. `ci:narrative-check` was not run because it generates readings.

## Diagnosis from existing evidence

The saved REL01 candidate changes a possible practice into an assumed current activity: “The patient blending you do now could open naturally into that calmer hope.” The modal verb qualifies the outcome, while the activity remains asserted. The baseline's corresponding phrase is conditional (“The skill you may be practicing now…”). The added retrieval passage is conditional; this single stochastic pair does not establish that retrieval caused the failure.

The narrative creative-project question asks about launching a project this quarter. Its supplied reflection mentions momentum and second-guessing tone and timing; it does not establish available collaborators or help. The saved prompt nevertheless projected the Support card as “resources, allies, or inner strengths available now” and as evidence that the reader was not empty-handed. The output later asserted that help was within reach, although its earlier example of trusted people was conditional. This source contradiction and the loss of a local condition both needed correction.

The [preceding diagnostic record](GRAPHRAG_OFFLINE_DIAGNOSTICS_2026-10-31.md) and [split qualification record](GRAPHRAG_SPLIT_QUALIFICATION_2026-10-31.md) retain the original findings. Existing readings, prompts, judgments, receipts and halt records were not edited.

## Scoped source correction

- **Keep each premise conditional where it is reused.** The system instruction distinguishes a proposed activity from an activity already underway, and hypothetical support from available support. A possible outcome does not qualify an asserted cause. The condition must survive questions, action steps, synthesis, recap and closing. Supplied facts and explicit absence remain authoritative.
- **Remove factual Present scaffolding.** Three-card and Celtic templates describe a symbolic lens to compare with supplied context. The shared formatter also covers short/custom Present positions and case variants. It no longer labels the supplied meaning as an established live dynamic or ongoing practice.
- **Remove factual Support scaffolding.** Support templates and the shared formatter describe support to explore, seek or develop. They do not establish resources, allies, capabilities or access. The card alone is not evidence that help is available.
- **Retain the protection during fitting.** The existing protected `PREMISE CHECK` line now explicitly includes activity and support, with synthesis, recap and closing. No budget, fixture, threshold, reference-retention expectation or fitting algorithm changed.

The implementation changes five runtime files: [role helpers](../../functions/lib/narrative/helpers.js), [card prompt builders](../../functions/lib/narrative/prompts/cardBuilders.js), [system prompt](../../functions/lib/narrative/prompts/systemPrompt.js), [user prompt](../../functions/lib/narrative/prompts/userPrompt.js) and [prompt version history](../../functions/lib/promptVersioning.js). The other task-owned source changes are the new test and four existing test expectation updates: two version checks, the Present alias normalization contract and the Celtic intro expectation. Unrelated pre-existing hunks in those files remain.

## Offline qualification

The new [conditional-scope tests](../../tests/conditionalScopeGrounding.test.mjs) exercise actual role emitters and provider prompt construction. Eighteen tests cover 384 role/meaning/orientation/context combinations, the two affected inputs across Claude/OpenAI/Modal targets, positive supplied context, explicit absence, hypothetical collaborators, and protected instructions with and without the scene contract under budget pressure. Adverse meanings are included so a symbolic state is not automatically presented as a practice. These are prompt/source contracts, not generated-content verdicts.

The corrected regression test replay fails all 18 tests against the exact preserved pre-task source for the intended missing behaviors. An earlier test draft had an incorrect selector for a position prefixed by a connector; that draft and its failure log are retained separately. The source correction passes all 18 tests in the final scoped and root runs.

| Check | Final result |
| --- | --- |
| Credential-free root suite | **6,238 pass / 0 fail / 2 skipped** |
| Focused scope, inference, integrity, budget and Celtic checks | **120 pass / 0 fail** |
| Worker knowledge graph, spread analysis and alert checks | **70 pass / 0 fail** |
| Offline prompt assembly | **874 fixtures / 2,541 provider builds pass** |
| Build | Pass |
| ESLint on the ten task-owned runtime/test files | Pass |
| Documentation links | Pass (local maintained Markdown links) |
| Saved-input prompt comparison | **39 comparisons pass** |

The comparison reconstructs all 11 saved standard prompts byte-for-byte on the preserved pre-task source, then compares old and new prompt construction across three provider targets. Both saved REL01 retrieval selections supply another six comparisons, without rerunning retrieval. All supplied-context blocks, reference blocks, exact card-name/scene contracts and checked GraphRAG retention metadata remain unchanged. This is not a new semantic replay or generation run.

The first expanded draft displaced a GraphRAG summary in a tight-budget fixture and failed assembly and budget tests. Intermediate failing receipts are retained. Concise wording resolves the regression without changing the fixture or expected retention: Claude and OpenAI retain the summary at **6,189 / 6,200 estimated tokens**, versus **6,187 / 6,200** before this task. Modal retains the full reference. The remaining margin is only 11 estimated tokens in that fixture and is recorded as such.

## Independent review and disposition

One independent source review examined a frozen ten-file task delta, not the complete pre-existing overlay. It found **0 Critical, 1 Important, 1 Minor** issues. Its original verdict remains unchanged: that initial snapshot was not ready for offline qualification.

| Finding | Disposition on final bytes |
| --- | --- |
| Important: expanded wording drops the required GraphRAG summary | Shortened core/footer/role instructions; unchanged full assembly and focused budget gates pass. Executor replay of the review probe confirms `summary` for Claude/OpenAI and `full` for Modal, with zero network attempts. |
| Minor: Present meanings universally framed as a practice | Neutral symbolic-possibility wording plus adverse/reversed emitter coverage. Executor replay confirms canonical Tower and reversed Hermit meanings are retained as themes, without the practice wrapper. |

The frozen review files and hashes are preserved. Later corrections have executor verification, including the full suite, but **were not independently re-reviewed**. The final manifest records the later hashes separately.

The reviewer explicitly declined to judge new provider-output behavior, Japanese prose quality, retrieval causation or semantic qualification, other pre-existing content issues, complete local-composer/provider execution quality, arbitrary new/translated role names, repository-wide preservation, later source edits, and merge/release/live readiness. Those limits remain. Preservation below is the executor's audit, not an independent review claim.

## Preservation and evidence

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-narrative-conditional-support-20261031T231638Z`.

- `preservation-before.json`, `preservation-after.json` and `preservation-summary.json` record 17 unchanged worktree HEADs and indexes, 96 unchanged refs, all unrelated dirty-file hashes, and the primary journal performance test. The retrieval-only and original complete GraphRAG worktrees remain unchanged.
- `prior-evidence-hashes.json` records the 41,477 historical evidence files checked unchanged, including original outputs and verdicts.
- `recovery/narrative-before/` and `recovery/narrative-after/` contain verified patches, pending-file archives, manifests and reconstructions outside Git. The pre-task narrative overlay had 68 pending files and was preserved before mutation.
- `final-source-manifest.json`, `final-source/` and `final-task-delta.patch` identify the final ten runtime/test files relative to that pre-task overlay. `review-source-manifest.json` and `reviewed-source/` separately identify the earlier independently reviewed snapshot.
- Final launcher receipts are `root-qualified.json`, `scoped-concise.json`, `worker-qualified.json`, `assembly-concise.json`, `build-qualified.json`, `lint-qualified.json`, `comparison-qualified.json`, `findings-qualified.json` and `docs-qualified.json`. All listed code-check receipts cover the frozen final runtime/test bytes.
- `diagnostics/prompt-comparison.json` and `diagnostics/review-findings-final-probe.json` retain the prompt and finding-resolution evidence. `review/review.md` and `review/review.json` retain the original review and its limitations. Earlier failing checks and first compact comparison remain separate evidence.

The source correction is ready for review as an uncommitted local change on the narrative branch only. The retrieval-only candidate has not received these edits. REL01 and the independent narrative available-help content gate remain open until separately authorized generated readings can be reviewed under their approved criteria. This task does not authorize or start that next step.
