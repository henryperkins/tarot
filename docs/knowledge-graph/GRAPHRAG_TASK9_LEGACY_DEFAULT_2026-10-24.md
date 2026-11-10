# GraphRAG Task 9 continuation: legacy default

Date: 2026-10-24. **The approved rollback and bounded qualification were executed. The candidate is not qualified for release.** This is a qualification record, not a release record.

## Source, authorization and attempts

The owner approved restoring `0.3 * k + 0.7 * s`, retaining every other remediation change, recording F3b as unresolved, running the 24 paired readings and `npm run ci:narrative-check`, and pushing the existing failed-attempt checkpoint with the result. Deployment and merge were excluded.

| Identity | Value |
| --- | --- |
| Branch | `claude/graphrag-complete-remediation-20261024` |
| Previously published tip | `aba419cf17ac38b3a51999bca52bdaf8733c9ff4` |
| Preserved failed-attempt checkpoint | `734fe475b3c7bb0b9e25feaac4a950f887f77436` |
| Runtime evaluated in this continuation | `a510194c949b298a67ab23db00ad6dbb6af6c677` |
| Preservation baseline | `7cd329a58894bd01cad1ea296cbc432b4bbb82da` |
| Default policy / prompt version | `legacy-weighted-v1` / `1.6.0` |
| Narrative provider | Existing personal Claude subscription, local CLI, `claude-opus-5-5`, effort `xhigh`, 32,000 output-token limit |
| Paired readings | 12 scenarios × two arms = 24 completed outputs / 24 observed attempts |
| Standard CI readings | 11 completed outputs / 11 observed attempts |
| Attempts and replacements | 35 total of the declared 50 maximum; no failed generation, harness retry or quality replacement |
| New embedding / paid API calls | Zero / zero |

The candidate export was checked against all 3,467 tracked Git blobs. Harness and scenario hashes were frozen before inference; every paired prompt was checked against its source-specific preflight hash. The four tight-budget settings were fixed before the first reading. Two generation processes at most ran concurrently. Application network access was blocked except loopback; the subscription CLI used its existing authenticated transport and no paid API fallback. CLI-internal transport retries are not observable; the counts above are harness-observed attempts.

Provider-reported usage across the 35 outputs: 70 ordinary input tokens, 202,824 cache-creation input tokens, 54,040 cache-read input tokens and 164,175 output tokens (including thinking). These are subscription token categories, not a paid API cost.

The paired lane uses matching frozen `@cf/baai/bge-m3` vectors captured by the prior Task 9 attempt, with zero missing vectors. The standard runner requests semantic scoring but has no Workers AI binding; all eleven standard samples report keyword fallback. Both use the existing direct subscription backend, not the public production route or a live alternate provider.

## Relevance and remaining retrieval blockers

Restoring the default removes the rejected formula's extra strong references and lexical-recall regressions in the same-candidate comparison. The evaluator reports the actual legacy formula and retains its original acceptance predicate. It still returns `failed_acceptance_criteria`: designated zero-overlap positives do not all pass, including the Japanese paraphrase. **F3b is unresolved.** The ten seen relevance cases are regression evidence; they cannot become an independent holdout for a newly tuned formula.

The same-candidate comparison does not establish preservation of the original pipeline. A second replay imports the real baseline and revised discovery, projection and retrieval code, applies the same frozen vectors and existing relevance judgments, and compares their selected IDs. No pre-existing candidate disappears. REL03 gains a relevant hit (one to two); other relevant-hit counts do not decrease. However, **REL04 gains a new strongly selected irrelevant Major**:

| REL04: “I feel bereft after this loss.” | Baseline | Revised |
| --- | --- | --- |
| Initiation journey, judged irrelevant | Selected, 0.304799 | Selected, 0.304799 |
| The Lovers, judged irrelevant | Not eligible | Selected, 0.327584 |
| Strong irrelevant selections in this case | 1 | 2 |

This is an F1 eligibility effect, separate from the withdrawn formula. The original fixture has two cards under a three-card key. A supplemental valid three-card request-preparation probe adds upright Two of Pentacles to Lovers/Chariot and reproduces the exact selections with no vector misses. That probe proves reachability of the selection; it is not a new independent relevance judgment or live HTTP request. F1's regression remains a release blocker.

## Actual paired output review

All 24 complete outputs were reviewed by the executing agent against the saved inputs, final references, deck, positions and reversals, reader constraints, useful guidance, card relationships and instruction requirements. This is agent review, not human approval, a blinded comparison or a statistical claim. One output per arm cannot establish whether a particular code change caused a wording difference.

| Pair | Comparison and disposition |
| --- | --- |
| S01 — Hermit / Hanged Man / Moon, “Any guidance?” | Candidate references Hermit and Moon instead of the complete triad/journey. Its actual reading still explicitly connects all three cards: lantern, surrender and uncertainty. Useful optional guidance and depth are preserved in this pair. Both arms occasionally imply past circumstances from the cards. |
| S02 — Strength / Hermit / Wheel, open question | Complete relationship and useful exercises remain, but candidate asserts “You've already done the hard, gentle work” and that what comes next is already moving. No supplied history establishes those claims. **Observed new grounding failure; output acceptance withheld.** |
| S03 — RWS library job / studio contract decision | All five cards, reversed Two of Swords, supplied path labels and agency remain. Candidate has a minor reader-facing internal label: “The cross-check notes friction.” No forced winning path. |
| S04 — Marseille version of that decision | All five cards, labels and reversal retained; Marseille names and pip interpretation, without imported RWS imagery. Practical comparison remains provisional. |
| S05 — Death / Temperance / Star transition | Full ending/integration/renewal arc survives the reference change. Guidance is paced and optional; future is explicitly a direction rather than a promise. Both arms sometimes presuppose an ending. |
| S06 — Tower / Star / Moon job search | Both give concrete job-search guidance and preserve the full arc. Both move from hypothetical upheaval to an asserted past collapse that the question does not supply. **Shared grounding limitation.** |
| S07 — Thoth with long reflections and interview context | Both recover the later interview context and retain Art and the full transition arc without RWS imagery. Candidate explicitly declines to promise an offer. Both also assert an unprovided ending. **Shared grounding limitation.** |
| S08 — Spanish interview question | Both answer in Spanish with the complete arc and practical preparation. Candidate explicitly declines to know the reader's history or promise a job. This does not qualify Japanese retrieval or general multilingual support. |
| S09 — Star / Four of Pentacles / Sun recovery | Relationships and useful optional routines remain. Candidate adds “a recovery measured in seasons rather than days.” Both prompts have the same symbolic chapter-versus-moment cue, but no input supplies this duration. **Observed new grounding/timing failure; output acceptance withheld.** Clinical decisions are otherwise deferred to the care team. Baseline advice about pausing a checking habit is also ambiguous if read as clinical monitoring. |
| S10 — Thoth suit summary | Dominion → Virtue → Completion remains coherent and useful; correct deck treatment. Both occasionally assert already-created momentum/visibility beyond the sparse question. **Shared grounding limitation.** |
| S11 — Marseille repeated-Three summary | Both connect initiative, community and honesty without RWS artwork. Both assert successful growth beyond the question (“real and visible” / “initiative that paid off”). **Shared grounding limitation.** |
| S12 — emerging suit summary | Both connect planning, first results and the Page of Cups to a small first step. Candidate frames possible existing progress as questions/examples and gives concrete optional actions. Useful detail preserved. |

The sampled readings preserve recognizable meanings and substantial card relationships, including the feared S01 loss. They **do not meet the zero-new-grounding-failures requirement**. The S02/S09 findings and shared limitations are retained even though candidate automated metrics are green. No successful output was regenerated to seek a better result.

## Summary budgets and automated gates

| Pair / intended summary family | Fixed budget | Measured candidate summary interval | Baseline → candidate graph mode |
| --- | --- | --- | --- |
| S09 / Major Arcana | 5,990 | 5,860–6,121 | Summary → summary; candidate adds Major family label |
| S10 / Thoth suit | 6,368 | 5,958–6,779 | None → summary |
| S11 / Marseille numerology | 6,131 | 5,821–6,442 | None → summary |
| S12 / emerging suit | 6,227 | 6,026–6,429 | None → summary |

All four candidate family labels survived the final prompt. Budget search and repeat probes were offline, with no missing vectors. Production caps were not enlarged.

| Dataset / command | Recorded result | Agent adjudication |
| --- | --- | --- |
| Candidate paired metrics / gate | 12 samples, 100% spine and card coverage, zero flags; exit **0** | Does not detect the manual grounding findings above. |
| Baseline paired metrics / gate | 12 samples, 100% spine and card coverage, one flag; exit **1** | S09 says “Two Majors from the late stretch of the Fool's Journey.” This names an archetypal sequence, not an additional drawn Fool card; false positive. |
| `npm run ci:narrative-check` | 11 samples, 100% spine and card coverage, one flag; exit **1** | `single-new-role`: “The Fool doesn’t offer guaranteed footing.” The evaluator flags “guaranteed” despite explicit negation; false positive. |

The standard command generated all eleven outputs and computed metrics before failing at `gate:narrative`. Its later `&&` prompt-assembly step therefore did not run in that command; the same source's assembly check passed separately. The evaluator and stored outputs were not changed. Both evaluator defects can be addressed and re-evaluated from saved outputs without fresh generation.

All eleven standard outputs were also read against their inputs. Supplied decision context, hypothetical relationship limits, deck conventions and reversals are preserved in these examples. The focused-week sample still sometimes turns a possible unfinished disappointment into a personal fact; no blanket instruction-obedience approval is claimed. These keyword-fallback results do not qualify semantic retrieval.

## Editorial, deterministic checks and latency

The 1.6.0 pipeline review was regenerated and compared against the prior artifact. All **1,167** projection texts and source/deck/anchor/membership identities are unchanged. Only **282** direct-highlight version labels changed from `reading-1.5.2` to `reading-1.6.0`, with **46** dependent group hashes refreshed. Existing agent judgments were revalidated against those identical identities: **191 accepted groups**, zero corrections, owner decisions or pending groups, and zero mechanical issues. This is not new human approval; no live enrichment was activated. The official generator reproduces the refreshed artifacts byte for byte.

| Local check on frozen runtime | Result |
| --- | --- |
| Focused rollback suites | 76 passed; five expected red assertions were observed before the implementation |
| `npm test` | 5,876 passed, two intentional installed-CLI skips, zero failures/cancellations |
| Worker graph/spread suites | 64 passed |
| Editorial suites | 16 passed |
| Prompt assembly | 874 existing fixtures / 2,541 provider builds, plus remediation 23 / 69; 525 projections, 21 caps and 13 grounding probes |
| ESLint / production build / maintained-document links / whitespace | Passed; build retains the observed `onnxruntime-web` eval warning |
| Independent final code/harness review | No actionable code findings; verified source and frozen harness identities; generated-output acceptance remains a separate judgment |

The suites overlap and are not additive. The first rollback green attempt exposed an obsolete recovery-score expectation of 1.0; the restored formula produces 0.85 for that fixture, and the assertion was migrated before the final passing run. All earlier red and intermediate logs are retained.

Latency is carried from the prior `aba419cf` Task 9 run, **not remeasured on `a510194c`**: embedding p95 667 → 648 ms; whole retrieval 731 → 845 ms (+15.6%); 186 → 261 embedding inputs (+40%); local paired median +2 ms. The extra bounded candidate work and network tail explain the prior result. Timeout (3,000 ms) and concurrency (two batches) are unchanged. These host REST timings do not establish production Worker-binding latency.

## Evidence and publication boundary

The primary checkout and its unrelated dirty files were left untouched. Runtime is frozen at `a510194c`; later qualification/editorial commits change documentation and review metadata only. The owner-authorized push includes `734fe475`, the rollback and this record. Publication does not imply acceptance, merge, deployment or live production verification.

New evidence root: `~/.cache/tarot-graphrag-remediation-20261024/task9-legacy-default/`. Verified archive: `~/tableu-evidence-archive/graphrag-task9-legacy-default-2026-10-24/`. The archive preserves source/scenario/harness identities, frozen input vectors, final prompts, every generated output, attempts and usage, original command exits, review judgments and checksums. Git exports remain in the cache; the archive excludes their bulky dependency/build trees. The original `task9/` evidence and `graphrag-task9-2026-10-24/` archive remain unchanged.

Key artifacts are `source-manifest.json`, `budget.json`, `scenarios-v1.json`, `generations/attempts.jsonl`, `evidence/generation-receipt.json`, `evidence/relevance.json`, `evidence/retrieval-baseline-vs-revised.json`, `evidence/rel04-valid-reading-reachability.json`, `evidence/paired-agent-review.json`, `evidence/standard-agent-review.json`, `evidence/editorial-refresh-receipt.json` and the final `manifest.json`. The budget-continuation receipt records the inherited declaration timestamp and verifies the continuation budget existed before inference.

Open work for a future authorized remediation: F1's added irrelevant selection, F3b with fresh held-out relevance cases if redesigned, the S02/S09 output grounding failures and shared grounding limitations, and the two evaluator false positives. Passing those requirements is necessary before a release record can be written.

The [F1 continuation record](GRAPHRAG_F1_CONTINUATION_2026-10-24.md) later closed this list. The evaluator corrections and the F1 lexical-support rule were implemented, and the owner ruled to descope F3b and to accept S02/S09 as not attributable. The shared grounding tendency remains separate work.
