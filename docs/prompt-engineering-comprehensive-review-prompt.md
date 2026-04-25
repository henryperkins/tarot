# Comprehensive Prompt Engineering Review Prompt

Type: prompt
Status: active reference
Last reviewed: 2026-04-24

Complements `docs/personalized-tarot-narrative-review-prompt.md` (narrative/reading pipeline only).
This prompt covers **every prompt engineering surface** in the repo: reading, follow-up, question
generation, journal summaries, media/vision/video/story-art, GraphRAG retrieval, evaluation
prompts, backend dispatch, versioning, A/B, telemetry, and safety/injection defense.

---

```text
You are reviewing the full prompt engineering system of this repository as a senior code
reviewer — not as a copy editor, and not as a vibes-check. Your job is to judge whether
the prompts, their assembly, their budgets, their safety rails, their telemetry, and
their fallback paths behave correctly end to end. Treat every prompt as production code:
if a bug in it would reach a user, it counts.

If there is an active diff, prioritize changed files first, then trace outward to the
modules, tests, backends, and UI surfaces the change touches. If there is no diff,
audit the full surface listed below.

## Project context (read before reviewing)

- Tableu: a React + Vite tarot reading app on Cloudflare Workers. Readings feel like a
  practiced reader, not a generic card widget. 78-card Rider-Waite deck plus Thoth and
  Marseille variants. Non-negotiable ethics: empowerment over determinism, no
  hallucinated cards, no medical/legal/financial/mental-health replacement, trauma-
  informed language, disclaimers for sensitive topics.
- AI dispatch: OpenAI GPT-5.4 via Responses API (native `OPENAI_API_KEY` preferred,
  Azure fallback), with Claude and local composer as further fallbacks. Streaming is on
  by default (`AZURE_OPENAI_STREAMING_ENABLED=true`).
- Every AI reading is asynchronously scored by Workers AI (Llama 3 8B) on personalization,
  tarot_coherence, tone, safety, overall, and a binary `safety_flag`. Scores feed
  `quality_stats` and optional gating (`EVAL_GATE_ENABLED`).
- Prompts can be optionally persisted (redacted by default) for quality correlation
  and A/B grouping. `PERSIST_PROMPTS` and redaction controls matter.

## Surfaces in scope (audit all, not just the narrative pipeline)

Reading narrative (primary path):
- `functions/api/tarot-reading.js`, `functions/api/tarot-reading-job-*.js`
- `functions/lib/narrativeBackends.js`, `functions/lib/narrativeBuilder.js`,
  `functions/lib/narrativeSpine.js`
- `functions/lib/narrative/prompts/` — `buildEnhancedClaudePrompt.js`, `systemPrompt.js`,
  `userPrompt.js`, `budgeting.js`, `truncation.js`, `cardBuilders.js`, `constants.js`,
  `deckStyle.js`, `graphRAGReferenceBlock.js`, `astro.js`, `visionValidation.js`
- `functions/lib/narrative/prompts.js` (re-export shim)
- `functions/lib/narrative/spreads/` — `base.js`, `singleCard.js`, `threeCard.js`,
  `fiveCard.js`, `decision.js`, `relationship.js`, `celticCross.js`
- `functions/lib/narrative/reasoning.js`, `reasoningIntegration.js`, `helpers.js`,
  `styleHelpers.js`, `sourceUsage.js`
- `functions/lib/spreadAnalysis.js`, `spreadAnalysisOrchestrator.js`

Follow-up conversation:
- `functions/api/reading-followup.js`
- `functions/lib/followUpPrompt.js`
- `functions/lib/memoryTool.js`, `functions/lib/userMemory.js`

Question generation:
- `functions/api/generate-question.js`
- Any prompt templates it inlines

Journal summaries and pattern alerts:
- `functions/api/journal-summary.js`
- `shared/journal/summary.js`
- `functions/api/journal/pattern-alerts*` (if present)

Media / story art / video / vision prompts:
- `functions/lib/mediaPromptAlignment.js`, `mediaPromptBudget.js`,
  `mediaPromptSanitization.js`
- `functions/lib/storyArtPrompts.js`, `functions/lib/videoPrompts.js`
- `functions/api/media.js`, `functions/api/generate-story-art.js`,
  `functions/api/generate-card-video.js`
- `functions/lib/llamaVision.js` (vision prompting)
- `shared/vision/**` for validation/annotation prompts the server embeds

GraphRAG / knowledge retrieval (consumed by prompts):
- `functions/lib/graphRAG.js`, `graphRAGAlerts.js`, `graphContext.js`
- `functions/lib/knowledgeBase.js`, `knowledgeGraph.js`
- `src/data/knowledgeGraphData.js` (data only; affects retrieval hits)

Evaluation prompts (the prompts that score the reading):
- `functions/lib/evaluation.js`
- `scripts/evaluation/runNarrativeSamples.js`, `processNarrativeReviews.js`,
  `verifyNarrativePromptAssembly.js`, `verifyNarrativeGate.js`,
  `computeNarrativeMetrics.js`, `runWeaveEval.js`

Backend dispatch and transport:
- `functions/lib/azureResponses.js`, `azureResponsesStream.js`
- Any OpenAI-native client path
- Claude/Anthropic path (if present) and the local composer fallback

Prompt lifecycle infrastructure:
- `functions/lib/promptEngineering.js` (hashing, PII redaction, fingerprinting)
- `functions/lib/promptVersioning.js` (version bumps, history)
- `functions/lib/promptInjectionDetector.js`
- `functions/lib/abTesting.js`
- `functions/lib/telemetrySchema.js`, `readingTelemetry.js`

Tests (judge coverage, not just presence):
- `tests/promptEngineering.test.mjs`, `tokenBudgeting.test.mjs`,
  `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`,
  `followUpSuggestions.test.mjs`, `readingFollowup.test.mjs`,
  `questionQuality.test.mjs`, `readingQuality.test.mjs`,
  `mediaPromptSanitization.test.mjs`, `azureResponses.test.mjs`,
  `evaluation.test.mjs`, `graphRAG.test.mjs`,
  `api.languageFallback.test.mjs`, `astroRelevanceGate.test.mjs`,
  `visionWeaving.test.mjs`, `contextDetection.test.mjs`,
  `symbolElementBridge.test.mjs`

## Review dimensions

For every surface above, evaluate:

1. Prompt construction correctness
   - Does the system prompt establish role, ethics, non-negotiables (no hallucinated
     cards, empowerment framing, disclaimers for sensitive topics, trauma-informed tone)
     before any task-specific content?
   - Are position semantics, reversal framework, spread metadata, deck style, and
     high-weight positions faithfully serialized into the user prompt? Cross-check
     against `src/data/spreads.js` and `functions/lib/spreadAnalysis.js:REVERSAL_FRAMEWORKS`.
   - Do spread-specific builders (`single`, `threeCard`, `fiveCard`, `relationship`,
     `decision`, `celtic`) each preserve positional meaning and narrative spine?
   - Does each non-reading prompt (follow-up, question-gen, journal summary, media,
     video, story-art) carry forward the same ethical guardrails, or does it quietly
     drop them?

2. Personalization signal flow
   - Does the user's question, reflections, display name, onboarding focus areas,
     `readingTone`, `spiritualFrame`, `preferredSpreadDepth`, deck style, and card-level
     detail materially influence the final output? Or do they fall through to a
     generic template?
   - Are long or empty fields handled without breaking prompt structure?
   - Are memories (`functions/lib/userMemory.js`) included in follow-ups and reading
     prompts the way `docs/context_personalization.md` says they should be?

3. Token budgeting, truncation, and tail preservation
   - Is the hard-cap trimming in `buildEnhancedClaudePrompt.js` safe? Does it preserve
     the footer of `userPrompt.js` that contains the "write the reading" instruction
     and per-card / next-steps requirements? (This was a Medium/High finding in the
     historical review `docs/prompt-engineering-review.md`.)
   - Does `truncation.js` trim from head, tail, or both? Is the chosen strategy
     consistent with what the downstream model needs to see?
   - Does `truncateSystemPromptSafely` throw? Is the throw caught by any caller, or
     does it hard-fail prompt construction under tight budgets?
   - Are GraphRAG passages trimmed *before* they reach the prompt, or mid-assembly
     (which would corrupt telemetry)?
   - For media/video/story-art prompts, does `mediaPromptBudget.js` enforce a budget
     that leaves headroom for the model's required structural tokens?

4. GraphRAG inclusion and telemetry honesty
   - Does `promptMeta.graphRAG` accurately reflect what made it into the final prompt?
     `includedInPrompt`, `passagesProvided`, `passagesUsedInPrompt`, `truncatedPassages`,
     `semanticScoringRequested`, `semanticScoringUsed`, `semanticScoringFallback`.
   - Does detection rely on substring/header matching that can lie when mid-block
     truncation occurs? (Historical finding.)
   - Are retrieval priorities (complete triads > Fool's Journey stage > high-sig
     dyads > suit progressions, per CLAUDE.md) actually honored in
     `functions/lib/graphRAG.js`?
   - Does the 30% relevance threshold behave sensibly for edge cases (single-card
     spreads, all-Major spreads, all-court spreads)?

5. Backend dispatch, streaming, and fallback
   - Does the order (OpenAI native → Azure GPT → Claude → local composer) match what
     CLAUDE.md claims? Are secrets checked in the right precedence?
   - On streaming (`azureResponsesStream.js`), what happens on mid-stream disconnect,
     abort, rate-limit, or malformed SSE? Is backpressure handled?
   - On fallback, does the downstream prompt shape match what the alternative backend
     expects, or do we send a Claude-shaped prompt to a GPT endpoint (or vice versa)?
   - Is there any path where a non-English question silently bypasses the fail-closed
     behavior described in the narrative review prompt?
   - Per Cloudflare Workers best practices: no `await response.text()` on unbounded
     model responses; no floating promises on post-response work; `ctx.waitUntil()`
     used (not destructured) for eval and persistence.

6. Prompt safety and injection defense
   - Does `promptInjectionDetector.js` run on every user-supplied string that enters
     a prompt (question, reflections, display name, journal entries, follow-up turns,
     vision annotations)?
   - Are sanitizers (`sanitizeDisplayName`, `sanitizeText`, media sanitizers)
     idempotent, length-capped, and unicode-safe?
   - What happens when detection fires: hard reject, soft strip, or pass-through with
     a telemetry flag? Is the user informed honestly?
   - Does the system prompt contain any delimiter that a crafted user input could
     replicate to confuse role boundaries?
   - Are tool-use instructions (`MEMORY_TOOL_INSTRUCTIONS`) hardened against
     prompt-injection-style subversion from journal content or follow-up turns?

7. PII, redaction, and persistence
   - If `PERSIST_PROMPTS` is on, is redaction applied *before* hashing and storage?
   - Does `promptEngineering.js` redact emails, names, locations, phone numbers,
     sensitive health/legal content before persistence?
   - Is the hash used for A/B grouping stable across redaction changes, or does a
     redaction tweak invalidate the whole dataset?
   - Is there any path where raw unredacted prompt text reaches D1/KV/R2 when the
     admin thinks redaction is on?

8. Prompt versioning, A/B, and regression discipline
   - Does `READING_PROMPT_VERSION` bump on any change that materially affects output?
     Is there a test or lint that fails if a prompt file changes without a version
     bump?
   - Does `abTesting.js` partition users deterministically and carry the variant id
     through to evaluation for honest score comparison?
   - Is there a documented procedure for retiring a bad variant before quality
     statistics are contaminated?

9. Evaluation prompts themselves
   - The prompts that *score* readings are production code too. Are they in scope
     for the same safety, budget, and versioning rules?
   - Does the evaluator prompt enforce a deterministic structured output (JSON
     schema), and does the parser fail closed when the model hallucinates fields?
   - Is the evaluator prompt biased toward favoring verbose readings, jargon-heavy
     readings, or the default tone/frame? A biased evaluator silently shapes the
     product.
   - Does `scripts/evaluation/verifyNarrativePromptAssembly.js` actually verify
     what it claims?

10. UI and source-usage honesty
    - Does `src/components/reading/complete/sourceUsageSummary.js` accurately
      communicate which inputs/knowledge sources informed the reading, versus which
      were requested but skipped or truncated?
    - Are journal, share, and export flows consistent about what prompt metadata
      they expose?

11. Tests and regression coverage
    - Is there a test that a critical footer instruction survives hard-cap trimming
      at the smallest supported budget?
    - Is there a test that every card named in `cardsInfo` appears at least once in
      the output, and that the question text is referenced in the opening and
      synthesis sections?
    - Is there a test for non-English fail-closed behavior, a test for mid-stream
      disconnect, a test for prompt-injection rejection, and a test for media-prompt
      sanitization drift?
    - For follow-ups: is there a test for the `MAX_HISTORY_TURNS` and
      `MAX_NARRATIVE_CONTEXT` boundary cases in `followUpPrompt.js`?

## Anti-patterns to flag on sight

- System prompt sections that can be silently truncated out of the final payload.
- User-prompt footer containing the only instance of "write the reading now" or
  required structural instructions (move to system prompt, or protect from trim).
- GraphRAG passages inserted into the prompt *after* budget accounting.
- Telemetry fields derived from string substring matches on the final prompt.
- Prompts built by concatenating user input without a sanitizer in the call path.
- Prompt hashing that runs before redaction (hash now includes PII).
- A backend fallback that reuses the previous backend's prompt shape without a
  reshape step.
- Any reading or follow-up path where the ethics preamble can be conditionally
  dropped by a variant, feature flag, or budget pressure.
- Media/video prompts that inherit from the reading prompt and accidentally include
  the user's full question or display name in an asset-generation request that
  might be logged by a third party.
- Evaluator prompt hardcoded to a particular tone/frame, quietly penalizing
  variants that change tone.
- `Math.random()` in any path that selects prompt variants, A/B buckets, or
  generates IDs exposed in telemetry (use `crypto.randomUUID` /
  `crypto.getRandomValues`).
- `any`, `as unknown as T`, or hand-written `Env` interfaces at binding boundaries;
  `env.X` instead of `this.env.X` inside DurableObject/WorkerEntrypoint classes.

## Non-goals for this review

- Generic style nitpicks or prose polish unless they affect safety, correctness, or
  telemetry accuracy.
- Reformatting tests or refactoring that doesn't change behavior.
- Rewriting the card meaning corpus in `src/data/majorArcana.js` /
  `src/data/minorArcana.js`; flag only if a prompt consumer misreads them.
- Front-end CSS beyond what the reading surface depends on for correctness.

## Output format

1. **Executive summary** — 4-8 lines, overall health by surface (reading, follow-up,
   question-gen, journal-summary, media, evaluation, infrastructure). Call out the
   single highest-risk issue.
2. **Findings by severity** (High / Medium / Low). Each finding:
   - Surface (e.g., "Reading narrative", "Media prompts", "Evaluation")
   - File path and line number(s)
   - What's wrong and why it matters
   - User-facing impact if it reached production
   - Suggested fix shape (not full code — the review is the deliverable)
3. **Telemetry and honesty audit** — every case where `promptMeta`, `sourceUsage`,
   or eval scores could overstate or misrepresent what happened.
4. **Safety audit** — injection, PII, persistence, redaction, role-boundary
   violations, ethics-preamble survival under truncation.
5. **Test coverage gaps** — ranked by blast radius.
6. **Open questions / assumptions** — anything you had to guess about intent,
   rollout state, or budget choices.
7. **Prioritized roadmap** — 5-10 items with Impact × Effort for each. Start with
   quick wins that prevent the highest-severity regressions.

Stay precise. Cite file:line. Prefer "this breaks when X happens" over "this feels
off". A reviewer who flags a real Medium is more useful than one who lists ten
speculative Lows.
```

---

## How to use this prompt

- Copy the fenced block above and paste it as the first message in a fresh review
  session (Claude, Codex, Gemini, or a local reviewer).
- For a focused pass, pair with a diff: `git diff master...HEAD -- functions/`.
- For a full audit, run it against the whole repo and expect a 30-60 minute session.
- After the review, file High findings as issues, link them in
  `docs/prompt-engineering-review.md`, and bump `READING_PROMPT_VERSION` only if a
  fix changes user-visible output.
