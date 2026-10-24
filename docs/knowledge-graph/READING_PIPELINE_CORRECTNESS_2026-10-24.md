# Reading pipeline correctness execution record — October 24

The [October 24 remediation plan](../superpowers/plans/2026-10-24-reading-pipeline-correctness-remediation.md) now includes a completed **47-output Claude subscription run and agent review**. The canon review remains complete with zero owner decisions. Three generated-reading defect families are corrected in prompt **1.5.2**. All eight changed prompts were then confirmed by separately authorized focused generations, with zero blocking candidate findings. It was merged to `master` and released on October 24 as Worker version `8d00f495`; the release record below separates what that release verified from what remains pending.

## Release record — October 24

The owner authorized the release on October 24 ("release as planned, fix retrieval separately") and chose to ship it together with PR #123, which merged to `master` during the release. Release commit **`f5f69f39`** merges the pushed candidate (`7b8397f8`) and the narrative-metrics reported-fear correction (`cbbaaa9f`) onto `master` `c7f40e64` (PR #123: label tracking tokens and the shared close button). It was pushed to `master` after the verification below. Private evidence is in `/home/ubuntu/tableu-evidence-archive/reading-pipeline-live-qualification-2026-10-24/`.

| Lane | Result |
| --- | --- |
| Before deployment | Active Worker `af8edd91` (master `98106dd8`, prompt 1.4.0, evaluator 2.5.0) recorded as the rollback target; zero pending migrations; all three narrative provider credentials present; semantic GraphRAG enabled |
| Workers AI (`@cf/baai/bge-m3`) | Compatibility qualified on 12 fixed cases with 12 of 24 authorized calls: finite 1,024-dimension unit vectors, every case scored semantically, REST latency 105–216 ms (p50 147). Ranking observations W1–W3 below |
| Release QA (`npm run deploy`) | Root suite **5,737 passed**, zero failed, two intentional skips (5,739 total); deploy tests **74 passed**; Cloudflare command and documentation checks pass; Claude subscription narrative gate **11 samples, every metric 100%, zero flags**; prompt assembly 874 fixtures / 2,541 provider builds / 525 projections / 12 boundaries. Vision qualification not run |
| Deployment | Worker version **`8d00f495-ff5b-4928-9634-72823e093049`** at 100% from 08:40 UTC; migrations already applied; 62 variables, 35 secret names and all bindings identical to `af8edd91`; Browserbase guest UI smoke passes at desktop and narrow widths |
| Live identity | The downloaded Worker bundle contains reading prompt 1.5.2, evaluator 2.6.0 and `duplicate_card_identity`, with no 1.4.0 or 2.5.0 marker. The served `index.html` and its assets match the release build, apart from Cloudflare's edge-injected challenge script. Health reports `claude-api` |
| Live admission | Direct and job routes both reject a repeated canonical card with **400 `duplicate_card_identity`** |
| Live readings | **Not verified.** The two guest readings (workplace boundary; Marseille Cups) returned **429 `reading_limit_reached`**: this host's guest allowance was already 5 of 5 for October. No generation occurred |

The first QA attempt stopped before any remote change: two file-mode tests failed under the restrictive umask the release wrapper had set, and they pass under the default. The first post-deploy smoke attempt omitted the required card `meaning` field, so schema validation rejected all four requests before admission. The corrected rerun built requests with the app's own card builder and validated them locally first. Both failed attempts are preserved. No rollback criterion was observed, so `af8edd91` was not restored. Release QA samples used keyword scoring because the local harness has no Workers AI binding; production semantic reference selection is covered only by the Workers AI lane.

Workers AI ranking observations, all pre-existing on `master` and outside this plan's scope:

- **W1:** the labeled weak-match floor applied in only 2 of 12 cases; three of four unrelated queries cleared the 0.3 threshold and would be cited as ordinary references.
- **W2:** context-specific passage variants can win for unrelated questions: a grief variant for a maroon-ribbon question, and an addiction variant for a question classified as shadow work because it contains the everyday word "pattern".
- **W3:** relevant and irrelevant controls score close together (cosine about 0.33–0.53); an irrelevant control ranked first in two workplace cases.

The owner chose to release without changing retrieval and to fix it separately, on branch `claude/retrieval-variant-gating-20261024` (not merged or deployed).

Still pending: a live reading on the new Worker (the guest allowance resets November 1, or a signed-in account can be used), live future-age omission and present-age retention with a signed-in account that has memories, Modal serving/capacity, OpenAI live compatibility, a seven-day telemetry window, vision qualification, physical devices and assistive technology.

## Current subscription review and corrections — prompt 1.5.2

The [narrative review](READING_PIPELINE_NARRATIVE_REVIEW_2026-10-24.md) records all 47 readings, frozen input/source/prompt identity, semantic verdicts and limits. Exactly 11 standard candidate outputs and 18 baseline/candidate pairs were generated using the existing first-party Claude subscription, Opus 5.5, `xhigh`, one turn, maximum output 32,000 including thinking, zero application retries, tools or paid API fallback. The standard metrics gate passes with zero flags. Four initial candidate comparison outputs fail across three defect families; their failures remain recorded. Baseline observations are separate.

The fixes replace generic Marseille geometry claims with symbolic rank meanings, protect original non-present age qualifiers throughout generated prose, and reserve a complete canonical drawn-card inventory during hard-cap fitting. Chariot imagery no longer supplies unsupported physical reins. Decision path clearing/replacement and explicit current-age controls remain supported. Ten new regression tests, fixture compatibility corrections and a fresh independent code review are recorded without claiming post-fix generation success.

| Current verification | Result |
| --- | --- |
| Full Node suite | **5,736 passed**, zero failed/cancelled, two intentional opt-in skips; **5,738 total** |
| Worker graph/spread analysis | **64 passed** |
| Assembly qualification | **874 fixtures / 2,541 provider-target builds / 525 projections / 21 caps / 12 boundaries / 13 bounded grounding probes** |
| Canon editorial inventory | **1,167 mechanically valid variants / 191 accepted groups / zero pending or owner decisions** |
| Other current checks | Lint, production build, documentation, separate plan links, exact editorial regeneration and whitespace pass |

The overlapping counts are reported separately. All **3,098 non-Markdown source paths** match before and after current final verification. The new private `subscription-qualification/qualification-manifest.json` binds these checks to source inventories and the generation/review evidence. Earlier manifests, failed checks and original outputs are preserved. Browser evidence below remains the historical 32-case 1.5.1 result; no fresh browser, physical-device or assistive-technology qualification is claimed for these prompt fixes.

Replaying the same 47 requests changes **eight** prompt hashes; **39** remain identical, consisting of 21 accepted candidate prompts and all 18 baseline prompts. After separate authorization, the eight corrected candidate requests were generated once each, with exact hashes and the same subscription settings. All eight are accepted on agent review. The source-matched standard (11) and candidate comparison (18) gates pass with zero flags, and the qualified non-Markdown source is unchanged. The private `subscription-qualification/focused-confirmations/qualification-manifest.json` binds the run, review, gates and pre-edit document snapshots. This qualification made zero embedding calls; the later Workers AI, production and release lanes are in the release record above. This work made no writes to the primary checkout.

## E1–E5 editorial correction snapshot — historical prompt 1.5.1

The following section preserves the completed E1–E5 correction pass. Its source, counts and zero-call state describe that earlier point; the current source and actual 47-generation run are qualified separately above.

The user replaced the 807-row human approval requirement with grouped agent review and then authorized all five corrections and offline requalification. The [completed review](READING_PIPELINE_AGENT_REVIEW.md) now records **191 accepted groups, zero unresolved corrections, zero pending groups and zero owner decisions**. Its 1,167 coverage rows include the original 807 variants plus 360 retrieved Minor/court variants, without expanding the editorial group count.

Forty source passages were revised to preserve meaningful optional guidance without unsupported circumstances, guaranteed outcomes or consequential directives. Actual Minor/court membership now survives retrieval and final prompt reconstruction; the two conflicting Major themes and Thoth article grammar are corrected. Independent review also caught unsupported headings and stale source-disclosure indices; both have failure-first regressions and fixes. Snapshot reading prompt **1.5.1**; evaluator **2.6.0**.

Final root qualification: **5,726 passed, zero failed, two intentional skips**. Worker suites: **64 passed**. Assembly: **874 fixtures, 2,541 provider-target builds, 525 projections, 21 caps, 12 boundaries and 13 grounding probes**. Direct Minor coverage: **1,368 renders / 684 provider builds**; retrieved coverage: **684 Minor builds / 132 court references**. Browser result: **32 passed across Chromium and WebKit**, including real local Pro login/logout. Lint, production build, enrichment validation, documentation and whitespace pass. These overlapping lanes remain separately reported.

Snapshot evidence is in `.superpowers/sdd/2026-10-24-reading-pipeline-correctness-remediation/editorial-corrections/qualification-manifest.json`, binding final checks to the corrected source inventory and preserving all earlier attempts. The original implementation and review-workflow manifests/logs remain intact. The 18-case baseline/candidate comparison has 36 freshly captured final prompts, with zero generated outputs or live calls. No staging, commit, push, merge or deployment occurred; the primary checkout remains unchanged.

## Original implementation snapshot — historical evidence

The remainder records the source and results before the subsequent editorial workflow and correction passes. Its prompt version, inventory, counts, pending human metadata and review wording describe that earlier snapshot. They do not override the completed agent review above or qualify the changed source; the current supplement provides that binding.

## Candidate and evidence identity

- Reviewed baseline: `a0ff83d32d67df46cf5146e5856156c5a23dd797`.
- Execution HEAD: `a2b7d7f6b8af5bf97a435d81b5e6d26c389a5b0a`, plus the uncommitted candidate changes.
- Workspace: `/home/ubuntu/.codex/worktrees/0df9/tarot`, a native managed detached worktree. The primary `master` checkout and its unrelated untracked artifacts remain unchanged.
- Reading prompt: **1.5.0**. Evaluator: **2.6.0**.
- Node: **24.21.0**. npm: **11.19.0**. Playwright: **1.62.1**.
- The same **1,646 executable/test/configuration paths** were hashed before and after final verification. Inventory SHA-256: `d50feff65de4aca1cb33800bfd9284324311d498fe9e6fda4b8667d5f4a565ae`.

Private synthetic evidence is under `.superpowers/sdd/2026-10-24-reading-pipeline-correctness-remediation/` in that workspace. `qualification-manifest.json` binds command exits and complete log digests to `source-before.json` and `source-after.json`. The verifier's internal development/null source label is not a frozen-source attestation; this external manifest supplies that binding. Documentation-only completion records were written afterward without changing the qualified executable/test inventory.

## Findings, implementation and regression ownership

| Finding | Resulting behavior | Principal code | Regression evidence |
| --- | --- | --- | --- |
| F4 / duplicate identity | New direct/public job admission returns `400 duplicate_card_identity`; MCP fails before starting. Distinct catalog membership governs graph strength, with every valid original slot retained. Historical canonicalization remains separate. | `readingCardResolution`, `graphCardMembership`, `knowledgeGraph`, `graphContext`, `readingJobs`, job-start route, MCP journal mapping | `readingCardResolution`, `graphCardMembership`, graph/Worker/job/MCP transport and historical display suites |
| F1 / absent Minor members | Both strong and emerging highlights use only actual members' roles. Complete groups retain symbolic relationships; positions and reversals remain authoritative. Court summaries describe possible symbolic roles rather than actual family history. | `minorPatternHighlights`, `knowledgeGraphData`, `knowledgeGraph` | 1,368 pure order/orientation/deck cases and 684 provider-target builds; partial-pattern/graph pipeline suites |
| F2 + D1 / context and focus | Scoped action exclusions cannot veto affirmed workplace evidence. Relevant saved interests supplement the frozen lens; unrelated interests are omitted. Current-led embedding queries still exclude supplementary saved focus. | `readingContextVocabulary`, `contextDetection`, user context/prompt construction, shared usage reasons | context/retention tests, actual direct and public job embedding/provider captures, telemetry controls |
| F3 / temporal memory | Same-person present agreement authorizes present age; matching dated non-present claims preserve exact wording. Quoted stories and temporal qualifiers cannot become current facts after splitting. Relative stored dates lack an original anchor and abstain. | `readingMemorySelection` | 402-test memory lane before final review extensions; direct/job receipt, accepted/canceled/failed, dated and quotation controls; final full suite |
| F5 / complete buffered answer | All assistant answer pieces are retained in order, with reasoning separate and aggregate fallback used only when no answer was collected. Stream completion reconciles authoritative complete text. | `openaiResponses`, `openaiResponsesStream`, backend shape telemetry | buffered/multiple-message/whitespace/reasoning/aggregate and stream reconciliation suites |
| F6 / false card presence | Affirmative undrawn presence has zero allowance. Absence, comparison, hypothetical and reported-quotation controls do not consume the residual allowance. Shared passage/follow-up/vision callers retain their actionable detector contract; generated metrics and gate consume the new assertion field. | `readingCardAssertions`, `readingQuality`, `evaluation`, passage guard, metrics/gate, route deck propagation | assertion/quality/evaluation/stream/job suites, follow-up repair and metrics-gate tests, review regressions |
| F7 / previews | Selected-deck/context projections display their projected prose. Legacy references reconstruct only with canonical saved cards and explicit saved deck, with a reconstructed-preview label. Malformed optional data cannot crash history. Old generation is canceled before installing restored journal prose. | spread analysis/orchestrator, narrative model/controller, `SpreadPatterns`, reading display, journal hydration | unit/Worker controls plus 32 Chromium/WebKit render cases |
| F8 + F10 / enrichment | Strict approval validation precedes writes. Default merge preserves missing/pending approvals and revokes exact rejected candidate IDs. Full replacement needs a matching complete inventory. Staging/import checks, hash-bound provenance and marker-before-backup cleanup preserve recovery. | `applyPassageCandidates`, defensive knowledge-base merge | 69-test integrated enrichment lane; cleanup failure/valid-rerun regression; read-only applied-module check |
| F9 / estimator | One immutable request-local estimator governs construction, every fitting/rebuild path and final accounting. Explicit Worker env wins, including `{}`. Impossible protected fits fail with `PROMPT_BUILD_BUDGET_EXCEEDED`; default caps and Modal null caps remain. | budgeting, truncation, system/user context and enhanced builder | Worker/process disagreement, interleaved builds, cap boundaries, Unicode, retained source/receipt and provider controls |

The capability restrictions are deliberate and bounded: ordinary repeated-card requests are rejected; ambiguous temporal claims stay omitted; previews without sufficient saved identity remain absent; affirmative false presence triggers fallback; conservative calibration can retain less optional context. A deterministic fixture retained **26,340 context characters at the default divisor versus 3,941 at divisor 1.1**. This is not an actual-provider token calibration or a proposed deployment setting.

## Final local verification

Final deterministic commands ran in a credential-free child environment with isolated HOME and external Node HTTP/fetch transport blocking. The prompt verifier adds its own network guard. No live narrative gate was included in this lane.

| Command / lane | Final result |
| --- | --- |
| `npm test` | **5,706 passed, zero failed/canceled, two intentionally skipped; 5,708 total**, 134.96 seconds. |
| Worker knowledge graph and spread analysis | **64 passed**, zero failed/skipped. Command: `node --test functions/__tests__/knowledgeGraph.test.js functions/__tests__/spreadAnalysis.test.js`. |
| `node scripts/evaluation/verifyNarrativePromptAssembly.js --json` | **874 fixtures, 2,541 standard provider builds, 525 deck projections, 21 passage caps, 12 boundaries, 13 bounded grounding probes and five expected admission rejections**. Four reference-adversary builds are separate. |
| Minor membership matrix | **1,368 pure cases and 684 provider-target builds**. These overlap the root test suite and are not additional root tests. |
| Preview browser lane | **32 passed**, zero failures/skips: Chromium 16 + WebKit 16. |
| `npm run lint` | Passed without warnings. |
| `npm run build` | Passed after the final test/verifier run. The existing `onnxruntime-web` eval warning remains. |
| `npm run docs:check`, separate plan links, `git diff --check` | Passed. The plan directory has a separate local-link/anchor record because the maintained-doc checker excludes it. |
| `npm run enrich:apply -- --check` | Passed read-only against the current empty generated registry. No real review queue was applied. |

The skipped root tests are the explicit installed-CLI and installed-app-server inference opt-ins. They were not replaced with paid API calls. New bounded grounding checks detect authored counterexamples, not arbitrary semantic faithfulness or instruction immunity.

The final browser lane contains **28 guest, two synthetic Pro and two real local Pro cases**. Real login and `/api/auth/me` verified the local active Pro reviewer account, and logout returned it to 401 in both engines. Narrative, embedding, journal and usage transports were mocked. The owned auth harness exercised production auth handlers and existing local D1; it does not qualify the entire Worker router. All sessions were logged out and owned services stopped; ports 8787 and 5190 were closed. Browser emulation does not establish physical-device or screen-reader behavior. The 77 browser-relevant source/test hashes matched before and after that lane.

## Failures and review corrections preserved

The first broad run under the final credential-free harness had **5,707 tests: 5,689 passed, 16 failed, two skipped**. Eleven failures exposed old duplicate/focus expectations; five came from the controlled frontend snapshot missing newly imported preview graph modules. The six fixture migrations preserve the original transport, style, reference, memory and Unicode-budget purposes with valid distinct cards and relevant interests. Their focused run passed 136/136. The controlled snapshot now enumerates exactly 13 additional credential-free library files and advances its identity from v5 to v6; Worker execution remains disabled. Its independent runtime suite passed 15/15 before the full rerun.

A fresh independent whole-change review found six Important issues and no Critical/minor issues: shared detector consumers, quoted age scope, outer negation/hypothetical scope, the legacy decision-key argument, malformed preview isolation, and recovery cleanup ordering. All were reproduced and fixed in one continuous correction pass. Additional controls corrected evaluation deck inference and the browser-reproduced cancellation/history race. There was no second independent review; passing regressions and the full final suite verify the corrections.

`attempt1-final-root-tests.log/json`, the red/green per-task logs, `review-fixes-*`, `review-cleanup-red-confirmed.log`, and `task7-race-capture-red.log` retain the failed evidence. Earlier development/harness failures remain historical rather than being relabeled passing. The initial broad environment observation using an empty HOME without the installed browser cache is also preserved; it was not a frozen-source qualification.

## Editorial, generated content and release lanes

The original [editorial inventory](READING_PIPELINE_EDITORIAL_REVIEW.md) enumerated **807 coverage rows**: 435 full canon projections, 90 matched-pair projections, 30 direct Major themes, 228 Minor membership/deck renderings and 24 court renderings. The user-directed review above replaces the former blanket human-approval gate; retained human metadata is historical, not a pending task queue. The base corpus remains 145 passages. The matching JSON file records stable source/projection/text identities. Regeneration preserves explicitly human verdicts only for exact matching IDs and text hashes; changed content invalidates approval. No agent check is recorded as human approval.

The frozen synthetic [comparison inputs](../../tests/fixtures/reading-pipeline-comparison-cases.json) contain P01–P18 in order. Private preparation captured **18 exact baseline and 18 candidate final prompts**, fixed reference time, input/prompt hashes and source-use manifests. Both use the exact reviewed baseline/candidate source; all generated output and actual-usage fields remain null with zero attempts. The baseline P17 prompt records its observed **33,784 estimated tokens over the 25,000 application cap**; this is a baseline observation, not successful generation evidence.

The standard subscription sampler currently defines 11 cases. The proposal therefore remains **47 narrative generations**: 36 comparison outputs plus 11 standard samples, using the owner's Claude subscription (Opus 5.5, `xhigh`) with paid API fallback disabled. CLI/provider internal attempt behavior still needs authorized preflight; additional attempts need a separate ceiling. Neither generation lane was run.

The private `live-qualification-inputs.json` also freezes 12 Workers AI queries with resolved relevant/irrelevant canon controls and repeat-cache passes. The proposed maximum remains **24 AI calls including corpus/query/failure calls**. Modal has four proposed generations only after serving-window/tokenizer/reserve inspection; OpenAI has three separately proposed generations. All actual call counts are zero. Deployed settings/bindings/provider traffic and the separately authorized seven-day telemetry denominator remain uninspected.

No commit, push, PR, merge, migration, plugin publication or deployment occurred. No production rollback was performed. The [receipt-aware release/rollback contract](../reading-context-inputs.md#compatibility-release-and-rollback-checklist) remains a requirement for any subsequent authorized release. A later executable/prompt/authoring change reopens its affected qualification and source identity.
