# Knowledge graph and context qualification status

## October 24 GraphRAG complete remediation candidate — offline Tasks 7–8

Reading prompt **1.6.0** adds final-prompt integrity and source accounting on branch `claude/graphrag-complete-remediation-20261024`, continuing the published Task 6 checkpoint `a3c115c0c3abf414c78e085528664aa3c88d99c6`. Task 7 is checkpointed at `88e01b18ce4f7aec02b6cbede722112f4ee3bafa`. This is an offline candidate; **Task 9 live embeddings, subscription generations and deployment remain pending explicit user review**. Earlier release and narrative records below do not qualify this changed prompt version.

The original Ubuntu worktree, cache evidence and complete-remediation plan were unavailable in this environment; the plan is also absent from the supplied Git revision. The user authorized an isolated checkout and their pasted Tasks 7–8 handoff as the execution contract. The published commit ancestry was verified. Original checkout hashes, prompt snapshots and Task 1–6 red/green logs remain unverified historical evidence.

### Final-prompt and pipeline coverage

- Final assembly calls `enforceGraphRAGPromptIntegrity()` after all trimming and before token totals, graph parsing, source usage, memory retention and provider handoff. Conditional guardrails use the projected, ranked, capped passages for that attempt.
- Public diagnostics retain only a bounded `integrityRemovedBlocks` count, fixed-enum `integrityRemovalReasons`, and `referenceGuardrailsComplete` when measured. Historical records without these measurements stay unknown. Integrity omission uses `reference_integrity_failed`, with reader copy **“Reference passages could not be included.”**
- The [remediation v1 fixture](../../tests/fixtures/graph-rag-remediation-v1-cases.json) exercises **16 cases / 48 provider-target builds**, including full references, partial/weak guardrails, selected-deck projection, summary, budget omission, disabled/empty input, rejected projection and integrity removal. All eight registry-backed pattern families have actual candidate evidence and matching summary signals. Fixture SHA-256: `df12321cc03497d3fcfbe75825dceabc2afd26283f07b83d2618dfa0cc872e76`.
- Actual Claude, OpenAI and Modal request serializers are exercised with mocked transports. Source indices, journal/client normalization, telemetry and memory receipts are checked against final prompt bytes. A rejected Modal attempt containing references and memory followed by an accepted capped OpenAI attempt reports only the accepted attempt's sources and memory receipts.
- Existing reader suppression of legacy partial arcs is preserved. A reference retained for generation does not guarantee a visible reader excerpt or prove that a model used it.

### Current offline verification

All commands run in the isolated checkout on Node **24.19.0**, npm **11.9.0**, with the six provider credentials named in the handoff unset. The standalone assembly evaluator also blocks unstubbed external network access.

| Check | Observed result |
| --- | --- |
| Task 7 required five-file suite | **123 passed**, zero failed/skipped at `88e01b1`. |
| Root `npm test` | **5,839 passed**, zero failed/cancelled; **two intentional installed-CLI opt-in skips** (5,841 total). The first failed integration run remains preserved. |
| Worker graph and spread analysis | **64 passed**, zero failed/skipped. |
| Credential-free assembly evaluator | **874 existing cases / 2,541 provider-target builds**, plus **16 remediation cases / 48 builds**; **525 deck projections / 21 caps / 13 grounding probes**. All passed; existing and additional lanes are reported separately. |
| `npm run lint` | Passed, zero errors; one existing unused-import warning for `countGraphRAGPassagesInPrompt`. |
| `npm run build` | Passed. |
| `npm run docs:check` and `git diff --check` | Passed; **223 maintained Markdown files** have valid local links. |

The full-suite integration run exposed missing GraphRAG dependencies in the offline preview's explicit source allowlist, an older telemetry assertion missing Task 5's three additive counts, and unavailable Playwright browser binaries. The allowlist and assertion are repaired, and the complete root rerun passes with the exact locked Playwright 1.62.1 / Chromium 151.0.7922.34 binaries. The normal CDN returned an unavailable-page response; the same version was installed from its official Google distribution with matching upstream MD5, ZIP integrity and executable-version checks. No package or test was changed to bypass the missing dependency. The earlier default-sandbox run was interrupted after local subprocess/listener errors and is not passing baseline evidence.

The existing frozen summary-only fixture remains byte-for-byte unchanged. Its test adapter's soft budget moves from **5,960 to 6,200** so complete summary guardrails survive; measured summary retention for that input was 6,003–6,533. Production budgets stay unchanged. Synthetic malformed registry rows are isolated and restored even on a failed expectation, so repeated qualification does not change the canon.

These checks do not supply real embedding relevance evidence, generated-reading quality approval, original-host preservation evidence or deployment verification. The live `REL01`–`REL10` relevance qualification below remains open.

### Task 4: Semantic-primary scoring and fallback qualification status

- **Default relevance composition:** `composeRelevanceScore({ keywordScore, semanticScore = null })` in `functions/lib/graphRAGScoring.js`, implementing `score = s + 0.3 * k * (1 - s)` (`RELEVANCE_SCORING_POLICY_ID = 'semantic-primary-corroborated-v1'`) for valid semantic vectors (`s` clamped to `[-1, 1]`, `k` in `[0, 1]`), returning `k` when `semanticScore` is null or non-finite.
- **Explicit custom-weight compatibility:** `scorePassageRelevance()` retains `keywordScore * keywordWeight + semanticScore * semanticWeight` when `keywordWeight` or `semanticWeight` is explicitly supplied by a caller.
- **Threshold and lexical version:** `DEFAULT_RELEVANCE_THRESHOLD = 0.3`; `LEXICAL_NORMALIZATION_VERSION = 'graphrag-lexical-v1'`; `PROJECTION_VERSION = 'meaning-v1/partial-meaning-v1'`.
- **Frozen relevance corpus:** `tests/fixtures/graph-rag-relevance-cases.json` (`REL01`–`REL10`, covering `relevant_paraphrase`, `multilingual_retrieval`, `short_word_plural`, `exact_context_unrelated`, `negated_excluded_topic`, `mixed_topic`, `partial_triad`, `cross_deck_projection`, `common_word_collision`, and `unrelated_weak_floor`).
- **Offline evaluator:** `scripts/evaluation/verifyGraphRAGRelevance.js` fails closed without `--embeddings <frozen-evidence-path>` or on case-order/hash mismatches, and has no implicit live-provider mode.
- **Real embedding qualification status:** **Pending authorized live Workers AI embedding capture** for `tests/fixtures/graph-rag-relevance-cases.json`. Earlier October 24 `@cf/baai/bge-m3` captures (`AI01`–`AI12`) predate the `REL01`–`REL10` corpus and observed anisotropic cosine floors (`0.38–0.49`) on unrelated queries (`AI06`, `AI10`), so real relevance qualification remains explicitly incomplete until authorized provider evaluation and precision review are completed.

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
