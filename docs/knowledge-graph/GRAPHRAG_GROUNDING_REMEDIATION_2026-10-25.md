# F1, grounding and evaluator remediation

The owner requested fixing the F1 relevance regression, grounding failures and both evaluator false positives; keeping F3b unresolved; adding regressions; reusing valid saved outputs; rerunning necessary subscription qualification; and no deployment. **Those corrections pass scoped qualification on prompt 1.6.2. F3b remains unresolved.** This record covers work across October 24–25 UTC and establishes no merge, deployment, production verification or general model guarantee.

| Identity | Value |
| --- | --- |
| Branch | `claude/graphrag-complete-remediation-20261024` |
| Starting checkpoint | `719073d5416f51b95fd4978defba166d24e00b37` |
| Existing evaluator fix | `3c511ede09c3e5fb1b6b662e4c044205202aa15c` |
| Existing F1 filter | `0a65047b47cf87cf4b1b412d3b74d11c06592e11` |
| Failed intermediate correction | `5931882d997a2132e8eb1ffb1b28bc9d8620cd57`, prompt 1.6.1 |
| Frozen runtime qualified | `f9e33903101b8c93a6df9acc137e65e1a76c7d0a`, prompt 1.6.2 |
| Full-suite verification | `1344b1858c5db1ab8d9fa16d7ccc3f10178f3f52`; only two test files differ from the runtime |
| Reused preservation baseline | `7cd329a58894bd01cad1ea296cbc432b4bbb82da` |
| Model / authentication | Existing personal Claude subscription, local CLI, `claude-opus-5-5`, effort `xhigh`, 32,000 output-token limit |

The runtime export was checked against **3,469 tracked Git blobs**. All **861 runtime/config files** compared in the verification worktree match that frozen manifest. The later test commit updates assertions for the intentionally revised agency wording and also requires the new supplied-fact closing guard. Generated outputs remain bound to their actual runtime and prompt hashes.

## Corrections and regressions

F1's existing correction is retained and reverified: a supplemental per-card Major needs shared question terms before it can be strongly selected. Its numeric composed score is not rewritten; the selection filter excludes the unsupported candidate. The legacy `0.3 * k + 0.7 * s` composition, 0.3 threshold, explicit weights, single-Major behavior, priority/bypass modes and caps remain. The full baseline/current discovery, projection and retrieval replay uses the saved `@cf/baai/bge-m3` vectors, not mocked cosines.

Across REL01–REL10 there are **zero new strongly selected irrelevant passages**, no removed original candidates and no relevant-hit loss. REL03 retains its gain from one to two relevant hits. REL04's unsupported Lovers passage no longer joins the existing initiation passage. A valid three-card request-preparation probe with Lovers, Chariot and Two of Pentacles reproduces exactly the baseline selection. These seen cases are regression evidence, not an independent holdout.

The original relevance evaluator still returns **`failed_acceptance_criteria`**, with the zero-overlap requirement failing on REL02's Japanese paraphrase. Its predicate, fixture judgments and case order were not weakened. **F3b remains unresolved; there is no claim of improved multilingual retrieval.**

Both evaluator corrections are retained: card mentions that overlap the Fool's Journey terminology span are excluded from undrawn-card detection, while a separate actual Fool-card mention remains measurable. Negated offering constructions such as “doesn't offer guaranteed footing” are not guarantees; positive guarantees and exception constructions remain flagged. Re-scoring the exact twelve saved baseline readings and eleven previous standard readings clears both original false positives with **zero model calls**. Their original failed results are preserved.

Grounding is corrected in the shared system and user prompts:

- A Past card or archetypal story does not establish completed personal history. Unsupplied events remain conditional locally, including questions, metaphors, synthesis, recap and closing. “Whatever the Tower cleared” still assumes an event; a condition must be retained each time.
- Card pacing is explicitly symbolic. It cannot establish a recovery duration or prognosis. Literal timing supplied by the reader remains usable; suggested action schedules are voluntary invitations.
- Closing encouragement uses supplied facts or next actions. It cannot turn card-implied events into completed history.
- Recovery reflection cannot prescribe changes to treatment or monitoring schedules.

Nine new provider-input regressions were watched failing before the corresponding corrections. They cover all three provider budget targets, all timing profiles, supplied timing, critical-section fitting, local event presuppositions and monitoring boundaries. They prove the request contract; actual model obedience is qualified by the generated-output review below. The focused framing/retention/compliance set passes **89 tests**. Existing F1 and evaluator positive/negative controls also pass in the full suite.

The first longer wording displaced GraphRAG in tight fixtures. The prose guidance was condensed while retaining its meaning, and every original full/summary retention expectation now passes. **No production cap, frozen corpus byte, summary budget or relevance threshold was enlarged or relaxed.** Three test-version assertions moved from 1.6.0 through 1.6.1 to 1.6.2. Two old closing-text assertions were migrated to the revised wording and strengthened with the supplied-fact guard. Their earlier failures and the exact migrations remain recorded.

## Preserved failed qualification

Source 1.6.1 / `5931882d` passed local checks but failed actual reading review. S06 still closed with “Whatever The Tower cleared…,” and S07's synthesis still implied a completed ending that its interview context did not supply. S09 removed the invented recovery duration but suggested a weekly progress check without clearly distinguishing reflection from clinical monitoring.

The two owned inference processes were checked by command, parent and working directory, then cancelled. The attempt record contains **18 starts, 16 completions and two cancellations**. Nine complete candidate readings persisted. The standard runner saves its batch only at completion, so its seven completed texts and their usage were not checkpointed; the counts, prompts, source and cancellation log remain. These unavailable texts are not represented as saved evidence. This source is **not qualified**, and its outputs were not silently replaced under the same source identity.

The 1.6.2 source has a separate manifest, pre-call budget, prompts, ledger and outputs. Its three critical cases, S06/S02/S09, were generated and read first. Only after they passed did the remaining eleven candidates and eleven standard outputs run. Both successful and failed sources remain in Git history and the evidence archive.

## Final subscription qualification and reuse

The confirmation completed **25 outputs on 25 observed attempts**, with no failed generation, harness retry or quality replacement: twelve original candidate scenarios, two new supplied-fact controls and eleven standard CI samples. Together with the failed first source, this request used **43 observed subscription attempts**, below the declared **50-attempt task ceiling**. Two generation processes at most ran concurrently after the critical stage. CLI-internal transport retries are not observable.

There were **zero paid API calls, zero new live embedding requests and zero evaluator model calls**. Paid credentials are absent from the controlled execution environment; the existing runner verifies personal-subscription authentication and fails without paid fallback. The original twelve scenarios reuse exact saved embedding vectors with zero misses. The two new supplied-fact controls use keyword scoring. The standard runner has no Workers AI binding and truthfully records keyword fallback.

All twelve baseline outputs are reused after checking source identity, both prompt hashes and their original completion-ledger reading digests. Every current candidate and standard prompt changed, so older candidate/standard outputs cannot qualify this source. The saved standard outputs remain valid for evaluator-only replay. The original four summary budgets remain **5,990 / 6,368 / 6,131 / 6,227**; all four candidate summary families survive final packing.

| Dataset / gate | Result |
| --- | --- |
| Fourteen new candidate readings | Automated gate exit 0; 100% measured spine/card coverage, zero flags |
| Twelve reused baseline readings | Corrected gate exit 0; zero flags |
| Eleven prior standard readings, evaluator replay | Corrected gate exit 0; zero flags, no new generation |
| Required `npm run ci:narrative-check` | **Exit 0**; all eleven fresh standard outputs, metrics, narrative gate and downstream prompt assembly complete |

The executing agent read every one of the **25 complete new outputs** against its saved question, reflections, effective labels, deck, positions, reversals and final source treatment. This is agent review, not new human approval, a blinded comparison or a statistical guarantee.

| Candidate cases | Actual-output finding |
| --- | --- |
| S01 | Complete Hermit/Hanged Man/Moon relationship remains; past reflection and synthesis remain conditional. |
| S02 | Past steadiness is a possibility or an available capacity; no claim of already completed hard work. |
| S03–S04 | Five-card RWS/Marseille decisions retain the library/studio labels, reversed Two of Swords, useful comparisons and agency. No forced winning path or invented completed event. |
| S05 | Full transition arc retained; possible endings are conditional and adjustment has no imposed deadline. |
| S06 | Upheaval stays hypothetical throughout; the closing explicitly says “Whether or not there's been an upheaval…”. Useful job-search actions remain. |
| S07 | Long interview context and Thoth Art remain. Synthesis says an ending, “if there has been one”; closing focuses on preparation and choices. |
| S08 | Spanish interview context, three-card arc and interview-this-week constraint retained; no assumed ending or promised offer. |
| S09 | No invented recovery duration or prognosis; emotional reflection stays separate from treatment/monitoring changes. |
| S10–S12 | Thoth suit, Marseille numerology and emerging-suit summaries retain substantial card relationships and useful optional direction, without asserting past successful growth. |
| S13 | Positive control retains the explicitly completed course last month and week of solo reflection; the rule does not erase supplied history. |
| S14 | Positive control preserves the clinician's uncertain three-month estimate without revising the prognosis, timeline or care plan. |

The eleven standard outputs also preserve the supplied move, creative-project quarter, Alex communication context, home/work restructuring, unspecified A/B mapping, spiritual frame, burnout/sleep context, hypothetical collaborators, focused-week question and Spanish family/work wording. Past fog/disappointment in the focused-week sample is conditional. No new concrete invented event, recovery deadline, hidden-feeling assertion, missing-card claim or material loss of usefulness was identified. Minor generic phrasing and an internal “cross-check” label remain possible; this does not claim universal perfect model behavior.

Confirmation provider-reported usage: 50 ordinary input tokens, 164,679 cache-creation input tokens, 20,711 cache-read input tokens and 147,117 output tokens including thinking. The seven uncheckpointed standard outputs from the failed attempt prevent a complete task-wide usage sum. Subscription usage is not a paid API cost.

## Local checks, editorial and evidence

| Check | Recorded final result |
| --- | --- |
| `npm test` in the real Git worktree | **5,887 passed, two intentional installed-CLI skips, zero failures/cancellations** |
| Worker graph/spread suites | 64 passed |
| Prompt assembly | 874 existing fixtures / 2,541 provider builds, plus remediation 23 / 69; 525 projections |
| Lint / production build / maintained links / whitespace | Passed |
| Official editorial generator | Reproduces the refreshed 1.6.2 artifacts byte for byte |

Suites overlap and are not additive. A test run in the plain Git export failed Git-dependent sourceHead checks; its failure is retained as a harness limitation. Final broad verification ran in the actual Git worktree with identical runtime bytes. Earlier obsolete-version and closing-wording failures are preserved with the expectation migrations. No product failure was hidden by those migrations.

All **1,167** editorial variant texts, anchors, source/deck identities and memberships are unchanged. Only **282** version labels and **46** dependent group hashes refresh, preserving **191 prior agent-accepted groups**, zero pending/corrections/owner decisions and zero mechanical issues. This grants no new human approval or enrichment activation.

No new latency measurement is claimed. The saved embeddings and original provider timeout/concurrency limits are retained; the prior host REST timing record keeps its original source and production-binding limitations.

Failed-attempt evidence: `~/.cache/tarot-graphrag-remediation-20261024/task9-grounding-remediation/`. Final confirmation: `~/.cache/tarot-graphrag-remediation-20261024/task9-grounding-confirmation/`. Verified combined archive: `~/tableu-evidence-archive/graphrag-grounding-remediation-2026-10-25/`.

The archive preserves source manifests, budgets, frozen vectors, request prompts, every persisted output, failed/cancelled attempts, exact reuse receipts, all gate exits, actual-output judgments, test migrations and checksums. Bulky Git/dependency/build exports remain in the cache and are excluded from the archive. The primary checkout's HEAD, status and all **49 original dirty-file hashes** are preserved. Publication is to the existing remediation branch; no merge or deployment is included.
