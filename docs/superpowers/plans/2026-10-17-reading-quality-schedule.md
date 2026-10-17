# Reading quality implementation schedule

Status: scheduling approved on 2026-10-17. Implementation, private historical
queries, evaluator replay, and activation remain separate decisions. This file
orders the work preserved in the [reading-context plan](2026-10-08-reading-context-fixes.md)
and [rubric specification](../specs/2026-09-28-eval-rubric-2.5.0-design.md).

Start after the approved browser/release, Tailwind migration, and separate
Spacefast compatibility work. Use the verified master at that point as the
implementation baseline. The sequence below is a dependency schedule, not a
calendar commitment; no implementation or model replay has started.

## Queue and acceptance

| Order | Work package | Dependencies and scope | Exit evidence |
| --- | --- | --- | --- |
| 1 | Context intake — Task 0 | Obtain permission for the four historical reads, or accept owner-supplied answers. Confirm provider, depth, timezone, name usage and memory provenance. Keep private data outside Git. | A bounded private fact record that resolves or explicitly retains each original finding; no inferred absence of deleted memories. |
| 2 | Context foundations — Tasks 1–6 | Synthetic four-draw regressions first, then imagery, independent timezone/date handling, one closing instruction, accurate source provenance and exports. | Regression cases cover both truncation branches, timezone without coordinates, forbidden imagery and exact exported context. Tests/lint and subscription narrative gate pass. |
| 3 | Gate coverage — Task 13 | Extend the narrative gate for the failure modes in package 2; retain the same cases for later prompt changes. | Baseline case identities, expected invariants and subscription results recorded privately; thresholds unchanged. |
| 4 | Context behavior — Tasks 7–11 | Orientation/position notes, sanitized decision labels through retrieval and provenance, subject-safe memory ranking, useful timing and plain language. Resolve memory budget and default timing-line choices before their dependent changes. | Synthetic ambiguous-subject, reversed-card, unnamed-path and truncation cases pass; exact sent prompt/provenance agree; narrative gate rerun on the new prompt version. |
| 5 | Length observability — Task 12 | Confirm the historical depth finding from package 1. Add telemetry independently of any enforcement floor. | Metrics distinguish configured depth, intended band and observed length; no new fallback or rejection until the owner chooses enforcement. |
| 6 | Optional reader features — Tasks 14–16 | Owner chooses continuity default and path inputs first. Implement continuity, decision-path persistence/UI/exports and repeated-rank retrieval as separate reviewable changes. | Continuity bounds and ownership tests; path labels survive reload/deep link/search/all exports; generic/Marseille rank deduplication happens before passage caps. |
| 7 | Rubric implementation | Separate branch and offline tests; coordinate the next evaluator version with context Task 8. Preserve baseline transport, deterministic overrides and gate behavior. | Rubric anchors, bounded quote validation, synthesis, caps, computed overall, reversal/deck inputs and storage tests pass; no model calls. |
| 8 | Paired replay preparation | Depends on package 7 and its independent review. Locate the 22 frozen schema-v2 payloads or obtain authorized replacements. Prepare a separate replay plan and blind human-score packet. | Pinned source/runtime, private input hashes, baseline/candidate prompts, lane settings, repetitions, timeout and full proposed call/cost budget are reviewable before approval. |
| 9 | Rubric replay and release | Requires explicit final replay-budget approval and blind human adjudication. Merge only after the specification's criteria pass. | Evidence coverage at least 95%, no worse invalid-answer rate, no new blocked readings, gate p95 at most 12 seconds and agreement no worse than baseline beyond run-to-run noise. |
| 10 | Post-release observation | Starts only after rubric deployment. | One week of scoped monitoring and a recorded keep/revert decision; deployment identity and observed behavior reported separately. |

Packages 7–8 can be prepared alongside context work after implementation is
authorized. Freeze their comparison inputs and versions before replay; do not
change generation prompts inside a paired evaluator comparison.

## Decisions required at the relevant boundary

- Before package 1: authorize the exact read-only historical queries or provide
  the answers; identify the two decision options and the reason for the re-ask.
- Before package 4: choose the memory-note budget and whether to remove the
  default timing line. Task 8's prompt rule can precede optional path inputs.
- Before package 6: choose continuity on/opt-in/off and whether to add the two
  optional path fields. Keep length telemetry separate from a later floor.
- Before package 9: approve the complete replay budget for both current
  evaluator lanes and supply blind human scores. The historical 132-call
  estimate covered one configuration and is not the approved budget.

No pending decision blocks the already approved maintenance work. Collect these
choices with the concrete implementation/replay proposal when that package is
ready to begin.

## Versioning and verification

At scheduling, the reading prompt is `1.2.0` and the evaluator is `2.4.0`.
Recheck both before implementation. Reserve one prompt version per prompt PR
and a matching `VERSION_HISTORY` entry; treat `1.3.0`, `1.4.0` and evaluator
`2.5.0` as proposed numbers until confirmed unused. Context Task 8 and rubric
implementation must not independently claim the same evaluator version.

Run `npm test` and `npm run lint` for implementation PRs, plus the affected
function tests. Prompt changes require `npm run ci:narrative-check` through the
owner's Claude subscription, without paid API fallback. Documentation changes
use `npm run docs:check`. UI/persistence work also needs ordinary-route browser
coverage, real local Pro authentication and current accessibility checks.

Use additive migrations with the next available number. Apply them before
deploying code that reads new columns. Keep local tests, subscription narrative
qualification, authorized evaluator replay, deployment and live verification
as separate evidence. GitHub Actions billing availability is not a prerequisite.

The maintained source plans remain the detailed requirements and acceptance
criteria. Check off their implementation tasks only when the relevant code,
tests and review have landed; scheduling does not complete those tasks.
