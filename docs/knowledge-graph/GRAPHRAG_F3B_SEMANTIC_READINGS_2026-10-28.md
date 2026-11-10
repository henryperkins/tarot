# F3b paired semantic-reading qualification — October 28, 2026 UTC

## October 31 current disposition: 1.6.10 correction verified offline; no generation run

The three corrections proposed below are implemented in the same uncommitted 66-file overlay on `a030467351b2374a9c9a1d933eecc0498abcaca3`, and prompt version 1.6.10 is recorded. Thirteen overlay files changed in this phase: seven source files and six tests. Evidence root: `/home/ubuntu/.local/state/tarot/f3b-contract-relationship-tallies-v1610-20261031T194543Z`, including a pre-edit recovery of all 66 files, RED/GREEN logs, prompt probes and check receipts.

| Correction | Source change | Regression evidence |
| --- | --- | --- |
| Relationship "Them" card | The system clause, the three intros and two frames, a custom "Them" role fallback and the position note offer a symbolic possibility to compare with anything actually observed. They describe neither the querent's experience nor the other person's stance, and the condition holds through headings, synthesis and closing. The wording avoids presupposing observations, because one standard case asks about hypothetical collaborators. | Tests cover every template variant, a custom role, the provider prompt with position notes, and the local composer. |
| Scene contract | The contract shows `{"type":"fact","id":"ID","language":"en"}` and `{"type":"interpretation","id":"ID","language":"en","text":"..."}`. The system style rule says every reference needs id and language. The renderer is unchanged. | A test parses every documented block shape and requires the strict renderer to accept it. The observed 1.6.9 shape is still rejected. |
| Aggregate claims | `getDrawnCardTallies` uses the theme analysis's element and orientation rules. Multi-card prompts name reversed cards and each element's cards; for the Celtic case, Earth 2 is The Hermit and Eight of Pentacles, and 3/10 are reversed. A card without a mapped element is named rather than dropped. | Tests cover counts matching `analyzeSpreadThemes`, zero counts, single-card omission and budget drop order. |

**Budget behavior is unchanged.** Two calibrated fixtures had almost no headroom: the summary-only boundary fit at 6,187 of 6,200 tokens, and the receipt fixture's summary window began 50 tokens below its tested 16,000. A first draft displaced both, so the tally line became the first budget-fitting removal (soft and hard cap) and the protected contract wording was shortened to a net 15 characters. Both windows now match 1.6.9 exactly. Prompt assembly differs from 1.6.9 only in one extra slimming-boundary step and the version.

Source checks: **6,221 root pass / 0 fail / 2 skip (credential-free); 70 Worker pass; 874 fixtures / 2,541 provider builds; build, lint of all thirteen changed files and 237-file documentation check pass.** Offline probes of the eleven standard prompts show only the intended lines changed, no fitting steps, and an unchanged single-card prompt.

**No provider, embedding or paid API call was made; no standard, pilot or semantic run was started.** The 1.6.9 halt receipts, outputs and judgments are unchanged. Of the planned qualification, six standard and all eighty semantic calls remain unstarted.

### Gate scope, recorded for the next decision

The standard lane uses keyword fallback, not the semantic retrieval path F3b changes. Correction rounds 1.6.3–1.6.9 made 77 fresh subscription calls (28 semantic, 49 standard). Each round halted on a different content fault, and most of those faults were inherited from production wording or imagery rather than caused by retrieval. The exception is the 1.6.9 Celtic rejection: the strict scene-fact transport that rejected it was added by this overlay in 1.6.6, and it can fail a whole reading that includes one of four covered cards. Whether the absolute standard gate should keep blocking the paired comparison, or whether the reading-text corrections should be separated from F3b, is an open owner decision.

## Historical October 31 disposition: 1.6.9 canon/Unicode correction qualified locally; generated standard gate failed

The owner approved the bounded imagery/Unicode checklist and gated resumption. Work remains an uncommitted **66-file overlay** on isolated HEAD `a030467351b2374a9c9a1d933eecc0498abcaca3`. The frozen source-manifest SHA-256 is **`204433e29b07fd7158f0963e6a0a6fbbb3272e97ac29e850a09b9a65d24367ff`**. Baseline remains the pre-fix rebased GraphRAG source, not production master. No staging, commit, merge, push or deployment occurred.

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-canon-unicode-v169-20261031T183926Z`.

### Corrected source and coverage

The supplied-image inventory covers the fixed eleven standard cases plus forty-six eligible semantic cases: **83 card/deck combinations (44 RWS, 18 Marseille, 21 Thoth)**. All 44 matching RWS scans were directly inspected; actual final reference prose was distinguished from raw unprojected retrieval suffixes. Twelve imagery hooks and corresponding symbol labels lose unsupported precision, including Tower gray sky, Fool/Death sunrise, Temperance sunrise, Three of Pentacles noble/cathedral identity, Nine of Swords sudden motion, and other verified pose/object details. Interpretive language remains explicitly separated. Retrieval texts, labels, thresholds, caps and weak-floor rules are unchanged. This is bounded supplied-input evidence, not certification of the entire catalog or unrendered metadata.

The shared instruction filter now matches a separate normalized search representation and replaces only matched original spans. Benign accents, marks, scripts and emoji survive accepted question/role projections; dangerous patterns and the existing unsafe-role rejection remain. Independent review reproduced an Important cross-grapheme Hangul contraction that discarded surrounding text. A regression first failed, then passed after intermediate normalization boundaries were mapped back to original spans. Full-suite findings also corrected the question-refinement consumer's comparison with normalized text and explicitly retained the prior private question/reflection retrieval normalization, including newline exclusion boundaries. The original accepted narrative fields remain separate. No frozen embedding was replaced or requested again.

Source qualification: **6,208 root pass, zero fail, two skips; 70 Worker pass; 874 fixtures / 2,541 provider builds; build and changed-code lint pass.** Maintained documentation checks pass. All 399 unsafe-pattern/obfuscation/Unicode-boundary combinations retain the previous normalized security result; dedicated final-provider tests cover benign Unicode and the reviewed contraction. The original failed checks are retained. The single fresh source reviewer did not rereview the later parent fix bytes. Minor M1 remains explicitly deferred: inventory `suppliedSymbolStrings` arrays are prompt-wide groups nested under card rows; they do not establish per-card ownership. No missing runtime audit claim was demonstrated. Existing CRLF source endings were preserved; whitespace checking passes with `cr-at-eol` recognized.

### Frozen inputs, review settings and reuse

Against 1.6.8, **41 candidate semantic prompts and six standard prompts change**. All 46 candidate prompts still differ from the fixed baseline. All 46 baseline prompts, original scenarios, and both arms' complete retrieval payloads/scores/weak flags/embedding-input hashes remain unchanged, excluding only nondeterministic `retrievalElapsedMs`. All 46 final candidate question contexts retain the exact accepted query. Shared reversal framework, guidance and subscription settings are verified equal across both arms and supplied in initial review packets. The original hard-check, anchored quality-score and acceptance text is byte-identical; Japanese language quality alone remains waived.

All twelve baseline outputs are retained byte for byte and revalidated against exact source, prompts, scenario, configuration, formatter and actual route-local gate. They are reused regardless of content verdict, not selected for taste. The pre-output freeze binds 421 artifacts. Twelve dispatch-refusal and eight capture/interrupt checks pass with a fake provider; subscription authentication is verified without inference. The new-run ceiling remains eleven standard plus eighty semantic calls, one attempt/output, maximum two concurrent semantic calls. Previous roots and halt receipts remain intact.

### Actual standard run and complete review

The literal `npm run ci:narrative-check` used the owner's Claude subscription with `claude-opus-5-5`, `xhigh`, 32,000 maximum output tokens, no paid API fallback and no retries. It made **five actual first calls**. The fifth CLI completed successfully as a process, but the exact canonical-fact validator rejected its response and the CI exited **1** at **19:14:56 UTC**. The relationship content-review halt was independently recorded at **19:15:15 UTC**, after that technical stop; it did not cause the earlier rejection. All five original CLI outputs and exact actual prompts/configuration are retained. The snapshot's three historical evaluation artifacts were restored byte for byte after the run.

| Case | Actual disposition |
| --- | --- |
| `single-new-role` | Valid complete consumer/display, independent pass; scores 3/3/3/3. |
| `three-card-transition` | Valid complete consumer/display, independent pass; scores 3/3/3/3. |
| `five-card-creative-project` | Valid complete consumer/display, independent pass; scores 3/3/3/2. |
| `relationship-checkin` | Valid complete consumer/display, confirmed factual-scope failure; scores 3/3/2/2. |
| `celtic-deep-shift` | Complete original provider response rejected by strict transport validation; no consumer/display. Complete raw-prose diagnostic is separate from consumer qualification. |
| Six other fixed standard cases | Unstarted, with no replacement output or implied pass. |

The confirmed relationship failure is: **“The Knight's directness, as you experience it, can be met with clear words instead of being soaked up.”** The user supplied uneven communication and a wish to ground before reacting. Earlier fast/direct exchange was hypothetical; the synthesis presupposes that experience. The optional response does not qualify the asserted experience. An earlier disclaimer and otherwise useful reading do not satisfy the unchanged local-condition rule.

The Celtic response's zero-based block 2 has `type: "interpretation"` and `text`, but omits `id` and `language`. The unchanged renderer returns `invalid_card_fact_reference`. No field was filled in, no block was relabelled and no substitute consumer was produced. Diagnostic review of all raw prose also records **“the two reversed cards”** twice despite three supplied reversals (Five of Wands, The Moon, Nine of Swords). Its “only Earth card” assertion is preserved as unresolved in the initial independent diagnostic. A separate post-review addendum confirms it false against the selected application mapping: The Hermit and Eight of Pentacles are both Earth, and the frozen payload counts two. That full Earth total and explicit Hermit association were not exposed in the actual final prompt; the evidence does not establish that the model ignored an explicit Earth=2 instruction. Neither raw prose score nor correct passages can clear invalid transport.

The reviewer inspected complete strings and every authored prose section, verified 22 card occurrences against 21 distinct matching primary scans, and checked uncertain details against original texts. The known display blank loss, duplicate symbolic lead-in and broad pause advice remain nonblocking/deferred. Four exact raw-to-consumer and route-local structural checks pass; their inability to reject the relationship claim is an observed coverage limit, not content clearance.

### Gate disposition, preservation and bounded follow-up

**F3b stays open. Six standard calls and all eighty fresh semantic calls are unstarted; no current semantic pair exists.** Twelve old baseline outputs alone do not complete a pair. The actual semantic pilot entrypoint refuses the negative standard clearance without provider invocation, reservation, or changes to its thirteen generation files. The fixed five-pair pilot and remaining forty-one pairs were not attempted. All model output, failed/unresolved judgments and halt receipts remain immutable. No new embeddings or paid narrative API calls occurred.

The verified recovery patch/archive reconstruct the complete owned overlay outside Git. Final preservation checks cover all fifteen worktree HEADs/staged entries, fourteen unrelated indexes/statuses, all refs/stash, forty-six unrelated hashes and the journal performance test (`ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`). Final documentation changes are separately accounted for from the frozen generation source.

The next proposal is specific and **not implemented in this phase**: (1) correct the relationship-flow instruction that still treats the Them card as the querent's experience, retaining local conditions through synthesis; (2) provide the complete `interpretation` object shape in both compact/full contracts while retaining strict ID/language authorization and existing budgets; (3) investigate aggregate reversal/element claims against deterministic spread facts without changing drawn cards or accepting unsupported totals. The current relationship clause and compact schema shorthand predate this phase; one new sample does not establish that the canon/Unicode correction caused either observed failure. Another source revision must retain these failed samples and pass the standard complete-content gate before any fixed pilot or remaining-matrix dispatch.

Key evidence: `imagery-audit.json`, `review/source-review.json`, `review/source-review-reconciliation.json`, `changed-input-inventory.json`, `generation-freeze.json`, `standard/ci-receipt.json`, `review/standard-independent/standard-independent-summary.json`, `post-halt-technical-validation.json`, `manual-review-halt.json`, `pilot-dispatch-refusal.json`, and final preservation/recovery receipts in the evidence root.

## Historical October 31 disposition: 1.6.8 imagery correction implemented; content qualification halted

The owner approved the bounded imagery correction and resumption under the unchanged criteria. Prompt **1.6.8** remains an uncommitted **58-file overlay** on isolated HEAD `a030467351b2374a9c9a1d933eecc0498abcaca3`. The frozen source-manifest SHA-256 is **`8e923a801546067b7a63be8c66edeb3b7bca0518ed35ea728646279e299a720c`**. This is a comparison against the pre-fix rebased GraphRAG source, not production master. No staging, commit, merge, push or deployment is authorized or performed.

### Implemented scope and source evidence

Two bounded primary-image observations join the existing Hierophant/Thoth Art inventory: the RWS Eight of Cups traveler has an uncovered head and red cloak, and the Hermit holds a lantern containing a star. The [Eight of Cups scan](https://commons.wikimedia.org/wiki/File:RWS1909_-_Cups_08.jpeg) and [Hermit scan](https://commons.wikimedia.org/wiki/File:RWS1909_-_09_Hermit.jpeg) were independently viewed. Sixteen new captions across eight languages retain those bounded propositions; they make no claim about a lantern's illumination distance.

Every fact includes its owning card. Covered cards suppress competing unreviewed imagery, including the previously bypassing Minor/custom-role paths. Other model-facing hooks distinguish their card's visual description from sensory metaphor. Shared helpers retain natural consumer prose for the local composer and honor the existing omit-imagery budget control. An optional validated interpretation block renders a fixed caption followed by a localized symbolic lead-in and the model's full interpretation. Unknown/undrawn/wrong-deck references, unsupported locales, missing final-prompt evidence, extra fields and internal reference leakage fail before consumer return. **The renderer does not validate the truth of arbitrary prose.** A false attribute can still appear inside an otherwise valid interpretation, so complete reading review remains mandatory.

The single independent source review covered the initial nine-file phase revision. It found two new Important regressions: prompt growth displaced an existing GraphRAG summary at the unchanged budget, and source/projection labels leaked into complete local-composer readings. The coordinator's one RED/GREEN fix pass shortened the prompt footprint, preserved the existing summary/caps, and restored natural consumer wording. The original review and hashes are preserved; they are not represented as independent approval of later fix bytes. The final phase delta spans twelve files, with 26 new imagery regression tests.

An inherited Important defect remains **open**: the existing instruction filter removes benign accents from questions and custom roles (for example, `¿Cómo` becomes `¿Como` and `Custom café` becomes `Custom cafe`). Both frozen 1.6.7 and 1.6.8 reproduce it. No sanitizer change was made in this bounded imagery phase. Original qualification case inputs remain exact, but byte-exact projected Unicode preservation is **not** established; the Japanese prose waiver does not excuse this defect.

| Source check | Final result |
| --- | --- |
| Credential-free root suite | **6,149 pass / 0 fail / 2 skip**, 6,151 total |
| Worker graph/spread/alert lane | **70 pass** |
| Prompt assembly | **874 fixtures / 2,541 provider builds**, unchanged fixtures and budgets |
| Targeted final retention/local-consumer boundaries | **8 pass**, also covered by the full root suite |
| Build / changed-code lint / pre-generation docs | Exit0; **232** maintained Markdown files |
| Harness | **12 refusal checks + 8 capture checks**, zero real calls; initial directory-creation race retained |
| Baseline reuse | **12** original outputs byte-verified and revalidated through actual current route gates |

Source review explicitly did not certify the entire hook/catalog inventory, native editorial fluency in eight languages, fresh generated content, production/device behavior, provider reliability, or live streaming latency. The plan ledger records each limitation and its disposition. The two new source findings are fixed; the inherited normalization defect and full-content gate are not waived.

### Actual standard generation and content halt

The literal `npm run ci:narrative-check` used the owner's Claude subscription (`claude-opus-5-5`, `xhigh`, max 32,000 output tokens), one attempt per case. It produced **five actual completions**, then exited **1** after the sixth dispatch was refused by the persistent content halt before inference. The generic runner error mentions login/usage, but this is a documented content refusal, not an established authentication failure. The three historical default evaluation artifacts were restored byte for byte; current outputs live only in the phase evidence archive.

All five exact CLI transports reconstruct their complete consumer strings, and all five pass actual route-local structural/card checks. These are partial technical diagnostics, not a successful standard content or CI gate. Independent full-content review retains every initial judgment before prompt provenance and primary-image addenda.

The confirmed blocking reading is `three-card-transition` (consumer SHA `1f19209074dd6c703bd2cdae705d6da6511287f577a87387d7cc5b074773c9b1`): **“flaming debris crosses a gray sky.”** Both the independent reviewer and coordinator viewed the selected [1909 Tower scan](https://commons.wikimedia.org/wiki/File:RWS1909_-_16_Tower.jpeg): its sky field is black/dark, with separate pale gray clouds. The exact gray-sky description already occurs in both baseline and candidate `imageryHooks.js` and in the actual provider prompt. This is a source-supported literal-image mismatch; it does not establish a new GraphRAG retrieval regression or provider invention. Source agreement does not clear the image-fidelity criterion.

The first reading's **“sun rising behind”** the Fool remains unresolved after an append-only source/image/primary-text check. Its captured prompt supplies that wording; Waite supports morning context and a sun shining behind, while literal rising remains an inference. It is retained as uncertainty, not promoted to proven false or silently accepted.

After all initial judgments and source/image addenda, the five complete readings have **1 pass, 1 fail and 3 unresolved**:

| Case | Effective absolute disposition |
| --- | --- |
| `single-new-role` | Unresolved: the Fool's literal rising-sun precision |
| `three-card-transition` | Fail: Tower sky-color mismatch |
| `five-card-creative-project` | Unresolved: Three of Pentacles noble status and specifically cathedral plans |
| `relationship-checkin` | Pass at the unchanged quality floor |
| `celtic-deep-shift` | Unresolved: inherited Death rising-sun precision, Temperance rising-sun/radiant-crown identity, and Nine of Swords bolting motion |

The uncertain claims are source-supported, not established new provider inventions. They remain unresolved after bounded direct-image review rather than triggering an exhaustive catalog investigation during a failed generation run. Reversal-framework and elemental-context gaps in the initial review packets were resolved from the exact pre-generation metadata; those were missing reviewer context, not output faults. All scored quality dimensions meet the unchanged floor2. Minor observations remain recorded: presentation normalization removes the relationship exercise's underscore blanks; the Celtic reading duplicates the symbolic lead-in and gives a blanket “Don't act on any yet” suggestion that weakens its momentum advice. No output was edited or regenerated to remove these issues. Independent review is agent review, not a completed human editorial panel.

The fifth, already in-flight Celtic output used **`rws-hermit-star-in-lantern`** through the actual validated interpretation renderer. It includes the exact fixed caption and explicitly frames the following light/next-step language symbolically. This supplies one observed generated-caption transport example, not overall factual acceptance or multilingual/corpus qualification. The Spanish/Eight of Cups sample was never invoked, so that new caption still has source/test evidence but no fresh generated-reading evidence.

### Coverage, unchanged criteria and remaining work

All fifty original inputs remain: forty-six normally valid pairs and four original card-count rejections retained as retrieval-only. Actual passage objects, scores, weak flags, context gates, coefficients, threshold, caps and labels remain unchanged. All eleven standard and forty-six candidate semantic prompts change versus 1.6.7 because of the new imagery guidance; all forty-six baseline prompts remain byte-identical. Prompt-version and authorized-fact metadata changes are recorded separately from unchanged reader inputs and retrieval. Wall-clock retrieval timing is not compared as semantic data.

**No current semantic output or complete current pair was generated.** Six standard calls and all **80** fresh semantic calls remain unstarted. Twelve preserved baseline outputs alone do not make twelve complete current pairs. The unchanged fixed pilot remains REL05/REL08/REL10/FRESH10/HOLD2_09; it is not cleared. Its real entrypoint demonstrably refuses negative standard clearance before provider authentication/inference without changing the attempt ledger or outputs. Japanese prose quality alone remains waived; all other criteria remain binding.

| Source phase | Fresh semantic | Fresh standard |
| --- | ---: | ---: |
| 1.6.3 | 4 | 11 |
| 1.6.4 | 18 | 11 |
| 1.6.5 | 6 | 0 |
| 1.6.6 | 0 | 6 |
| 1.6.7 | 0 | 11 |
| 1.6.8 | **0** | **5** |
| **Correction-request total** | **28** | **44** |

The cumulative correction-request total is **72** fresh subscription calls; the eight-output original pilot remains separate. This phase used zero new embedding requests, zero paid narrative API fallback and zero retries.

### Evidence and preservation

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-imagery-evidence-v168-20261031T170000Z/`. It retains both source revisions, initial failures, final manifests, exact prompts, first CLI outputs, complete review packets/judgments/addenda, `standard-post-halt-audit.json`, the actual failed CI receipt, negative standard clearance, and `pilot-dispatch-refusal.json`. Previous phase outputs and verdicts are unchanged. The source freeze binds 414 pre-generation artifacts; post-halt diagnostics make no provider calls.

The pre-generation 58-file recovery patch/archive reconstructs every owned file on frozen a030 outside all Git worktrees. Final recovery also captures status-only documentation updates and is verified separately. Preservation checks compare all fifteen worktree HEADs/staged entries, fourteen unrelated index/status snapshots, forty-six unrelated file hashes, durable refs/stash, and the primary journal performance test.

The next bounded source work is to correct demonstrably inaccurate stored imagery and resolve precision claims before another generation freeze, while keeping every original output and the same gate. The inherited accent-normalization defect also requires a separate bounded correction before an exact-input preservation claim. **F3b remains open; nothing was staged, committed, merged, pushed or deployed.**

## Historical disposition: prompt 1.6.7 role correction implemented; reading qualification blocked

The owner approved the bounded role-projection correction and resumed qualification under the same criteria. The isolated worktree remains on `a030467351b2374a9c9a1d933eecc0498abcaca3` with an **uncommitted 54-file overlay**. The frozen 1.6.7 source manifest is **`558fb695c7f7b4ccfb06c519d0c44a2bf3e2ebfe2e4c5dc6638d4d72c0d21c03`**. It is the corrected rebased GraphRAG candidate, not a comparison against production master. Primary `master`/local `origin/master` remain protected at `26da856cc4e3da98d015dc5f0d306952d58015c7`.

### What changed and what was verified

`narrative/helpers.js`, `prompts/cardBuilders.js` and `spreadAnalysis.js` now frame Conscious goals, External circumstances, the paired consciousness axis, and Path A/B as supplied facts or symbolic possibilities. Exact role labels, questions, reflections, card names and orientations remain. Lowercase/custom role matching retains the same protection. All four Celtic Advice/Outcome branches compare card themes instead of forecasting a course. Prompt version metadata and its existing test expectations are 1.6.7. No retrieval, source-fact inventory, renderer, provider, score, threshold or acceptance change was made.

Seventeen initial regressions reproduced the conflicting full provider inputs and fallback meanings before correction. An independent source review found two remaining important gaps: staff forecast branches and case-sensitive role fallbacks. Seventeen additional cases reproduced those gaps; all 34 role regressions pass after one fix pass. Existing tight-budget coverage caught a displaced GraphRAG summary; shorter axis/note wording restored the summary and all accepted card notes at the unchanged cap. Two dormant/defensive limitations remain explicitly deferred: legacy wording in unused Celtic structured positionNotes, and an unknown-card Decision missing-element fallback whose accepted-request reachability was not established.

| Check | Current actual result |
| --- | --- |
| Final credential-free root suite | **6,123 pass / 0 fail / 2 skip**, 6,125 total; `root-suite-final.json` |
| Focused role/integration/retention/budget checks | **220 pass / 0 fail**, including all 34 new role regressions |
| Worker lane | **70 pass**, `worker-final.json` |
| Prompt assembly | **874 fixtures / 2,541 provider builds** at unchanged caps and frozen fixtures |
| Build / changed-code lint / maintained Markdown links | All exit0; final documentation check recorded separately |
| Literal `ci:narrative-check` | **Exit0**, all 11 standard readings, zero automated metric flags |
| Exact transport and route checks | All 11 actual CLI completions reconstruct complete consumer strings; all 11 actual route-local structural/card checks pass |
| Complete content review | **9 pass, 1 unresolved, 1 fail**; automated acceptance does not clear these content findings |
| Current semantic qualification | **0 fresh calls, 0 complete current pairs**; all 80 planned fresh semantic calls remain unstarted |

The initial root diagnostic ran during the source-review fix pass and is not final-source qualification. Its failures included old-version assertions, the retained-budget regression and newly added review regressions; the final complete suite above ran on the frozen corrected source. All earlier receipts and sources remain preserved. The original independently reviewed harness is unchanged except phase paths; 12 refusal checks and 8 capture checks pass without real inference. Owner subscription authentication was verified without paid API credentials.

### Reading findings, with uncertainty retained

All 11 standard readings were generated once through the owner's Claude subscription (`claude-opus-5-5`, `xhigh`, max 32,000 output tokens). Complete original text, actual prompts, CLI stdout, consumer text and judgments are retained. The standard lane uses keyword fallback, not the changed semantic path. The new Celtic and Decision readings no longer contain the previous categorical unstated-goal/environment and likely-path claims; this is evidence about these observed outputs, not a population error-rate claim.

- **Confirmed image fault — Spanish** (`non-english-spanish`, consumer SHA `b8cecfc2ab6e347246fdf936a253de72dc4ea71f8a6559d5972a99cf1ad79d01`): “Aparece otra figura encapuchada…” describes the Eight of Cups traveler as hooded. Independent visual inspection shows uncovered hair above a red cloak. The local image exactly matches the [original 1909 RWS scan record](https://commons.wikimedia.org/wiki/File:RWS1909_-_Cups_08.jpeg): SHA-1 `7c97829e6fe0d84d7f22b530d976f15b815639a9`, 257,546 bytes; local SHA-256 `bd8896083ba2c3d7cdb245ed9dae4528a0637a527f45bced93b6f6ed89c1b9fc`. Both reviewers and the coordinator verified this particular fact. Source agreement alone was not treated as global canon verification.
- **Unresolved literal precision — Celtic and Spanish**: the Hermit lantern is said to show “the next few steps” and have enough light to see “el siguiente paso.” These follow concrete scene descriptions; supplied evidence establishes the lantern/star/focused beam, not ground coverage. Both independent adjudications retain ambiguity between metaphor and added literal detail. Neither is promoted to a proven false fact or cleared by default. Celtic consumer SHA `fd75ca78810799ca7e1800092f2b37f7620073683718ed14e87cc57fa5ca3f86`.
- The Celtic Hopes/Fears wording remains a possible card theme, not a confirmed assertion of private feelings. Optional Thursday examples, conditional Past reflection and modest action suggestions remain allowed. These criteria were not tightened to reject ordinary metaphor or weakened to excuse an uncertain literal claim.

Each initial complete content judgment was frozen before inspecting its actual prompt provenance. New image evidence resolves the hood uncertainty in appendices; the original uncertain judgments remain unchanged. `humanReviewCompleted:false` throughout. A second reviewer independently read both complete contested outputs before comparison, then checked the primary image. No generated replacement or repair call was used.

### Matrix, calls and limits

All 50 original inputs remain: 46 normally valid pairs and the four original card-count rejections retained as retrieval-only. All exact questions, cards, roles, orientations, decks, actual retrieved passage objects, scores and weak flags match 1.6.6. Five standard provider inputs changed; none of the 46 candidate semantic prompts changed versus 1.6.6. That phase had generated no semantic readings, so it supplies no candidate output reuse. Twelve baseline outputs retain their original bytes/metadata and are revalidated against exact source, prompts, inference config, formatter and actual route gates.

The frozen budget remains 11 standard calls plus 80 semantic calls, one attempt/output, maximum two concurrent semantic calls. The fixed five-pair pilot remains REL05/REL08/REL10/FRESH10/HOLD2_09. It was not reached. **Actual new calls this phase: 11 standard, 0 semantic, 0 embedding requests, 0 retries.** None of the 11 standard draws triggers either controlled scene fact, so there is still no fresh generated-caption proof. The source renderer tests do not substitute for that missing coverage.

| Source phase | Fresh semantic | Fresh standard |
| --- | ---: | ---: |
| 1.6.3 |4|11|
| 1.6.4 |18|11|
| 1.6.5 |6|0|
| 1.6.6 |0|6|
| 1.6.7 |**0**|**11**|
| **Correction-request total** |**28**|**39**|

The cumulative total is **67 fresh calls** since the correction request; the eight-output original pilot before that request remains separate. This standard absolute failure does not establish a candidate-minus-baseline semantic regression or prove which source line caused stochastic imagery transfer. **F3b remains open**, with the Japanese prose-only waiver unchanged.

### Evidence, preservation and next boundary

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-role-projection-v167-20261028T221025Z/`. It contains source/recovery manifests, all frozen prompts, the generation freeze/budget/protocol, `standard/cli/01..11/`, current `standard/narrative-samples.json`, successful automated CI receipt, complete independent review ledger/freezes, append-only primary-image adjudications, transport/route audits, the original unresolved halt and final negative clearance. The standard runner restored all three historical default artifacts byte for byte; current outputs are the external standard archive, never those restored defaults.

The pre-generation 54-file patch/archive was verified by reconstruction on frozen a030 outside every Git worktree. Final recovery adds only qualification-document updates and is verified separately; no generated output is relabeled with those document changes. Preservation receipts compare all 15 worktree HEADs/staged entries, 14 unrelated indexes/statuses, 46 unrelated dirty/untracked file hashes, durable refs/stash and the primary journal performance hash `ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`.

The next design boundary is free-prose imagery: it can still add or transfer a literal attribute outside the two validated scene facts. A further correction should bind literal attributes to their own card evidence and distinguish added interpretation explicitly, while retaining every original output and the unchanged gate. No broader imagery architecture, fact-inventory expansion or extra generation has been implemented in this role-projection phase. **Nothing was staged, committed, merged, pushed or deployed.**

## Historical 1.6.6 disposition: two-fact contract implemented; standard content acceptance failed

The owner approved preserving sourced card relationships across roles, validating literal fact references before rendering, and qualifying the corrected source. The work remains an **uncommitted 53-file overlay** on `a030467351b2374a9c9a1d933eecc0498abcaca3` in `.worktrees/graphrag-rebase-20261027`. This comparison baseline is the pre-fix rebased GraphRAG source, **not production master**. The frozen 1.6.6 source-manifest SHA-256 is **`3b18a78dbfdd3106432cf8b64875f3608680b704684c9e1cc3790d91782ed353`**. Primary `master` and `origin/master` remain `26da856cc4e3da98d015dc5f0d306952d58015c7` at the protected local snapshot.

### Implemented and verified scope

- `canonicalSceneEvidence.js` owns two immutable, deck/drawn-card-restricted primary-source relations: RWS Hierophant crossed keys at feet, and Thoth Art raven-on-skull motif on the cauldron. The latter does not assert rim or interior placement. All sixteen captions across en/fr/es/pt/de/it/ja/zh were independently checked for those bounded relations. [Waite](https://sacred-texts.com/book/the-pictorial-key-to-the-tarot/v-the-hierophant) directly supports the former; the indexed [Crowley primary text](https://hermetic.com/crowley/book-of-thoth/atu) supports only the broad latter relation (direct fetch returned 403).
- Standard/custom roles retain reviewed object-location evidence; the protected prompt inventory must survive fitting at the existing numeric caps. For contract draws, optional deck notes may be removed before reducing retained GraphRAG references to a summary. Retrieval ranking, own-score threshold, relevance labels, weak-floor flags and passage objects are unchanged.
- An ordered prose/fact transport validates exact fields, eight exact language keys, accepted card/deck identity and final-prompt authorization. Approved references render fixed captions into the existing reading string. Extra or invalid literal fields fail closed; missing/raw/malformed output is retained for qualification. **Free prose still requires complete factual review.**
- Claude, Modal, OpenAI and personal subscription backend results use common validation. Buffered OpenAI SSE validates before emitting consumer text; fact-covered Codex draws use the buffered backend path. Actual local OpenAI serving tests use mocked provider transport. Fact-specific Codex/jobs delivery was code-traced, not separately exercised live.
- Future/Near Future/Outcome framing is prospective and symbolic in the corrected common paths. Exact role labels and reader text remain. The failed standard run below reveals conflicting Conscious/External/Decision projections still emitted elsewhere; source tests do not excuse those contradictions.
- The standard batch checkpoints each completed output and the first rejected raw completion atomically, then stops without retry. Authentication/no-completion failure creates no usable sample. Qualification captures exact CLI requests and stdout before backend parsing, forwards termination and bounds child cleanup. Persistent reservations prevent automatic retry.

### Source and harness verification

| Check | Actual result |
| --- | --- |
| Final credential-free root suite | **6,089 pass / 0 fail / 2 skip** (6,091 total), `root-suite-verified.json` |
| Prompt assembly | **874 fixtures / 2,541 provider builds**, original caps/fixtures, `assembly-verified.json` |
| Build and all 46 owned code files lint | Exit 0, `build-verified.json`, `all-owned-code-lint-verified.json` |
| Worker lane | 70 pass in the earlier 1.6.6 implementation check; final root/assembly checks cover the subsequent locale/wording/checkpoint corrections |
| Fresh source review | Exact-locale finding F1 reproduced and fixed RED→GREEN; all other inspected scope accepted with explicit delivery/free-prose limits |
| Fresh harness review | H1 precreated inventory blocked standard launch; H2 proxy termination left a child alive. Original reproductions retained; distinct exclusive reservation and bounded forwarding/draining pass fake-provider red/green checks |
| Harness controls | 12 intent-specific refusal checks and 8 capture checks pass with zero real provider calls |
| Actual standard `ci:narrative-check` | **Exit 1**, interrupted by content halt after six completions; metrics/release acceptance not completed |
| Saved-output diagnostics | All six exact transports reconstruct their full consumer strings; all six pass actual route-local structural/card checks. These are partial diagnostic checks, not a content or CI pass |

Revision1 probes and failed root runs remain in the evidence root. Revision2 was frozen only after the final root/build/lint/assembly checks passed. One intermediate coordinator read after the CI wrapper had restored historical default samples was caught and saved as invalid before any reviewer received it. Both independent content judgments use the current archived completion hashes below; no historical output was substituted.

### Actual generated-content findings

The predeclared ceiling was 11 standard plus 80 fresh semantic calls, one attempt per output, owner Claude subscription `claude-opus-5-5`, `xhigh`, max 32,000 tokens, max two semantic calls concurrent. The standard lane is serial and uses keyword fallback. At halt, **six actual standard calls have completed on six attempts**, with no retry; **five standard calls and all 80 semantic calls remain unstarted**. The seventh `Generating sample` log is a pre-capture refusal and not an inference attempt or evidence of login failure.

All six readings were reviewed in full under the unchanged six hard criteria and four anchored dimensions. Four pass: `single-new-role`, `three-card-transition`, `five-card-creative-project`, `relationship-checkin`. Two fail:

- **Celtic Cross** (`celtic-deep-shift`, consumer SHA `93553633ccf84a0e2f1a9cf2d5a22e210b6f36390b1245e0fbf174a5ce2ae314`) asserts “what you're consciously reaching for: structure, authority, a plan that holds” and surroundings that “reward steady craft.” The supplied request establishes home/work restructuring, centeredness, compassion and momentum, not those specific goals or environmental conditions. Later conditions do not condition earlier categorical statements. A Hermit light-range phrase remains unresolved as literal precision versus metaphor, not proven false.
- **Decision** (`decision-crossroads-long-reflections`, consumer SHA `b690c172a7bec9b0f500bff9e1d70e9aa16b9c4458838d7387ef27a8b9658e0f`) says “The likely trajectory on this path leans toward deliberate momentum, with a plan taking shape.” The card and unnamed Path A do not establish a likely future course. An option name alone would not authorize the forecast.

A second reviewer independently identified the same three categorical claims and froze judgments before seeing the first review or actual prompt provenance. Both agree on the failing verdicts. They retain a specificity-score difference for Decision (1 versus 2) and the Hermit metaphor/literal ambiguity; neither affects the confirmed halt. The six completed readings retain exact card names, roles/orientations and conditional Past framing. This is evidence about six observed outputs, not a population error-rate estimate or complete past-history qualification. Thoth, Marseille and Spanish standard cases have no outputs. None of the six exercises either controlled scene fact.

### Confirmed prompt conflict and bounded next proposal

After content freeze, actual prompt inspection found lower-level role projections contradicting the grounding rules: Conscious describes known aims and “Stated goals”; External describes actual circumstances echoing the card; Decision describes “probable results” and “Trajectory if you commit.” Sources are `narrative/helpers.js`, `prompts/cardBuilders.js` and `spreadAnalysis.js`. These are deterministic conflicting inputs and a plausible mechanism, not proof which line caused a stochastic output. This absolute keyword-lane failure does **not** establish an F3b/corroboration-caused paired regression.

The concrete next proposal is to align those role/meaning/axis/position-note emitters with the existing symbolic-only contract while preserving exact supplied roles, cards, orientations and reader wording. Conscious should examine supplied goals or pose a possibility; External should consider known conditions or optional responses; Path A/B should compare symbolic themes and actions without predicting outcomes. Preserve useful conditional examples. Additional literal precision requires supplied deck evidence or explicitly symbolic framing. No extra model judge, repair calls, caption-inventory expansion, language waiver, relevance or quality-criterion change is proposed. Credential-free regressions must first reproduce the actual conflicting requests; further generation requires a separately frozen correction and unchanged complete-reading review.

### Matrix, calls, evidence and preservation

All 50 inputs remain, 46 normally valid pairs and the same four original card-count rejections (`REL03/04/06/07`) retained as retrieval-only. Forty-three candidate provider inputs changed versus 1.6.5 and three did not (`REL09`, `REL10`, `FRESH06`); all baseline inputs and actual retrieved passage objects/scores/weak labels match the prior phase. Twelve exact baseline outputs are retained regardless of verdict, with original metadata and source/transport/gate/formatter identity revalidated. No candidate output is reused under the changed renderer. No 1.6.6 semantic pair is complete.

| Source phase | Fresh semantic | Fresh standard | Outcome retained |
| --- | ---: | ---: | --- |
| 1.6.3 | 4 | 11 | Further premise/name faults; original outputs retained |
| 1.6.4 | 18 | 11 | Standard content pass with original CI1; later semantic role/canon failures retained |
| 1.6.5 | 6 | 0 | Corrected pilot literal-canon failure and unresolved findings retained |
| 1.6.6 | **0** | **6** | Four standard content passes, two independent confirmed failures; halt before semantic pilot |
| **Correction-request total** | **28** | **28** | **56 fresh calls**; original eight-output pilot before this request remains separate |

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-fact-contract-v166-20261028T182536Z/`. Important artifacts are `generation-freeze.json`, `source-manifest.json`, all actual prompt and source inventories, `standard/cli/01..06/`, `standard/narrative-samples.json`, `standard/ci-receipt.json`, `review/narrative/standard-v166/{ledger,freeze}.json`, `review/narrative/independent-adjudication-v166/`, the original `manual-review-halt.json`, negative `standard-review-clearance.json`, `pilot-dispatch-refusal.json`, and the partial transport/route receipts. The actual pilot launcher refuses clearance with its 12-reuse ledger unchanged, before authentication/inference. Zero new embedding requests or paid narrative API fallback occurred.

The verified pre-generation recovery contains all 53 owned files: `recovery/pre-generation/owned-changes.patch`, `owned-files.tar.gz` and `manifest.json` (patch SHA `4b0e56b174e517cc822ddaa672438a276367d6a91e746ae0eeb251e1da778ffc`, archive SHA `1b04f63515cbdcd7c346d9342d6e4a631665e08a5a92f1000a586757cd53e3c8`). It reconstructed on frozen a030 outside all Git worktrees. A final archive adds these qualification-document updates. Final preservation and source-difference receipts are recorded separately; documentation changes after generation do not relabel the frozen source. The primary journal performance SHA remains `ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`.

Japanese prose fluency/grammar/headings/readability alone remains waived. All other factual, agency, names/positions/orientations, deck/image, timing/roles/negation/exclusion, usefulness and other-language gates remain enforced. **F3b remains open. Nothing was staged, committed, merged, pushed or deployed.**


## Historical 1.6.5 disposition: local checks passed; semantic pilot failed literal canon

The owner's current request is to fix unsupported past-history assertions in the isolated GraphRAG worktree and resume paired qualification, with Japanese prose quality waived, unrelated work preserved, and no commit, merge, push or deployment. The historical checkpoint candidate was **prompt 1.6.5**, an uncommitted overlay on `a030467351b2374a9c9a1d933eecc0498abcaca3` in `.worktrees/graphrag-rebase-20261027`. The comparison baseline is that pre-fix rebased GraphRAG source, **not production master**. That checkpoint frozen source-manifest SHA-256 was `58c71abe0ef2a3b1824033499c6a8fff3e33483dbba8b189025e4ca179d2079b`.

The five corrected pilot pairs have complete independent blind review of every raw reading and display projection. Their candidate readings have no identified unsupported past-event assertion and retain the actual custom roles. Nevertheless, **a confirmed new candidate literal-canon fault blocks qualification**. That phase remains halted; its remaining 68 fresh calls were never started. No clean-output or full F3b acceptance is claimed.

### Implemented corrections

- Past-position meanings, introductory prose, arc connectors and local-composer guidance describe symbolic reflection instead of claiming a past event. Supplied personal facts remain usable, including factual framing inside questions; interrogative, hypothetical or negated propositions are not silently treated as facts.
- Conditions remain local when an example reappears in synthesis, practical steps or closing. The protected final contract preserves the complete exact question and accepted card-name inventory during fitting, or rejects an unfit prompt. Existing caps and assembly fixtures are unchanged.
- Three-card `Self/Other/Bond`, `Left/Center/Right` and other custom roles retain their literal labels through analysis, provider assembly and local composition. Card order does not impose a chronology. Role classification examines the role prefix, so a description such as `Other — Future Ltd.` does not become a Future position. Supplied analysis stays inside the existing escaped data boundary. Standard temporal paths remain unchanged in the independent source comparisons.
- A drawn Thoth Art/Temperance receives a primary-source motif reference placing the raven-on-skull motif on the cauldron, rather than inside it. Its applicability is restricted by accepted card identity and deck. This input correction does not establish that generated literal scene details are faithful; the pilot below demonstrates the remaining gap.
- A named drawn-card subset comparison is distinguished conservatively from an incorrect total suit count. The standard narrative agency evaluator accepts explicitly stated reader-action influence without requiring a particular keyword. Repudiated, extra-clause, rhetorical and fatalistic negative controls remain tested. These are bounded measurement corrections against the original criteria; no quality threshold was lowered. Every original failed result remains archived.

### Correction phases and actual new model calls

| Source | New semantic calls | New standard calls | Retained outcome |
| --- | ---: | ---: | --- |
| 1.6.3 | 4 | 11 | Four candidate pilot readings clear their factual review, while the standard lane exposes further unsupported premises and an exact accepted-name omission. All failed outputs remain. |
| 1.6.4 | 18 | 11 | All eleven standard readings pass independent content review; the original automated exit 1 is retained, and exact-output replay passes after the evaluator correction. Four candidate semantic pilot readings pass. The next reviewed batch finds custom-position loss and a literal Art scene error; dispatch stops and all in-flight outputs finish and persist. |
| 1.6.5 | 6 | 0 | Five corrected pilot pairs, ten outputs, fully reviewed. One candidate literal-canon fault is confirmed; two Art rim details and the shared Future-framing boundary remain unresolved. Remaining dispatch is refused. |
| **Historical 1.6.3–1.6.5 subtotal** | **28** | **22** | **50 fresh calls**, no paid API fallback and no new live embedding requests. The original eight-output 1.6.2 pilot predates this request and remains separate. |

These are distinct source phases, not replacements under the same source. Generation used the owner's existing Claude subscription, `claude-opus-5-5`, effort `xhigh`, maximum 32,000 output tokens, one attempt per output, and at most two concurrent calls. Frozen real BGE-M3 vectors supplied retrieval. Failed samples and judgments were not discarded or regenerated for preference.

### Matrix, exact reuse and review coverage at 1.6.5

All fifty original/seen/holdout inputs remain inventoried. Forty-six pass normal request validation and require 92 baseline/candidate output slots. `REL03`, `REL04`, `REL06` and `REL07` retain their original invalid card-count tuples as retrieval-only evidence; they were not padded or replaced.

Only five candidate provider prompts change between 1.6.4 and 1.6.5: `REL05`, `REL08`, `REL10`, `FRESH10`, `HOLD2_09`. All forty-six baseline prompts, the other forty-one candidate prompts, all retrieved passage objects/scores/weak labels, and all eleven standard model inputs remain identical. Reuse retains every already completed exact-input/configuration/prompt output regardless of prior content verdict. Its original source/version metadata stays intact, and the current route gate and final formatting are revalidated separately.

The 1.6.5 phase contains **24 completed slots**, consisting of eighteen exact prior-output reuses and six fresh calls. The five-pair pilot uses four reused baseline outputs, one new baseline output and five new candidate outputs. The fixed forty-one-pair remainder comprises fourteen already completed output reuses and **68 unstarted fresh calls**. A completed output slot is not a complete content review or an accepted pair.

Two fresh independent reviewers split the pilot into a fixed first-two/last-three partition before seeing output. Both received exact authorized inputs, identical supplied ephemeris/timing context and a mapping-free canon reference. They read all ten complete raw outputs and all ten complete display projections, including every step, synthesis and closing. Both ledgers were frozen before the coordinator read A/B mapping. Canon and interpretation follow-ups are separate immutable addenda; initial findings and paired judgments remain unchanged.

| Case | Candidate observation | Baseline observation | Current disposition |
| --- | --- | --- | --- |
| `REL05` | Preserves `Self/Other/Bond`, but says the RWS Hierophant holds crossed keys. | Replaces the supplied roles with foundation/present/trajectory. | **Candidate hard deck/image fault confirmed**; both outputs have different hard faults. Position improvement does not cancel the new literal error. |
| `REL08` | Literal Art motif is placed on the vessel rim. | Does not make that literal rim claim; a separate present-premise concern is retained. | Rim placement **unsupported/unresolved**, not conclusively disproven by the text-only canon. Both outputs' unchanged-course Future language remains unresolved under the existing factual criterion. |
| `REL10` | Preserves `Left/Center/Right`, offering optional labeling suggestions. | Replaces them with `Past/Present/Future` and adds an unrequested trajectory. | Candidate clears the reviewed hard checks; position fidelity improves in this pair. |
| `FRESH10` | Preserves the French cooperation request and optional symbolic exercises. | Also preserves the request and offers usable exercises. | Comparable; neither output has a hard fault identified. |
| `HOLD2_09` | Preserves the supplied completed life stage and unhurried integration request, but adds a literal Art top/rim location. | Preserves the request without that literal location. | Candidate canon question **unsupported/unresolved**. |

All initial quality scores are at least 2/3. Those scores cannot offset a hard fault or an unresolved factual check. The confirmed keys error is supported by the actual RWS 1909 scan and Waite's original description: the keys are at the feet and the held object is the sceptre. [Waite, V. The Hierophant](https://sacred-texts.com/book/the-pictorial-key-to-the-tarot/v-the-hierophant).

The original Crowley Art text establishes the motif's broad relation to the cauldron. It does not by itself establish whether a precise rim location is false. A separate original-art reproduction favors a front/body location, but its plate provenance was not authenticated, and the official publisher materials actually inspected did not resolve that detail. The initial categorical rim rationale is therefore qualified in an addendum. Unresolved canon still fails to clear the unchanged acceptance gate; it is not converted into a pass. [Crowley, XIV Art](https://hermetic.com/crowley/book-of-thoth/atu).

An independent full-reading adjudication also retains the ambiguity in `REL08`: a conditional symbolic sequence can answer the abstract question, while language about continuing the current course can imply unsupported personal circumstances. Conditionality and agency alone do not establish those circumstances. The original review applies the explicit no-forecast clause; the independent addendum records the competing interpretation as unresolved. No rule was changed after seeing outputs.

### Verification and limits

| Lane | Current evidence |
| --- | --- |
| Root suite on final source | **6,035 passed, zero failed, two skips**; credential-free environment. |
| Worker graph/spread/alert suites | **70 passed**. |
| Independent source review | **130 focused tests**; twelve complete temporal prompt/analysis comparisons unchanged, 36 custom-role provider combinations, eighteen forced fits, ten descriptive-keyword cases plus ten actual-role controls, eight Art alias/deck controls. Initial custom-description bug and its failed reproduction remain archived. |
| Production build / owned-code lint | Pass on the final code. Final lint covers all owned JavaScript/module files, including the final role-prefix correction. |
| Standard narrative content and metrics | Eleven frozen complete 1.6.4 outputs pass independent content review. Twenty-two offline source builds prove all eleven final 1.6.5 provider inputs unchanged. Saved-output metric replay passes with zero flags after the bounded evaluator correction. **The original `ci:narrative-check` exit 1 remains recorded; this is not a fresh successful invocation on 1.6.5.** |
| Semantic exposure | Completed eligible outputs preserve actual semantic scoring and final GraphRAG prompt inclusion, with full prompts, request metadata, local validator outcomes and output hashes archived. Exposure is not proof of model attention or correct content. |
| Retrieval acceptance | Prior 19/19 seen and 12/12 blind-holdout positives and original REL01–REL10 outcomes remain valid on unchanged retrieval code and passage objects. No formula, 0.3 threshold, context gate, cap, weak-floor label, corpus label or required case is weakened. |
| Dispatch refusal | Negative pilot clearance and persistent manual halt; an actual `remaining` invocation exits before a provider attempt and leaves the attempt-ledger hash unchanged. |
| Delivery / production | Not exercised. This is local subscription generation and route-validator replay, not a production Worker, browser, device or live-user qualification. |

### Architecture discussion before another correction

Three source versions exposed distinct fidelity gaps despite green local checks. Another prompt-only patch is not being attempted. The immediate confirmed issue is an evidence-flow gap: the existing shared symbol annotation already contains the keys' location, but the generic imagery hook is a noun list and the current provider path loses that relationship. The route gate measures structure, card coverage, undrawn-card assertions and suit counts; it has no general literal scene-relation validator. A correct noun inventory therefore does not establish a correct scene.

The concrete discussion proposal is to preserve deck-scoped, sourced object/relation facts through the common card-evidence path for every accepted role, separate those facts from symbolic interpretation, and validate structured fact references before rendering literal descriptions. Start with the existing supported evidence and a small reviewed contract, not a new registry written from model memory. Arbitrary interpretation prose still needs semantic review; a structural contract or a few regular expressions cannot prove all personal or visual claims true. The proposal and independent architectural trace are stored under the current evidence root's `review/code/architecture/` directory. No architecture change is implemented or accepted by this document.

After the architecture decision, preserve every failed phase, freeze the revised source and unchanged full case inventory, reuse only exact equivalent inputs, and run the corrected pilot before any remaining dispatch. All factual and usefulness criteria remain. The owner's Japanese waiver applies only to prose fluency, grammar, headings and readability scoring; Japanese facts, constraints, card/deck fidelity and other dimensions remain checked.

### Current evidence and preservation

The phase evidence roots are:

- `/home/ubuntu/.local/state/tarot/f3b-grounding-fix-20261028T025821Z` — prompt 1.6.3, fifteen fresh calls and failed standard findings.
- `/home/ubuntu/.local/state/tarot/f3b-grounding-v164-20261028T153544Z` — prompt 1.6.4, twenty-nine fresh calls, standard content review, exact-output metric replay, halted semantic batch and source review.
- `/home/ubuntu/.local/state/tarot/f3b-role-canon-v165-20261028T173205Z` — final frozen 1.6.5 source, six new calls, eighteen exact reuses, five-pair blind pilot, independent canon/interpretation addenda, mapped disposition and persistent refusal receipts.

The current root retains `pre-generation-freeze.json`, `generation-plan.json`, `source-manifest.json`, `standard-prompt-parity.json`, `reuse-revalidation.json`, `review/narrative/protocol-v165.md`, both immutable blind ledgers and addenda, `pilot-mapped-disposition.json`, `pilot-review-clearance.json`, `manual-review-halt.json` and `remaining-refused.json`. Private mapping is separate from the blind packets.

Final preservation verifies all fifteen worktree HEADs and staged entries, all fourteen unrelated worktree statuses and index bytes, 46 unrelated dirty/untracked file hashes, durable refs and stash. The task index's stat metadata was refreshed earlier, but its staged entries remain identical to HEAD. The primary journal performance test retains SHA-256 `ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`. The current source remains local and uncommitted. A verified current patch and file archive, with reconstruction on frozen HEAD outside all Git worktrees, are saved under the current root's `recovery/blocked-current/` directory. No commit, merge, push or deployment occurred.

## Historical 1.6.2 pilot — original results retained below

The remainder of this record describes the earlier source and its original findings. Counts, dispositions and preservation receipts below belong to that historical phase and do not qualify the corrected 1.6.5 candidate.

**Disposition: F3b remains open.** The eight-output pilot completed without provider errors and all outputs passed the application's exact local quality gate. Complete content review found unsupported past-history statements in both outputs of one pair. The remaining 41 outputs were not started. No candidate source correction, commit, merge, push or deployment was performed in this follow-up.

The owner subsequently instructed **"Skip the Japanese language gate."** Japanese prose fluency, grammar, headings and language-quality scoring are waived as acceptance gates. Japanese cases remain in the matrix. Factual grounding, agency, exact dates/roles/exclusions/cards/decks, internal-boundary checks, other language gates and retrieval labels/thresholds remain in force. The pilot findings below concern factual assertions, so this waiver does not clear them.

## Frozen inputs and source

- Worktree: `/home/ubuntu/tarot/.worktrees/graphrag-rebase-20261027`.
- Baseline: exact rebased commit `a030467351b2374a9c9a1d933eecc0498abcaca3`.
- Candidate: that baseline plus the twelve existing dirty/untracked F3b files, verified against the prior corroboration handoff. Both complete source trees were copied outside the repository before generation; all 3,503 baseline blobs and candidate overlays were verified.
- Primary `master` and `origin/master`: `26da856cc4e3da98d015dc5f0d306952d58015c7` at capture. No fetch or branch mutation was required for this local qualification.
- Evidence root: `/home/ubuntu/.local/state/tarot/f3b-semantic-reading-review-20261028T003156Z/`.
- Prior retrieval evidence: `/home/ubuntu/.local/state/tarot/f3b-fix-20261027T071235Z/`.
- Reference time: `2026-10-28T00:31:56Z`, identical in both arms.

The accepted original question, cards, positions, orientations, deck and spread are preserved. Existing frozen real `@cf/baai/bge-m3` vectors, including canonical descriptors, are served by input hash to each arm's actual runtime path; no new live embedding request was made. Any missing vector, semantic fallback, source mismatch, changed prompt or invalid request fails closed. The actual provider prompts and complete outputs are archived with hashes.

## Selection and execution

The original ten relevance cases, seen 24-case corpus and independently frozen 16-case holdout form the 50-case input inventory. Normal request validation accepts 46. Four original tuples (`REL03`, `REL04`, `REL06`, `REL07`) have fewer cards than their declared spread requires and remain retrieval-only evidence. No cards were padded, positions relabeled, questions rewritten or fixtures substituted.

The frozen prompt inventory identifies 23 cases with a changed final prompt. Every such case requires an independent baseline/candidate generation. Three additional identical-prompt controls (`HOLD2_08`, `HOLD2_13`, `PHASE2_06`) each receive one output explicitly reused for both arms. They cannot support a paired causal comparison or estimate stochastic variability. The complete plan is **26 cases, 23 independent pairs, three reused controls, at most 49 fresh outputs and one attempt per output**. Two system prompts also differ through inherited context routing (`FRESH15`, `PHASE2_07`); no system prompts are changed in the pilot's failing `PHASE2_08` pair.

The first four independent pairs were frozen as `FRESH15`, `PHASE2_08`, `FRESH10`, `REL02`: eight fresh outputs. The remaining 41 require a passing pilot review receipt before dispatch. All eight completed on eight attempts through the owner's authenticated Claude Code subscription, configured `claude-opus-5-5`, `xhigh`, with the same output limit. Paid API credentials were absent, no paid fallback was allowed, and there were no automatic retries or replacement samples.

An atomic process lock, durable attempt ledger, output hashes and persistent rejection checks enforce the call ceiling and prevent duplicate launches or implicit resumption after a failed, unfinished or rejected attempt. Six local refusal checks passed without model calls. A negative pilot clearance receipt now prevents the remaining stage from starting. The harness reviewer identified two original gaps; they were corrected and locally verified before generation. That reviewer hit a usage limit before independently approving the corrections, so no final independent harness approval is claimed.

## Pilot content findings

| Case | Complete outputs | Local quality | Full-content disposition |
| --- | ---: | --- | --- |
| `FRESH15`, English/French, RWS | 2 | Both pass | Both preserve the father, shared garden, future December 3 conversation and topic exclusions. Past task changes remain conditional. No observed hard fault or material loss. |
| `PHASE2_08`, English/Japanese, RWS | 2 | Both pass | Both preserve the colleague, future `2027-02-12` project, exclusions and Emperor reversal, but each asserts a different unsupplied past problem. Hard factual failure remains. Japanese prose quality is waived. |
| `FRESH10`, French, Thoth | 2 | Both pass | Both retain the opposing impulses, actual Lovers/Art/Love cards and positions, conditional past framing and optional concrete experiments. No observed hard fault or material loss. |
| `REL02`, Japanese, RWS | 2 | Both pass | Both preserve the supplied sorrow/quiet renewal question, keep possible endings conditional, and avoid inventing a death, diagnosis or recovery duration. No observed non-language hard fault or material loss. Japanese prose quality is waived. |

In `PHASE2_08`, the authorized input asks how to divide responsibilities fairly for a future joint project with a colleague. It supplies no prior structural failure or undecided agreement.

- **Candidate, opening card-flow summary:** `揺らいだ構造から公平な天秤へ、そして共同作業の手応えへと進む流れです。` The reading moves “from a destabilized structure to fair scales” after assigning the Emperor to Past. Under the unchanged rule covering metaphors and every sentence, this implies an unsupplied prior problem. Later conditional examples do not qualify that sentence.
- **Baseline, Past/Emperor section:** `ここで目を向けたいのは、誰が悪かったかではなく「何が決まっていなかったか」です。` It asks the reader to focus on “what had not been decided.” An earlier conditional example does not retain its condition into this paragraph; the rhetorical question presupposes an unsupplied prior gap.

These share a failure category but are not the same false proposition. Neither cancels the other, and benefits in other pairs cannot compensate. A single stochastic pair does not establish that corroboration caused either assertion. There is one candidate output and one baseline output with a hard factual defect; the pilot is not a clean pass.

The independent narrative reviewer identified both defects while blind to arm mapping, then hit a usage limit before freezing a complete six-output review ledger. Its exact message is preserved. The coordinator reviewed all eight complete raw readings and display projections and froze judgments before opening the private mapping. Arm-linked output hashes had appeared in coordinator progress output, so that completion is explicitly **not claimed as a fully blind or independent review**. This limitation remains separate from the observed factual failures.

## Prompt diagnosis and limits

The failing pair has identical system prompts. Both contain the existing explicit instruction to keep unsupplied events conditional in every sentence, synthesis, recap, closing, question and metaphor. Both final user prompts repeat the grounding constraint. The failure occurs in generated content despite that instruction; the local structural/card quality gate accepts it.

The final user-prompt difference is narrow: the candidate retains the same Emperor passage and unchanged numeric score, but removes its weak-match label and the weak-match footer after descriptor corroboration. Neither passage supplies the asserted personal history. That exposure change is a possible contributor, but the failed baseline prevents a causal conclusion from this sample. No speculative prompt patch or successful retry is presented as a validated fix. First outputs and judgments remain preserved.

The earlier retrieval qualification remains valid: 19/19 seen positives and 12/12 blind-holdout positives, with the original relevance checks and preservation categories passing. Those results do not establish generated-reading quality. The 5,992-pass root suite, 70 Worker tests, prompt assembly, build and standard narrative results are reused from the matching prior source; they were not rerun or relabeled as new semantic-content proof here. The standard narrative lane uses keyword fallback.

The review executes the actual production Claude prompt/backend through subscription transport and the exact route-local `evaluateQualityGate`, with original inputs and dependency hashes archived. The frontend `normalizeReadingText` output is a text projection only. **Downstream Workers AI delivery safety, route fallback/retry behavior, authenticated hosted requests, browser rendering and production serving were not exercised.**

The inherited prompt sanitizer also removes some Unicode accents in both arms. Original accepted questions remain byte-identical through the input payload, and actual normalized provider prompts are archived. This limits end-to-end Unicode claims and does not excuse changed meaning or factual drift. The Japanese language-quality waiver does not change application prompts or provider settings.

## Evidence and preservation

The evidence root contains:

- `source-manifest.json`, frozen `trees/`, `prompt-probe.json`, `prompts/` and `provider-payload-retrieval-parity.json`: exact source, request preparation, prompt exposure and vector-replay checks.
- `review/narrative/protocol-v2.md`, `matrix-final.json`, scope addendum and freeze receipts: pre-generation selection and criteria.
- `generation-plan.json`, `generations/attempts.jsonl`, request/raw/final output JSON and `pilot-generation-result.json`: eight complete attempts, no retry, complete content and exact local-gate results.
- `blind/pilot.json`, `review/narrative/independent-pilot-finding-message.json`, `pilot-coordinator-review.json` and `pilot-review-freeze.json`: complete A/B packet, original reviewer finding, completed coordinator judgments and their limitations.
- `pilot-mapped-disposition.json`, `pilot-review-clearance.json` and `japanese-language-gate-waiver.json`: unblinded findings, refusal to dispatch the remaining 41 and exact human waiver scope.
- `preservation-before.json`, final preservation receipt and the final recovery patch/archive: protected Git/file state and recoverable current local changes.

Only the qualification documents were edited in the task worktree during this follow-up. Application code, frozen fixtures, labels, score composition, thresholds and caps remain as captured. Final checks verify all fifteen worktree HEADs and indexes, all fourteen unrelated worktree statuses and all 46 unrelated dirty/untracked file hashes unchanged. The primary journal performance test retains SHA-256 `ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`.

Branches, tags, remote-tracking refs, stash and recovery refs remain unchanged. Three app-managed `refs/codex/turn-diffs/` entries rotated during the session (two removed and one added). Their removed targets remain readable; the exact old ref map and the 113 objects not reachable from current refs were saved in an externally verified recovery pack. No task command changed Git refs. `tool-snapshot-ref-delta.json` records this qualification of the all-ref comparison. The first preservation probe also used expanded untracked status rather than the capture's normal status; the matching-command recheck confirms primary status unchanged. Initial failed probe receipts are preserved.

`docs:check` passes for 226 maintained Markdown files, whitespace checks pass, and the negative pilot receipt is verified to reject the remaining stage before any additional provider attempt. The final recovery patch and file archive include all thirteen current candidate files; their reconstruction and file hashes are checked outside every Git worktree.
