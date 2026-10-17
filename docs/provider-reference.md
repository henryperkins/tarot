# Provider Inventory and Reference

Type: reference
Status: active reference
Last reviewed: 2026-10-17

This guide maps the selected providers by capability. The integrated master candidate combines native OpenAI Responses and Azure retirement with explicit ElevenLabs/Deepgram narration, owner subscription routing, gated visual cues and saved visual recovery. Defaults come from source and [wrangler.jsonc](../wrangler.jsonc); deployment overrides, credential availability and live provider health require separate verification. Configuration entries below are names, never secret values.

Use [developer onboarding](DEVELOPER_ONBOARDING.md) for local setup, [narration safeguards](narration-safeguards.md) for audio accounting, [Claude subscription setup](claude-subscription.md) for owner inference and release QA, and [system diagrams](architecture/full-system-diagrams.md) for the wider architecture.

## Historical branch coverage and status

The following inventory is the historical 2026-10-11 snapshot, before the 2026-10-17 integration. Its branch differences are not the current runtime boundary. That audit inspected all 20 local branches and 16 cached remote-tracking branches, excluding the duplicate `origin/HEAD` alias: 25 distinct tips, 774 source paths and 1,319 distinct committed source blobs. It also checked source changes in all 31 existing registered worktrees, including 203 distinct changed source variants. Remote refs are local snapshots; this audit did not refresh them or call providers.

The committed-branch audit predates the current working-tree cleanup. Older tips can retain Azure implementations and legacy provider IDs; their presence does not configure or enable Azure in this checkout. Current public text uses native OpenAI Responses, and retired speech-token/card-video routes return HTTP 410.

| Source scope | Provider differences from the primary checkout |
| --- | --- |
| Primary `codex/preserve-primary-20261008` (`ba009b3`, with existing local changes) | Base reference below; automatic ElevenLabs/Aura selection and seven custom React contexts |
| Local `master` / narration-choice branch (`b5ba16f`) and descendants | Explicit ElevenLabs or Deepgram selection |
| Visual integration (`6233b3a`), Codex subscription (`836f4a7`), cue qualification (`f24487d`) and review consolidation (`1e5c098`) | Independent Workers AI visual observer and `READING_VISUAL_JOBS`; additional narrative/Markdown contexts. Committed Codex inference is present in the last three, not `6233b3a` |
| ChatGPT listing/plugin branches and cached `origin/master` (`58c8a33`) | Public/allowlist/off MCP access policy; still app-hosted OAuth |
| Dirty `codex/spacefast-compatibility-20261009` worktree, based on `b5ba16f` | Uncommitted Spacefast/MySQL/HTTP binding adapters; absent from every committed tip scanned |
| Older cached narrative-remediation and dependency branches | Historical Azure AI Foundry Claude, Hume and earlier model/configuration variants; see [historical implementations](#historical-implementations-in-older-branches) |

For paths absent from this checkout, the branch sections use code-formatted paths rather than broken local links. Read committed source with `git show <ref>:<path>`. Worktree-only prototypes require reading that worktree; their branch tip does not contain their implementation.

## Provider map

| Provider / service | What it supplies | Activation / scope | Main implementation |
| --- | --- | --- | --- |
| Anthropic API | Claude reading narratives, follow-up answers and repairs, journal summaries | Public text routes in `TEXT_PROVIDER=legacy` when `ANTHROPIC_API_KEY` is present | [anthropicMessages.js](../functions/lib/anthropicMessages.js), [claudeApiFollowUp.js](../functions/lib/claudeApiFollowUp.js) |
| Claude Code subscription | Owner-only reading narratives, follow-ups and summaries; narrative generation for QA | Optional runtime `TEXT_PROVIDER=claude-code`; subscription generation is required for narrative/release QA | [claudeCode.js](../functions/lib/claudeCode.js), [CLI service](../services/claude-code/server.mjs), [subscriptionNarrative.js](../scripts/evaluation/lib/subscriptionNarrative.js) |
| Codex / ChatGPT subscription | Owner-only readings with optional live streaming, follow-ups/repairs and journal summaries | `TEXT_PROVIDER=codex-subscription`; uses the host's stored ChatGPT login | `functions/lib/codexSubscription.js`, `services/codex-subscription/`; see [branch scope and setup](#codex-subscription-provider) |
| Modal | Qwen reading narratives and follow-up fallback through Chat Completions | Valid endpoint and proxy credentials | [modalChatCompletions.js](../functions/lib/modalChatCompletions.js) |
| OpenAI | Native Responses text generation | Requires `OPENAI_API_KEY`; Azure configuration is not accepted | [openaiResponses.js](../functions/lib/openaiResponses.js), [openaiResponsesStream.js](../functions/lib/openaiResponsesStream.js) |
| Cloudflare Workers AI | Suggested questions, quality grading, coach extraction, embeddings, optional server vision, reader narration, story art; independent gated visual cues | `AI` binding; each capability has its own selection and flags | See [Workers AI and local models](#workers-ai-and-local-models) and [visual observer](#independent-visual-observer) |
| Cloudflare Clef | Candidate model for evaluator comparison tooling | `@cf/cloudflare/clef-flash`; operator qualification tool, not the default runtime judge | [clefQualification.js](../scripts/evaluation/lib/clefQualification.js), [qualifyEvaluators.js](../scripts/evaluation/qualifyEvaluators.js) |
| ElevenLabs | Reader voice narration | Explicit user choice; requires `ELEVENLABS_API_KEY` | [tts.js](../functions/api/tts.js) |
| Deepgram | Reader voice narration hosted by Workers AI | Aura-2 / Cora; explicit `deepgram` selection | [tts.js](../functions/api/tts.js); see [narration branch changes](#narration-and-mcp-branch-changes) |
| Auth0 | Optional social account login, including Google/Apple identities | Auth0 domain, client credentials and callback configuration; committed Auth0 settings are blank | [oauth-start.js](../functions/api/auth/oauth-start.js), [oauth-callback.js](../functions/api/auth/oauth-callback.js) |
| Stripe | Subscription checkout, billing portal, webhooks, restoration and cancellation | Stripe secret, price IDs and webhook secret | [stripe.js](../functions/lib/stripe.js), [create-checkout-session.js](../functions/api/create-checkout-session.js), [webhook](../functions/api/webhooks/stripe.js) |
| Cloudflare Email Service | Account, billing and quality-alert email | Preferred when the `EMAIL.send` binding is available | [emailService.js](../functions/lib/emailService.js) |
| Resend | Same transactional email transport | Selected only when the email binding is absent and `RESEND_API_KEY` is present | [emailService.js](../functions/lib/emailService.js) |
| Sentry | Browser and Worker errors and sampled performance traces | SDK setup in application entrypoints; DSN is in source; browser Session Replay is disabled | [main.jsx](../src/main.jsx), [worker/index.js](../src/worker/index.js) |
| OTLP collector | OpenTelemetry distributed trace export | Production requires `OTLP_ENDPOINT`; development defaults to a local collector | [tracing.js](../functions/lib/tracing.js) |
| W&B / Weave | Optional evaluation and training tracking | Operator scripts using `WANDB_API_KEY`; outside the Worker runtime | [runWeaveEval.js](../scripts/evaluation/runWeaveEval.js), [logToWandB.js](../scripts/training/logToWandB.js) |
| Spacefast / native MySQL | Alternate application runtime and database/binding adapters | Uncommitted compatibility prototype; retains existing AI/media vendors | See [Spacefast prototype](#spacefast-compatibility-prototype) |

Cloudflare Workers hosts the application API and static frontend. D1, KV, R2 and Durable Objects provide its infrastructure; see [bindings](#cloudflare-infrastructure-bindings). React state providers are listed [separately](#react-context-providers).

## Text generation routing

The default `TEXT_PROVIDER=legacy` selects the public provider policies below. Configured providers are tried according to the feature's own orchestration and acceptance checks.

| Capability | Provider order | Local behavior / source |
| --- | --- | --- |
| Full reading | `claude-api` → `modal-qwen` → `openai-native` → `local-composer` | Deterministic English narrative fallback; recognized non-English questions require an AI backend. [Registry](../functions/lib/narrativeBackends.js), [reading route](../functions/api/tarot-reading.js) |
| Reading follow-up | `claude-api` → Responses → `modal-qwen` | Provider failures ultimately return a retry error. Repairs use the provider that produced the answer. [reading-followup.js](../functions/api/reading-followup.js) |
| Journal summary | `claude-api` → Responses → local heuristic | No Modal summary backend. [journal-summary.js](../functions/api/journal-summary.js) |
| Suggested intention question | Workers AI → local template | Free access uses `local-template` directly; eligible AI failures use `local-fallback`. Independent of `TEXT_PROVIDER`. [generate-question.js](../functions/api/generate-question.js) |

The Responses slot uses native OpenAI and the `openai-native` provider ID. Missing native credentials skip that backend rather than activating Azure. Narration and email selections below depend on configuration; they do not switch vendors after a selected vendor fails.

### Provider identifiers in responses and logs

| Identifier | Meaning |
| --- | --- |
| `claude-api` | Anthropic Messages API; separate from the personal subscription |
| `claude-code` | Personal subscription through the private CLI gateway |
| `codex-subscription` | ChatGPT subscription through the Codex CLI / app-server gateway; implemented on the later branches described below |
| `modal-qwen` | Modal Chat Completions |
| `openai-native` | Native OpenAI Responses for readings, follow-ups and summaries |
| `workers-ai` | Cloudflare-hosted inference; inspect the model and task to identify its role |
| `local-composer`, `local-template`, `local-fallback` | Deterministic application logic rather than a hosted model |

Older persisted records can contain `azure-gpt5` or `azure-responses`, including records produced by native OpenAI through the old shared adapter. Those are historical labels, not current routing options. [inferenceAttempts.js](../functions/lib/inferenceAttempts.js) records task, provider and requested/returned model evidence.

### Text provider configuration

| Client | Credentials / connection | Model and behavior settings |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` defaults to `claude-opus-5-5`; reading `ANTHROPIC_EFFORT` defaults to `xhigh`; `ANTHROPIC_TIMEOUT_MS`. Shorter tasks set their own effort. The API client requests Anthropic's server-side refusal fallback; returned model evidence can differ from the requested model. |
| Modal | `MODAL_ENDPOINT_URL`; paired `MODAL_PROXY_TOKEN_ID` and `MODAL_PROXY_TOKEN_SECRET`, or legacy `MODAL_PROXY_TOKEN` when both pair fields are absent | `MODAL_MODEL` defaults to `Qwen/Qwen3.8-Max-VL-Thinking`; `MODAL_REASONING_EFFORT` defaults to `high`; `MODAL_STREAM`, `MODAL_TEMPERATURE`, `MODAL_TOP_P`, `MODAL_TIMEOUT_MS`. A partial declared credential pair fails validation. Full readings omit `max_tokens`; only explicit per-call caps apply. |
| Native OpenAI | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` | `OPENAI_MODEL` defaults to `gpt-5.6-sol`; `OPENAI_REASONING_EFFORT`, `OPENAI_VERBOSITY`, `OPENAI_RESPONSES_USER`, `OPENAI_STREAMING_ENABLED` |
| Owner subscription gateway | `TEXT_PROVIDER=claude-code`, `CLAUDE_CODE_OWNER_USER_ID`, `CLAUDE_CODE_GATEWAY_URL`, `CLAUDE_CODE_GATEWAY_TOKEN`, `CLAUDE_CODE_TIMEOUT_MS` | CLI host: `CLAUDE_CODE_MODEL`, `CLAUDE_CODE_EFFORT` and per-task model overrides. Defaults are Opus 5.5 / `xhigh`. [Full service configuration](../services/claude-code/example.env) |
| Codex subscription gateway (later branches) | `TEXT_PROVIDER=codex-subscription`, `CODEX_SUBSCRIPTION_OWNER_USER_ID`, `CODEX_SUBSCRIPTION_GATEWAY_URL`, `CODEX_SUBSCRIPTION_GATEWAY_TOKEN`, `CODEX_SUBSCRIPTION_TIMEOUT_MS`, `CODEX_SUBSCRIPTION_STREAMING_ENABLED` | CLI host: `CODEX_SUBSCRIPTION_MODEL` defaults to `gpt-6.1-sol`, `CODEX_SUBSCRIPTION_EFFORT` defaults to `high`; task model overrides and `CODEX_SUBSCRIPTION_EXECUTABLE` |

In this checkout, `TEXT_PROVIDER` accepts `legacy` or `claude-code`; later branches also accept `codex-subscription`. It is not a general vendor selector. Owner subscription mode replaces the public text chain, restricts callers to the configured owner, and permits only the existing local reading/summary fallbacks. It never falls through to paid API providers. Workers AI capabilities remain independent.

### Codex subscription provider

The Codex / ChatGPT subscription integration was introduced in commit `2a5aa8d` (`feat(ai): add isolated Codex subscription provider and streaming`). It exists on `codex/codex-subscription-provider-20261009`, `codex/reading-cue-qualification-20261009` and `codex/reading-review-consolidation-20261010`. It is absent from this primary checkout (`ba009b3`) and local `master` (`b5ba16f`) at this review. Its presence on those branches does not establish deployment.

The provider uses a verified stored ChatGPT login on its service host, with Codex CLI version `0.162.0` pinned by the implementation. It rejects API-key login. The Worker calls a private authenticated gateway; ChatGPT credentials remain on the host. It supports readings, structured follow-ups and repairs, memory decisions and journal summaries. Suggested questions and visual cues continue to use Workers AI independently.

Readings can stream through Codex app-server and gateway SSE when `CODEX_SUBSCRIPTION_STREAMING_ENABLED=true`; structured follow-ups and summaries remain buffered. Requests that require whole-reading evaluation retain buffering. Once a live reading has started, failure terminates that attempt rather than appending a fallback. Paid API fallback is excluded. The default model is `gpt-6.1-sol` at `high` reasoning; metadata labels its model as `modelSource: configured`, not response-confirmed. Narrative/release QA retains the separate Claude subscription policy.

Source files on those branches are `docs/codex-subscription.md`, `functions/lib/personalTextProvider.js`, `functions/lib/codexSubscription.js`, `functions/lib/codexReadingStream.js`, `shared/inference/codexSubscription.js` and `services/codex-subscription/`. Dedicated tests include `tests/codexSubscriptionRouting.test.mjs`, `tests/codexSubscriptionRunner.test.mjs`, `tests/codexSubscriptionIsolation.test.mjs` and `tests/codexReadingStream.test.mjs`. These paths are written as code because they do not exist in this checkout. Read the setup guide without switching branches:

```bash
git show codex/codex-subscription-provider-20261009:docs/codex-subscription.md
```

The `codex/reading-gestures-react-bridge` worktree also contains uncommitted Codex adapter/service files. They are working-tree additions, not evidence that its committed tip contains the provider.

### Narrative and release QA

`npm run ci:narrative-check` and `npm run ci:release-check` generate narratives with the owner's Claude subscription. Local runs use the existing verified Claude Code login; hosted runs use a private subscription gateway. Missing access fails without paid API fallback. Model/effort pins and the production Claude prompt are preserved; `local-composer` is a diagnostic option rather than release qualification.

Evaluation scripts layer exported environment variables over Wrangler defaults and do not load `.dev.vars`. These checks have their own provider policy and do not establish the public runtime fallback chain or production availability. See [subscription evals](claude-subscription.md#run-narrative-evals), [subscriptionNarrative.js](../scripts/evaluation/lib/subscriptionNarrative.js) and [runReleaseChecks.js](../scripts/evaluation/runReleaseChecks.js).

## Workers AI and local models

Each hosted model below uses Cloudflare's `AI` binding. The model author and the hosting provider are different pieces of the inventory.

| Capability | Model default / engine | Selection and failure behavior | Source |
| --- | --- | --- | --- |
| Intention questions | `@cf/zai-org/glm-5.3`, effort `high` | `QUESTION_MODEL`, `QUESTION_REASONING_EFFORT`, `QUESTION_TIMEOUT_MS`; Plus/Pro generation, local templates on model failure | [generate-question.js](../functions/api/generate-question.js) |
| Async reading grader | `@cf/zai-org/glm-5.3`, effort `low` | `EVAL_ENABLED`, `EVAL_MODEL`, `EVAL_REASONING_EFFORT`, `EVAL_TIMEOUT_MS`; committed `EVAL_ENABLED=true` | [evaluation.js](../functions/lib/evaluation.js) |
| Synchronous quality gate | `@cf/zai-org/glm-5.3-flash`, effort `low` | `EVAL_GATE_ENABLED`, `EVAL_GATE_MODEL`, `EVAL_GATE_REASONING_EFFORT`, `EVAL_GATE_TIMEOUT_MS`, `EVAL_GATE_FAILURE_MODE`; committed gate flag is `false` | [evaluation.js](../functions/lib/evaluation.js) |
| Coach action extraction | `@cf/zai-org/glm-5.3-flash`, effort `low` | Fixed in code; background extraction when journal entries are saved | [coachSuggestion.js](../functions/lib/coachSuggestion.js), [journalEntries.js](../functions/lib/journalEntries.js) |
| GraphRAG embeddings | `@cf/baai/bge-m3` | `GRAPHRAG_ENABLED`, `ENABLE_SEMANTIC_SCORING`; local pseudo-embedding / keyword scoring fallback when model embeddings are unavailable | [embeddings.js](../functions/lib/embeddings.js), [graphRAG.js](../functions/lib/graphRAG.js) |
| Coach / journal similarity | `@cf/baai/bge-m3` | Separate embedding implementation with its own timeouts/provenance; journal search yields no matches when unavailable | [coachSuggestion.js](../functions/lib/coachSuggestion.js), [journalSearch.js](../functions/lib/journalSearch.js) |
| Server vision | `@cf/meta/llama-3.2-11b-vision-instruct` | Optional `llama-vision`, or `hybrid` with CLIP, selected by server `VISION_BACKEND_DEFAULT`; requires `AI` | [llamaVision.js](../functions/lib/llamaVision.js), [visionBackends.js](../shared/vision/visionBackends.js) |
| Reader voice without ElevenLabs key | `@cf/deepgram/aura-2-en`, speaker `cora` | Configuration selection described in [voice and generated media](#voice-and-generated-media) | [tts.js](../functions/api/tts.js) |
| Story illustration | `@cf/black-forest-labs/flux-2-dev` | Fixed model; `FEATURE_STORY_ART=true` in committed config; no alternate provider chain | [generate-story-art.js](../functions/api/generate-story-art.js) |
| Independent visual cues (development branches) | Explicit `VISUAL_CUE_MODEL`; no default model | Requires `VISUAL_CUE_PROVIDER=workers-ai`, `AI.run` and a model; independent of text generation | See [visual observer](#independent-visual-observer) |
| Evaluator qualification candidate | `@cf/cloudflare/clef-flash` versus `@cf/zai-org/glm-5.3-flash` | Operator-only comparison; dry-run by default, explicit `--live` uses `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_AUTH_TOKEN`. The comparison result does not automatically qualify or install the candidate | [clefQualification.js](../scripts/evaluation/lib/clefQualification.js), [qualifyEvaluators.js](../scripts/evaluation/qualifyEvaluators.js) |

`EVAL_GATEWAY_ID` optionally attaches grading feedback to Cloudflare AI Gateway logs. It does not replace the grading model or select the narrative provider. GraphRAG content comes from the app's authored [knowledgeBase.js](../functions/lib/knowledgeBase.js), with optional semantic ranking; it is not an external search provider.

Local recognition uses Transformers.js with `Xenova/clip-vit-base-patch32`. The browser pins `clip-default`; the proof route's server configuration chooses `clip-default` (the committed default), `llama-vision` or `hybrid`. The request body cannot select the server backend. `VISION_TIMEOUT_MS`, `VISION_PROOF_SECRET` and frontend `VITE_ENABLE_VISION_RESEARCH` control the research flow. See [useVisionValidation.js](../src/hooks/useVisionValidation.js), [vision-proof.js](../functions/api/vision-proof.js) and the [vision pipeline](vision-pipeline.md).

Optional local symbol detection uses Transformers.js OWL-ViT, default `Xenova/owlvit-large-patch14`, or `Xenova/owlvit-base-patch32` for the fast preset. `SYMBOL_DETECTOR_MODEL`, `VITE_SYMBOL_DETECTOR_MODEL` and `SYMBOL_DETECTOR_PRESET` configure it. Model loading may download assets; inference runs locally rather than through a hosted vision API. [symbolDetector.js](../shared/vision/symbolDetector.js)

Spread semantics, card draws, pattern analysis, local narrative composition and astronomy/ephemeris calculation are application logic, not additional remote inference providers. [spreadAnalysisOrchestrator.js](../functions/lib/spreadAnalysisOrchestrator.js), [ephemerisIntegration.js](../functions/lib/ephemerisIntegration.js)

### Independent visual observer

Development branches add a separate annotation model that observes delivered reading passages and proposes card connections/cues. It does not generate or rewrite narrative prose, act as a narrative fallback, or delay text delivery. The only implemented vendor selection is `VISUAL_CUE_PROVIDER=workers-ai`. Both that setting and `VISUAL_CUE_MODEL` must be explicit; absent configuration makes new visual jobs unavailable. Existing accepted cues remain readable.

`VISUAL_CUE_REASONING_EFFORT` defaults to `low` for GLM models and accepts `low`, `high` or `max`; `VISUAL_CUE_TIMEOUT_MS` defaults to 30 seconds with a 60-second cap. There is no automatic model/vendor fallback. Evaluation candidates include GLM-5.3 Flash and GLM-5.3 at separately configured efforts; candidate experiments are not a production default or qualification claim.

The feature was introduced in `f3424f2` and is committed on `codex/reading-visual-integration-20261009`, `codex/codex-subscription-provider-20261009`, `codex/reading-cue-qualification-20261009` and `codex/reading-review-consolidation-20261010`. Source: `functions/lib/visualCueProvider.js`, `functions/lib/visualCueObserver.js`, `functions/lib/readingVisualJobs.js`, `src/worker/readingVisualJob.js`. The SQLite Durable Object binding is `READING_VISUAL_JOBS`, class `ReadingVisualJob`, separate from narrative `READING_JOBS`. The bridge worktree also has uncommitted visual-provider files.

## Voice and generated media

| Feature | Provider / defaults | Configuration and behavior | Source |
| --- | --- | --- | --- |
| Reading narration | ElevenLabs `eleven_v4` / Sarah or Workers AI Deepgram Aura-2 / Cora | Explicit user choice; both share the monthly allowance. ElevenLabs requires `ELEVENLABS_API_KEY`, with optional model/voice settings. Deepgram uses the `AI` binding. Explicit choices never silently switch; omitted provider retains legacy configuration-based selection. Credentials stay in the Worker. | [tts.js](../functions/api/tts.js), [narration safeguards](narration-safeguards.md) |
| Story art | Workers AI FLUX.2 [dev] | `FEATURE_STORY_ART`, `AI`; generated media and cache in `R2_LOGS` | [generate-story-art.js](../functions/api/generate-story-art.js) |

Hume narration, Azure Word Sync and Azure card-video generation are retired. [tts-hume.js](../functions/api/tts-hume.js), [speech-token.js](../functions/api/speech-token.js) and [generate-card-video.js](../functions/api/generate-card-video.js) retain HTTP 410 compatibility handlers without inference or allowance consumption. No replacement video provider is configured. Replicate/DALL-E media proposals do not represent the current reader-voice or story-art implementations.

### Narration and MCP behavior in integrated master

Commit `b5ba16f` adds `shared/narrationProviders.js` with explicit `elevenlabs` and `deepgram` choices. `POST /api/tts` accepts `provider`, rejects invalid choices, and reports an explicitly selected but unconfigured vendor as unavailable. Omitting the choice keeps the prior configuration-based selection. `GET /api/tts` lists both vendors and their availability. Defaults remain ElevenLabs `eleven_v4` / Sarah and Workers AI Deepgram Aura-2 / Cora. The frontend sends the selected vendor and separates cached audio by vendor.

The ChatGPT public-listing change (`f76cbd0`, including cached `origin/master` at `58c8a33`) adds `MCP_ACCESS_MODE=public|allowlist|off`. An absent value defaults to `allowlist`; an invalid value disables access. Those branches commit `public`, allowing normal Tableu accounts to link; consent can use native password sign-in with existing login rate limits. Source: `functions/lib/mcp/config.js`, `functions/lib/mcp/consent.js`, `functions/lib/passwordSignIn.js`. This changes access policy, not the OAuth vendor. `MCP_ALLOWED_USER_IDS` remains relevant to allowlist mode.

## Authentication, billing, email and monitoring

| Integration | Configuration / ownership | Reference |
| --- | --- | --- |
| Native account authentication | App-owned email/password auth uses Web Crypto PBKDF2 and HTTP-only sessions stored in `DB`; API keys and service-account authentication are also app-owned | [auth.js](../functions/lib/auth.js), [auth routes](../functions/api/auth/), [serviceAuth.js](../functions/lib/serviceAuth.js) |
| Auth0 social login | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_USERINFO_URL`; optional `AUTH0_AUDIENCE`; `APP_URL` resolves the callback URL | [oauth-start.js](../functions/api/auth/oauth-start.js), [oauth-callback.js](../functions/api/auth/oauth-callback.js) |
| ChatGPT / MCP OAuth | App-hosted OAuth server using `@cloudflare/workers-oauth-provider`, `OAUTH_KV`, `MCP_RESOURCE_URL`, `MCP_ALLOWED_USER_IDS`. ChatGPT consumes this integration; Auth0 is a separate login flow | [oauthProvider.js](../functions/lib/mcp/oauthProvider.js), [MCP integration guide](integrations/openai/tableau-backend-chatgpt-app-integration.md) |
| Custom GPT service authentication | `GPT_SERVICE_TOKEN`, `GPT_SERVICE_TIER`; optional `GPT_SERVICE_USER_ID`, `GPT_SERVICE_EMAIL`. Separate `GPT_OWNER_TOKEN` gates owner diagnostics | [serviceAuth.js](../functions/lib/serviceAuth.js), [GPT Actions setup](integrations/openai/chatgpt-gpt-actions-setup.md) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PLUS_ANNUAL`, `STRIPE_PRICE_ID_PRO_ANNUAL`; `APP_URL` | [stripe.js](../functions/lib/stripe.js), [monetization logic](monetization/monetization-logic.md) |
| Cloudflare Email / Resend | `EMAIL` binding first; `RESEND_API_KEY` only when binding absent. `ALERT_EMAIL_FROM` selects the shared sender; `ALERT_EMAIL_TO` selects quality-alert recipient. A binding send failure does not trigger Resend | [emailService.js](../functions/lib/emailService.js), [authNotifications.js](../functions/lib/authNotifications.js), [qualityAlerts.js](../functions/lib/qualityAlerts.js) |
| Sentry | Public DSN in browser/Worker entrypoints; Worker release identified by `CF_VERSION_METADATA`. Browser Session Replay is disabled | [main.jsx](../src/main.jsx), [worker/index.js](../src/worker/index.js) |
| OpenTelemetry / OTLP | `OTLP_ENDPOINT`, optional `OTLP_AUTH_HEADER`, `OTEL_TRACE_SAMPLE_RATIO`. Local default collector is `http://localhost:4318/v1/traces`; no production export without an endpoint. Collector vendor is not specified in source | [tracing.js](../functions/lib/tracing.js) |
| W&B / Weave tooling | `WANDB_API_KEY`, script/project options; evaluation/training uploads and optional traces | [runWeaveEval.js](../scripts/evaluation/runWeaveEval.js), [logToWandB.js](../scripts/training/logToWandB.js) |

Apple App Store / Google Play billing labels and management links exist in [AccountPage.jsx](../src/pages/AccountPage.jsx), but no store receipt-validation or checkout adapter is implemented in the runtime payment code. Stripe is the implemented hosted checkout provider.

## Cloudflare infrastructure bindings

These bindings provide services through the Worker environment rather than vendor API keys. [wrangler.jsonc](../wrangler.jsonc) is their configuration source.

| Binding | Service | Purpose |
| --- | --- | --- |
| `ASSETS` | Worker static assets | Built frontend and SPA fallback |
| `AI` | Workers AI | Capability-specific hosted inference listed above |
| `CF_VERSION_METADATA` | Version metadata | Deployment identity and diagnostics |
| `DB` | D1 | Accounts, sessions, journal, subscriptions, usage, media metadata, evaluation and archive records |
| `RATELIMIT` | KV | Request rate-limit state |
| `FEEDBACK_KV` | KV | Feedback buffer/cache and compatibility archive input |
| `METRICS_DB` | KV | Media telemetry, media usage counters, retained legacy video-job metadata and compatibility archive input; runtime reading evaluation metrics use D1 `eval_metrics` |
| `OAUTH_KV` | KV | MCP OAuth clients, grants and tokens |
| `READING_JOBS` | SQLite Durable Object | Reading job execution, stored events, status, SSE and cancellation; [ReadingJob](../src/worker/readingJob.js) |
| `EMAIL` | Email Service `send_email` | Restricted transactional sender |
| `R2_LOGS` | R2 | Generated/user media, export caches, logs and archives |

Workers Logpush, observability and the configured `azure-search-mcp-tail` tail consumer are also infrastructure. The tail service's name does not establish an application Azure Search provider. There is no Vectorize binding in the current configuration; GraphRAG and journal retrieval use the implementations linked above.

### Spacefast compatibility prototype

The dirty worktree for `codex/spacefast-compatibility-20261009` contains implemented but uncommitted adapters under `spacefast/` and a separate build profile. They are absent from all committed branch tips scanned. The adapter delegates application routes to the existing Worker and changes how its bindings are supplied.

| Adapter | Provider / behavior | Configuration / source in that worktree |
| --- | --- | --- |
| Runtime and database | Spacefast Functions and native MySQL behind a D1-shaped interface | Native `DB`, internal `TABLEU_NATIVE_DB`; `spacefast/entry.js`, `spacefast/database/index.js` |
| KV | Namespaced MySQL storage replaces Cloudflare KV transport | Existing `RATELIMIT`, `FEEDBACK_KV`, `METRICS_DB`, `OAUTH_KV` aliases; `spacefast/bindings/kv.js` |
| Reading jobs | MySQL state/events, leases and polling-backed SSE replace the Durable Object transport | `TABLEU_READING_JOBS_ENABLED`, `READING_JOBS`; `spacefast/jobs/index.js` |
| AI | Cloudflare Workers AI HTTP adapter implements `AI.run()` and Gateway log updates; no new model vendor or general inference broker | `CLOUDFLARE_ACCOUNT_ID` / `CF_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`; `spacefast/bindings/ai.js` |
| Media/object storage | Cloudflare R2 through S3-compatible HTTPS with SigV4; endpoint validation is R2-specific | `R2_ACCOUNT_ID` / account aliases, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`; `spacefast/bindings/r2.js` |
| Email | Removes `EMAIL`, using the existing Resend transport | `RESEND_API_KEY`; `spacefast/bindings/index.js` |
| Maintenance | Authenticated HTTP maintenance instead of Worker scheduled callbacks | `TABLEU_CRONS_ENABLED`, `TABLEU_CRON_SECRET`, `ADMIN_API_KEY`; `spacefast/entry.js`, `scripts/spacefast-build.mjs`, `spacefast/project/build.mjs` |

Prototype documentation keeps remote provider delivery, identity, database/broker contracts and background job lifetime as separate verification gates. This inventory establishes source implementation, not remote readiness. Existing [operator data access](../scripts/lib/dataAccess.js) and [reading fetch tooling](../scripts/claude/fetchRecentReadings.js) also use an S3 SDK for Cloudflare R2; they do not establish an additional Amazon S3 runtime provider.

## React context providers

These providers are frontend state containers rather than hosted service vendors; some store vendor choices or call application APIs. The five app-wide providers are nested in [main.jsx](../src/main.jsx) in this order:

```text
AuthProvider → SubscriptionProvider → PreferencesProvider
  → ReadingProvider → ToastProvider → BrowserRouter → AnimatedRoutes
```

| Provider / hook | State and responsibility | Scope / dependencies |
| --- | --- | --- |
| [AuthProvider / useAuth](../src/contexts/AuthContext.jsx) | User session, auth loading/errors, login/register/logout, password reset, verification and OAuth start | App-wide; calls app auth routes |
| [SubscriptionProvider / useSubscription](../src/contexts/SubscriptionContext.jsx) | Billing status, effective tier, entitlements, limits, spread access and upgrade helpers | App-wide; requires Auth; derives from authenticated user and shared monetization policy |
| [PreferencesProvider / usePreferences](../src/contexts/PreferencesContext.jsx) | Theme, audio path/settings, deck, reversals, personalization, onboarding, location consent and UI preferences | App-wide; requires Auth; owns preference persistence and audio setup |
| [ReadingProvider / useReading](../src/contexts/ReadingContext.jsx) | Reading lifecycle, jobs/SSE, narrative metadata, vision, audio playback, reflections/follow-ups and highlights | App-wide; requires Preferences and, through its hooks, Auth/Subscription; persists across route changes |
| [ToastProvider / useToast](../src/contexts/ToastContext.jsx) | Notifications, lifetimes, viewport and screen-reader announcements | App-wide; independent of other custom contexts |
| [GuidedIntentionCoachProvider / useGuidedIntentionCoach](../src/contexts/GuidedIntentionCoachContext.jsx) | Coach steps, question generation/editing, drafts, history, recommendations and applying a question | Scoped to [GuidedIntentionCoach](../src/components/GuidedIntentionCoach/GuidedIntentionCoach.jsx); requires Auth/Subscription/Preferences/Toast |
| [SceneContext / useScene](../src/components/scenes/SceneContext.js) | Scene state, transitions, dispatch and scene models | Scoped to [SceneShell](../src/components/scenes/SceneShell.jsx); exposes idle/no-op defaults outside its provider |

Development branches add three custom contexts while retaining the five app-wide providers:

| Context / wrapper | Responsibility | Branch source and scope |
| --- | --- | --- |
| `FocusStateContext` / `useNarrativeCardFocus()` | Card focus, visible/held narrative associations and reading gesture state | `src/components/reading/narrative/NarrativeCardFocus.jsx`; `NarrativeCardFocusProvider` scopes live/restored narrative and supplies two contexts |
| `FocusApiContext` / `useNarrativeCardFocusApi()` | Stable progress, visibility, inspection and card-selection reporting API | Same provider/file; both focus hooks return `null` outside its scope |
| `MarkdownComponentsContext` | Current renderer map behind stable Markdown component identities, preserving focus as streamed text grows | Internal context in `src/components/MarkdownRenderer.jsx`; nested renderer scope |

`feat/reading-card-touch` has the two focus contexts (nine custom contexts total). The bridge, visual-integration, Codex-subscription, cue-qualification and review-consolidation branches also have the Markdown context (ten total). These are frontend state/rendering contexts, not extra inference vendors.

The app-wide providers wrap `BrowserRouter`, so adding router hooks to those providers would require changing that arrangement. Their order also preserves real context dependencies.

Three similar fields name different systems: `subscription.provider` is the billing source; `readingMeta.provider` is narrative provenance; `ttsProvider` is the frontend audio path preference. They are not interchangeable vendor settings.

## Historical implementations in older branches

These adapters are real source implementations retained on older cached refs. They are not newly added providers on the current development lines and should not be reintroduced into the active routing by following old setup instructions.

| Older implementation | Models / configuration | Evidence scope |
| --- | --- | --- |
| Azure AI Foundry Claude | Backend `claude-opus45`, default `claude-opus-4-5`; `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`, with shared Azure key fallback | Older refs including cached `origin/codex/narrative-remediation` (`f18b26d`); `functions/lib/narrativeBackends.js` |
| Earlier Modal model | `Qwen/Qwen3.8-2.4T-A95B`, effort `medium`; existing `MODAL_*` settings | `f18b26d:functions/lib/modalChatCompletions.js`; later source uses Qwen Max VL Thinking |
| Earlier Workers AI model roles | Qwen3 30B for grading; Llama 3 8B AWQ, then Llama 4 Scout for coach extraction; Qwen3 embedding 0.6B for coach/journal similarity | `f18b26d` / `252351b`: `functions/lib/evaluation.js`, `functions/lib/coachSuggestion.js`. Later source uses GLM grading/extraction and BGE-M3 embeddings; these are model changes on the same hosting provider |
| Earlier intention-question routing | Responses, then owner Claude / public Claude branches, with local templates | `f18b26d`, `252351b`, `5ef4038`: `functions/api/generate-question.js`; later source uses Workers AI independently of text-provider selection |
| Hume Octave narration | Real Hume TTS API with `HUME_API_KEY`, preset voice identities and local-waveform failure fallback; no explicit request model ID | `f18b26d`, `ec97b5c`, `252351b`, `5ef4038`, `806ce02`; `functions/api/tts-hume.js`, `src/lib/audioHume.js`. Newer refs retain HTTP 410 only |
| Resend-only email | `RESEND_API_KEY`, shared sender/recipient settings; no `EMAIL` transport | `f18b26d`, `ec97b5c`; `functions/lib/emailService.js` |
| Earlier narration/monitoring policy | Earlier Aura failures synthesize local waveforms; Sentry Replay is implemented in some older entrypoints | Older dependency refs for Aura; `f18b26d` / `ec97b5c` for Replay and Resend-only email. These are behavioral variants of already listed vendors |

Replicate/DALL-E references in media design proposals, Responses-model compatibility hints inside the evaluator, and `@cf/controlled/*` fixture models do not establish additional runtime adapters.

## Maintaining this inventory

When changing an integration, update its capability row, routing, configuration names and source links here. Keep model defaults synchronized with the adapter and Wrangler settings, and distinguish configuration selection from runtime failure fallback. Proposed providers and retired compatibility routes belong in explicitly labeled notes rather than the active provider map.

Run `npm run docs:check` for documentation changes. Existing focused tests include [narrativeBackends](../tests/narrativeBackends.test.mjs), [Claude API routing](../tests/claudeApiRouting.test.mjs), [subscription routing](../tests/claudeCodeRouting.test.mjs), [OpenAI configuration](../tests/openaiProviderConfig.test.mjs), [question generation](../tests/generateQuestionRoute.test.mjs), [embeddings](../tests/embeddings.test.mjs), [vision proof](../tests/visionProof.test.mjs), [TTS](../tests/tts.test.mjs), [ElevenLabs](../tests/tts-elevenlabs.test.mjs), [email](../tests/emailService.test.mjs), [Stripe webhooks](../tests/stripe.webhook.test.mjs) and [MCP OAuth](../tests/mcpOAuth.test.mjs). Consult them when changing behavior; this documentation inventory does not run inference.

Local Worker secrets belong in untracked `.dev.vars`; non-secret defaults belong in `wrangler.jsonc`. `VITE_*` settings reach browser code and must remain non-secret. `npm run config:check` validates a subset of AI/auth settings, not every integration in this guide. Operator and Claude CLI service settings have their own environment loading described in the linked setup guides.
