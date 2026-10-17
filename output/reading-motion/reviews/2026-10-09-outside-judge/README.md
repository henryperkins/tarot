# Independent outside assessment

Submitted revision: `f6bcfcd17cc52dfe36cea65a286867f8a3e80c95` on `codex/reading-gestures-react-bridge`. Incremental base: `ad8c97ce1962329b263a79d792e3acc66978287c`; bridge context begins at `4c433b9`.

The user requested an outside judgment of both the code and the intended reading experience. Claude Opus 5.5 was invoked through the existing Claude subscription in a fresh session at `xhigh`. No paid API credentials or fallback provider were supplied. The implementation team did not participate in that session.

The [submission brief](submission-brief.md) and [submission metadata](submission.json) preserve the request. The judge received source snapshots, code diffs, original recorded fixtures, vector artwork, product/design contracts and test source. Previous critiques, scores, verification summaries, coverage conclusions, implementation plans, selected screenshots and conversation history were withheld. Customizations, memory discovery, plugins and session persistence were disabled. Read access and bounded test/preview/probe commands were available; application edits were not authorized.

This method reduces anchoring and separates the evaluator from the authors. It does not establish that an AI reviewer is free of bias, replace human user research, or certify production readiness. No implementation changes are part of this review request.

## Reports

- [Outside judge report, preserved verbatim](judge-report.md): conditionally playable feature checkpoint, partial intent fit, not production ready. The judge recommends keeping the presentation layer and changing the source of semantic associations.
- [Additional external review supplied by the user, preserved verbatim](additional-external-review.md): accept with reservations, with semantic, delivery and mobile/testing concerns. Its reviewer identity, tools and execution history were not supplied with the document.
- [Comparison and evidence qualifications](review-comparison.md): separates agreement, verified facts, reviewer judgments and unconfirmed claims.

## Execution evidence

The outside review completed successfully on October 9, 2026, using `claude-opus-5-5` at `xhigh`. The judge ran four focused unit commands (49 tests passed), six completed passage probes and 13 Chromium capture runs (63 screenshots). These counts come from tool results; the report's self-reported capture/probe counts differ.

- [Original execution receipt](receipt.json) and [verified provenance](provenance.json), including the SHA-256 of the unchanged report.
- [Selected tool commands and results](investigation-results.json), excluding the raw conversation, internal reasoning and authentication output.
- [Observation records and screenshots](observations/), [capture helper](capture.mjs), [capture usage](capture-help.txt), [passage probe helper](probe.mjs), and [review system prompt](system.txt).

Two Bash requests were denied by the bounded tool policy: a broad shell inventory and a piped passage probe. Native file tools remained available; six direct probes completed. The judge did not run the Playwright suite, generate live readings, assess physical devices, measure frame rate, or evaluate screen-reader output. Captures are headless Chromium stills, not video. No WebKit capture was executed. The helper does not scroll automatically, so offscreen phone streaming choreography was not observed.

Original observation paths beginning `/tmp/tableu-outside-judge-qmewvi77/observations/` map to the matching files in this directory. Snapshot-relative source references refer to the submitted Git revision. The helpers retain their original machine paths and port; replay requires the submitted revision, dependencies and preview at those locations. They are evidence of the investigation, not a portable test harness.

## Factual corrections to the outside judge report

The report is unchanged. These corrections concern its evidence description, not an automatic dismissal of its findings:

1. There were 13 completed captures, not 14; six completed probes plus one denied attempt, not seven completed probes.
2. `receipt.json`'s `assistantTurns: 175` counts streamed assistant events. The terminal CLI result reports 93 turns.
3. The average pixel-difference assertion cited as `reading-gestures-refinement.spec.js:152` is at line 35 in the submitted revision.
4. The packet included `data/evaluations/narrative-samples.json` with 11 recorded generated readings, including newly covered RWS cards. The claim that none were supplied is incorrect. Their presence does not establish successful semantic alignment, and the judge did not report evaluating those samples.
5. The proposed cause of the stuck animation timer is explicitly an inference. The retained observations show the active state persisting; they do not establish that timer rounding is the cause.
