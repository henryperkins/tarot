# AI reliability implementation plan

> For agentic workers: use the approved implementation scope below, focused regression tests, and an independent final review. The user approved execution on 2026-10-07 after the source/runtime audit and six-step next-steps proposal.

**Goal:** Prevent unintended AI spending, preserve allowances when generation fails, consistently screen delivered readings, and qualify evaluator changes without changing production decisions prematurely.

**Architecture:** Extend existing Worker routes, D1 accounting, provider adapters, and React flows. Keep existing authentication and subscription behavior, use atomic database operations for new limits, and retain GLM production evaluation while preparing a separately measured Clef candidate.

**Tech stack:** React/Vite, Cloudflare Workers/D1/KV, Node tests, Playwright.

**Spec:** The approved six-step plan in this conversation and the verified report at master `c5139fe`; this file records implementation choices without expanding that scope.

## Global constraints

- Work only in `.worktrees/ai-reliability-20261007`, branch `codex/ai-reliability-20261007`; preserve the original checkout and all other branches/worktrees.
- No external calls from tests. Use `/tmp/tableu-ai-reliability-20261007/deny-network.mjs` and explicit provider mocks; never import an executable evaluation script until it has an entrypoint guard.
- Keep secrets, PII, session state, credentials and full prompts out of Git and logs.
- Existing source styles and identity remain authoritative. New UI text explains user outcomes without provider implementation details.
- Production Clef activation is out of scope until its qualification passes. Live QA is bounded, synthetic, explicitly invoked and recorded, with no automatic retries that exceed its call budget.
- Use additive migrations: 0033 feature limits (task 1), 0034 narration accounting if needed (task 2), 0035 inference attempts if needed (task 5). Do not modify historical migrations.
- No production migration, deployment, secret deletion or shared-branch push during implementation. Prepare concrete changes and validation first.

## Review focus

- Concurrent requests and storage outages must not bypass paid inference limits.
- Provider errors, stream failures and retries must not debit a user's allowance more than once or leak a reservation.
- Safe wellbeing/language fixtures must remain usable while dangerous output is checked identically across JSON and SSE.
- Deadline/cancellation must cover bodies and tool continuations, not just response headers.
- Model qualification must use the actual gate contract and distinguish API success, deadline success, false blocks and missed unsafe output.

### Task 1: Protect vision and paid text features

**Owner:** limits agent. **Files:** `functions/api/vision-proof.js`, `functions/api/generate-question.js`, `functions/api/journal-summary.js`, new `functions/lib/featureUsage.js`, migration `0033_add_feature_usage.sql`, matching tests and documentation.

- [x] Add failing tests for unauthenticated/forged backend choice, burst/concurrent access, daily exhaustion, failure release and unavailable storage.
- [x] Preserve guest photo recognition using only the server-selected backend; ignore client backend selection. Bound request bodies before expensive work. Use hashed guest identity, existing authenticated identity and D1 atomic reservation accounting. Deny costly work when accounting is unavailable.
- [x] Use configurable daily safeguards: vision guest/free 5, Plus 20, Pro 100; generated questions Plus 30, Pro 100; summaries Plus 3, Pro 10. One active request per identity and feature. Service tokens follow their effective tier. Retain API-key metering in addition to these safeguards. Document defaults as operational limits, not changed advertised entitlements.
- [x] Resolve reservations on every exit, including fallback and errors. Validate real SQL behavior with SQLite-backed tests, not mocks alone.
- [x] Run focused tests and report changed files plus exact commands/results.

### Task 2: Narration and media availability

**Owner:** media agent. **Files:** TTS/Hume/speech-token routes and helpers, audio hooks/preferences/settings, cinematic availability components, `src/worker/index.js`, migration 0034 if necessary, matching tests.

- [x] Add failing tests for Hume default/fallback double debit, provider failure refunds, guest/signed-in concurrent accounting, token-only refresh, long narration and video disabled.
- [x] Selectively port Hume removal from `fix/media-followups`, preserving newer safeStorage/accessibility changes. Aura becomes default; migrate saved Hume preference. Retire its server route without charging.
- [x] Replace debit-before-success behavior with bounded reservation/settlement accounting; preserve monthly limits and release failures idempotently. Speech-token retrieval receives an independent abuse limit and no narration debit.
- [x] Preserve the full allowed reading text and stream ordered provider chunks without silent 4096-character truncation. Keep a documented bounded request size and account for one user narration coherently, without client-controlled unlimited replay.
- [x] Hide card video using actual server availability as well as tier. Do not rely on an unrelated build flag alone.
- [x] Bound FLUX work without overlapping uncancellable retries; stop after a timeout if the binding cannot cancel.
- [x] Run focused tests and report exact commands/results. Coordinate with task 3 before editing ReadingContext; otherwise keep file ownership disjoint.

### Task 3: Consistent safety, outage behavior and quota preservation

**Owner:** safety agent. **Files:** `functions/lib/evalGatePolicy.js`, `functions/lib/evaluation.js`, `functions/api/tarot-reading.js` finalization/safety sections, relevant frontend reading-state/notice files and regression tests.

- [x] Add failing tests covering identical hazardous outputs over JSON/SSE, benign rest/balance prompts, multilingual danger and benign cases, evaluator timeout/incomplete output, quota settlement and user notice.
- [x] Share pre-delivery safety handling across transports. Keep sensitive content protected. Separate broad wellbeing context from high-risk intent without disabling safeguards simply for latency.
- [x] Replace misleading successful canned output on evaluator unavailability with a typed retryable outcome, refund the reading reservation once, and show a clear retry message. Preserve genuine unsafe-output blocking. Keep non-English unavailable cases protected; use explicit multilingual cases and honest coverage limits.
- [x] Run focused tests and report precise findings/coverage. Root owns provider dispatch/deadline portions of tarot-reading; coordinate any overlap before editing them.

### Task 4: Provider deadlines and complete output

**Owner:** root. **Files:** `functions/lib/retryWithBackoff.js`, `azureResponses.js`, `azureResponsesStream.js`, `modalChatCompletions.js`, `anthropicMessages.js`, `narrativeBackends.js`, provider caller sections and tests.

- [x] Add failing tests for stalled bodies, outer cancellation, retry-after exhaustion, incomplete/failed stream endings and tool continuation cancellation.
- [x] Carry one bounded task budget through provider attempts and tool rounds; pass signals through Modal/OpenAI and clamp retries to remaining time. Cover body consumption.
- [x] Reject partial/failed Responses outputs, set explicit `store:false`, and set bounded task-appropriate Modal short-output budgets. Preserve existing successful output contracts.
- [x] Run focused provider and orchestration regressions.

### Task 5: Provenance and evaluation aggregation

**Owner:** assigned after task 1. **Files:** telemetry/schema/reading-quality/quality-analysis, inference attempt storage, task-specific model provenance and tests.

- [x] Add meaningful regression tests for accepted/rejected/failed attempts, model identity, token usage, all-provider failure and evaluator aggregation.
- [x] Persist actual model, known usage and unknown-usage status per attempt; never invent cost for missing usage. Preserve successful-result metrics separately.
- [x] Group quality aggregates by evaluator model/source and prevent mixing heuristic and model scores. Record coach extraction model and skip canned fallbacks.
- [x] Run focused tests and migration checks.

### Task 6: Safe QA and Clef qualification

**Owner:** root plus available agent. **Files:** evaluation CLI entrypoints/release checks, a bounded evaluator comparison runner, labeled fixtures, adapter and tests/docs.

- [x] Guard evaluation CLI imports; test that importing with dummy credentials cannot call inference or write output.
- [x] Default release narrative QA to the primary configured Claude provider with explicit fallback/configuration behavior; retain live gate checks and document required secrets/budget.
- [x] Create an expanded, provenance-labeled synthetic corpus covering benign sensitive topics, explicit danger, multilingual cases, hallucinated cards, injection, long-middle/end hazards and outages. Labels are policy expectations, not claimed independent human ground truth.
- [x] Qualify Clef through the production score/gate contract, validate every field, expose probability thresholds as configuration, and record API errors, deadline failures, disagreement, false blocks and misses. Default dry/offline; bounded live invocation has a hard request cap and no retries. Keep production evaluator unchanged.
- [x] Run offline replay and bounded live checks only when appropriate credentials are available; report missing lanes honestly.

### Task 7: Integrated verification and handoff

- [x] Run full root unit suite, targeted functions tests, build, deployment checks, docs links and relevant vision/narrative gates; distinguish fixture replay from live generation.
- [x] Review guest and real signed-in Pro flows locally using the documented reviewer account, plus mocked/separate fixtures for affected other tiers. Verify desktop/mobile, keyboard, and clear failure/retry states. Log out afterward.
- [x] Obtain independent whole-change review, resolve material findings and rerun covering checks.
- [x] Prepare scoped commits and a concise handoff describing migrations, settings, verification, qualification results and remaining production actions. Leave unused secret deletion until all code/config references have been checked against the final change.

## Execution status

Local implementation and offline checks completed October 7 on
`codex/ai-reliability-20261007`. Independent review findings were reproduced and
fixed. See [verification and rollout limits](../../reviews/2026-10-07-ai-reliability-verification.md).
No fresh live Claude or Clef qualification was possible with the available
configuration; no production deployment, migration or secret cleanup occurred.
The release evidence tasks above remain subject to those documented limits.
