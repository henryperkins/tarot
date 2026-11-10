# Coach AI refinement hardening — 2026-10-23

The authorized follow-up is implemented locally on base `680516f0c13054f1a86b3f60d824e46427dec803`. At the time of this review it had not been committed, pushed, or deployed. See the [working-change handoff](2026-10-23-working-change-handoff.md) for the later Git publication scope. The candidate runtime identity used for live qualification is `503fba765aca587e69676202891bb64edfa9148aeaee4aa48e127f6f37095a6d`; the exact five runtime file hashes are retained in the request ledger.

Existing-question refinement now uses its own minimal-edit prompt. Only the question and optional explicit reader detail enter that prompt; default topic/timeframe/depth, spread structure, journal history/recommendations, seed-driven variation and astrology do not. Refinement skips ephemeris fetching. Clear text can remain unchanged, and the prompt preserves the original language, perspective, people, concern, goals, negation and literal timing. Fresh generation retains its prior prompt and forecast behavior.

The candidate validates the final displayed text inside the observed inference operation. A pure timing helper preserves confidently recognized English/Spanish timing phrases, calendar/ISO/numeric dates, boundary/negation words, durations, ranges, clock times and timezones literally. A separate conservative content guard rejects new unsupported vocabulary, missing/reordered body anchors, role/perspective changes, changed negation or constrained goals, changed concrete/name literals, and excessive expansion. It retains declarative facts and scoped goals as complete clauses. Only narrow outer frames and source-activated equivalences are editable; the approved career self-doubt expression is an isolated exception that cannot erase another stopping goal. Past actions are not canonicalized to present tense.

This is a conservative constraint guard, not semantic understanding. Useful unfamiliar paraphrases may be rejected. Timing recognition is bounded and does not infer language from Latin script. Optional detail is not automatically an affirmed fact and cannot authorize arbitrary new substantive content. The original remains editable and applicable regardless of a rejected refinement.

Rejected suggestions return the exact original as `local-preserved` with no model or forecast in the public result. The consumed attempt retains provider/model/token provenance as rejected with `quality_rejected`, while the daily feature reservation is released. This rejected state is an explicit opt-in for refinement; other short-task failure accounting remains unchanged. The coach's fallback copy now truthfully says the wording was kept, without falsely reporting a provider outage.

The old generic sanitizer removed Spanish diacritics while filtering instructions. Refinement now preserves raw Unicode, punctuation-bearing entities such as C#, and literal timing whitespace. Instruction-like text, including a legitimate quotation, is retained exactly without dispatching a model call or creating usage/attempt records. Overlong input is rejected before dispatch rather than silently truncated.

## Regression and local verification

- Full root suite: **4,637 passed, two skipped, zero failures** (4,639 total).
- Focused prompt/route/helper/client/provenance suite: **110/110 passed**.
- New route integration coverage: **26/26 passed**, including captured silence/week drift, same-time invented silence, people/date/deadline/time changes, unsupported new timing, scoped no-contact preferences, separate stopping goals, role swaps, valid minimal edits, fresh-generation parity, Unicode/quotes/C#, no-dispatch preservation, provider failure and cancellation.
- Literal timing tests: **16/16 passed**. Content preservation tests: **14/14 passed**.
- Changed-file ESLint and whitespace checks passed. Frontend production build passed. Worker deployment dry-run/bundle passed without publication. Documentation link validation passed in the isolated checkout.
- Behavioral RED evidence precedes the implementation. Independent review found leaks involving separate stopping goals, multi-clause roles, names/tense, new concrete entities and past-tense canonicalization. These were reproduced as failing regressions and corrected before live calls.

## Fixed six-case live sample

Six explicit requests were sent once each to the configured Workers AI question model `@cf/zai-org/glm-5.3`, at `high` reasoning effort and `max_tokens: 8192`, with no agent retries. The fixed order, exact prompts, conflicting synthetic defaults, request hashes and candidate runtime hashes were saved before dispatch. Only final answers and usage were captured; model reasoning was not consumed.

| Case | Raw live answer | Candidate delivery |
| --- | --- | --- |
| Captured sister concern, “this week” | Exact original | Accepted unchanged; no invented silence or timing change |
| Career self-doubt | Exact original | Accepted unchanged |
| Interview on November 6 at 3:30 p.m. CDT | Exact original | Accepted unchanged, including date/time spelling |
| Already-clear career question | Exact original | Accepted unchanged |
| Guaranteed partner return, “this week” | “What can I do to help my partner come back to me this week?” | Outside the conservative editing envelope; exact original preserved |
| Spanish sister concern, “esta semana” | Exact original | Accepted unchanged, including accents |

All six delivered questions were byte-identical to their originals: five were unchanged model responses and one was a guard fallback. The guarantee refusal demonstrates conservative preservation; it does not establish that the raw paraphrase was semantically worse. Unit regressions also show that narrow sister and career edits can pass, but this live sample did not produce an accepted changed question.

Each real final answer was replayed once through the unchanged candidate route using a local seeded Pro D1/session fixture, with external fetch disabled and exact request/runtime hashes checked. All six constraint, response, reservation and inference-ledger checks passed: five accepted/completed, one rejected/released with actual usage retained. This is **live provider output plus candidate route replay**, not production authentication or a deployed endpoint test. A manual raw/delivered comparison is recorded separately; no automatic semantic grade was assigned.

Observed provider usage totaled 1,773 prompt tokens and 284 completion tokens (2,057 total). This was a six-case preservation check, not a broad model-quality or rewriting-effectiveness qualification. No Claude narrative gate, paid narrative API fallback, production account content, or deployment was used.

## Preservation and evidence

Work was isolated under `/home/ubuntu/.cache/tableu-coach-meaning-guard-20261023T073251Z/checkout`. The task manifest and before/after hashes are retained beside it. Only task-owned files are copied into the primary checkout after verifying its originals against the baseline. All 79 pre-existing unrelated files, their Git status and staging entries are checked for exact preservation; existing user refs, worktrees and stashes are retained.

Evidence directory: `/home/ubuntu/.cache/tableu-coach-meaning-guard-20261023T073251Z/`. Key files: `route-regressions-red-expanded.log`, `review-guard-red.log`, `tense-red.log`, `final-focused.log`, `final-unit.log`, `final-lint.log`, `final-build.log`, `worker-dry-run.log`, `live-requests.json`, `live-responses.json`, `live-replay.json`, and `live-editorial-review.json`. The original deployment's live failure remains preserved in the separate production release evidence.
