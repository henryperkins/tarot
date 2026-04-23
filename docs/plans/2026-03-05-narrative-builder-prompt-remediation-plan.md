# Narrative Builder And Prompt Engineering Remediation Plan

Type: plan
Status: active background document
Last reviewed: 2026-04-23

Date: 2026-03-05

**Goal:** Remediate all review findings in the narrative builder and prompt-engineering paths, starting with privacy leaks and user-visible output defects, then fixing telemetry drift and missing backend coverage.

**Scope:**
- `functions/lib/promptEngineering.js`
- `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`
- `functions/lib/narrative/prompts/userPrompt.js`
- `functions/lib/narrative/prompts/cardBuilders.js`
- `functions/lib/narrative/helpers.js`
- `functions/lib/narrative/spreads/*.js`
- `functions/lib/narrativeBackends.js`
- `functions/lib/graphRAGAlerts.js`
- targeted tests under `tests/` and `functions/__tests__/`

**Remediation Principles:**
- Fix privacy leaks before touching lower-severity telemetry issues.
- Add failing tests before changing behavior whenever the current surface can be reproduced deterministically.
- Prefer shared sanitization helpers over one-off fixes in individual builders.
- Keep telemetry semantics aligned with actual prompt/output behavior.
- Treat missing coverage as part of the bug when the defect is easy to regress.

---

## Phase 0: Freeze Repros And Test Targets

### Step 0.1: Capture each current failure mode in targeted tests

Add or extend tests for:
- response echo leakage in persisted prompt payloads
- partial and empty `nameHints` behavior
- upright-only readings incorrectly appending reversal reminders
- single-card builder echoing unsanitized `userQuestion`
- relationship/decision openings when `userQuestion` is absent
- vision source usage remaining true when vision-derived card text survives slimming
- GraphRAG `sourceUsage` semantics for empty graph keys and disabled env
- local-composer GraphRAG debug telemetry and alert interaction
- Claude backend dispatch / prompt-meta contract

### Step 0.2: Group tests by remediation area

Use or extend:
- `tests/promptEngineering.test.mjs`
- `tests/narrativeBuilder.promptCompliance.test.mjs`
- `tests/narrativeBackends.test.mjs`
- `tests/narrativeBuilder.reversal.test.mjs`
- `functions/__tests__/graphRAGAlerts.test.mjs`
- add a new backend-dispatch test file if mocking becomes cleaner than extending the existing backend suite

### Step 0.3: Define the acceptance bar before code changes

For each finding, require:
- one failing repro test
- one passing regression test after the fix
- no weakening of existing privacy or prompt-budget tests

---

## Phase 1: Privacy And Prompt Persistence Fixes

This phase addresses the highest-risk defects because they affect stored prompt payloads and redaction correctness.

### Finding A: Response echo stripping misses `Outcome/Future — likely ...` prompt echoes

### Step 1.1: Add failing payload-redaction tests

Add cases proving that `buildPromptEngineeringPayload()` currently preserves:
- `Future — likely trajectory for "Should I leave my job?" if nothing shifts`
- `Outcome — likely path for "How do I handle this relationship?" if unchanged`

Keep the existing non-echo prose test so the fix does not over-strip normal narrative language.

### Step 1.2: Refactor stripping rules into shared reusable helpers

In `functions/lib/promptEngineering.js`:
- extract the trajectory-label replacements into a shared helper used by both prompt stripping and response stripping
- avoid duplicating the regex logic in separate code paths

### Step 1.3: Update `stripResponseEchoContent()`

Make the response path remove only direct prompt echoes, while preserving legitimate narrative prose that merely uses similar wording.

### Step 1.4: Re-run targeted tests

Run:
```bash
node --test tests/promptEngineering.test.mjs
```

### Finding B: Explicit `nameHints` arrays replace automatic extraction instead of augmenting it

### Step 1.5: Add failing tests for partial and empty hint arrays

Add cases proving:
- `nameHints: ['Alex']` still redacts `Jamie` when the user question mentions both names
- `nameHints: []` does not disable automatic extraction

### Step 1.6: Change redaction-option assembly semantics

In `buildPromptRedactionOptions()`:
- treat explicit `nameHints` as additive, not exclusive
- merge them with extracted hints from `userQuestion` and `reflectionsText`
- continue deduping and filtering against `displayName`

If a future opt-out is needed, introduce an explicit flag such as `disableAutomaticNameExtraction`; do not overload an empty array with that meaning.

### Step 1.7: Confirm all prompt logging paths inherit the fix

Verify the merged behavior is used by:
- `buildPromptEngineeringPayload()`
- `maybeLogPromptPayload()`
- backend prompt logging in `narrativeBackends.js`

### Step 1.8: Re-run targeted tests

Run:
```bash
node --test tests/promptEngineering.test.mjs
```

---

## Phase 2: User-Facing Narrative Output Corrections

This phase fixes defects visible in generated readings.

### Finding C: Single-card builder interpolates raw `userQuestion` into Markdown output

### Step 2.1: Add a failing narrative test

Create a test proving `buildSingleCardReading()` currently preserves raw markdown such as:
- `[x](https://evil.test)`
- markdown emphasis or header markers
- instruction-like question text that should be sanitized

### Step 2.2: Centralize sanitized question usage

Choose one of these implementation directions:
- route the single-card opening through `buildOpening()`, or
- extract a shared `sanitizeQuestionForNarrative()` helper used by both `buildOpening()` and the single-card fallback path

Preferred approach:
- centralize sanitization once
- keep the single-card wording style if needed, but never interpolate raw `userQuestion`

### Step 2.3: Verify rendered Markdown behavior is safe

Confirm the sanitized output no longer produces clickable links through the Markdown renderer.

### Step 2.4: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBuilder.promptCompliance.test.mjs
```

### Finding D: Questionless relationship and decision spreads quote internal fallback copy as a user question

### Step 2.5: Add failing tests for empty-question openings

Add tests proving that:
- `buildRelationshipReading()` with no question should not render `to your question: "This spread ..."`
- `buildDecisionReading()` with no question should not render `to your question: "This spread ..."`

### Step 2.6: Split opening intent from fallback explanation

In `relationship.js` and `decision.js`:
- pass `null` or empty string into `buildOpening()` when the user did not actually ask a question
- keep the descriptive fallback copy available as plain introductory context, not as quoted user input

### Step 2.7: Keep reasoning-aware openings consistent

Apply the same correction to both:
- `buildOpening()`
- `buildReasoningAwareOpening()`

If the reasoning path currently expects a string, update it to handle absent questions cleanly.

### Step 2.8: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBuilder.promptCompliance.test.mjs
```

### Finding E: Upright-only readings append a false reversal reminder

### Step 2.9: Add failing tests for upright-only spreads

Cover at least:
- single-card upright-only
- three-card upright-only
- one additional spread builder to prove the helper-level fix works globally

### Step 2.10: Fix `appendReversalReminder()`

In `functions/lib/narrative/helpers.js`:
- require at least one actually reversed card before appending the reminder
- preserve the existing guard that avoids duplicate reminders

### Step 2.11: Review builder call sites

Confirm no builder relies on reversal reminders as a substitute for inline reversal handling.

Builders to verify:
- `singleCard`
- `threeCard`
- `fiveCard`
- `relationship`
- `decision`
- `celticCross`
- local generic composer path if it uses a separate reversal helper

### Step 2.12: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBuilder.reversal.test.mjs
node --test tests/narrativeBuilder.promptCompliance.test.mjs
```

---

## Phase 3: Prompt-Assembly Telemetry Alignment

This phase fixes mismatches between what the prompt actually contains and what telemetry reports.

### Finding F: `sourceUsage.vision.used` flips to false when diagnostics are dropped, even if vision still shapes card text

### Step 3.1: Add a failing prompt-meta test

Construct a slimmed prompt where:
- vision diagnostics are removed
- vision-derived tone or emotion lines still remain in the card section
- `promptMeta.sourceUsage.vision.used` should remain true

### Step 3.2: Define the correct telemetry rule

Set `vision.used` based on whether vision-derived content survives in the final prompt, not whether the dedicated diagnostics section survived.

Recommended implementation:
- track a boolean during card-builder assembly when vision-informed text is emitted
- thread that signal into `promptMeta.sourceUsage`

Avoid brittle string-search-only detection if a direct signal can be carried through options or return metadata.

### Step 3.3: Preserve `skippedReason` semantics

Differentiate among:
- `not_provided`
- `removed_for_budget`
- `diagnostics_disabled`
- `used`

### Step 3.4: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBuilder.promptCompliance.test.mjs
```

### Finding G: GraphRAG `sourceUsage` reports `requested` for empty graph keys and can drop disable reasons

### Step 3.5: Add failing GraphRAG telemetry tests

Cover these cases:
- `graphKeys: {}` should not count as a meaningful GraphRAG request
- `GRAPHRAG_ENABLED=false` with available payload should preserve a disable reason in `sourceUsage.graphRAG.skippedReason`
- empty payload plus empty graph keys should not yield `requested: true`

### Step 3.6: Tighten `hasGraphRAGSource` detection

In `buildEnhancedClaudePrompt()`:
- treat GraphRAG as requested only when there is a meaningful source:
  - non-empty payload passages
  - non-empty graph keys
  - a retrieval attempt with explicit metadata

Do not treat bare empty objects as evidence that GraphRAG was meaningfully requested.

### Step 3.7: Propagate disable and skip reasons consistently

Ensure `sourceUsage.graphRAG.skippedReason` reflects:
- `disabled_by_env`
- `retrieval_failed_or_empty`
- `removed_for_budget`
- `not_requested`

### Step 3.8: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBuilder.promptCompliance.test.mjs
node --test functions/__tests__/graphRAGAlerts.test.mjs
```

### Finding H: Local-composer GraphRAG debug mode records contradictory telemetry and triggers a false omission alert

### Step 3.9: Add failing debug-mode tests

Create a local-composer test proving:
- debug mode appends Traditional Wisdom output
- telemetry no longer says `includedInPrompt: false`
- `applyGraphRAGAlerts()` does not emit an omission warning in that scenario

### Step 3.10: Normalize debug-mode semantics

Pick one model and use it consistently:

Option A:
- set `includedInPrompt: true` when debug GraphRAG is visible in local-composer output

Option B:
- keep `includedInPrompt` strictly reserved for LLM prompt injection
- update alert logic to suppress omission warnings when `debugVisibleInOutput` or another explicit visibility flag is true

Preferred approach:
- keep the meaning precise
- add a separate `visibleInOutput` or reuse `debugVisibleInOutput`
- update alert logic so debug-visible passages are not treated as omitted

### Step 3.11: Reconcile local-composer prompt-meta fields

Ensure these fields do not conflict:
- `includedInPrompt`
- `injectedIntoPrompt`
- `debugVisibleInOutput`
- `passagesUsedInPrompt`

### Step 3.12: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBackends.test.mjs
node --test functions/__tests__/graphRAGAlerts.test.mjs
```

---

## Phase 4: Backend Coverage And Contract Hardening

This phase addresses the low-severity but important coverage gap around the Claude backend and dispatcher path.

### Finding I: Claude backend and `runNarrativeBackend()` dispatch path are effectively untested

### Step 4.1: Decide the test seam

Use one of:
- dependency injection for transport helpers, or
- module-level mocking around `fetchWithRetry()` and prompt builders

The goal is deterministic tests without live network calls.

### Step 4.2: Add Claude backend tests

Cover:
- prompt construction path
- request payload shape sent to the Anthropic/Azure endpoint
- empty response handling
- prompt logging redaction behavior
- prompt-meta propagation on the payload object

### Step 4.3: Add dispatcher tests for `runNarrativeBackend()`

Cover:
- `azure-gpt5`
- `claude-opus45`
- `local-composer`
- unknown backend id error path

### Step 4.4: Reconcile prompt-meta contract if needed

Review whether `generateWithClaudeOpus45()` should also return `promptMeta` in its result for parity with Azure GPT-5, or whether payload mutation alone is the intended contract.

If returning `promptMeta` improves consistency, update the implementation and tests together.

### Step 4.5: Re-run targeted tests

Run:
```bash
node --test tests/narrativeBackends.test.mjs
```

---

## Phase 5: Cross-Cutting Refactors To Reduce Regression Risk

### Step 5.1: Consolidate question sanitization

Create one shared narrative-question sanitizer used by:
- `buildOpening()`
- single-card openings
- any future spread-specific introductory text

### Step 5.2: Consolidate source-usage calculation where practical

Avoid duplicated prompt-meta truthiness checks spread across:
- enhanced prompt builder
- local composer
- GraphRAG alert logic

### Step 5.3: Document telemetry meanings inline

Add short comments where fields are easy to misuse:
- `includedInPrompt`
- `injectedIntoPrompt`
- `debugVisibleInOutput`
- `used`
- `requested`
- `skippedReason`

### Step 5.4: Keep comments narrow and behavioral

Document the invariant, not the implementation history.

---

## Phase 6: Validation And Release

### Step 6.1: Run the targeted suites first

```bash
node --test tests/promptEngineering.test.mjs
node --test tests/narrativeBuilder.reversal.test.mjs
node --test tests/narrativeBuilder.promptCompliance.test.mjs
node --test tests/narrativeBackends.test.mjs
node --test functions/__tests__/graphRAGAlerts.test.mjs
```

### Step 6.2: Run the broader unit suite

```bash
npm test
```

### Step 6.3: Run the narrative quality gate

```bash
npm run gate:narrative
```

### Step 6.4: Manual spot checks

Verify these interactive cases locally:
- single-card reading with markdown in the question
- relationship reading with no question
- decision reading with no question
- upright-only spread with no reversal reminder
- GraphRAG disabled by env with graph context available
- local-composer debug GraphRAG output with no false omission warning
- persisted prompt-engineering payload redacting echoed trajectory labels and third-party names

### Step 6.5: Audit telemetry payloads after the fixes

Inspect:
- `promptMeta.graphRAG`
- `promptMeta.sourceUsage`
- prompt-engineering persisted payload redacted content
- GraphRAG alerts

### Step 6.6: Ship in two commits if needed

Recommended split:
- Commit 1: privacy and narrative correctness fixes
- Commit 2: telemetry alignment and backend coverage

That keeps rollback cleaner if a telemetry-only refinement needs to be revisited.

---

## Suggested Execution Order

1. Add failing tests for privacy leaks and user-visible output defects.
2. Fix response echo stripping and `nameHints` merge semantics.
3. Fix single-card question sanitization.
4. Fix relationship/decision empty-question openings.
5. Fix upright-only reversal reminders.
6. Fix vision and GraphRAG source-usage semantics.
7. Fix local-composer GraphRAG debug telemetry and alert behavior.
8. Add Claude backend and dispatcher coverage.
9. Run full validation and narrative gates.

---

## Done Criteria

The remediation is complete when:
- no reviewed privacy leak still reproduces
- no upright-only reading shows a reversal reminder
- no builder quotes internal fallback copy as a user question
- single-card readings no longer render raw user markdown links
- `sourceUsage` reflects actual prompt/output usage for vision and GraphRAG
- GraphRAG debug mode no longer triggers false omission alerts
- Claude backend and dispatch paths have deterministic regression coverage
- `npm test` and `npm run gate:narrative` both pass
