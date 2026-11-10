# Grounded Card Facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. The user explicitly forbids staging and commits; keep the execution ledger and recovery evidence outside Git.

**Goal:** Preserve sourced scene relations and render validated literal fact references, then qualify the corrected semantic pilot without weakening its criteria.

**Architecture:** A pure Worker-compatible evidence module owns two reviewed deck/card facts and localized literal captions. The common prompt path exposes that inventory for every role and protects it during fitting; backend output handling validates prose/fact transport and renders the existing reading string. Future framing remains symbolic under the existing factual criterion.

**Tech Stack:** Existing JavaScript ESM, Cloudflare Worker modules, Node test runner, current narrative providers and subscription-only qualification.

**Spec:** [Approved scope and design](../specs/2026-10-28-grounded-card-facts-design.md).

## Global Constraints

- Preserve unrelated work and the primary journal performance test. No staging, commit, merge, push or deploy.
- Japanese prose quality alone is waived. All other factual, card/deck, agency, usefulness, language and boundary criteria stay enforced.
- Retain exact reader inputs and all previous outputs, failures, unresolved findings and original metadata.
- Existing `0.3 * keyword + 0.7 * semantic`, threshold `0.3`, context gates, caps, weak-floor labels, corpus labels and providers remain unchanged.
- No paid narrative APIs, new embedding requests, repair calls or taste retries in qualification. Use the owner's existing Claude subscription.

## Review Focus

- A custom role or a role description containing temporal words must retain its role and its reviewed fact evidence.
- An alias, forged identity field, wrong deck or undrawn card must never authorize a literal fact.
- A caption reference cannot carry extra literal prose, an unknown locale or a fact removed from the actual final prompt.
- A tight fit must retain the entire exact question/name/fact contract or fail closed at the existing cap.
- Raw JSON/reference transport must never become the final consumer reading; free prose remains subject to complete factual review.

### Task 1: Implement the shared evidence and rendering contract

**Files:** create `functions/lib/canonicalSceneEvidence.js`, `tests/canonicalSceneEvidence.test.mjs` and `tests/canonicalSceneProjection.test.mjs`; modify `functions/lib/narrative/helpers.js`, prompt `cardBuilders.js`, `userPrompt.js`, `buildEnhancedClaudePrompt.js`, `truncation.js`, `functions/lib/narrativeBackends.js`, `functions/lib/narrative/spreads/threeCard.js`, `functions/lib/promptVersioning.js`, the runtime source allowlist, and relevant existing assertions.

**Interfaces:** `getCanonicalSceneFacts(cardsInfo, deckStyle)` returns immutable eligible records; `buildCanonicalSceneContract(cardsInfo, deckStyle)` returns the protected prompt lines; `renderCanonicalSceneReading(rawText, { cardsInfo, deckStyle, allowedFactIds, required })` validates and renders `{ reading, rawReading, usedFactIds }`. Backend results preserve their existing reading string and additionally archive raw provider text where relevant. No model calls are made by these pure functions.

- [x] Write and run a failing relation/role regression against the current real helper and provider prompt. Expected: the existing code drops the at-feet relation.
- [x] Add the bounded two-fact inventory and relation-preserving projection for standard/custom roles. Add renderer tests before implementing the renderer. Expected: invalid/undrawn/cross-deck/embellished references fail, approved localized references render fixed source text, ordinary no-fact readings retain behavior.
- [x] Integrate the protected contract, final-prompt inventory metadata and common backend rendering, including the production Claude request reused by subscription qualification. Add real backend tests with only transport mocked. Expected: consumer reading contains the approved caption and no envelope; malformed output fails before return.
- [x] Add a failing prospective-Future regression, then align provider and local-composer instructions with the existing no-forecast criterion. Expected: supplied Future labels/meanings/dates remain, with no inferred current-course forecast.
- [x] Run focused and complete root/Worker tests, assembly, build and owned-code lint. Expected: zero failures, unchanged retrieval behavior and existing caps/fixtures. Record every meaningful plan deviation in the external execution ledger.

### Task 2: Freeze and qualify the revised source

**Files:** evidence tools and protocol under the new external phase root; current qualification documents in `docs/knowledge-graph/`.

**Interfaces:** actual `runSubscriptionNarrative` backend result, exact context/retrieval/prompt preparation, final rendered reading and formatter projection. Reuse requires exact model prompts/scenario/configuration and revalidated rendering/gates; original raw outputs and metadata stay immutable.

- [x] Obtain one fresh whole-change review against the spec, plan, Review Focus and external ledger. Fix substantive findings with failing tests and a single verified fix pass.
- [x] Freeze source/input/configuration, reviewed caption inventory, every changed prompt, baseline/candidate matrix and exact reuse proof. Expected: no altered case/question, missing vector, changed relevance label or unsupported relation; all previously failed sources retained.
- [ ] Run the standard narrative lane or reuse only proved-equivalent inputs with complete review and original failed results preserved. Expected: unchanged quality criteria and no new factual/card faults.
- [ ] Predeclare the corrected pilot's complete pairs and actual fresh-call count, blinding and remaining matrix. Generate once through the subscription, archive raw transport/rendered/display outputs and validate each actual local gate.
- [ ] Freeze independent full-reading judgments before mapping. Expected: no new hard candidate fault, unresolved factual claim or material loss. Halt dispatch if the pilot fails; proceed to the remaining fixed matrix only after it clears.
- [x] Update the execution/status documents honestly; verify unrelated state and a current patch/archive reconstructed outside all Git worktrees. Expected: all protected hashes, heads, staged entries and durable refs unchanged; no commit, merge, push or deployment.

## Qualification checkpoint — October 28, role correction 1.6.7

The approved two-fact implementation and subsequent scoped role-projection correction are implemented and verified, with independent source findings addressed through RED/GREEN regressions. Final source root 6,123 pass / 0 fail / 2 skip, Worker 70, 874 fixtures / 2,541 builds, build/lint pass. All 11 current standard calls completed once, and automated CI exits 0. Full content review is9 pass, 1 unresolved, 1 fail: primary-image-confirmed Eight of Cups hood error in Spanish, plus unresolved Hermit light-range descriptions in Celtic and Spanish. Initial judgments, all previous failures and append-only image adjudications remain intact.

The pilot selection/budget were frozen, but no semantic call occurred; all 80 fresh semantic calls remain unstarted. No standard draw uses the two controlled facts, so generated-caption proof remains absent. The standard-content and paired-qualification acceptance checkboxes remain open. Current execution/status documents, verified recovery and preservation receipts describe this failed/incomplete gate honestly. No further free-prose imagery correction was added after the failed content review. Japanese language quality alone remains waived; no commit or release action occurred.
