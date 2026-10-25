# Knowledge graph and context qualification status

## October 24 grounding and evaluator remediation — qualification in progress

The owner explicitly requested fixing the F1 relevance regression, grounding failures and both evaluator false positives, retaining F3b as unresolved, reusing valid saved outputs and rerunning necessary subscription qualification. This request supersedes the earlier S02/S09 waiver for the current work; the historical ruling remains below. Deployment is excluded.

The existing F1 lexical-support and evaluator corrections are retained. The first correction, prompt 1.6.1 on `5931882d`, passed 5,885 root tests with two skips, but **failed actual-output review**: S06's closing and S07's synthesis still assumed unsupplied endings. Both owned generation processes were stopped; 18 attempts, 16 completions and two cancellations are recorded, with nine candidate texts preserved. The standard runner had not checkpointed its seven completed texts. Nothing from that attempt is silently substituted or called qualified.

Prompt 1.6.2 explicitly rejects presupposed events in questions and metaphors, requires conditions to remain local, grounds closings in supplied facts or next actions, and separates recovery reflection from treatment/monitoring schedules. Two more regressions first failed and then passed; all 89 targeted framing, retention and compliance tests pass without changing production caps. Confirmation is pending in `~/.cache/tarot-graphrag-remediation-20261024/task9-grounding-confirmation/`; the failed 1.6.1 evidence remains separate in `task9-grounding-remediation/`.

## October 24 F1 continuation — blockers closed

The owner approved five rulings ("Proceed"), and the [F1 continuation record](GRAPHRAG_F1_CONTINUATION_2026-10-24.md) closes the four blockers from the legacy-default section below.

- **F1:** a supplemental per-card Major needs shared question terms to count as relevant (`0a65047b`). Against production baseline `7cd329a5`, `REL01`–`REL10` show zero new false positives, and `REL03` keeps its added relevant hit.
- **F3b is descoped.** No score composition can rank `REL02`'s relevant candidates into its two slots, because every candidate there has zero lexical overlap. The relevance evaluator still reports that single failure.
- **S02/S09 are accepted as not attributable** to the remediation.
- **Evaluator false positives are corrected** (`3c511ede`, also shipped to `master` as PR #125). The paired baseline, paired candidate and 11 standard outputs now pass with 0 flags.

Only S01 and S08 change their prompts on the F1 tree, so only those two were regenerated through the subscription. Both readings pass review, with no grounding failure new relative to their pairs.

On `0a65047b`, credential-free `npm test` passes 5,878 tests with 2 skips. Prompt assembly passes, and the editorial artifacts reproduce byte for byte. **The candidate is qualified but not released.** Merge, deployment and live verification remain separate.

## October 24 Task 9 continuation — legacy scoring restored

The owner approved restoring the legacy default, publishing the failed-attempt checkpoint `734fe475` with the rollback, and continuing the 24 paired subscription outputs and `ci:narrative-check`. Deployment and merge remain excluded. The default is now `0.3 * k + 0.7 * s` (`legacy-weighted-v1`), with the 0.3 threshold, lexical fallback, explicit custom weights and all other remediation changes retained. **F3b remains unresolved**; the original semantic-improvement acceptance gate is unchanged and a multilingual miss must still fail it.

The approved execution is complete on runtime commit **`a510194c949b298a67ab23db00ad6dbb6af6c677`**, compared with baseline `7cd329a58894bd01cad1ea296cbc432b4bbb82da`. **Overall qualification has not passed.** All 24 paired readings and all 11 standard narrative samples were generated through the owner's Claude subscription, with 35 observed attempts, zero failed generations, zero replacements, zero paid API calls and zero additional live embedding requests. Matching frozen Workers AI vectors supplied the paired semantic lane. The standard runner had no Workers AI binding and used keyword fallback.

The [continuation qualification record](GRAPHRAG_TASK9_LEGACY_DEFAULT_2026-10-24.md) contains source identities, all twelve pair judgments, gate results and remaining blockers:

- **F3b remains unresolved.** The unchanged semantic-improvement gate still fails; restoring the default is not a claim of improved multilingual retrieval.
- **F1 adds a separate relevance regression.** Comparing the actual baseline and revised pipelines, `REL04` adds a judged-irrelevant Lovers passage at **0.327584**, above the 0.3 threshold, alongside the existing irrelevant initiation passage at **0.304799**. A valid three-card request-preparation probe reproduces the same selection. A same-candidate formula comparison alone does not reveal this expanded-candidate effect.
- **Generated-output acceptance remains open.** Candidate paired metrics pass 12/12 and preserve the complete Hermit/Hanged Man/Moon interpretation, but manual review identifies new unsupported certainty in `S02` and an unsupported recovery timescale in `S09`. Several shared grounding limitations also remain. These observations fail the zero-new-grounding-failures requirement; one sample per arm does not establish which code change caused them.
- **`ci:narrative-check` exits 1.** Its sole automated flag mistakes “The Fool doesn’t offer guaranteed footing” for a guarantee. The paired baseline gate also exits 1 because “the Fool's Journey” is mistaken for an undrawn Fool card. Both failed results and outputs are preserved without evaluator changes or replacement generations.
- **Editorial version refresh passes.** All 1,167 variants have identical text/source/deck identities; 282 version labels and 46 dependent group hashes were refreshed at 1.6.0. The 191 prior agent-accepted groups remain accepted, with no new human approval or enrichment activation.

The frozen runtime passes **5,876 root tests / two skips**, **64 Worker tests**, **76 focused rollback tests**, **16 editorial tests**, **874 assembly fixtures / 2,541 builds** plus the **23-case / 69-build** remediation lane, lint, build and maintained-document checks. These suites overlap and are not additive. Independent final code/harness review found no actionable code issue. The earlier latency measurement is retained with its source and host-REST limitations; no new latency measurement is claimed for this rollback.

Continuation evidence is stored separately in `~/.cache/tarot-graphrag-remediation-20261024/task9-legacy-default/`, with a verified archive under `~/tableu-evidence-archive/graphrag-task9-legacy-default-2026-10-24/`. The original Task 9 evidence and failed policy remain historical. Branch publication preserves the rollback and findings; it does not establish release readiness. No deployment or merge was performed.

## October 24 GraphRAG Task 9 live qualification

The owner authorized Task 9 except deployment ("push it, and run Task 9 except the deploy"). The four Task 7–8 commits were pushed first (`a3c115c0..aba419cf`). Live lanes ran against git exports of baseline `7cd329a5` and candidate `aba419cf`, verified blob by blob (3,456 and 3,467 tracked files). Evidence, tools, the attempt budget declared before the first live call, and a hashed manifest are in `~/.cache/tarot-graphrag-remediation-20261024/task9/`. The work made **73 Workers AI embedding requests** (2 failed: an expired OAuth access token, and a deliberate invalid-token check of the failure record), **zero narrative generations** and **zero paid-API calls**. Deployment, live production verification and Modal Qwen generation were excluded.

| Lane | Result |
| --- | --- |
| Real relevance, `REL01`–`REL10` (`@cf/baai/bge-m3`, 48 inputs in one request) | **Failed** (`failed_acceptance_criteria`): zero-overlap positives fail, two new strong false positives, and recall regressions in `REL03` and `REL08`. See the counterexamples below. |
| Retrieval latency (12 scenarios × 2 arms × 3 repetitions, a fresh process each, arms interleaved) | Embedding-request p95 **667 → 648 ms**. Whole-analysis p95 **731 → 845 ms (+15.6%)**, explained by **40% more embedding inputs** (186 → 261) from newly eligible Majors and by the network tail; local compute is unchanged (paired median +2 ms). The 3,000 ms timeout and two-batch concurrency are unchanged; no request failed or timed out. These are REST timings from this host, not in-Worker binding latency. |
| Editorial projections | No new or changed projection text. The 525 canon projection rows regenerate identically, and no per-card Major passage assumes a lone Major. Regenerating the pipeline review at 1.6.0 relabels `projectionVersion` from `reading-1.5.2` to `reading-1.6.0` on 282 direct-highlight rows; the changed input hash makes the grouped review report `review_pending`. That file needs regeneration and re-confirmation, not new editorial judgment. |
| Reading scenarios | Twelve scenarios: eight frozen fixtures covering the F1 relevance wins and flagged cases, retained patterns, the F3a lexical changes and a Spanish paraphrase, plus one tight-budget scenario per summary family the old summary omitted. All 60 texts either arm embeds were captured once, so both arms score identical inputs identically. Offline probes are deterministic, with zero missing vectors. |
| Paired generations, `ci:narrative-check`, output review, release record | **Not run.** The relevance gate failed, so these would qualify a scoring default that cannot ship. |

### Real relevance counterexamples

- **Unrelated text clears the threshold.** For `REL10` ("How could I arrange labels in a small collection?"), the irrelevant Cups court lineage and Death passages have cosines of 0.414 and 0.383 with no lexical overlap. The legacy `0.3·k + 0.7·s` keeps them at 0.290 and 0.268, on the weak floor only. The proposed `s + 0.3·k·(1 − s)` scores them at the raw cosine, so both become strong references.
- **Lexical evidence loses to small cosine differences.** In `REL03`, the expected Empress/Emperor/Hierophant triad (k 0.250, s 0.452) rises from 0.391 to 0.493 but is overtaken by The Hierophant's own passage (k 0, s 0.516). In `REL08`, the expected Death/Temperance/Star triad (k 0.4, s 0.477) is overtaken by Death (k 0.2, s 0.528).
- **No separation for the Japanese paraphrase.** In `REL02`, the top eight candidates all score 0.528–0.597, and the expected relevant dyad ranks eighth under both formulas.
- **Existing false positives remain.** `REL04` and `REL09` already admit irrelevant passages under the legacy formula (cosines 0.44–0.47).

Over this corpus, bge-m3 cosines sit in a compressed band of about 0.35–0.60. Making cosine primary therefore lets the unrelated floor pass 0.3 and lets noise-sized differences outrank lexical matches. Under semantic scoring, the candidate also moves realistic selections toward per-card Majors: in the Hermit/Hanged Man/Moon "Any guidance?" scenario, both paid slots go to The Hermit and The Moon, and the complete triad leaves the references.

Under Task 4, the scoring task stays incomplete and the release is blocked until the formula is revised against these counterexamples, or the default composition returns to the legacy formula with F3b recorded as unresolved. Either change alters the candidate, so the paired generations and `ci:narrative-check` run afterwards on the revised source. The frozen vectors allow a revised formula to be re-scored offline without new captures, but `REL01`–`REL10` have now been seen, so qualifying a newly tuned formula needs fresh held-out cases.

## October 24 GraphRAG complete remediation candidate — offline Tasks 7–8

Reading prompt **1.6.0** adds final-prompt integrity and source accounting on branch `claude/graphrag-complete-remediation-20261024`, continuing the published Task 6 checkpoint `a3c115c0c3abf414c78e085528664aa3c88d99c6`. Task 7 is checkpointed at `88e01b18ce4f7aec02b6cbede722112f4ee3bafa`; Task 8 at `96e9e0048da67dd97cd06dc3d090a9bf5926b8b3`; the inline-heading fix at `19f9004dde4cff934fe9ec1ecf791b8273fca871`; and the [original-host reconciliation](#original-host-reconciliation) in the commit that adds that section. This is an offline candidate; Task 9 later ran its live relevance, latency and editorial lanes and stopped at the relevance gate ([Task 9](#october-24-graphrag-task-9-live-qualification)). Earlier release and narrative records below do not qualify this changed prompt version.

ChatGPT prepared `88e01b18`, `96e9e004` and `19f9004d` in a separate checkout that did not have this host's worktree, cache evidence or plan; its own results are kept under [ChatGPT checkout run](#chatgpt-checkout-run). The three commits were then applied with `git am` to the original worktree, reproducing all three commit hashes exactly, and every check was re-run on this host against the plan and the preserved Task 1–6 evidence.

### Final-prompt and pipeline coverage

- Final assembly calls `enforceGraphRAGPromptIntegrity()` after all trimming and before token totals, graph parsing, source usage, memory retention and provider handoff. Conditional guardrails use the projected, ranked, capped passages for that attempt.
- Public diagnostics retain only a bounded `integrityRemovedBlocks` count, fixed-enum `integrityRemovalReasons`, and `referenceGuardrailsComplete` when measured. Historical records without these measurements stay unknown. `referenceGuardrailsComplete` reports whether the final provider prompt carries a complete guarded full-reference section, so it is also `false` when references were summarized or omitted; `parseStatus`, mode and the removal count distinguish those cases. Integrity omission uses `reference_integrity_failed`, with reader copy **“Reference passages could not be included.”**
- The [remediation v1 fixture](../../tests/fixtures/graph-rag-remediation-v1-cases.json) exercises **23 cases / 69 provider-target builds**, including full references, partial/weak guardrails, selected-deck projection, summary, budget omission, disabled/empty input, rejected projection and integrity removal. All eight registry-backed pattern families have actual candidate evidence and matching summary signals. Seven paired cases, tagged with `finding` and `pair`, pin the F1, F2 and F3a retrieval outcomes on both sides: a relevant newly eligible Major wins, existing patterns keep their place on equal evidence, approved enrichment wins only for its matching context, and short words clear the threshold without promoting unrelated questions. Fixture SHA-256: `5b47a8b7787bdf9ae239cebc1a3bec6ca12040258ebaf4b0564f49ce5062744d`.
- Actual Claude, OpenAI and Modal request serializers are exercised with mocked transports. Source indices, journal/client normalization, telemetry and memory receipts are checked against final prompt bytes. A rejected Modal attempt containing references and memory followed by an accepted capped OpenAI attempt reports only the accepted attempt's sources and memory receipts in JSON, buffered SSE and durable-job delivery; a rejected OpenAI token stream followed by the local composer does the same.
- Existing reader suppression of legacy partial arcs is preserved. A reference retained for generation does not guarantee a visible reader excerpt or prove that a model used it.

### Current offline verification

All commands ran in the original worktree on this host, on Node **24.21.0** and npm **11.19.0**, with the six provider credentials named in the handoff unset, as well as `CLOUDFLARE_API_TOKEN` and `BROWSERBASE_API_KEY`. The standalone assembly evaluator also blocks unstubbed external network access. The results describe the reconciled source.

| Check | Observed result |
| --- | --- |
| Task 7–8 focused suites (the five Task 7 files plus the qualification and prompt-integrity suites) | **226 passed**, zero failed/skipped. |
| Root `npm test` | **5,876 passed**, zero failed/cancelled; **two intentional installed-CLI opt-in skips** (5,878 total). |
| Worker graph and spread analysis | **64 passed**, zero failed/skipped. |
| Credential-free assembly evaluator | **874 existing cases / 2,541 provider-target builds**, plus **23 remediation cases / 69 builds**; **525 deck projections / 21 caps / 13 grounding probes / 12 boundaries**; zero live provider calls. Existing and additional lanes are reported separately. |
| `npm run lint` | Passed with zero errors and zero warnings. |
| `npm run build` | Passed; the shared `node_modules/.vite` cache was unchanged. |
| `npm run docs:check` and `git diff --check` | Passed; all maintained Markdown local links resolve. |

The existing frozen summary-only fixture remains byte-for-byte unchanged. Its test adapter's soft budget moves from **5,960 to 6,200** so complete summary guardrails survive. A sweep on this host confirms the interval: that input is omitted at 6,002 or less, summarized from 6,003 to 6,533 and fully referenced from 6,534. Production budgets stay unchanged. Synthetic malformed and enrichment registry rows are isolated and restored even on a failed expectation, so repeated qualification does not change the canon.

### Original-host reconciliation

Evidence files are in the execution evidence directory, `~/.cache/tarot-graphrag-remediation-20261024/`.

- **Red and as-applied reproduction.** With `a3c115c0` production code and the `88e01b18` tests, the Task 7 five-file suite ran **95 passed / 28 failed** of 123, as ChatGPT reported. The provider-attempt control failed only on the then-missing `referenceGuardrailsComplete` field; route-level attempt isolation already held. At `19f9004d`, before any reconciliation change, the root suite passed **5,852** of 5,854 with two opt-in skips and the assembly evaluator passed, matching ChatGPT's final run.
- **Preservation baseline.** Against `baseline-prompt-assembly-7cd329a5.json`, the evaluator summary differs in 13 fields, all classified. `candidatesScored` rises from 9 to 12 at the embedding-outage and beyond-old-shortlist boundaries, from three newly eligible Majors. The partial-path minimum user budget moves from 830 to 840, one 10-token search step: graph envelopes and the reserved instruction marker cost 21–36 estimated tokens. The other differences are the summary-only test adapter, the new remediation lane and the prompt version.
- **Selection comparison.** A capture script that reproduces the content of the stored `baseline-fixture-selections-7cd329a5.json` exactly from a `7cd329a5` export was run on the candidate over all 101 frozen, v2 and v3 prompt fixtures (`task8-selection-comparison-7cd329a5-vs-19f9004d.json`, SHA-256 `b734dcc628715866de578ea40448352af1ff0562f798773c2415d17e6877f541`). 27 fixtures are unchanged and 61 gain only per-card Major candidates. 13 change selection: 5 relevance wins, 1 previously unused paid slot, 5 new weak-floor passages where no candidate existed before, and 2 sub-threshold lexical ties. No candidate was removed and no cap changed. Equal-evidence ties still favor existing patterns.
- **Flags for the Task 9 output review.** In five Hermit fixtures that ask "Any guidance?", the Hermit's own passage matches "guidance" (1.000). It replaces a complete triad, partial triad or journey stage that scored 0.000 and survived only as the weak floor; the triad stays in the prompt's archetypal highlights. This follows the relevance-first rule, but whether the reading is better needs the generated-output comparison. In decision spreads with The Chariot, Judgement and no other pattern, both Majors score 0.000 and Judgement wins the weak floor by candidate-identity order.
- **Paired finding cases.** Seven remediation cases pin both sides of F1, F2 and F3a: `remediation-f1-relevant-major-wins`, `remediation-f1-equal-evidence-pattern-first`, `remediation-f1-existing-pattern-outranks-new-majors`, `remediation-f2-approved-enrichment-wins-matching-context`, `remediation-f2-canon-wins-unmatched-context`, `remediation-f3a-short-words-match` and `remediation-f3a-unrelated-short-words-stay-weak`. At `7cd329a5` the short-word question selected the same career triad only as a 0.000 weak floor; it now scores 0.667. New negative controls reject a reversed equal-evidence order, a weak short-word match and an unmatched enrichment win.
- **Delivery paths.** The provider-attempt control now runs through JSON, buffered SSE and a durable job with a principal, plus a rejected OpenAI token stream followed by the local composer. Each rejected request carried a complete reference block and a memory block. Each accepted result reports no references, no memory use and no receipt, and leaves `last_accessed_at` untouched. Breaking all three metadata replacement layers (the route reset, the backend assignment and the route's capture of the backend result) makes the JSON, SSE and job controls fail; with only the backend assignment, or only the route capture, intact they pass.
- **Embedding work.** With a mocked binding, the full 145-passage registry yields 123 scored candidates, against 101 at `7cd329a5`. That is 124 embedding inputs including one shared query vector, sent in batches of 100 and 24 (100 and 2 before). A warm rerun takes 100 inputs from the cache and sends one batch. A ten-Major Celtic Cross yields 45 candidates (35 before) in one 46-input batch. A failed batch and invalid vectors fall back to whole-set keyword scoring; cancellation makes no calls; 4-second batches time out at the 3-second deadline with peak concurrency two. Synchronous preview retrieval makes no embedding calls.
- **Cleanup and preservation.** The unused `countGraphRAGPassagesInPrompt` import is removed; the function is still re-exported. Extra blank lines at the end of four test files added in Tasks 2 and 4 are trimmed, so `git diff --check` is clean against the branch base as well as the working tree. The primary checkout's HEAD `a2b7d7f6` and all 22 pre-run dirty-file hashes, including both plan files, are unchanged. The only new status entry there is an untracked plan written by another session.

### ChatGPT checkout run

ChatGPT's checkout ran on Node 24.19.0 and npm 11.9.0. Its Task 7 five-file suite went from 95 passed / 28 failed to 123/123. Its final root run passed 5,852 tests with two opt-in skips (5,854 total); the Worker suites passed 64; the assembly evaluator passed 874 / 2,541 plus 16 / 48; lint passed with one unused-import warning; build, documentation and whitespace checks passed.

In that checkout, the full-suite integration run exposed missing GraphRAG dependencies in the offline preview's explicit source allowlist, an older telemetry assertion missing Task 5's three additive counts, and unavailable Playwright browser binaries. The allowlist and assertion are repaired, and the complete root rerun passed with the exact locked Playwright 1.62.1 / Chromium 151.0.7922.34 binaries. The normal CDN returned an unavailable-page response; the same version was installed from its official Google distribution with matching upstream MD5, ZIP integrity and executable-version checks. No package or test was changed to bypass the missing dependency. The earlier default-sandbox run was interrupted after local subprocess/listener errors and is not passing baseline evidence.

A fresh independent review of all 19 Task 7–8 changed files found one Important issue and no Critical or Minor issues: incidental inline graph headings in theme text or a preselected memory could trigger deletion of the user prompt. Header recognition now requires structural lines, and removal requires a recognized artifact boundary. **Thirteen new regressions failed before the fix and passed afterward**, covering both header kinds across disabled/full/summary prompts, source preservation and prefix fallback. Existing malformed-block checks continue to pass. This was reproduced at the supported builder boundary; a remotely exploitable HTTP input was not established. The fix passed a fresh full verification run in that checkout; no second independent review is claimed.

These checks do not supply real embedding relevance evidence, generated-reading quality approval, original-host preservation evidence or deployment verification. The live `REL01`–`REL10` relevance qualification below remains open.

### Task 4: Semantic-primary scoring and fallback qualification status

- **Rejected composition, through `734fe475`:** `score = s + 0.3 * k * (1 - s)` (`semantic-primary-corroborated-v1`). The owner-approved continuation restores `0.3 * k + 0.7 * s` (`legacy-weighted-v1`) in `composeRelevanceScore()`, with the same clamping and null/non-finite lexical fallback. This rollback does not resolve F3b.
- **Explicit custom-weight compatibility:** `scorePassageRelevance()` retains `keywordScore * keywordWeight + semanticScore * semanticWeight` when `keywordWeight` or `semanticWeight` is explicitly supplied by a caller.
- **Threshold and lexical version:** `DEFAULT_RELEVANCE_THRESHOLD = 0.3`; `LEXICAL_NORMALIZATION_VERSION = 'graphrag-lexical-v1'`; `PROJECTION_VERSION = 'meaning-v1/partial-meaning-v1'`.
- **Frozen relevance corpus:** `tests/fixtures/graph-rag-relevance-cases.json` (`REL01`–`REL10`, covering `relevant_paraphrase`, `multilingual_retrieval`, `short_word_plural`, `exact_context_unrelated`, `negated_excluded_topic`, `mixed_topic`, `partial_triad`, `cross_deck_projection`, `common_word_collision`, and `unrelated_weak_floor`).
- **Offline evaluator:** `scripts/evaluation/verifyGraphRAGRelevance.js` fails closed without `--embeddings <frozen-evidence-path>` or on case-order/hash mismatches, and has no implicit live-provider mode.
- **Real embedding qualification status:** **Failed on October 24** with frozen `@cf/baai/bge-m3` vectors for `tests/fixtures/graph-rag-relevance-cases.json` (evidence `task9/evidence/rel/vectors.json`, report `task9/evidence/rel/evaluation.json`). The proposed default adds two strong false positives and two recall regressions, and the zero-overlap multilingual case still fails; see [Task 9](#october-24-graphrag-task-9-live-qualification). The scoring task remains incomplete. Earlier `AI01`–`AI12` captures had already observed anisotropic cosine floors (`0.38–0.49`) on unrelated queries.

## Historical October 24 correctness candidate and release

**The bounded Claude narrative qualification is complete: zero blocking candidate findings.** All 47 originally authorized subscription narratives are generated and agent-reviewed. The 11 standard samples pass the existing metrics gate and agent review. Four initial candidate comparison readings failed across three defect families: unsupported Marseille artwork, conversion of non-present ages to current facts, and fitted prompts losing accepted drawn cards. These are corrected in reading prompt **1.5.2**, evaluator **2.6.0**. Eight separately authorized focused confirmations of the changed prompts are all accepted, and the recomputed standard (11) and candidate comparison (18) gates pass with zero flags. The [narrative review](READING_PIPELINE_NARRATIVE_REVIEW_2026-10-24.md) records every outcome, correction and two minor residual observations without converting initial failures into passes.

The current root suite passes **5,736 tests**, zero failures and two intentional opt-in skips (5,738 total); Worker graph/spread-analysis suites pass **64**. Assembly qualification passes **874 fixtures / 2,541 provider-target builds / 525 projections / 21 caps / 12 boundaries / 13 grounding probes**. Lint and the production build pass. Current documentation, whitespace and source-preservation checks are bound in the new subscription qualification manifest. These overlapping lanes are not summed.

**All 191 canon editorial groups remain accepted: zero pending groups or owner editorial decisions.** Their 1,167 variants pass mechanics; version-only metadata changes were revalidated without changing the reviewed text or identities. The [canon review](READING_PIPELINE_AGENT_REVIEW.md) preserves the prior E1–E5 corrections and independent-review findings. Direct/retrieved Minor matrices and the 32 Chromium/WebKit preview passes are historical 1.5.1 evidence, not newly executed browser/device qualification for 1.5.2.

The candidate, pushed as branch `claude/reading-pipeline-correctness-20261024` from `a2b7d7f6…`, was merged to `master` as release commit `f5f69f39` and deployed on October 24 as Worker version `8d00f495`. Live identity, duplicate-card admission and two signed-in readings are verified. Both readings were served by the Modal fallback, because the production Claude API has returned HTTP 400 since October 18, before this release. The [execution record's release section](READING_PIPELINE_CORRECTNESS_2026-10-24.md) has the details. Evidence is in `subscription-qualification/qualification-manifest.json` and, for the confirmations, `subscription-qualification/focused-confirmations/qualification-manifest.json` under the plan's private evidence directory. The [execution record](READING_PIPELINE_CORRECTNESS_2026-10-24.md) distinguishes the 1.5.2 checks, original generation source and earlier manifests, all of which remain preserved.

Exactly **55 subscription generations** (47 plus the eight confirmations) and **zero embedding calls** were made. Rebuilding identical inputs changes eight prompts and leaves 39 identical: 21 accepted candidate prompts plus all 18 baseline prompts. Each changed prompt was generated once with the same model and settings, one turn, zero application retries and no paid API fallback. On the current source the 47 requests have 43 accepted outputs, four baseline observations and no candidate blocking failure.

Workers AI compatibility and the production inspection are recorded in the release section. The production Claude API failure, Modal capacity, OpenAI live compatibility, physical devices and assistive technology remain pending. Browser rendering is emulation. No historical waiver was reused. This work made no writes to the primary checkout.

The following October 23 and earlier records are historical evidence; their counts, failures, human-review policy and release authorization do not qualify or authorize this candidate.

## Historical October 23 remediation candidate

**The follow-up memory-veto correction is implemented; its verification is recorded below. This candidate is not qualified for release.** Human editorial approval and live qualification remain pending; the pre-push subscription check failed at its first sample.

### October 23 production authorization

The user subsequently authorized merging the remediation into current `master` and deploying it, explicitly waiving the Claude gate for this release. The prior failed subscription check remains recorded. A one-run external release wrapper preserves the other release checks, migrations, settings-preserving upload and guest-browser verification without adding a permanent bypass to the checked-in deployment policy. The user also requested a bounded evaluation of actual production readings after deployment. Deployment identity, live-reading results and the waiver are recorded separately in `/home/ubuntu/.codex/artifacts/tarot-context-release-20261023-01a1697e/`; authorization does not convert pending editorial or live qualification into passing evidence.

Branch: `codex/reading-context-remediation-20261023`. Original reviewed base: `680516f0c13054f1a86b3f60d824e46427dec803`. Previously qualified executable/test checkpoint: **`e51022f3661b4a07c6c0f0b92af28f1a7e3e1da3`**, tree `66b7e89f9dc7b8e6215610caba639a109e204070`. Reading prompt **1.4.0**; evaluator **2.5.0**. See the [current plan](../superpowers/plans/2026-10-23-reading-context-complete-remediation.md) and [remediation ledger](REMEDIATION_LEDGER.md).

### Follow-up memory-veto correction

A subsequent P2 review reproduced obsolete age memories entering direct API and durable-job provider requests when a current correction shared a clause with another topic. Selection now keeps positive authority and ranking topic-filtered, then checks supported factual notes against all accepted current inputs for conflicts and retractions. The selection cache includes those complete inputs. Saved focus and caller interpretations remain excluded from current factual authority.

The regression run failed 23 cases before the production change; all pass after the correction. The updated suites add 32 tests covering age, wedding and employment corrections, all three supplemental current-input kinds, cache invalidation, subject ownership, topic-based admission/ranking, final provider memory blocks and access timestamps. The eight original review probes also pass: corrected notes are omitted and unstamped, while compatible controls remain retained and stamped. The full root suite passes **5,337 tests**, with zero failed/cancelled and two intentional installed-CLI opt-in skips (5,339 total). The deterministic gate passes 849 fixtures, 2,523 provider builds, 525 canon/deck projections and 12 exercised boundaries. Scoped ESLint passes.

Evidence is preserved separately under `/home/ubuntu/.codex/artifacts/tarot-memory-veto-fix-20261023-01a1697e/`, based on `2d76a50d951c92fb30537d29ee5001bb483cae8c` with the follow-up diff. These offline checks used a credential-free environment and an external-network guard. The previous frozen-source qualification and v4 comparison below predate this executable change; they are preserved as historical evidence and do not qualify the follow-up source.

### Pre-push subscription check

At the user's requested commit-and-push stage, `npm run ci:narrative-check` was attempted once through the existing Claude subscription, with paid API credentials absent. It exited 1 on the first standard sample, `single-new-role`, with `Claude Code request failed. Check subscription login and usage limits.` One of 11 samples was attempted; zero completed, and the metrics and downstream gate commands were not reached. The attempt was not retried and no paid fallback was used. All 21 tracked evaluation files retained their pre-run hashes. The failed log and preservation record are in `/home/ubuntu/.codex/artifacts/tarot-memory-veto-push-20261023-01a1697e/`. Implementation/test bytes still match the passing offline check manifest. Branch publication does not close this failed live gate or any remaining release requirement.

### Passed offline checks for the previous checkpoint

| Check | Result |
| --- | --- |
| Root Node suite | **5,305 passed**, zero failed/cancelled; two installed-CLI opt-in checks intentionally skipped (5,307 total). |
| Worker knowledge graph suite | **47 passed**, zero failed/skipped. |
| Deterministic prompt gate | **849 fixtures, 2,523 provider-target builds, 525 deck projections, 21 actual passage-cap selections** passed; includes 720 partial permutations and 30 complete controls. |
| Full ESLint and Vite build | Passed; build emits an `onnxruntime-web` eval warning. |
| Documentation, plan links and diff | 245 maintained Markdown files, both plans' five local links/anchors and `git diff --check` passed. |
| Source and tooling stability | All **3,364 tracked/nonignored source paths**, toolchain/harness hashes and Git index match before/after; final Git status clean. |
| Independent review | Whole-change review and subsequent qualification-repair review approved; the last repair review passed 158 fixture/relay tests, 173 privacy/prompt/access tests and an additional storage-bound probe. These overlap other suites. |

The previous source-path digest is `7f321e7993bac3048d7c2e12d8ed0fd65baf3340f038118fb8e852b7470b8ff1`. Exact commands, exits, durations, corpus/fixture identities and artifact hashes are recorded in the private evidence directory `/home/ubuntu/.cache/tarot-reading-context-remediation-20261023/task9-final-e51022f3-qualification-2/`. The raw prompt-gate artifact retains its development/null source label; the external qualification manifest binds it to that identical before/after source. Status-only documentation through `2d76a50d` preserved those executable/test bytes; the follow-up correction above changes them.

Final qualification manifest SHA-256: `ee71fa578293c4a7f2ac81259358b800080d02a88db7ee9fea9768ad6193c367`; report SHA-256: `3f1ed7e8ba6394392bcccd334ab17b7e094c354a93655e229642721893983ded`.

The first full attempt on `115bbd02` is preserved as failed/incomplete, including nine leaf failures and one incomplete relay file. It exposed W5 private-name persistence redaction and obsolete harness/fixture assumptions. Those were repaired, independently reviewed and qualified under the new source above; the failed attempt was not relabelled or discarded. Earlier whole-change memory-retraction/ownership failures and the historical October 22 live failures are also retained.

### Prepared comparison and remaining lanes

Task 10 v4 recaptured **24 candidate and 24 original-baseline final provider requests** with a blocked-network harness, synthetic principals/providers and real in-memory SQL. The exact same inputs and harness mechanics were used for both sources. All 48 prompt hashes match the corresponding v3 captures after fresh execution. The candidate omits retracted employer memories without access stamps and considers an older relevant ninth memory across all three decks. Three multilingual cases per source return an explicit postcapture `503 reading_safety_unavailable` because selective evaluation is intentionally unavailable; these are prompt-construction captures, not accepted generated-reading or safety qualification.

The v4 report/index/manifests are in `/home/ubuntu/.cache/tarot-reading-context-remediation-20261023/task10-preparation/`. Comparison manifest SHA-256: `523c9ced708dd056a55da7d8866e020cecbc28723a3494ff1687ffda669699d7`. Artifact index SHA-256: `2aa7b2e75f967d9aef9400c4bd54ad72a2a37f8f801060caf609cd8422202511`; all 72 new indexed files were independently rehashed. Historical v1–v3 artifacts and the old 18-case evidence remain unchanged.

- **Human editorial approval:** 525 reference projections and 30 direct partial themes remain pending; zero agent checks are represented as human approval.
- **Subscription generation:** the required `npm run ci:narrative-check` failed at its first sample as recorded above. The 48-output baseline/candidate comparison remains unrun; every comparison output row records zero attempts and null actual output/usage. The executable capture harness has no live mode; comparison execution remains a separate authorized stage.
- **Workers AI:** actual embedding relevance, failure/cache behavior and p95 latency remain unrun for this source.
- **Provider capacity:** Modal's serving window, tokenizer, output reserve and overflow/truncation policy require configuration inspection and bounded live qualification.
- **Release:** branch publication is separate from release. No merge, plugin publication, migration, deployment, production flags/binding check or live application verification occurred. Rollback and receipt-draining requirements are documented in the [input contract](../reading-context-inputs.md#compatibility-release-and-rollback-checklist).

The following October 22 record is preserved as historical evidence. Its passing tests, source hashes, failed provider attempts, 18-case comparison and usage observations do **not** qualify the October 23 implementation.

## Historical October 22 candidate record

Recorded: 2026-10-22
Implementation branch: `codex/knowledge-graph-context-20261022`
Implementation base: `7164fc21c6c9e5988c0c4ac368f843cc5cd0c1df`
Reading prompt version: **1.3.0**
Evaluator version: **2.5.0**

**Code implementation and deterministic qualification are complete. Subscription-authenticated generated-reading qualification remains blocked and pending. Human editorial review of all 145 meaning-only canon projections remains pending.** Committing and pushing the implementation branch preserves these open requirements; it does not mark the implementation as fully qualified for release.

The [implementation plan](../superpowers/plans/2026-10-22-knowledge-graph-context-remediation.md) records the task requirements, completed work and remaining acceptance checks.

## PR #121 review fixes

The three code findings from the review of `cb4c0198` are resolved:

- Possessive age modifiers fail closed when their owner is unresolved, including `my 42-year-old partner`, `my partner's 42-year-old friend` and named possessives. Unit and real-route regressions cover both current-input and stored-note directions, provider prompt exclusion and absent access stamps. Explicit age predicates and birthdays remain supported.
- Both prompt builders honor the current and legacy graph flags before regenerating canonical highlights. Coverage includes flag precedence, disabled defaults, deck identity and provider budget rebuilds. The deterministic gate distinguishes disabled graphs from enabled graphs with no reference passages.
- Topic-neutral general and card notes remain eligible for bounded retrieval. The initial allocation shares the existing note allowance across all eligible notes; a maximum-card regression retains the late topical note alongside neutral constraints. Conflicting-topic, duplicate and inactive saved-focus exclusions remain covered.

That follow-up added 62 tests. Independent review approved those three fixes and the qualification-harness correction. A subsequent review of `513caa9b` identified two further P2 issues, addressed in the next fix wave:

- The local fallback resolves explicit and inferred decision labels before replacing custom positions with stable A/B roles. Those same roles now drive flattened card notes and usage accounting, so cleared or replaced options cannot return through a card reflection. Regressions cover both sides, original-card immutability, inferred labels, nondecision notes and reflection-length boundaries.
- Ordinary memory-list access updates use batches of at most 98 IDs, leaving two D1 bindings for the timestamp and owner. Each update failure is nonfatal to the successful read and emits a fixed warning without database details. SQLite-backed regressions exercise authenticated requests for 98, 99 and 100 notes, failed batches, monotonic stamps, owner/session filtering and the write-free candidate-loading path.

This second fix wave adds 28 tests, including four route subtests. Independent review approved both fixes and confirmed the reading-specific selected/retained access lifecycle remains intact.

The re-review of `7dec3846` identified two further P2 issues, addressed in the third fix wave:

- Bare age authorization now requires an age-compatible continuation. Known measurements remain ordinary context; unsupported numeric continuations stay ambiguous and cannot authorize an age or bypass stored-detail filtering. Numeric commas and mixed fractions remain intact through clause splitting, including the Unicode fraction slash produced by NFKC. Completed measurement predicates can still separate a later named or relationship age clause. Route regressions prove that older unraised age notes stay out of provider prompts and receive no access stamp.
- The reading route flattens decision-card notes with canonical A/B roles after raw crisis screening. Explicit clears and replacements therefore cannot reintroduce obsolete restricted-topic labels through a card-note prefix. Current questions, general/card notes and normalized or inferred path labels still trigger selective evaluation when appropriate. Direct requests and reading jobs share this behavior; original raw-position crisis screening and nondecision positions remain covered.

This third fix wave adds 48 tests, including twelve route/job subtests. Independent bounded review passes 215 focused tests and fifteen asserted route probes, with no significant issue remaining in these two corrections. The eleven measurement probes exclude the private age note and its access stamp; four named/relationship age controls retain their matching note. Earlier failed probes remain preserved alongside the final passing evidence.

The re-review of `e0307db0` identified three further P2 issues, addressed in the fourth fix wave:

- Language screening in the reading route and local fallback now includes effective explicit or inferred A/B labels. Unsupported path language cannot bypass evaluation when the question and card notes are English. Cleared or replaced legacy labels remain excluded; raw-position crisis screening remains intact. Route, local-fallback and reading-job regressions cover both active and overridden labels.
- Explicit day/week/month ages remain ambiguous personal details, so an unraised infant-age note cannot enter a provider prompt through an unrelated topic. Prefixed ages now require the same positive age-continuation check as bare shorthand, preventing decimal, fractional or range prefixes from authorizing integer year ages. Spelled-out quantities and hyphenated fraction modifiers also remain ambiguous. Ordinary durations and separate supported age clauses retain their behavior.
- Ampersand mixed fractions stay intact during clause splitting, including ASCII, Unicode and word fractions. `42 & 1/2 miles` therefore cannot authorize a stored self-age-42 note. SQLite-backed route regressions require prompt exclusion and no access stamp while retaining the relevant general note.

This fourth fix wave adds 74 tests. The six focused context, memory and backend suites pass 354 tests. Independent bounded review approves the final source with no actionable findings after 363 focused tests, 51 additional memory/route probes and fifteen additional language-route probes. Those suites overlap the root suite and are not additive. Earlier failing cases and independent review probes remain preserved with their source identities.

These fixes preserve the frozen corpus and pending acceptance requirements. The older candidate previews do not qualify the updated implementation. The PR remains in draft while subscription qualification and human editorial review are pending.

## Passing local evidence

The following local checks cover the PR review fixes. Subscription gates and human editorial approval are separate from these results.

| Check | Recorded result |
| --- | --- |
| Root Node suite (`npm test`) | 4,926 passed, two skipped, zero failures |
| Worker knowledge graph suite | 47 passed, zero failures |
| Deterministic qualification corpus | 73 synthetic fixtures and 219 provider prompt builds |
| Authored archetypal patterns | All 30 partial pairs and ten complete arcs |
| Deck projection coverage | 145 canon passages across three decks: 435 projections |
| Budget/fallback boundaries | Twelve explicit boundaries, including graph disabled versus passages removed |
| Repository and changed-file ESLint | Zero errors and warnings |
| Build, maintained documentation links and diff check | Passed |
| Independent code review | Original whole-change review and all four fix-wave reviews approved; all ten findings from the requested review rounds addressed |

An earlier separate real Workers AI lane validated nineteen finite embedding vectors of 1,024 dimensions from `@cf/baai/bge-m3`. Sixteen paired cases used semantic scoring; two accurately reported no eligible patterns or passages. This lane predates the PR fixes and does not establish generated-reading usefulness, production latency or production cache behavior.

## Pending subscription qualification

- [ ] Pass `npm run ci:narrative-check` through the existing Claude subscription.
- [ ] Complete the frozen eighteen-pair quality comparison: eighteen baseline and eighteen candidate outputs, 36 outputs total.
- [ ] Review candidate readings against the actual inputs and the existing ethics, card-coverage and depth gates.

The original narrative-gate attempt used the existing personal Claude subscription, model `claude-opus-5-5`, effort `xhigh`, and stopped on its first sample because of the subscription usage limit. One attempt during each of the four review-fix waves also failed on its first sample with the Claude Code subscription request error. The third- and fourth-wave attempts ran in isolated source snapshots before their final numeric-boundary corrections; neither qualifies the updated source. Each attempt retains its own source identity and log. The latest read-only usage check confirmed the historical weekly limit below; this fix wave did not refresh that usage observation. The gate has **not passed**. No paid API fallback was used; the original sample, metric, review-queue and paired-comparison evidence remains unchanged.

Fourth-wave gate preparation first exhausted disk space while creating a full source snapshot. That incomplete task-created copy was removed, with its setup failure recorded separately; it made no subscription request. A smaller source-only snapshot was then prepared successfully and reached the subscription provider before failing on its first sample. The initial full-suite verification was also interrupted by the disk-space failure; final checks use a fresh run after recovery.

The frozen baseline comparison attempted eighteen cases once and produced five readings and thirteen CLI failures. All failures remain recorded, with zero retries. Independent content review passed three available baseline outputs and failed two: one lost the named decision options, and one disclosed an irrelevant coastal-walk memory. Those two failures were not waived or omitted. All five available baseline outputs passed the saved structural/card-coverage checks, which did not detect those content failures.

Candidate narrative generation is **unrun**. Eighteen final candidate prompt previews and their source-usage metadata were captured without model inference. They are prompt-assembly evidence, not generated reading outputs. The 36-output paired quality comparison remains incomplete.

At the latest read-only live usage check, **2026-10-22 at 19:08 UTC**, the subscription reported weekly use of 100%, with a reset at **2026-10-24T04:00:00.344015Z**. The earlier 17:24 and 18:24 UTC observations remain preserved in their original evidence. These checks record the observed blocker; they do not assume that future access is available. A later qualification run must retain the original failed records, record its own source revision and attempts, and never overwrite or silently exclude failed cases.

## Pending human editorial review

- [ ] A human reviewer checks the semantic fidelity of all 145 meaning-only projections and records approval or corrections.

The [editorial checklist](CANON_PROJECTION_REVIEW.md) includes every original/projection pair and an unchecked review item for each passage. Agent authorship and independent agent reviews are complete. They do **not** satisfy the required human editorial review.

## Frozen qualification identity and local evidence

The paired case IDs, order and objects are frozen in [the synthetic fixture corpus](../../tests/fixtures/knowledge-graph-context-cases.json). The recorded identities are:

| Identity | SHA-256 |
| --- | --- |
| Fixture file bytes | `578e615034eaef0e188ae04986cfc9834b62c80943dae089873582cb0cd2ee29` |
| Canonical fixture JSON | `b0636009bccc517d71e9ebc3c07e2292c24945cf188667487226d170ffed9641` |
| Eighteen paired cases and order | `ae2ab4ee406b7b085d6e6f9887b32c7159bb9bf9522b1e33b7f040106acc1c95` |
| Canon/projection corpus | `77bc5a94ee589040318842e12174728403bb670bcfb73e9a71890a432a7f204f` |

The full qualification manifest, original failed attempts, synthetic generated readings, prompt previews, test logs and code-review reports are preserved locally under `.superpowers/sdd/2026-10-22-knowledge-graph-context-remediation/` in the implementation worktree. Exact source archives are preserved under `/home/ubuntu/.codex/artifacts/knowledge-graph-context-20261022/`. These local evidence files are not part of the Git publication; this status page, the fixture corpus and the human editorial checklist are tracked.

The fixture bytes, paired-case order and canon/projection corpus are unchanged by the PR fixes. Follow-up regression logs, local-check results and the fresh subscription observation are preserved in the `pr121-fixes-20261022-k3a3_5l4` directory beneath that artifact root. Original source archives and candidate previews predate these fixes and retain their original identities. Fresh generated-reading qualification must identify the updated implementation commit.

The subsequent two-P2 fix wave retains its own regression, verification, review and subscription evidence under `pr121-p2fixes-20261022-nlmsr0s2` beneath the same artifact root. Earlier failed attempts and their run identities remain intact.

The measurement and selective-evaluation corrections retain red/green regression logs, independent route probes, final source hashes, local checks and the isolated failed subscription attempt under `pr121-measurement-policy-fixes-20261022-24lxcpxf` beneath that artifact root. The source archives and all earlier failed or passing observations retain their original identities.

The decision-language, infant-age and ampersand-fraction corrections retain red/green regression logs, independent numeric/language probes, final source hashes, local verification, the source-only subscription snapshot and its failed gate under `pr121-three-p2-fixes-aamkry0z` beneath that artifact root. Snapshot preparation and interrupted-verification logs remain separate from the actual subscription attempt. Frozen fixture bytes, all original narrative artifacts and all 145 unchecked human-review items remain unchanged.

No merge, deployment, migration or production-behavior qualification is established by this branch publication.
