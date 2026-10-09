# Reading gestures: verified finding repairs

This repairs the implementation reviewed at `f6bcfcd` on `codex/reading-gestures-react-bridge`. The [two original reports and their factual qualifications](../../../output/reading-motion/reviews/2026-10-09-outside-judge/README.md) remain unchanged. This record supersedes their remediation status, not their historical observations.

## What changed

| Verified finding | Repair and evidence |
| --- | --- |
| Completed water could remain active indefinitely | A cancellable deadline scheduler rechecks early wakes; settling is anchored to the original deadline. Delayed execution skips expired motion. Deterministic early-timer browser regression and unit tests reproduce the old failure and verify settlement. |
| Interpretations and synthesis depended on fixture strings | Removed memorized returns and Ace/Queen wording from the automatic matcher. Added a generated-document contract, generation prompt, source-bound compiler and React/SSE consumer. Exact quotation spans refer to supported detail IDs; later interpretations require an earlier accepted literal for the same card occurrence/detail. Existing recorded demonstrations retain their authored sidecars. |
| Personal-context links were absent outside authored fixtures | Generated associations can quote the actual question, general reflection, or card reflection. Validation removes unsupported personal quotations without removing the underlying interpretation. Question-only readings work; removing a reflection strips its acknowledgement. |
| Original eight cards bypassed literal safeguards | One clause-aware guard applies to all cards. It rejects the supplied negations and personal metaphors while preserving adjective commas and observational wording such as “You see him holding a lantern.” Closed statements prevent a later negation from retracting an already published detail. |
| New-card validation reused its own examples | Added an independent frozen corpus and evaluated all 11 recorded readings, preserving exact source provenance and misses. Also generated 15 new reading/annotation documents without supplying regex rules or example sentences. Neither result is described as complete semantic coverage. |
| Static desktop detail emphasis was weak | Stronger localized focus retains the image while reducing its surround. Two of Swords uses continuous blade-aligned regions. Reduced motion retains the same detail associations. Pixel assertions are accompanied by inspected screenshots, not treated as perceptual proof alone. |
| Too many card-name buttons | Identity mentions remain observed plain text. The persistent shelf offers whole-card inspection; meaningful passage associations retain visible keyboard focus and hold/release. |
| A shared renderer special-cased The Star | Multi-detail framing now comes from artwork registry composition metadata. The renderer uses the same path for any card. |
| Short-screen crops clipped the Emperor and Justice | Reproduced at 375×568. Compact crops now fit supported mask extents inside the unchanged stage. Whole-card inspection remains separate. |
| WebKit asserted layout before the resized breakpoint settled | Reproduced a stale 106px height before the 96px breakpoint committed. Tests await the expected stage height and use a visible text line for native touch. Product layout was not changed to satisfy a timing assertion. |
| Raw SVG delivery was unnecessarily large | Added attributed, source-hash-checked WebP derivatives for all 78 faces. The React study requests those files; originals and vector overlays remain intact. Total artwork bodies fall from 271.6 MB to 22.8 MB, with only spread cards requested. |
| Automatic matching was English-only | The generated quotation contract is language-independent. Two fresh Spanish readings exercise localized prose with canonical card/detail identifiers. English literal fallback remains explicitly limited. |

## Integration boundaries repaired during verification

- A late semantic document must not release an explicitly held passage. The provider retains the exact still-valid cue in both rendered prose and motion state until release, then reconciles visible generated cues. Changed annotation IDs are re-observed even if the text is unchanged.
- An omitted annotation must not prevent another explicitly named spread card from becoming available. Partial generated coverage retains conservative identity introductions for other named cards.
- A vector document cannot lend geometry to an individual scan-edition card in a mixed spread. Per-card edition checks apply before accepting its detail.
- Non-prefix replacement revokes semantic metadata and held state. Completed text preserves the original whitespace so offsets remain valid when hydrated.
- An explicitly absent recorded reflection is valid input; it removes optional context, not the entire sidecar.

## Evidence, with limits

[Independent fallback evaluation](../../../output/reading-motion/evidence/remediation-2026-10-09/alignment-evaluation.json) compares an exact `f6bcfcd` snapshot with the repaired fallback:

| Measure | Before | After |
| --- | ---: | ---: |
| Recorded card introductions | 51/51 | 51/51 |
| Selected English RWS literal mentions | 22/36 | 23/36 |
| Selected Spanish literal mentions | 0/5 | 0/5 |
| Independent literal positives | 12/24 | 14/24 |
| Negative passages falsely illuminated | 8/22 | 0/22 |

These denominators are selected, explicitly labelled passages. The fallback's remaining misses are retained in the report; there was no tuning to make the held-out set pass. It intentionally emits no interpretive or personal-context claims.

The [fresh generation experiment](../../../output/reading-motion/evidence/2026-10-09-generated-associations/README.md) used the existing Claude subscription, actual Opus 5.5 at `xhigh`, with no API fallback. Fifteen unchanged readings cover 46 distinct cards, two Spanish cases, and seven cases without reflections. All 247 supplied annotations passed structural validation, including 82 interpretations, nine balance cues, 17 relationships and 31 exact personal-context references. Model-authored labels are not a human ground truth. The [qualitative inspection](../../../output/reading-motion/evidence/2026-10-09-generated-associations/semantic-review.md) records wording/span concerns, its partial blinding and same-team status. The original output and failed initial schema attempts remain available; no reading was silently rewritten to improve results.

[Presentation evidence](../../../output/reading-motion/evidence/verified-finding-repairs/README.md) includes desktop/phone crops, resource records and limitations. The sampled Star spread requests 979,088 image-body bytes instead of 9,064,298 source-SVG bytes; the five-card spread requests 1,490,502 instead of 17,209,012. These are payload measurements and successful decode observations, not production network latency or device/GPU benchmarks.

## Open the repaired study

```bash
cd /home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge
npm run dev:frontend -- --port 5174 --strictPort
```

- [Fresh generated reading](http://localhost:5174/__e2e/reading-gestures?study=generated&sample=new-home-rhythm&arrival=gentle)
- [Spanish reading](http://localhost:5174/__e2e/reading-gestures?study=generated&sample=ritmo-compartido&arrival=complete)
- [Original recorded Star](http://localhost:5174/__e2e/reading-gestures?study=star&associations=authored&arrival=gentle)

The lab can compare generated associations with the conservative dynamic fallback. Its controls are study instrumentation. The reading itself has no tracking bar, instructional interaction toolbar, or playback button.

## Release boundary

The feature remains opt-in. This repair supplies the semantic document contract, generation experiment, and a tested consumer for optional `semanticDocument` metadata on SSE meta/delta/snapshot/done events and hydrated readings. The user's subsequent [architecture correction](../plans/2026-10-09-reading-gestures-react-bridge.md#independent-visual-cue-model-production-direction) requires a separate visual-cue model: application orchestration forwards immutable narrative output to it, keeping annotation instructions out of the reading model's prompt. The production reading response format and selected scan edition remain unchanged. The recorded generated study demonstrates source arrival from saved joint-generated output; its live-SSE tests use controlled metadata, not an independent visual-model transport.

Enabling production requires the independent visual-model service, source binding that accepts its lagging exact prefixes, a visual lifecycle that can outlive narrative completion, a compatible explicit artwork edition, latency/cost and human semantic-quality acceptance, and broader device/accessibility verification. The compiler validates exact source, ownership, geometry availability and earlier references; it cannot prove that a model's interpretation is meaningful or psychologically true. No all-card cinemagraph, all-detail visual audit, screen-reader, physical-device or production-readiness claim is made.

## Verification

Final integrated command results are recorded in the adjacent [verification record](2026-10-09-reading-gestures-remediation-verification.md). Historical tests in earlier handoffs are not substituted for these runs.
