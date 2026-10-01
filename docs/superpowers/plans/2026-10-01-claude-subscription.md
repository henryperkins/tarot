# Claude Subscription Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Route non-Cloudflare text generation through the personal Claude subscription.

**Architecture:** Worker-side provider adapter calls a private Node HTTP service wrapping the official CLI. Existing prompts and gates remain authoritative; structured tool decisions return to the Worker for execution.

**Tech Stack:** ESM, Node 24, Claude Code 2.1.286 or later, Cloudflare Workers, Node test runner.

**Spec:** [Approved design](../specs/2026-10-01-claude-subscription-design.md)

## Global Constraints

- Workers AI calls remain unchanged.
- Subscription mode never falls back to paid inference.
- Claude credentials stay on the service host; HTTP routes are owner-only.
- No deployment, remote secret changes, or edits to unrelated worktrees.
- Preserve prompts, source metadata, persistence, safety and quality checks.

## Review Focus

- Expired or overridden subscription authentication must fail before inference.
- Disconnects and queue saturation must not leave orphaned CLI processes.
- Model output must not execute unknown tools or write another user's memories.
- Streaming must not bypass existing content checks or select Azure implicitly.
- Explicit offline backend selection must not defeat subscription-only routing.

### Task 1: Private service and Worker adapter

**Files:** `services/claude-code/{server,runner}.mjs`, `shared/inference/claudeCode.js`, `functions/lib/claudeCode.js`, `tests/claudeCode*.test.mjs`.

**Interfaces:** `callClaudeCode(env, {task, systemPrompt, messages, responseSchema, signal})` returns `{text, structured, model, usage, provider}`. `createClaudeCodeServer({token, run, ...limits})` supplies a testable HTTP server. `runClaudeCode(input, {signal, ...hostOptions})` supplies the CLI transport.

- [x] Write failing behavioral tests for auth, transport completion, timeout/cancel, incomplete output and bounded queue.
- [x] Run tests and confirm failures, implement the adapter/service, rerun until green.
- [x] Verify the local CLI subscription with a small synthetic request.

### Task 2: Reading, question, summary and offline routing

**Files:** `functions/lib/narrativeBackends.js`, `functions/api/{tarot-reading,generate-question,journal-summary}.js`, `scripts/evaluation/runNarrativeSamples.js`, focused route tests.

**Interfaces:** Reuse Task 1 adapter. `getClaudeCodeAccessError(env, user)` returns an owner-only rejection or null. Backend dispatch preserves the existing reading result shape and source metadata.

- [x] Write failing tests for owner access, no paid fallback, existing prompt provenance and offline selection.
- [x] Add claude-code dispatch and task routing; disable Azure streaming selection in subscription mode.
- [x] Run focused route/backend tests and record results.

### Task 3: Follow-up generation and memory continuation

**Files:** `functions/lib/claudeFollowUp.js`, `functions/api/reading-followup.js`, `tests/claudeFollowUp.test.mjs`, route integration tests.

**Interfaces:** `generateClaudeFollowUp(env, {systemPrompt, userPrompt, enableMemoryTool, onToolCall, signal})` returns validated final text after at most two tool calls. Worker owns tool execution and history.

- [x] Write failing tests for memory decisions, malformed/unknown calls, round-trip limit, cancellation and streaming/non-streaming finalization.
- [x] Route generation and repair through Claude while retaining existing content gates, reservation release, consolidation and persistence.
- [x] Run focused follow-up tests, including legacy paths.

### Task 4: Operator setup and complete verification

**Files:** `docs/claude-subscription.md`, `package.json`, `wrangler.jsonc`, sample service configuration.

- [x] Document local login, service token, owner ID, model selection, startup, local Worker setup, and optional later HTTPS hosting.
- [x] Run root tests, lint, docs checks, build and narrative gates. Record mock, deterministic and live evidence separately.
- [x] Review the complete diff with a fresh reviewer, fix material findings and rerun affected checks.
- [x] Leave a reviewable feature branch/worktree with complete evidence and remaining deployment prerequisites.

## Completion evidence

Implemented on `codex/claude-subscription-20261001`. Root tests passed 2,618/2,618;
36 new tests cover the provider and its integration. Live subscription generation
passed for 11 narrative samples, a structured memory continuation, and questions.
The offline narrative gate, build, Worker dry build, docs and changed-file lint
passed. Repository lint retains 132 errors and 36 warnings, reproduced unchanged
under the original configuration.

Fresh review found unsupported setup-token handling and orphaned CLI work on
shutdown. Regression tests reproduced both, plus a surviving process-group child;
the fixes passed. The service now requires verified host login and drains work on
SIGTERM/SIGINT. See [operator setup and verification](../../claude-subscription.md).
Remote configuration and deployment have not been performed.
