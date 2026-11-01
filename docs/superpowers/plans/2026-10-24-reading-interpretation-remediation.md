# Reading Interpretation Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Use `superpowers:subagent-driven-development` only if delegated execution is selected. Track progress with the checkboxes. This revision authorizes planning and evidence preservation; implementation and provider experiments have not started.

**Goal:** Improve question-specific card interpretation without turning symbolism into personal evidence, weakening retrieval safeguards, or confusing structural checks with reading quality.

**Architecture:** Freeze inputs and evaluation criteria first. Repair card-note evidence boundaries and reversal propagation, then symbolic pacing and question-led synthesis, in separately measurable increments. Integrate retrieval changes independently and qualify the combined result on Claude and the actual Qwen fallback path.

**Tech Stack:** Existing JavaScript ESM, Node test runner, Cloudflare Worker prompt pipeline, subscription-backed Claude qualification, and a separately authorized Modal Qwen comparison. No new runtime dependency, production evaluation service, or database migration.

**Spec:** The user's 2026-10-24 review, transcribed into the [design contract](#design-contract), [evaluation contract](#evaluation-contract), and [review-to-task map](#review-to-task-map) below. Preserve the [reading input contract](../../reading-context-inputs.md) and coordinate with the [GraphRAG plan](2026-10-24-graphrag-complete-remediation.md) and [pipeline correctness plan](2026-10-24-reading-pipeline-correctness-remediation.md). Read the pipeline plan from `master`; the primary checkout holds an older untracked draft at the same path. The GraphRAG plan was written against `a2b7d7f6` and needs the rebase described under [Retrieval boundary and ownership](#retrieval-boundary-and-ownership).

**Status and evidence:** Plan revision 2; planning only. Implementation base: `origin/master` `70ecff1f4ad2ba2286484cd749f13a7d0161faba` (reading prompt 1.5.2, evaluator 2.6.0). It is also the source attributed to the audited reading's production Worker, so the historical reconstruction and the current base are the same code. Revision 1 reviewed the primary checkout at `a2b7d7f6` (prompt 1.4.0), an ancestor 19 commits behind `70ecff1f`; its probes and baseline are superseded. Prompts 1.5.0–1.5.2 changed retrieval membership, made identified canon claims conditional, made Marseille pip text symbolic, and removed the Chariot's reins, but left the card-note donors, reversal propagation, and pacing untouched. Offline probes of `70ecff1f` reproduce both structural findings, more broadly than revision 1 stated: all eight reversal framework keys change the global lens text but yield byte-identical five-card notes, and pacing returns `developing-arc` for 78/78 trajectory cards in five-card, three-card, and five-card relationship spreads. Original raw prompt bytes were not persisted; the reconstructed request is not an exact capture. These observations are structural evidence, not proof that any replacement generates better readings.

## Revision 2 changes

Revision 1 is preserved unchanged in `plan-revision-1/`, and its plan text in `plan-revision-2/previous/plan-revision-1.md`. Revision 2:

- Rebases the baseline, probes, and file references from `a2b7d7f6` to `70ecff1f`.
- Moves 16 of the 19 generation pairs' history to a card reflection, the web reading flow's only history channel, and keeps 3 on `reflectionsText`.
- Paraphrases D01 and removes the private question and timestamp from every revision-2 file. D06 now asks the same question, so the D01/D06 absent variants differ only in deck.
- Records each card's selected-deck display name and the source-derived context, moon phase, reversal framework, timing profile, and astrology admission. Requests carry no context.
- Gives every pair its own reference time, covering all eight moon-phase labels.
- Adds D13 (D03's question and history over a different draw), assigns arm S to D03/D13, and assigns arm T to D02/D12 so T includes a no-timeframe case.
- Rewrites reserved H01 so its two time limits are unambiguous and its history no longer routes to the wellbeing context.
- Moves the four evaluator examples that used reserved H01/H02 onto calibration-only cases C01/C02.
- Specifies how the comparison runner handles the production Modal retry.
- Adds the pacing profile's other consumers (astrology admission, local composer) to Task 4, the `none` override to Task 3, and per-card reflection rendering to Task 2.

## Global constraints

- Card identity, orientation, deck, position, and user wording remain authoritative. Preserve people/roles, Unicode, negation, explicit boundaries, and literal timeframes through existing screening; do not invent relationship history.
- Distinguish user reports from externally verified facts. Neither a card, its position, a lens, imagery, nor a retrieved reference establishes anyone's feelings, intentions, private conduct, history, or future.
- Literal imagery must have support for the selected deck. Missing imagery remains absent; do not fill Marseille or Thoth gaps with RWS scenes. Keep symbolism separate from depicted objects.
- Preserve provider ordering, jobs, cancellation, retry semantics, local fallback availability, personalization admission, memory selection, source receipts, and existing safety rules.
- Preserve the current `2–4` optional next-step guidance and existing spread/depth word bands throughout the interpretation comparisons. Action count and reading length are separate later experiments.
- Preserve retrieval relevance threshold `0.3`, selected-deck projection, one variant per pattern, passage caps, weak-match labels, and disabled/empty retrieval paths. Increased eligibility does not mandate inclusion or use.
- Freeze provider/model/configuration, raw inputs, reference time, unrelated derived context, prompt budget policy, and output budget policy within each comparison. Only the named treatment may change derived context. Freeze retrieval results during N–S and G2; for G1, freeze the corpus and scoring evidence while allowing its eligibility change to affect selection.
- Narrative gates use the owner's Claude subscription and fail closed without it; never substitute paid API credentials. Qwen generation requires a separate bounded experiment authorization. This document starts neither.
- Preserve failed, contradictory, truncated, and refused outputs. No silent retries, successful-only denominators, or aggregate scores that erase a failed dimension.
- Use an isolated worktree on current `origin/master` when implementation is authorized; the primary checkout is at `a2b7d7f6` with unrelated journal/UI work and cannot fast-forward. Preserve that work and the existing plans. No commit, push, or deployment is authorized by this plan revision.

## Review focus

1. A user says there has been no repair attempt or asks for no contact: do not invent momentum, turn caution into avoidance, or recommend contact. Tasks 1, 2, and 5 own these cases.
2. A reversed card receives an unknown lens or a `none` override, or an upright card shares a spread with reversals: fallback must be explicit and upright interpretation must remain invariant. Task 3 owns these cases.
3. A spread has no usable timing signal, a single signal, or conflicting signals; a question has no timeframe or says “not today”: do not fabricate a deadline or erase the negation. Task 4 owns these cases.
4. The same question uses different cards/decks, or the same cards answer a different question: focus follows the question and roles, imagery follows the selected deck. Tasks 2 and 5 own these cases.
5. Retrieval produces no relevant evidence, only a weak floor, or the same Wands material twice: allow no reference use, retain weak labeling and all source identities, and avoid double emphasis. Task 6 owns these cases.

## Design contract

### Card notes and evidence boundaries

Add a prompt-only `buildPromptCardNote(cardInfo, position, options) -> CardNote` in `functions/lib/narrative/prompts/cardNotes.js`. `CardNote` separates:

- `identity`: canonical key/name, selected-deck display name, orientation, deck ID.
- `position`: original label, canonical role when available, and zero-based index.
- `meanings`: canonical orientation-appropriate meanings, explicitly labeled symbolic possibilities.
- `imagery`: selected-deck literal details with their existing source identifiers; empty when no supported details exist. Symbolic associations occupy separate fields.
- `lens`: `{ requestedKey, appliedKey, applied, fallbackReason, guidance }`; applies only to reversed cards. Task 2 reserves the field; Task 3 wires its behavior.

Do not add personal history to `CardNote`. Accepted user sources keep their source IDs (`question`, `reflections`, `card-N`, `interpretation-N`) and their status as user reports. The web reading flow sends history only as per-card reflections (`reflectionsText` is always `''`), and `buildCardWithImagery()` renders each one inside its card's block as `*Querent's Reflection:* (card N) <user_context source="card-N">`. Keep that attributed block with its card, serialized once and visibly separate from the note's identity, meaning, imagery, and lens fields; never merge its text into a symbolic field. Caller interpretations (`interpretation-N`) follow the same rule. A quoted user report such as “I sent an apology” supports acknowledging that reported action; it does not support saying the apology worked or that the other person welcomed it. An explicitly hypothetical example must remain hypothetical throughout the paragraph. Adding “may” to an invented biography is not sufficient grounding.

Remove second-person factual assertions from generated meaning/context/imagery donors. For example, Three of Wands can invite considering whether an effort is already underway; it cannot establish that repair was attempted. King of Cups can symbolize emotional steadiness without certifying that the user already possesses it or treating suppression as regulation. Preserve interpretations involving waiting, boundaries, engagement, or no action when compatible with the question. No fixed list of alternatives must appear in every reading.

Use existing sanitization, canonical card resolution, deck projection, approved vision eligibility, and per-card reflection handling. `buildCardWithImagery()` must serialize the new note once; existing imagery wrappers must not reintroduce removed personal claims or unsupported scenes. Shared `buildPositionCardText()` remains readable for local composition; neutralize its shared assertion donors without exposing serialized prompt records in fallback prose.

### Reversal selection and propagation

Preserve existing request behavior: a valid override selects its framework; absent/`auto`/unknown overrides follow `selectReversalFramework()` automatically. All-upright spreads resolve to `none`. Validate overrides against `REVERSAL_FRAMEWORK_OVERRIDES`, which excludes `none`: today `analyzeSpreadThemes()` checks the full registry (`functions/lib/spreadAnalysis.js:414`), so a request with `reversalFrameworkOverride: 'none'` and reversed cards gets “All Upright” guidance. Treat that override as unknown. Do not introduce a new public request rejection policy in this fix.

At the card-note boundary, carry the resolved framework **key** as well as its descriptor through `getPositionOptions()` and every spread builder. Use the canonical framework registry rather than trusting arbitrary descriptor text. If a reversed card reaches this internal boundary without a valid resolved key, use `contextual`, with `fallbackReason: 'missing_framework'` or `'unknown_framework'`. `none` on a reversed card is invalid at this boundary and uses the same contextual fallback. An upright card has `applied: false`, `appliedKey: null`, and no lens guidance. Resolve the descriptor once for prompt assembly so global guidance and per-card fallback cannot disagree; replace the current missing-descriptor “Upright Emphasis” fallback where reversed cards are present. Existing descriptor consumers (`getCrossCheckReversalNote()`, `appendReversalReminder()`, `buildInlineReversalNote()`, `buildGuidanceActionPrompt()`) use the same resolved descriptor.

Identity, canonical meanings, position, and literal imagery must remain identical when only the lens changes. Only the lens-dependent interpretive guidance changes. Test all supported framework keys and every reversed slot, with both a Major and a Minor. Do not assert that every pair of frameworks produces different natural-language readings; overlap can be correct. Propagation receipts and semantic lens suitability establish the contract.

### Pacing aggregation and requested time

Keep the current card-to-symbolic-tempo mapping in this change. Preserve `getSpreadTimingProfile()`'s public return type: `null | 'near-term-tilt' | 'developing-arc' | 'longer-arc-tilt'`. Add a pure internal `aggregateTimingHints(hints)` and exercise this table before changing production behavior:

| Usable selected signals | Result | Example |
| --- | --- | --- |
| Zero; empty, missing, or unknown hints | `null` | No timing data |
| One | The matching qualitative profile | `sooner` → `near-term-tilt`; `longer-arc` → `longer-arc-tilt` |
| Multiple, unanimous | The matching qualitative profile | Two `developing` → `developing-arc` |
| Multiple, one category has at least 2/3 of valid votes | That category's profile | Two `sooner`, one `longer-arc` → `near-term-tilt` |
| Multiple, no category reaches 2/3 | `null` | One fast/one slow; three fast/two slow; one of each |

The 2/3 rule is a proposed conservative consensus policy, not a measured confidence estimate. Unknown hints do not vote. Prefer canonical trajectory roles (`future`, `near_future`, `direction`, `outcome`, `rel_outcome`), with existing label aliases retained for compatibility. Use all cards only when no trajectory slots exist; unusable trajectory cards do not silently borrow timing from unrelated slots. This also fixes selection of canonical Celtic labels that lack the older “(Card N)” suffix.

The defect is not specific to five-card readings. Any spread whose only matched trajectory slot is a single card (five-card `direction`, three-card `future`, relationship `rel_outcome` when drawn) can never reach the current two-vote threshold (`functions/lib/pacingHeuristics.js:135`), so it always returns `developing-arc`. Canonical Celtic labels match no trajectory slot, so all ten cards vote. Under the one-signal row, 44 of the 78 possible trajectory cards change profile (22 to `near-term-tilt`, 22 to `longer-arc-tilt`).

The profile has consumers beyond the user prompt. `shouldIncludeAstroInsights()` adds one astrology point for `developing-arc` or `longer-arc-tilt` (`functions/lib/narrative/prompts/astro.js:29`), and the local composer's three-card and Celtic builders and `buildEnhancedSynthesis()` write pace sentences from it. The 22 `near-term-tilt` cards lose that point; offline, that flips admission for 21 of 76 no-anchor three-card draws at a quarter moon and for none at a crescent or full moon. Treat these effects as part of P: both arms' receipts record timing profile and astrology admission, and any case whose admission changes is reported separately. Reserved H05 is expected to lose admission. Changing the astrology gate itself is a separate decision. The gate also matches anchors against deck display names, so Thoth's Fortune, Art, The Aeon, and The Universe never count as anchors; that pre-existing defect is out of scope here and is recorded in the probes.

Treat aggregation and timeframe instructions as separate comparison arms. Symbolic tempo is optional interpretive context; it predicts no event date. An explicit timeframe governs the feasible action/reflection, not a promised relationship change. Preserve “today,” “this week,” “next month,” “before tomorrow's conversation,” and negated timing as written. With no timeframe, do not add “today” by default. Keep the full authoritative question available; do not introduce a lossy keyword-based timeframe parser in this repair. Even when the question asks when an outcome will occur, do not convert symbolic pace into a factual forecast.

### Question-led synthesis

Add `buildSynthesisContext({ userQuestion, spreadInfo, cardsInfo }) -> { question, positions }` in `functions/lib/narrative/prompts/synthesisContext.js`; each position contains `{ index, roleKey, label, cardKey }`. Reuse existing `SPREADS.roleKeys` and actual present slots; do not infer missing relationship clarifiers or insert absent cards.

The prompt asks the model to identify the relevant role or roles from the actual question, answer through those cards, and connect the remaining cards to that answer. For a hidden-strength question, subconscious/support roles may be useful; support, challenge, core, advice, or direction questions need different anchors. This is a semantic synthesis instruction, not a fixed “hidden always wins” or card-name rule. Ambiguous or multi-part questions allow multiple anchors and a balanced reading. Unknown/custom roles keep their original labels without forced classification.

Do not add a separate intent-classification model call or require private reasoning to be exposed. Static checks can prove role metadata arrives; only output review can establish that the reading selected useful anchors and integrated the spread. A repeated question, all five card names, or a flattering assertion does not satisfy synthesis.

### Retrieval boundary and ownership

Task 1 of the existing GraphRAG plan owns multi-Major enumeration. Add this reading's Fool/Wheel case to that change; do not implement a competing candidate path. Keep semantic scoring changes, threshold changes, corpus expansion, and single-court material out of this interpretation work. That plan was written against `a2b7d7f6`. Since prompt 1.5.0, `buildGraphKeys()` counts `totalMajors` over distinct canonical identities (`groupGraphCardIdentities()`) and admission rejects duplicate identities, so its premise that `totalMajors` keeps a slot-count meaning no longer holds; rebase its Task 1 on `master` before G1. Branch `claude/retrieval-variant-gating-20261024` (`6267fa35`, unmerged) changes `selectPassageCandidates()`; decide whether it lands before G1 and G2, and freeze retrieval evidence on whichever base is chosen.

Separate deduplication from eligibility. Deduplicate repeated interpretive material across direct highlights and retrieved references using a stable pattern/content identity after deck projection. Preserve all contributing provenance and distinguish direct-highlight presence, retrieval selection, and final prompt inclusion. A shared topic or suit is not sufficient to deduplicate distinct interpretations. Preserve weak warnings on any retained rendition and do not count suppressed text as injected. If a retained reference is removed later for budget, deduplication must not falsely claim it remains available.

Clarify two different empty states: no eligible/projectable references legitimately returns `[]`; eligible but subthreshold references may retain the existing labeled one-passage floor, while the reading may use **none** of it. `includedInPrompt` means availability, not evidence that a sentence used the reference. Never require a reference mention to pass evaluation. Removing the weak floor itself would be a separate policy change; it is not hidden inside expanded eligibility.

## Evaluation contract

### Frozen materials and fixture matrix

Private evidence lives in `.superpowers/reading-prompt-audit-20261024-9c354374/`. Preserve the original reading, inputs, reconstructed prompts, provider request, saved evaluation, manifest, probes, and illustrative candidate byte for byte; `plan-revision-1/frozen-audit-manifest.json` records 26 original artifact hashes. Do not publish private personalization or copy the private journal record into ordinary test fixtures. Revision 1 materials stay unchanged in `plan-revision-1/`. Revision 2 materials live in `plan-revision-2/`: `build-revision-2.mjs` derives them from revision 1 plus listed changes, `probe-current.mjs` records the structural probes, and `verify-revision-2.mjs` checks both. Each script first verifies its source tree byte for byte against `70ecff1f` and makes no network or model calls.

`plan-revision-2/fixture-matrix.json` freezes 26 synthetic development cases (13 history pairs), 12 reserved qualification cases (6 pairs), and 4 calibration-only cases (2 pairs) that are never generated, plus a hash reference to the original private case. Each pair changes only the supplied history and its source metadata. It records exact questions, card orders/orientations, decks, expected focal roles, temporal constraints, source boundaries, and provenance. These expectations are proposed test labels, not independent human ground truth. Keep the reserved set out of prompt tuning; changes after looking at its results require a new version and new reserved cases. The matrix also records values derived from `70ecff1f` as review aids, never as request inputs: each card's selected-deck display name, the inferred context, moon phase, applied reversal framework, current timing profile, and astrology admission.

- **History channels:** 16 of the 19 generation pairs supply history as one card's `userReflection` (source `card-N`), the web reading flow's only channel. D09, D10, and H04 use `reflectionsText` (source `reflections`), which API, MCP, and follow-up callers can send.
- **Contexts:** requests carry no context; production infers it. Inferred contexts vary (love, decision, general), and H04 and H06 change context when history is supplied. No case routes to the wellbeing context.
- **Deck names:** reviewers accept the app's aliases rather than marking them as undrawn cards. Thoth shows canonical King of Cups as Knight of Cups and Wheel of Fortune as Fortune; Marseille shows Two of Wands as Two of Batons and The Fool as Le Mat.
- **Reference times:** each pair has its own instant between late October and mid-December 2026, covering all eight moon-phase labels; none uses the private reading's timestamp. Most draws contain Wheel of Fortune, an astrology anchor, so their admission does not depend on pacing.
- **Privacy:** D01 paraphrases the private question while keeping the inferred context, retrieval context, and Unrealized Potential lens that the original wording produced. No revision-2 file contains the private question text. Development and calibration cases may be copied into the public repository; reserved cases stay in the private directory, and public files list them by ID and hash.
- **Scope:** 24 of the 42 cases intentionally reuse the original five-card draw to study this failure across question variants. Results qualify relationship-themed questions on this draw family, the partly varied draws (D05, D08–D11, H05), and the fully different D13, not tarot interpretation in general.

Development coverage: original question shape (paraphrased); support/core/challenge/direction questions; today/week/month/quarter/no timeframe; RWS/Thoth/Marseille; one question and draw in RWS and Marseille (D01/D06); one question and history over two different draws (D03/D13); a hidden position with a different card; a relationship “them” question; a decision with wait/contact alternatives; Celtic advice; ambiguous multi-part synthesis. Reserved cases include negation, a reported failed attempt, explicit no-contact, competing timeframes, non-RWS imagery, and a question whose best anchor is not hidden. Calibration-only C01 (a negated evening) and C02 (an explicit no-contact month) host the evaluator examples those behaviors need, so no evaluator example uses a reserved case.

Add separate offline edge fixtures for zero/one/multiple/conflicting pace signals, all reversal frameworks, a `none` override with reversed cards, upright invariance, missing/unknown lens keys, unknown/custom positions, a card reflection in every spread builder, astrology admission under the pacing change, disabled/empty/weak retrieval, and preservation across all spread builders. These are structural fixtures, not additional live-generation cases.

### Reading-quality labels

Create an offline interpretation rubric alongside the existing delivery/safety evaluator. Do not silently redefine the production gate or overwrite historical rubric 2.6.0 results. Every reviewed output includes quoted evidence spans and, where applicable, the user-source ID supporting a personal statement.

| Dimension | 0 — failure | 1 — weak | 2 — acceptable | 3 — strong |
| --- | --- | --- | --- | --- |
| Personal-claim grounding | Invents personal history/private mental state or presents symbolism as fact | Hedges still imply a particular unsupported biography | User reports are attributed; examples/possibilities stay conditional | Useful specificity follows the supplied facts without unsupported extrapolation |
| Agency and control | Prescribes an outcome, violates a boundary, or implies control over another person's response | Pushes one relational outcome without support | Feasible optional guidance within the user's control | Handles the relevant tension and preserves compatible alternatives without listing them mechanically |
| Timeframe fidelity | Changes a stated boundary or predicts an event deadline from cards | Includes the timeframe but advice does not fit it | Action fits the literal timeframe; outcome timing stays uncertain; no-timeframe cases gain no invented deadline | Distinguishes what can be done now from what depends on time/others, when relevant |
| Question-specific synthesis | Does not answer, privileges the wrong anchor, or materially misreads roles/cards | Echoes the question or provides a generic card-by-card list | Directly answers through relevant role(s) and relates the other cards | Explains a meaningful interaction/tension specific to the question, without inventing facts |

Retain separate checks for card/deck/orientation/position fidelity, lens suitability, unsupported literal imagery, and internal contradictions. A soft phrase, a concise answer, or a perfect average cannot cancel a violation. Advice that encourages contact despite a no-contact request is a failure even if phrased gently. Acknowledging supplied history does not authorize claims about its effects.

Before generation, freeze paired evaluator examples: invented vs attributed repair, calm vs suppression, control vs agency, action today vs promised reunion today, and question echo vs actual synthesis. Revision 2 keeps 19 such fragments in `plan-revision-2/evaluator-contrast-examples.json`, including acceptable waiting, boundary, engagement, and no-action examples. None uses a reserved case: the four that used H01/H02 now use calibration-only cases C01/C02, and history citations use each fixture's actual source ID. Fragment labels apply only to their named dimension, not to a complete reading. Human review must adjudicate ambiguous labels before treating an automated judge as qualified. Until then, judge scores are exploratory aids. Do not manufacture an evaluator confidence claim from self-authored examples.

### Controlled comparisons and run receipts

The illustrative `candidate-prompt.md` changes wording, emphasis, and action count together. Exclude it from component attribution and release gates. Preserve it as an editorial example; do not silently replace the baseline with it.

Use a frozen baseline built from the implementation base (`70ecff1f`, prompt 1.5.2) for prospective comparisons. The historical output is diagnostic evidence, not a matched stochastic control, even though it came from the same source: its exact request bytes are unknown. Revision 1's `a2b7d7f6` baseline is superseded; it is an ancestor of `70ecff1f` and lacks prompts 1.5.0–1.5.2. If the base moves again before execution, freeze a new baseline, document its difference from this one, and rerun affected comparisons.

| Arm | One change against its accepted predecessor | Four development cases |
| --- | --- | --- |
| N | Neutral note/evidence boundaries, including deck fidelity | D01 and D06, both history variants |
| R | Per-card reversal propagation | D07 and D08, both variants |
| P | Timing selection/aggregation only | D05 and D11, both variants |
| T | Literal-question timeframe authority only | D02 (this week) and D12 (no timeframe), both variants |
| S | Question-to-position synthesis only | D03 and D13 (same question and history, different draws), both variants |
| G1 | Multi-Major eligibility only | D01 and D09, both variants |
| G2 | Direct/retrieved repetition removal only | D06 and D10, both variants |

D04 has no live arm and remains a development fixture for offline and prompt-assembly checks. Calibration cases C01/C02 are never generated.

Each comparison measures the incremental effect on its accepted predecessor, not an independent main effect against the original. Retain the prompt/request diff for each arm and reject accidental changes outside that arm. If the attribution remains ambiguous, report it; do not claim causation from the combined package. Rebuild treatment-owned derived fields from identical raw inputs: P must actually recompute pacing rather than reuse a frozen `timingProfile`. G1 uses a frozen corpus and common precomputed score evidence for the union of eligible candidates; only enumeration/selection may change. Freeze that evidence before the comparison and budget any required embedding acquisition separately. G1/G2 use their own changesets and remain disabled during N–S comparisons.

Use 3 Qwen runs and 2 Claude subscription runs per case **per arm**, alternating arm order within provider/case blocks. A component batch is 4 cases × 2 arms × (3 + 2) = **40 readings**. Seven batches have a maximum of 280 readings; stop for review after each batch. The final reserved comparison is 12 cases × 2 arms × (3 + 2) = **120 readings**, combined candidate versus frozen current baseline. Planned maximum: **400 readings, 240 Qwen and 160 Claude**, excluding the existing required release gate. These are proposed ceilings, not authorization to run them; the first authorized batch would be N only. Do not run all batches automatically after a failure.

Pin the exact provider/model deployment or immutable endpoint revision where available. Record mutable-alias limitations and reject a mixed-deployment comparison. Keep reference time, payload, personalization, accepted memories, deck data, retrieval snapshot, model reasoning setting, temperature/top-p where supported, timeout, word band, action count, and token-cap policy identical within pairs. Random seeds are recorded only if the provider actually supports them; repeated calls are not reproducible merely because a seed field was written locally.

For the historical Qwen configuration, the application sends no `max_tokens` cap. A controlled comparison must either pin the same endpoint deployment and verify its effective default cap, or use an explicit supported cap of **32,000 total output tokens in both arms**, rebuilding the control under that identified experimental configuration. Matching an omitted field with an unknown mutable server default is insufficient to claim a fixed output budget. If the explicit cap is unsupported and the effective default cannot be established, postpone the controlled comparison rather than label it controlled. Keep production-compatible uncapped routing checks distinct from a capped quality experiment. Claude subscription comparisons retain the existing requested **32,000** output-token limit, model, reasoning effort, transport, and timeout; record any gap between the requested and enforced limit. Reasoning tokens and visible prose tokens must be reported separately where available. No candidate-only cap or word-band reduction is allowed.

Store source/prompt/fixture hashes, arm, case/pair IDs, repetition, reference time, history channel, inferred context, timing profile, astrology admission, provider request settings, model/deployment, requested/effective budget policies, start/end times, finish reason, usage, full visible output, errors, and adjudicated findings. Present outputs to reviewers in shuffled order with arm/provider identity hidden until initial judgments are recorded; retain the full user context and card/deck data needed for assessment. Keep raw artifacts private; ordinary telemetry stays text-free. Capture provider-supplied reasoning only under existing policy; do not request private chain-of-thought for evaluation.

Use a dedicated explicit Qwen runner for these experiments; do not relax `runNarrativeSamples.js`'s subscription-only policy to accept paid providers. Production now gives `modal-qwen` one automatic retry after a structural quality-gate rejection when at least 120 seconds of the reading budget remain (`QUALITY_RETRY_BACKENDS` in `functions/api/tarot-reading.js`, commit `f2cc3687`), so quality runs do not go through the production loop. Each scheduled attempt calls the Modal backend once with the fallback path's payload and prompt assembly (`buildOpenAIResponsesPrompts()` with `backendId: 'modal-qwen'`, then `generateWithModalQwen()`), applies the same structural quality gate itself, and records a rejection, with its output, as that attempt's result; do not repeatedly incur a paid Claude failure. Assert the recorded provider is Qwen; a local/OpenAI substitution is a failed experiment. Verify routing of the production loop, including the Claude-failure fallback and the Modal retry, with offline stubs; those checks stay outside quality denominators.

Freeze retry policy at zero automatic generation retries for comparisons. Transport failures and refusals remain in the run ledger; a later replacement requires an explicitly labeled attempt and retains the original denominator. Do not label a missing output as a semantic pass or silently replace a contradictory reading. Report output availability separately from interpretation quality.

### Acceptance and limits

- Offline contracts must pass before any generation. A failed new regression is retained as evidence; do not weaken its expectation to make a gate green.
- Component review reports every dimension and critical violation by provider, case, and repetition, alongside paired better/tied/worse judgments. No aggregate-only pass. A target behavior must be observed in outputs, not inferred from prompt text.
- Combined qualification requires every available reserved candidate output to score at least 2 on each of the four dimensions, with no card/deck/agency/unsupported-personal-fact hard failures. Report the full denominators and availability; missing scheduled outputs make the planned run incomplete.
- To claim improvement, demonstrate lower observed targeted violation counts or adjudicated improvement on the target dimension without a new regression. An unchanged passing result supports compatibility only. A small repeated sample does not establish population reliability or statistical superiority.
- Retain and review failures even if the mean improves. Disagreement between judge and human, or between repetitions, must appear in the qualification report. Do not tune against the reserved set and continue calling it held out.
- Run the existing subscription-backed narrative gate as a separate compatibility requirement after source freeze. Its pass alone does not qualify Qwen, grounding, timeframe fidelity, or question-led synthesis.
- Treat the “one action” format as optional experiment F1 **after** interpretation qualification: change action count only, keeping the word band fixed. Test shorter length separately as F2. Use the same 40-reading component design if authorized; each adds its own ceiling and cannot establish the other effect.

## Implementation tasks

### Task 1: Freeze fixtures and evaluator expectations before changing generation

**Files:** Create `tests/fixtures/reading-interpretation-v2.json`, `tests/fixtures/reading-interpretation-evaluator-v2.json`, `tests/readingInterpretationFixtures.test.mjs`, `scripts/evaluation/lib/readingInterpretationRubric.mjs`, `scripts/evaluation/runReadingInterpretationComparison.mjs`, and `tests/readingInterpretationComparison.test.mjs`. Extend `tests/narrativeEvaluationEvidence.test.mjs` for new report evidence fields; retain the existing production evaluator's schema and historical results. Reuse `scripts/evaluation/lib/subscriptionNarrative.js` without widening its provider allowlist.

**Interfaces:** Public fixtures contain the development and calibration cases' synthetic inputs, provenance, pair IDs, derived values, and expectations from the private matrix; reserved cases appear only as IDs and hashes. `validateInterpretationReview(review, fixture)` checks dimension scores, evidence spans, source references, and explicit unreviewed status; it does not infer semantic truth from regexes. Output-review labels remain unqualified until reviewed. The comparison runner consumes frozen fixtures, two versioned source/prompt artifacts, provider-specific config, and a bounded run manifest; it emits append-only receipts and complete outputs. Default mode is offline/dry-run. Explicit `--execute --provider claude-subscription|modal-qwen` is required for generation; the manifest bounds cases, arms, repetitions, and allowed provider.

- [ ] Copy only the development and calibration cases of `plan-revision-2/fixture-matrix.json` into the versioned public fixture file; list reserved cases by ID and hash, and keep `originalPrivateCase` out of public files. Assert pair members differ only in the history field, its source metadata, and derived allowed-claim expectations, and that recorded display names and derived values match the source.
- [ ] Freeze the four-dimensional rubric and evaluator contrast examples before touching prompt assembly. Add assertions rejecting missing dimension scores, evidence spans outside the output, invented user-source IDs, duplicate case IDs, and changed reserved cases without a version change.
- [ ] Run `node --test tests/readingInterpretationFixtures.test.mjs tests/narrativeEvaluationEvidence.test.mjs`; expect all fixture/report-contract checks to pass. Record proposed versus human-adjudicated labels explicitly.
- [ ] Before implementing the comparison runner, add tests for exact case/arm/repetition counts, rejection of unequal within-provider settings or mutated fixture hashes, append-only error retention, and refusal to substitute providers. Stub preceding-backend failure and verify the Qwen fallback request path; block network in these tests.
- [ ] Run `node --test tests/readingInterpretationComparison.test.mjs tests/narrativeSubscriptionGates.test.mjs tests/narrativeBackends.test.mjs` and retain expected new failures. Implement the runner, rerun the command, and dry-run every manifest. Freeze its identities, ceilings, and authorization state before prompt changes. This completes the harness needed for each later component gate; it does not start generation.
- [ ] Add initially failing behavioral cases named in Tasks 2–6 before each corresponding implementation. Keep structural regression expectations separate from editorial evaluation labels.

### Task 2: Neutral card notes and deck-specific imagery — arm N

**Files:** Create `functions/lib/narrative/prompts/cardNotes.js` and `tests/promptCardNotes.test.mjs`. Modify `functions/lib/narrative/prompts/cardBuilders.js`, `functions/lib/narrative/helpers.js`, and the evidence-boundary instructions in `functions/lib/narrative/prompts/systemPrompt.js`. Extend `tests/promptInferenceFraming.test.mjs`, `tests/narrativePromptSafety.test.mjs`, and `tests/promptBuilders.test.mjs`.

**Interfaces:** Implement `buildPromptCardNote()` and the `CardNote` schema above; preserve spread builder signatures and `buildPositionCardText()`'s prose return type. Reserve the lens field without claiming propagation is repaired in N.

- [ ] Add failing tests for separated identity/meaning/imagery/role, no personal assertions in generated notes, and supplied history retained only in its attributed user-source block. Test Major and Minor RWS/Thoth/Marseille, missing imagery, an unknown position, and approved/absent vision evidence.
- [ ] Add failing tests that a `card-N` reflection stays attributed in its own card's block, appears once, and never enters the identity, meaning, imagery, or lens fields, for a Major and a Minor in every spread builder; check that `reflectionsText` stays outside the card blocks.
- [ ] Assert the original five-card identity/order/orientations are unchanged; literal RWS battlements/ships do not appear as Marseille illustrations. Verify existing sanitization prevents input text from becoming trusted instructions.
- [ ] Run `node --test tests/promptCardNotes.test.mjs tests/promptInferenceFraming.test.mjs tests/narrativePromptSafety.test.mjs tests/promptBuilders.test.mjs` and retain expected new failures.
- [ ] Replace assertion-bearing prompt donors with the new symbolic note representation, preserving deck source provenance and per-card reflections. Neutralize shared fallback donors without changing local reading format or unrelated imagery content.
- [ ] Rerun the focused command plus `tests/narrativeBuilder.promptCompliance.test.mjs` and `tests/narrativeBuilder.reversal.test.mjs`; inspect representative local fallback prose. When generation is authorized, run N's fixed comparison and record its findings before accepting N.

### Task 3: Wire the selected reversal framework to every reversed card — arm R

**Files:** Modify `functions/lib/narrative/helpers.js`, `functions/lib/narrative/prompts/cardNotes.js`, `functions/lib/narrative/prompts/cardBuilders.js`, and `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`. Align the fallback consumers in `functions/lib/narrative/prompts/userPrompt.js` and `functions/lib/narrative/prompts/constants.js`. Extend `tests/promptCardNotes.test.mjs`, `tests/reversalFrameworkAgency.test.mjs`, and `tests/reversalFrameworkOptions.test.mjs`. Change `functions/lib/spreadAnalysis.js` to validate overrides against `REVERSAL_FRAMEWORK_OVERRIDES`, and otherwise only if propagation needs an exported canonical resolver; do not redesign lens selection.

**Interfaces:** `getPositionOptions()` carries `reversalFramework` plus its existing descriptor. `CardNote.lens` implements the documented external automatic selection/internal contextual fallback distinction.

- [ ] For every `REVERSAL_FRAMEWORK_OVERRIDES` key, assert `appliedKey === selectedKey` at every reversed slot. Assert upright notes' interpreted content is unchanged, and identity/position/imagery/meanings are invariant under lens-only changes.
- [ ] Assert missing/unknown external overrides, and a `none` override on a spread with reversed cards, use automatic selection; missing/unknown internal resolved keys fall back to contextual with reasons; all-upright spreads remain `none`. Assert the global descriptor and each reversed note agree, including a missing legacy descriptor. Include Minor/Major reversals and every supported spread builder.
- [ ] Run `node --test tests/promptCardNotes.test.mjs tests/reversalFrameworkAgency.test.mjs tests/reversalFrameworkOptions.test.mjs tests/promptBuilders.test.mjs`; retain the failing propagation evidence.
- [ ] Wire the key through the existing options path and resolve only the lens-dependent guidance. Rerun the command. Do not add a “all frameworks must differ” assertion; review lens suitability in the authorized R comparison.

### Task 4: Repair pacing, then timeframe authority — arms P and T

**Files:** Modify `functions/lib/pacingHeuristics.js`, `functions/lib/narrative/prompts/userPrompt.js`, and `functions/lib/narrative/prompts/systemPrompt.js`. Create `tests/pacingHeuristics.test.mjs` and `tests/promptTimeframeAuthority.test.mjs`. Extend `tests/narrativeSampleReferenceTime.test.mjs` and `tests/astroRelevanceGate.test.mjs`. Verify, without changing them, the profile's other consumers: `functions/lib/narrative/prompts/astro.js`, `functions/lib/narrative/spreads/threeCard.js`, `functions/lib/narrative/spreads/celticCross.js`, and `buildEnhancedSynthesis()` in `functions/lib/narrativeBackends.js`.

**Interfaces:** `aggregateTimingHints()` implements the decision table; `getSpreadTimingProfile()` preserves its return type and adds canonical trajectory-role recognition without losing legacy labels. Prompt instructions distinguish a supplied action timeframe from optional symbolic pace.

- [ ] Assert the table, including `[sooner]`, `[longer-arc]`, `[developing]`, empty/unknown hints, 2:1, 3:2, ties, and all three categories. Assert five-card Ace of Wands and Ten of Pentacles direction cases no longer collapse to developing. Assert the same for three-card `future` and a drawn relationship `rel_outcome`, canonical Celtic near-future/outcome selection, and unusable selected slots.
- [ ] Assert P's downstream effects: astrology admission changes as expected for a no-anchor three-card draw with a `sooner` trajectory card at a quarter moon, `tests/astroRelevanceGate.test.mjs` covers string profiles, and local-composer three-card and Celtic prose follow the new profile, including `null`. P's receipts record both arms' timing profile and astrology admission.
- [ ] Run `node --test tests/pacingHeuristics.test.mjs`; record failures, implement only selection/aggregation, then rerun. Freeze P's prompt diff and compare P before adding timeframe instructions.
- [ ] Add timeframe authority tests for today/week/month/quarter/relative/no-timeframe/negated-timeframe questions. Preserve exact accepted question text and ensure optional symbolic pace is labeled subordinate; do not claim these static checks establish compliant generated advice.
- [ ] Add the timeframe instructions as T; run `node --test tests/promptTimeframeAuthority.test.mjs tests/narrativeSampleReferenceTime.test.mjs tests/promptBuilders.test.mjs`. Keep action count and output length fixed for T's comparison.

### Task 5: Question-led synthesis across roles and cards — arm S

**Files:** Create `functions/lib/narrative/prompts/synthesisContext.js` and `tests/questionLedSynthesis.test.mjs`. Modify `functions/lib/narrative/prompts/userPrompt.js` and `functions/lib/narrative/prompts/systemPrompt.js`; reuse `src/data/spreads.js` role metadata without changing spread layouts.

**Interfaces:** Implement `buildSynthesisContext()` as specified above. This supplies accurate role data and a synthesis instruction; it does not persist inferred user intentions as facts.

- [ ] Assert positions/roles contain only drawn slots, preserve custom labels and decision paths, and remain valid for all spreads including optional relationship clarifiers. Swap King of Cups out of the hidden slot and assert no hard-coded King/hidden directive appears.
- [ ] Run `node --test tests/questionLedSynthesis.test.mjs tests/promptBuilders.test.mjs`; implement the context and instruction, then rerun with `tests/promptContextRetention.test.mjs` and `tests/narrativePromptSafety.test.mjs`.
- [ ] Review S outputs for a direct answer, appropriate anchors, integration of remaining cards, and agency; compare D03 with D13, where the answer should follow the core card of each draw. A valid boundary/wait/no-action reading is acceptable; do not reward contact or closeness as the default successful outcome.

### Task 6: Retrieval eligibility and repetition as separate changes — arms G1 and G2

**Files:** For G1, coordinate the existing GraphRAG plan's Task 1 in `functions/lib/graphContext.js` and `functions/lib/graphRAGCandidates.js`; extend `tests/graphRAGCandidateSelection.test.mjs` and `tests/graphContext.test.mjs`. For G2, modify the direct/retrieved assembly boundary in `functions/lib/narrative/prompts/userPrompt.js` and `functions/lib/narrative/prompts/graphRAGReferenceBlock.js`; extend `tests/graphRAGProvenance.test.mjs`, `tests/graphRAGSummaryProvenance.test.mjs`, and create `tests/promptGraphDeduplication.test.mjs`.

**Interfaces:** Reuse `graphKeys.majorNumbers` from the GraphRAG plan. G2's request-local deduplication maps a retained rendition to all source identities; it does not change retrieval scores, passage IDs, historical records, or the meaning of `includedInPrompt`.

- [ ] Rebase the GraphRAG plan's Task 1 on `master` first (see [Retrieval boundary and ownership](#retrieval-boundary-and-ownership)). Add the Fool/Wheel regression with and without a stronger existing pattern. Assert eligibility for both drawn Majors and rejection of absent ones, unchanged threshold/caps, preserved weak labels, disabled retrieval, and valid empty results. Coordinate with already-implemented work if the other plan lands first.
- [ ] Run `node --test tests/graphRAGCandidateSelection.test.mjs tests/graphContext.test.mjs tests/graphRAGDeckProjection.test.mjs`; integrate G1 alone and rerun before its comparison.
- [ ] Assert exact/projected duplicate Wands material appears once, distinct Wands interpretations remain distinct, both sources retain provenance, and trimmed-away references do not retain false injection receipts. Include weak floor plus legitimate zero narrative reference use.
- [ ] Run `node --test tests/promptGraphDeduplication.test.mjs tests/graphRAGProvenance.test.mjs tests/graphRAGSummaryProvenance.test.mjs tests/promptContextRetention.test.mjs`; implement G2, rerun, then compare separately. Defer changes to semantic scoring and corpus contents.

### Task 7: Combined qualification and honest handoff

**Files:** Reuse Task 1's comparison runner, rubric, fixtures, and contract tests. Create `docs/superpowers/reviews/2026-10-24-reading-interpretation-qualification.md` when results exist. Coordinate the final prompt-version update in `functions/lib/promptVersioning.js` with other pending prompt work.

**Interfaces:** Consume Task 1's frozen runner contract and each accepted component's run ledger. The combined report preserves those identities and adds the reserved-set comparison without relabeling earlier failures.

- [ ] Verify that N–G2 each have their own accepted comparison or an explicit unrun/failed status; do not silently roll an unqualified component into the combined candidate. Dry-run the final reserved manifest and verify source/prompt hashes, equal settings, and the 120-reading ceiling.
- [ ] Run only the separately authorized component batch, review all its outputs, and stop at its gate before proceeding. After N–G2 acceptance, freeze the combined source and execute the reserved comparison when authorized.
- [ ] Run `npm test`, `npm run lint`, and the existing subscription-backed `npm run ci:narrative-check` on the final frozen implementation, reporting their distinct scope and additional generation count before that gate starts. Run relevant Worker tests separately where the root suite omits them.
- [ ] Write the qualification report with per-provider/per-dimension/per-case evidence, retained failures, reviewed label provenance, repeated-run contradictions, budget/config limits, and exact code/prompt/fixture identities. Mark incomplete/unrun portions explicitly. Do not mark this plan complete based on static checks alone.

## Review-to-task map

| User requirement | Owning work | Required evidence |
| --- | --- | --- |
| Facts versus symbolism; deck-specific imagery | Tasks 1–2 | History pairs on both channels, deck cases with display names, note provenance, output claim review |
| Unused reversal input; invariant upright/identity; fallback | Task 3 | Every framework/reversed slot receipt, invariant fields, fallback tests; semantic output review |
| Zero/one/multiple/conflicting pacing; varied timeframes | Task 4 | Decision-table tests, P/T separation, exact-question cases and output review |
| General question-to-position synthesis; agency alternatives | Task 5 | Role/card permutations, varied focal questions, boundary/wait/no-action labels |
| Eligibility without permissiveness; dedup with provenance | Task 6 | Multi-Major/threshold/weak/empty controls and G1/G2 diffs |
| Evaluation before changes; isolated comparisons | Tasks 1 and 7 | Frozen materials/rubric, paired config equality, reserved cases, independent dimension results |
| Repeated Qwen fallback and retained failures | Task 7 | Actual provider receipts, repeated output sets, no silent replacement |
| Shorter “one action today” proposal kept separate | Evaluation contract, optional F1/F2 | Separate action-count and length comparisons, only after interpretation qualification |

This plan supersedes the original audit's recommended implementation order and comparison design, and revision 2 supersedes revision 1's baseline, fixtures, and evaluator examples. Neither rewrites the audit's historical evidence, validates its illustrative candidate, or declares the implementation complete.
