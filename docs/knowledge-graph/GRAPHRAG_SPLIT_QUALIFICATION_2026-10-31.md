# Retrieval and narrative split qualification — 2026-10-31

The owner approved separating retrieval changes from narrative corrections, then replacing the combined absolute-content prerequisite with a frozen old-vs-new retrieval comparison. The extraction is complete and source checks pass in both new worktrees. **F3b has not passed. The independent narrative lane has not passed.** Both stopped under their own content rules; no failed output was retried or replaced.

## Source ownership and baseline

| Worktree / branch | Owned overlay before this report | Narrative source |
| --- | --- | --- |
| `.worktrees/f3b-retrieval-only-20261031` / `qualify/f3b-retrieval-only-20261031` | 10 files: four runtime modules, evaluator, tests/fixture and preview-manifest entry | Unchanged a030 prompt 1.6.2 and renderer |
| `.worktrees/narrative-grounding-20261031` / `qualify/narrative-grounding-20261031` | 58 files: grounding/role/imagery/Unicode/scene-contract/tally changes, tests and records | Prompt 1.6.10 |
| `.worktrees/graphrag-rebase-20261027` / `integrate/graphrag-onto-master-20261027` | Original complete 66-file candidate, preserved byte for byte | Complete historical 1.6.10 candidate |

All three HEADs remain `a030467351b2374a9c9a1d933eecc0498abcaca3`. These are uncommitted overlays on the existing committed GraphRAG stack, **not master-based release branches**. Local master and its existing remote-tracking ref remain `26da856cc4e3da98d015dc5f0d306952d58015c7`; this run did not fetch, push or query the active production version.

The retrieval runtime ownership is `functions/lib/graphRAG.js`, `graphRAGCandidates.js`, `graphRAGRanking.js` and `readingContextVocabulary.js`. Unicode preservation and its private retrieval-normalization companion remain together in narrative work. Shared context tests and the preview manifest were split by hunk/module. The extracted union reconstructs the original 66 files; later documentation-only clarification in the narrative copy and these new reports are separately accounted for.

## Source and retrieval checks

| Check | Retrieval worktree | Narrative worktree |
| --- | --- | --- |
| Credential-free root suite | 5,992 pass / 0 fail / 2 skip | 6,195 pass / 0 fail / 2 skip |
| Worker suite | 70 pass | 70 pass |
| Prompt assembly | 874 fixtures / 2,541 builds | 874 fixtures / 2,541 builds |
| Build, changed-code lint, maintained-document links | Pass | Pass |
| Frozen retrieval replay | 50 cases; original 7/7, seen 19/19 and former blind holdout 12/12 positives; no new judged false positives, recall losses, cap or weak-floor violations | No retrieval acceptance inferred from narrative tests |

Extraction initially misplaced the new ranking module's preview allowlist entry; the required module ownership was corrected and both suites rerun. Concurrent root suites then collided on port4193; the final retrieval root run passed serially. No application workaround was introduced for that port collision.

The independent source/harness review found no Critical issues and one Important narrative-launcher interruption issue. That launcher was fixed before generation with observed failing-then-passing lifecycle tests, including success, failure, exception, SIGINT/SIGTERM and refusal of a second launch. The later harness fix was not independently rereviewed. Dispatch refusal and capture checks also passed. The separate semantic interruption described below remains an unresolved transport limitation; those earlier tests do not erase it.

## Frozen paired retrieval comparison

The common source, provider, input scenarios, settings, accepted question bytes and renderer were held constant. Only retrieval ranking, corroboration and nominal context exclusion, with their resulting context/passages, vary. In FRESH15 and PHASE2_07 the nominal exclusions also change the derived system context lens; the narrative-builder code itself is identical. The common old sanitizer can normalize final-prompt Unicode in both arms, so this comparison does not establish byte-exact final Unicode preservation.

All 50 original cases and labels remain. Four invalid card-count tuples (REL03/04/06/07) stay retrieval-only. The 46 eligible generated pairs comprise **23 changed-prompt pairs and 23 identical-prompt stochastic controls**. Twelve saved baseline readings were revalidated against exact source, scenario, actual prompts, provider configuration, capture and local validation before reuse. Blind A/B assignment and the order were frozen before new calls.

Both arms use the owner Claude subscription, `claude-opus-5-5`, `xhigh`, maximum 32,000 output tokens. The cap is 80 fresh semantic calls including the pilot, one attempt per output and maximum two concurrent. No paid narrative API fallback or new embedding request is permitted. Cached real vectors supply actual semantic-path replay.

The approved relative rule records all absolute faults, preserves equivalent specific shared faults, and blocks on candidate-only/worse hard faults or material per-case quality loss. Unresolved differences do not pass. It does not change relevance thresholds, labels, caps or weak-floor rules. **Japanese prose quality alone remains waived**; every factual, scope, role, card and other-language check remains binding.

The five-pair pilot passed the relative gate after all ten outputs were reviewed and judgments frozen. REL05 had a baseline-only custom-role failure on identical prompts, which is not causal evidence of retrieval improvement. Both REL10 outputs turned spatial roles into temporal ones; that same-specific shared defect remains recorded.

The next frozen batch stopped qualification. REL01 asks, “How can I move through sorrow toward quiet renewal?” The candidate says:

> The patient blending you do now could open naturally into that calmer hope.

The question supplies no such current activity. An earlier hypothetical practice does not establish that it is occurring; “could” qualifies the future result. The baseline instead says “The skill you may be practicing now…”. The independent blinded judgment was frozen and hash-verified before B was revealed as the candidate. This is a **confirmed candidate-only H1 fault** under the unchanged content rubric. A single stochastic pair does not establish that the retrieval code caused it, but it prevents a clean paired pass.

Shared/inconclusive findings remain explicit: REL01 has the same unresolved Temperance “rising sun” imagery in both outputs; PHASE2_08 has a baseline-only unresolved conditional-scope question; FRESH04 has the same unresolved Fool sunrise claim; FRESH05 substitutes French Marseille names for all three accepted English card names in both outputs. These findings are not erased or offset against the candidate H1 failure. All 17 complete pairs and the one unmatched candidate output have now received full independent review: 35 outputs and all 70 consumer/display strings. The retained later pairs have no additional confirmed candidate-only hard fault or material quality loss. FRESH07 favors the baseline locally (usefulness 3 versus 2), which remains nonmaterial under the frozen scale. FRESH11 is reviewed only as a single output; no paired verdict is inferred. All original findings remain in the immutable evidence manifests.

The candidate FRESH03 output also has a retained automated local spine flag (`1/4 card sections, need 75%`). Complete content review is separate from that technical flag; neither proves live route delivery. All 23 completed fresh outputs have exact provider-to-consumer transport verification, semantic scoring used and GraphRAG included in their actual prompts; 22/23 pass the local structural gate.

## Actual generation and interruption accounting

| Quantity | Result |
| --- | --- |
| Fresh semantic subscription attempts | 25 of 80; 23 complete and 2 interrupted |
| Exact reused baseline outputs | 12 |
| Complete semantic pairs | 17 of 46: 10 changed-prompt pairs and 7 identical-prompt controls |
| Additional complete output | FRESH11 candidate, no complete counterpart; no paired verdict |
| Incomplete attempts | FRESH11 baseline and FRESH12 baseline; partial raw streams retained |
| Semantic fresh slots unstarted | 55; 29 eligible pairs remain incomplete |
| Independent standard subscription attempts | 5 of 11; all 5 complete; 6 unstarted |
| Total new subscription attempts in this split run | 30; zero retries, paid narrative calls or new embedding calls |

The coordinator wrote the semantic content halt at 20:56:55 UTC. Every recorded fresh dispatch predates it. The outer remaining-generation command also returned exit 143 without its normal terminal receipt. Two capture proxies ended; their owned Claude children were briefly orphaned and then exited. The exact cause of 143 is not established. Original partial streams and logs remain, the attempts are counted, and neither completion nor rendered output is fabricated. No provider process remains and no failed/incomplete attempt was retried. This is a separate transport qualification gap; it does not explain or undo the earlier complete REL01 content failure.

## Independent narrative and scene-contract disposition

The narrative worktree has its own standard gate and does not gate retrieval. The literal standard CI exits 1 after a content halt: **4 complete outputs pass, 1 fails, 0 remain unresolved; 6 fixed cases are unstarted**. The creative-project synthesis says:

> The spark is real (Ace of Wands), and help with building it well is within reach (Three of Pentacles).

The question does not supply available help. The earlier conditional helper example loses its condition in synthesis. This H1 fault remains despite passing local structural checks. The transition reading's initial Mars uncertainty was resolved using the exact current-transit line already in its frozen prompt; the original judgment and separate source addendum remain immutable.

The scene contract is separately indexed in `review/scene-contract-review-boundary.md` in the evidence root. The narrative overlay owns `canonicalSceneEvidence.js`, prompt/metadata/fitting integration, backend finalization, pre-render streaming buffering and matching tests. The retrieval comparison has none of that contract overlay.

All 5 standard outputs have exact transport/rendering verification and no renderer rejection. The retained Celtic output exercised the Hermit fact caption. That is one observed success, not evidence of general adherence across all four covered facts, languages or providers. The strict validator still rejects the historical malformed interpretation. It checks shape, fact authorization and bounded captions, not arbitrary prose truth or matching the caption locale to the question. Malformed model JSON can reject a reading; live streaming latency, fallback and release behavior remain unqualified. These risks stay with the narrative change.

## Preservation and recovery

All 15 original worktree HEADs/statuses/staged entries and 112 dirty-file hashes remain unchanged: 66 complete-candidate files plus 46 unrelated files. The original unrelated indexes, stash and durable refs remain unchanged. Two new branch refs point to the existing a030 commit; no commit was created. New-worktree indexes remain empty. The journal performance test's SHA256 is `ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`.

The original complete-candidate recovery and both extracted overlays have patches and archives, verified by hashes and reconstruction outside Git. Final documentation has its own final recovery copies. Nothing was staged, committed, merged, pushed or deployed. The original complete candidate and all prior qualification records remain untouched.

## Evidence and next bounded work

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-retrieval-split-20261031T201931Z`.

- `qualification-outcome.json`: final coverage, calls, differential findings and independent review hashes.
- `split-plan.md`, `split-manifest.json`, `source-manifest.json`, `generation-freeze.json`: approved scope, exact ownership and pre-generation source/input/config freeze.
- `retrieval-replay.json`, `reuse-revalidation.json`, `input-boundary.json`: unchanged retrieval gates, baseline reuse and prompt boundaries.
- `review/blind-pilot/`, `review/blind-remaining-01/`, `review/blind-remaining-02/`, `review/blind-remaining-03-retained/`: immutable full-output judgments before unblinding.
- `manual-review-halt.json`, `diagnostics/semantic-terminal-receipt.json`, `diagnostics/semantic-interruption-observation.json`: content halt and honest incomplete-attempt accounting.
- `semantic-terminal-transport-verification.json`, `narrative-lane/standard-partial-transport-audit.json`: complete capture/consumer checks, with content limitations retained.
- `narrative-lane/review/standard-independent/final5-dispositions.json`: separate standard content result.
- `diagnostics/final-freeze-verification.json`, `preservation-final.json`, `recovery/`: frozen bytes and recovery/preservation proof.

Before any new generation, diagnose the REL01 wording against the two frozen contexts and address the semantic launcher's lost-terminal-receipt/descendant-lifecycle gap. Any causal replication must be predeclared as a complete paired batch, retain the failed first pair and all repeats, and receive fresh blind review; it cannot replace the observed failure. Separately address or review the narrative helper-availability assertion and scene-contract failure behavior. Also inspect the FRESH03 spine flag before making any live delivery claim. No additional source correction or repeated provider batch is performed in this run. F3b and narrative release readiness both remain open.
