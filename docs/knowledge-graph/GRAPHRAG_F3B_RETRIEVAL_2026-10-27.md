# F3b multilingual retrieval correction and qualification

This file preserves the combined candidate history. The retrieval implementation and tests described below now belong to the separate `f3b-retrieval-only-20261031` worktree; this narrative worktree does not contain them. The unchanged original record remains in `graphrag-rebase-20261027`.

*Latest October 31 disposition: local prompt 1.6.10 corrects the relationship "Them" framing, shows complete scene-reference objects and supplies drawn-card tallies. Offline source checks pass, retrieval is unchanged and no generation was run; see the [paired reading record](GRAPHRAG_F3B_SEMANTIC_READINGS_2026-10-28.md).*

*Previous October 31 disposition: the [paired reading record](GRAPHRAG_F3B_SEMANTIC_READINGS_2026-10-28.md) documents local prompt 1.6.9 canon/Unicode correction. Source qualification passes 6,208 root tests, 70 Worker tests and 874 fixtures / 2,541 builds. All frozen retrieval results and baseline prompts are preserved, and 46 candidate questions now retain exact Unicode. Five standard calls yielded three independently passing consumers, one confirmed relationship-grounding failure, and one rejected Celtic transport with separate raw-prose diagnostics. Actual CI exits 1; six standard and all 80 semantic calls remain unstarted. F3b remains open; the actual pilot refuses negative standard clearance. Japanese prose quality alone is waived. Nothing was staged, committed, merged, pushed or deployed.*

## Disposition

The original Japanese `REL02` ranking failure is repaired, and the original ten-case relevance gate passes without changing its labels or acceptance predicate. **Broader multilingual qualification still fails.** The independently judged 24-case corpus has five positive misses, also present on the baseline. F3b must remain open at that broader scope; this is not release qualification.

*October 28 follow-up: the [corroboration candidate](#october-28-follow-up--canonical-topic-corroboration) below resolves those five misses on this now-seen corpus and on a new blind holdout. F3b remains open for paired semantic-path reading review.*

*Historical 1.6.8 October 31 disposition: the [paired reading record](GRAPHRAG_F3B_SEMANTIC_READINGS_2026-10-28.md) covers the uncommitted 1.6.8 imagery correction. Final root 6,149 pass / 0 fail / 2 skip, Worker70, assembly874/2541, build/lint/docs pass. Five actual standard completions were preserved before a content halt: a supplied Tower gray-sky hook conflicts with the selected primary scan, and Fool sunrise precision remains unresolved. All five exact transport/structural checks pass, but the actual CI exits 1 and the semantic pilot is blocked. The new Hermit caption is exercised once; Spanish/Eight of Cups and six standard calls remain unrun, as do all80 semantic calls. Retrieval objects/scores/labels/caps and original case inputs remain unchanged; an inherited projected-text accent-normalization defect is explicitly open. Japanese prose quality alone stays waived. No staging, commit, merge, push or deployment.*

*Historical October 28 disposition: uncommitted 1.6.7 passed 6,123 root tests and all11 standard automated checks, but complete content review had9 passes,1 unresolved and1 confirmed image failure. The Spanish Eight of Cups hood and Hermit light-range findings, their original outputs and all earlier failed phases remain preserved.*

The changes are local and uncommitted in `.worktrees/graphrag-rebase-20261027`, on `integrate/graphrag-onto-master-20261027` at base `a030467351b2374a9c9a1d933eecc0498abcaca3`. No merge, push or deployment was performed. `master` and `origin/master` remain `26da856cc4e3da98d015dc5f0d306952d58015c7`.

## Implementation

- Pattern ranking (`functions/lib/graphRAGRanking.js` in the retrieval worktree) separates admission of a passage from ordering its pattern. A context-specific variant can supply semantic evidence for the same authenticated pattern without authorizing that variant's prose. Only passages that independently pass the existing score and context gates receive the ranking hint. Pattern identity includes the deck and matched card subset.
- [Candidate selection](../../functions/lib/graphRAGCandidates.js) still uses `0.3 * keyword + 0.7 * semantic`, the `0.3` threshold, the existing spread/tier cap, one variant per pattern, duplicate suppression, the supplemental-Major lexical safeguard, and the weak floor. Scores stored as a passage's actual relevance are unchanged. The new hint only orders eligible passages.
- [Prompt trimming](../../functions/lib/graphRAG.js) follows the same ranking and score tie-break as selection, so a tighter prompt budget retains the intended first passage. Invalid or incomplete semantic evidence, keyword fallback, priority-only and filtering-bypass paths retain their prior behavior. No additional runtime model call is introduced.
- [Topic exclusions](../../functions/lib/readingContextVocabulary.js) recognize bounded nominal lists such as “Not a divorce, not a lawsuit, and not a medical recovery question.” Known topic phrases are required; the parser does not span arbitrary clauses, negate an affirmative topic after “but,” or turn a negated action such as “not quitting my job” into a topic exclusion. Accepted reader input is not rewritten.
- The cold-start source allowlist includes the new ranking module. Regression tests (`tests/graphRAGPatternRanking.test.mjs` in the retrieval worktree) cover the unchanged admission rules, pattern identity, weak floor, prompt ordering, invalid evidence and saved real cosine evidence. [Context tests](../../tests/contextDetection.test.mjs) cover the exclusion boundaries.

## Original regression gate

The original fixture SHA-256 remains `ff7922c809fbe948d78714ce4adccf0f026673495b744585a23c2d9530fbda51`. Its acceptance code is byte-identical to the base. The evaluator explicitly preserves the baseline's passage-local ranking instead of silently applying the new ranking to both arms.

With the original 48 real Workers AI vectors, `REL02` changes from **zero to one designated relevant strong hit**: the general Death–Star passage, whose own composed relevance remains approximately `0.369340`, above `0.3`. The two-passage cap stays two; specialized grief/healing prose is still context-gated. `REL01` changes from one to two relevant hits. No other original case loses a relevant-hit count, and no new judged false positive or cap violation appears. Existing judged false positives in the original controls remain recorded. Unjudged alternatives are not counted as proven relevant.

Both the formal original gate and an actual-runtime comparison pass. The runtime comparison loads each arm's own context, candidate and retrieval modules. Thirteen baseline runtime files were independently verified byte-identical to the corresponding files at `a0304673`; the preserved original GraphRAG worktree supplies that baseline without mutation.

The checked-in cosine fixture (`tests/fixtures/graph-rag-relevance-cosines.json` in the retrieval worktree) records the original real-vector cosines and input hashes, without rounding or label changes. It is regression evidence, not a fresh holdout.

## Fresh multilingual qualification — failed

An independent reviewer froze sixteen cases and exhaustive candidate judgments before seeing ranking outcomes. A second independently prepared set added eight cases with multiple Majors. Across the two sets there are **24 cases, 142 candidate judgments, 19 positive-designated cases and five unrelated controls**, covering Japanese, Spanish, French, Chinese, Korean and mixed-language questions.

The acceptance requirements were frozen before outputs: every positive-designated case must return at least one definitely relevant strong hit; no per-case relevant-hit loss; no new judged-irrelevant strong passage; no cap violation; and no promotion of the negative controls' weak floor to strong. Uncertain judgments remain separate and never satisfy a positive target. The first set became seen regression evidence after its initial evaluation; its labels were not changed during the parser correction.

The final comparison uses each arm's actual query/context code and exact frozen vectors, with network access prohibited and zero missing vectors. The two corpus hashes remain:

- First sixteen: `16e277525ad7733164bd1b8519397969648a14a1e1ce5fd1ac95d47e11a4e222`.
- Second eight: `83d442b8155e503d4d1002c64ee12c412ec03846ead5b31fc34bd37e042bd9a3`.

| Measure | Baseline | Candidate |
| --- | ---: | ---: |
| Positive cases with a definitely relevant strong hit | 13 / 19 | 14 / 19 |
| Definitely relevant strong passages | 18 | 22 |
| Judged-irrelevant strong passages | 4 | 1 |
| Uncertain strong passages | 6 | 4 |
| New judged false positives, relevant-hit regressions, cap or weak-floor regressions | — | 0 in every category |

The required positive-coverage check still fails on:

| Case | Remaining limitation |
| --- | --- |
| `FRESH10`, French | The relevant Art/Temperance passage clears the numerical threshold but lacks lexical corroboration for a supplemental Major; it remains weak. |
| `FRESH15`, English/French | The excluded medical-recovery framing is removed from context admission, eliminating its judged false positive. No definitely relevant strong passage survives; the general relationship/acceptance candidates and Major safeguard still limit retrieval. |
| `PHASE2_02`, Spanish | The relevant Magician passage clears the numerical threshold but lacks lexical corroboration; it remains weak. |
| `PHASE2_03`, Chinese | The relevant Hanged Man passage clears the numerical threshold but lacks lexical corroboration; it remains weak. |
| `PHASE2_08`, English/Japanese | The relevant Emperor/Justice candidates lack lexical corroboration. Negated quitting/ending actions are retained; the best candidate remains weak. |

All five miss on the actual baseline too. This fact establishes the absence of a new miss on these cases, not a passing qualification result.

A separate probe tested semantic corroboration against all 22 canonical Major topic descriptors, under a frozen rule requiring exactly one descriptor above the unchanged semantic-only composed threshold. It failed to distinguish the missed French reference: six descriptors qualified and the leading descriptor was not the target. The probe was rejected. No alternate semantic-only Major admission, lowered threshold, relabeling, or widened cap was shipped into the local candidate.

## Verification and limits

| Check | Result |
| --- | --- |
| Final root suite, credentials stripped | **5,988 passed, zero failed, two intentional skips** (5,990 total). |
| Worker graph/spread/alert suites | **70 passed**. |
| Context/source/query regression suites | **86 passed**, plus nine independent parser-boundary probes. |
| Ranking regression suite | **14 passed**, including the reviewer-found prompt-order tie case. |
| Final prompt assembly | **874 fixtures / 2,541 provider builds**, with canon/deck and boundary checks passing. |
| Required `ci:narrative-check` | **Passed**, eleven fresh standard outputs through the owner's Claude subscription, zero automated flags. The final source preserves all eleven standard system/user prompt hashes. |
| Build / changed-file ESLint / whitespace | Passed. Documentation links checked after this report was added. |
| Original relevance gate | **Passed**, unchanged original predicate and labels. |
| Expanded independent retrieval gate | **Failed**, the five positive misses above; no preservation-category regressions. |

These suites overlap and are not additive. The standard narrative runner has no Workers AI binding and uses keyword fallback. It does not prove generated-reading quality for the new semantic retrieval path. No paired semantic-reading generation, production deployment, live production behavior, browser or physical-device qualification is claimed for this correction.

Live embedding work used the configured `@cf/baai/bge-m3` provider. Four successfully archived REST requests captured 127 initial, 22 corroboration-probe and 13 additional inputs; the retrieval corpus contains 140 distinct validated 1,024-dimensional vectors. Two earlier connector responses were truncated and discarded as evidence, for **six embedding requests total**. The eleven standard narrative generations used subscription authentication with paid API credentials absent. No production state was changed.

The first full root run failed because the cold-start source allowlist omitted the new module; that was fixed and both the focused cold-start tests and final full suite pass. An initial exclusion-parser candidate overmatched person/action descriptions; the bounded grammar and independent review close that finding. Failed intermediate attempts and the failed fresh qualification remain in the evidence directory.

## Evidence and preservation

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-fix-20261027T071235Z/`.

- `final-original-runtime.json`, `original-gate-final-check.log`, `acceptance-preservation-final.json`: original gate, actual baseline comparison and unchanged acceptance.
- `final-fresh-qualification.json`, `qualify-final.mjs`, `combined-fresh-cases.json`, `live-vectors-phase2.json`: reproducible expanded comparison and its failed result.
- `review/` and `review/phase2/`: frozen independent judgments, source checks and review findings.
- `major-support-probe.json`: rejected corroboration experiment.
- `narrative-standard/`, `final-standard-probe/prompt-equivalence.json`, and `*-final*.log`: saved outputs, prompt equivalence and final checks.
- `preservation-before.json`, `preservation-final.json`, `owned-changes.patch`, `manifest.json`: preservation and recoverable local changes.

All fifteen worktree HEADs and every Git ref are unchanged. The fourteen unrelated worktrees retain their status/index state and all **46 pre-existing dirty/untracked file hashes**. The primary journal performance test retains SHA-256 `ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`. The candidate's three pre-existing evaluation artifacts were saved before the narrative run and restored byte for byte afterward. The original GraphRAG stack, mobile source worktree, cold-start edits, stash and recovery refs remain preserved.

The remaining work is a qualified multilingual corroboration mechanism for semantic-only Major retrieval, plus the mixed-language scope/recall miss. The rejected descriptor experiment is evidence against treating a high relative similarity as adequate corroboration. Until the fresh positive-coverage requirement passes and changed semantic prompts receive paired reading review, retain this candidate locally and keep broader F3b qualification open.

## October 28 follow-up — canonical-topic corroboration

The rejected probe required exactly one of all 22 Major descriptors to clear the threshold; the shipped rule is narrower in a different way. A supplemental Major without shared question terms may count as relevant only when **all** of these hold (`major-topic-corroboration-v1`):

- it is the strongest supplemental Major among the eligible candidates by its own unchanged composed score (candidateId breaks ties);
- the query independently clears the same relevance threshold against that card's canonical topic descriptor — registry theme plus the hand-written general passage's tags, the representation frozen by the earlier probe (all 22 texts verified byte-identical to the frozen inventory); and
- it is pivotal: no non-Major pattern qualifies, or it outranks every qualified non-Major pattern.

The descriptor embedding is requested only when those pivotal conditions already hold on the scored candidates, shares the existing retrieval deadline, and is recorded in retrieval stats (`majorTopicCorroborationAttempted/Used/FallbackReason`). Missing, invalid, fallback, keyword-only, priority-only and quality-bypass paths fail closed to the lexical safeguard. A passage's own score, the `0.3 * keyword + 0.7 * semantic` formula, the `0.3` threshold, context gates, caps, duplicate suppression and weak-floor labeling are unchanged.

Results on the frozen corpora (actual runtime replay, baseline arm reproduced exactly):

| Corpus | Result |
| --- | --- |
| Original REL01–REL10 runtime replay | All checks pass; `REL04`'s Lovers is vetoed by its descriptor score (0.279 vs the 0.3 gate) and selections are unchanged |
| Seen 24-case multilingual corpus | **19 / 19** positive cases (was 14 / 19); the five misses resolve; no relevant-hit losses, new judged false positives, cap violations or weak-floor promotions. Nine cases change selection, including four already-passing cases where a corroborated Major displaces an equal-or-lower relevant/uncertain passage |
| Blind holdout `holdout2` (16 cases, 89 judgments, sha256 `8624c92585086acbb58f9b3ef00dc824ed5efdc6738fa079226c99f146837704`, authored and frozen before any retrieval, 8 new-language positives in de/pt/it/fr/es/ja/zh-Hans/ko) | **12 / 12** positive cases under its predeclared criteria; no relevant-hit losses or new judged false positives; the four unrelated negative controls gain no strong passage |

Corroboration margins stay thin and must not be overstated: on the seen corpus the weakest admitted descriptor score is `FRESH15` Justice at 0.3034 against the 0.3 gate (+0.0034), and many non-drawn descriptors also clear 0.3 for the same queries, so the descriptor check is a coarse second view whose discrimination comes mainly from the drawn-card, strongest-Major and pivotal conditions. On the blind holdout the weakest admitted score is 0.3142 (`HOLD2_06`). Seven holdout cases triggered a descriptor request; all seven corroborated. One further live embedding request (69 inputs) captured the holdout vectors; no production state changed.

Verification after this follow-up: root suite **5,992 passed, zero failed, two intentional skips** (credential-free); Worker graph/spread/alert suites **70 passed**; focused candidate-selection and pattern-ranking suites **77 passed**; prompt assembly **874 fixtures / 2,541 provider builds**; standard `ci:narrative-check` passed (eleven samples, zero flags) and its evaluation artifacts were restored byte for byte; build, changed-file ESLint, documentation links and whitespace pass. An independent reviewer re-ran the frozen replays (exit 0, baseline reproduced exactly) and found no code-correctness blocker; its findings on thin margins, telemetry and test coverage are addressed above or in the added stats fields and runtime tests.

**Disposition remains: F3b open, candidate local and uncommitted.** Retrieval qualification now passes both the seen corpus and one independently authored blind holdout, but the standard narrative lane uses keyword fallback and still does not qualify generated readings through the changed semantic path. Until paired semantic-path reading review exists, do not merge, push or deploy on the strength of this retrieval result.

## October 28 semantic-reading pilot

The [semantic-reading execution record](GRAPHRAG_F3B_SEMANTIC_READINGS_2026-10-28.md) supersedes the preceding statement that no paired semantic-content review exists. Eight fresh outputs now cover four complete baseline/candidate pairs, all with real semantic-vector replay and final GraphRAG inclusion. All eight pass the exact local application quality gate, but complete content review identifies unsupported past-history assertions in both `PHASE2_08` outputs. The candidate and baseline assert different unsupplied propositions. The other three pilot pairs have no observed hard fault. The remaining 41 outputs in the frozen 49-output plan were not started, and the full matrix has not passed.

The owner's instruction to skip the Japanese language gate waives Japanese prose-quality scoring only. It does not waive factual grounding or remove Japanese cases. The candidate remains local and uncommitted, F3b stays open, and the retrieval code and acceptance criteria described above are unchanged. This is generated-content and local-quality evidence; downstream delivery safety and hosted serving were not exercised.
