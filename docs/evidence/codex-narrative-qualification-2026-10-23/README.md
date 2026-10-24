# Fresh Codex narrative qualification for 98106dd8

Type: evidence
Status: historical snapshot
Last reviewed: 2026-10-23

Result: **PASS**. All 11 freshly generated readings passed the maintained narrative metrics gate with its original default thresholds. The four automated rubric averages (accuracy, coherence, agency, compassion) were 100%; these are repository heuristic scores. Codex also reviewed all 11 outputs and found no blocking issue.

Source commit: 98106dd895d7c57874614b356f17287681c2e1b5. At verification time, production Worker tableau was serving version af8edd91-5a28-4f15-a3db-3d68838fe651 at 100% traffic, verified 2026-10-24T00:48:26.401Z. The production prompt and scoring sources match that commit. The runner repair described below is published with this report; the qualification target remains the earlier deployed commit.

Generation used ChatGPT subscription authentication, pinned Codex CLI 0.162.0, configured model gpt-6.1-sol and xhigh reasoning. The CLI exec protocol labels model evidence as configured; it does not provide an authoritative upstream model identifier. No paid API fallback was used.

Each sample uses the production generateWithClaudeApi prompt builder with only its send transport replaced by runCodexSubscription. The unchanged default 11-case corpus uses the fixed reference instant 2026-09-23T14:04:00Z. Model generation finished 2026-10-24T00:47:48.924Z. Codex was given no explicit output-token cap; the runner retained its 2 MiB byte limit and a 600-second request deadline. Every retained response completed the runner protocol checks and contains a closing.

Seven completed outputs survived the task interruption. The unfinished Marseille attempt had no retained completion and is recorded in qa-provenance.json; its identical prompt was verified before retrying. The other completed readings were not regenerated. All individual readings, aggregate readings and prompt hashes were independently verified.

| Narrative measure | Result | Default requirement |
| --- | --- | --- |
| Story-spine completion | 100.0% | At least 90% |
| Average card coverage | 100.0% | At least 90% |
| Accuracy and coherence heuristic averages | 100% each | At least 85% each |
| Agency heuristic average | 100% | At least 80% |
| Compassion heuristic average | 100% | At least 85% |
| Flagged samples and all issue counters | 0 | 0 |

Zero counters include deterministic claims, missing agency, hallucinated cards, suit-count mismatches, harsh tone, missing supportive language, unaddressed questions and templated card-section repetition.

| Fresh case | Deck | Cards | Characters | Result |
| --- | --- | ---: | ---: | --- |
| single-new-role | rws-1909 | 1 | 2179 | PASS |
| three-card-transition | rws-1909 | 3 | 4124 | PASS |
| five-card-creative-project | rws-1909 | 5 | 5260 | PASS |
| relationship-checkin | rws-1909 | 3 | 4044 | PASS |
| celtic-deep-shift | rws-1909 | 10 | 8631 | PASS |
| decision-crossroads-long-reflections | rws-1909 | 5 | 5724 | PASS |
| spiritual-thoth-ritual | thoth-a1 | 3 | 4128 | PASS |
| wellbeing-marseille-reset | marseille-classic | 5 | 5312 | PASS |
| relationship-hypothetical-collaborators | marseille-classic | 3 | 4074 | PASS |
| celtic-general-focused-week | thoth-a1 | 10 | 7594 | PASS |
| non-english-spanish | rws-1909 | 3 | 3885 | PASS |

The default corpus contains 0 saved-memory personalization cases and no vision cases. Semantic GraphRAG scoring fell back to keyword scoring because the standalone evaluation process has no Workers AI binding. This is a direct-backend Codex qualification; production Claude/Modal requests, fallback routing and end-to-end live reading jobs were outside this run. The default Claude-only release command remains unchanged.

The repaired runner previously set sqlite_home to a fresh directory for every request. CLI 0.162.0 then backfilled existing host rollouts before starting the turn, exceeding both installed-CLI fixture deadlines. Removing that override retains the initialized native store while preserving --ephemeral, disabled history persistence, request-file isolation, disabled tools and suppression of host instructions. The fixture session left zero thread metadata rows in the host database. The native saved login worked for real inference after this repair; the stale WSL login was not used.

Both installed-CLI isolation tests passed after the repair (plain exec and app-server streaming). They verified no exposed tools, no host instruction context, no authorization header sent to the unauthenticated fixture, no hostile hook/MCP execution, and streaming before completion. Targeted ESLint and whitespace checks also passed.

The deterministic prompt gate passed 849 fixtures, 2,523 provider builds, 30 partial pairs, 10 complete triads, 525 canon/deck projections and 12 boundaries.

The full root suite was run in the Linux verification checkout with the runner repair: **5,426 passed, 1 failed, 2 skipped**. The failure was tests/readingCueValidationRuntime.test.mjs:97, “cold startup serves callable development JSX after the production build, with optimized DEV false”: the frontend listener missed its 60-second deadline. The identical test passed alone in about 35 seconds. Both original failure and isolated rerun evidence are retained; the full run is not reported as green.

Pre-push publication validation on 2026-10-23, after preserving the independent coach-wording commit a0ff83d3 on master: **5,428 tests passed, 0 failed, 2 skipped**. Both installed-CLI isolation tests, targeted ESLint, 238 maintained Markdown link checks, whitespace validation and the retained narrative gate passed. These results are recorded separately in [publication validation](publication-validation.json); the earlier qualification failure remains preserved above.

At the end of qualification, the runner repair was uncommitted. This evidence bundle is published together with that repair. No deployment command was run for this publication.

Evidence: [receipt](qualification-receipt.json), [fresh readings](narrative-samples.json), [metrics](narrative-metrics.json), [gate output](gate.txt), [provenance](qa-provenance.json), [manual review](qualitative-review.json), [integrity checks](integrity-verification.json), [test summary](test-summary.json), [runner patch](runner-repair.patch), [CLI diagnosis](cli-diagnosis.json), [synthetic prompts](narrative-prompts.json), [validation extract](validation.txt), and [publication validation](publication-validation.json).

Automatic approval review rejected removal of the local temporary diagnostic database copies with “blocked by policy”. They remain outside Git and are excluded from the qualification manifest.

Portability: published JSON replaces host-specific paths with repository-relative references. The [portability manifest](portability-manifest.json) records original and published artifact hashes. Narrative text, prompt content, metrics, thresholds and historical check outcomes are unchanged. The historical receipt records the state before publication. The 11 prompt records are aggregated without changing their contents; no account credentials, real user readings, session files or diagnostic databases are included.
