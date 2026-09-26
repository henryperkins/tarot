# Developer Onboarding

Type: guide
Status: active reference
Last reviewed: 2026-09-25

This guide is the current starting point for engineers working in the Tableu repository.

## Environment Bootstrap

1. Create `.dev.vars` and populate the local secrets used by the Worker and local tooling.
2. Run `npm run config:check` after adding or changing environment variables.
3. Mirror production secrets with `wrangler secret put <NAME> --config wrangler.jsonc` when deploying.

Common local variables include:

- `MODAL_PROXY_TOKEN`, `MODAL_ENDPOINT_URL`, `MODAL_MODEL`, `MODAL_REASONING_EFFORT`, and `MODAL_TIMEOUT_MS` — primary `modal-qwen` narrative provider
- `OPENAI_API_KEY` — enables the native OpenAI Responses path in the `azure-gpt5` backend
- `OPENAI_MODEL` (defaults to `gpt-5.6-sol` in `wrangler.jsonc`) and `OPENAI_STREAMING_ENABLED`
- Azure OpenAI Responses fallback variables, if the native OpenAI path is not configured:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_GPT5_MODEL`
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, and `AZURE_ANTHROPIC_MODEL` — `claude-opus45` fallback (default deployment `claude-opus-4-5`)
- Azure OpenAI TTS variables:
  - `AZURE_OPENAI_TTS_ENDPOINT`
  - `AZURE_OPENAI_TTS_API_KEY`
  - `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET` when using the opt-in vision research flow
- `VITE_ENABLE_VISION_RESEARCH` — set to `true` only to expose the research UI; the default is `false`
- Auth variables such as `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`, `AUTH0_USERINFO_URL`, and `APP_URL` when testing auth flows

`npm run config:check` validates selected provider and authentication variables; it is not a complete feature-secret audit. Set optional Stripe, Hume, Azure Speech, MCP/OAuth, email, media, and admin secrets only for the environments and routes that use them.

## Repo Shape

| Area | Purpose |
| --- | --- |
| `src/` | React web app |
| `functions/api/` | Worker route handlers |
| `functions/lib/` | Worker-only backend logic |
| `src/worker/index.js` | Worker router and route wiring |
| `shared/` | Code shared across frontend and worker surfaces |
| `scripts/` | Deploy, evaluation, training, and utility scripts |

## Runtime Boundaries

- `src/lib/*` is browser-only.
- `functions/lib/*` and `functions/api/*` are Worker-only.
- `scripts/*` is Node.js tooling.
- Shared logic that must run in more than one environment belongs in `shared/`.

Do not cross-import browser code into Worker code or Worker code into browser code.

## Current Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend: Cloudflare Workers with route handlers in `functions/api/`
- Data: Cloudflare D1, KV, R2

Narrative backends are attempted in this order: `modal-qwen` → `azure-gpt5` (native OpenAI Responses when `OPENAI_API_KEY` is set, otherwise Azure OpenAI Responses) → `claude-opus45` → `local-composer`.

Runtime reading metrics and evaluation payloads are written to D1 `eval_metrics`. `METRICS_DB` is also active operational KV for media telemetry, daily media-usage counters, and card-video job metadata, with ongoing legacy `reading:*` compatibility archival. `R2_LOGS` stores generated/user media, journal-export caches, archives, and exports. GraphRAG passages are internally authored `Tableu Tarot Canon` content from `functions/lib/knowledgeBase.js`.

## App Entry And Routing

- Web entrypoint: `src/main.jsx`
- Root providers: `AuthProvider`, `SubscriptionProvider`, `PreferencesProvider`, `ReadingProvider`, `ToastProvider`
- Router: `react-router-dom` with route composition in `src/components/AnimatedRoutes.jsx`

Current top-level web routes include:

| Path | Component |
| --- | --- |
| `/` | `TarotReading.jsx` |
| `/journal` | `components/Journal.jsx` |
| `/journal/gallery` | `pages/CardGalleryPage.jsx` |
| `/pricing` | `pages/PricingPage.jsx` |
| `/account` | `pages/AccountPage.jsx` |
| `/admin` | `pages/AdminDashboard.jsx` |
| `/design` | `pages/DesignSystemPage.jsx` |
| `/share/:token` | `pages/ShareReading.jsx` |
| `/reset-password` | `pages/ResetPasswordPage.jsx` |
| `/verify-email` | `pages/VerifyEmailPage.jsx` |
| `/auth/callback` | `pages/OAuthCallbackPage.jsx` |
| `*` | `TarotReading.jsx` fallback |

## State And Data Flow

Main app-wide contexts:

- `AuthContext` - session and auth state
- `SubscriptionContext` - tier normalization and entitlements
- `PreferencesContext` - theme, audio, personalization, onboarding, and UI preferences
- `ReadingContext` - active reading lifecycle and streaming state
- `ToastContext` - notifications

Data fetching is primarily custom-hook based using `fetch`, local component state, and context helpers.

## Local Workflows

### Full-stack web development

```bash
npm run dev
```

(`npm run dev:vite` is the same full-stack script.)

## Reading Jobs

The Worker binds the `READING_JOBS` Durable Object namespace to `ReadingJob` in
`src/worker/readingJob.js`. The public routes are:

- `POST /api/tarot-reading/jobs` — validate the request, create a job, and return `jobId` plus `jobToken`
- `GET /api/tarot-reading/jobs/:id` — read status and terminal result
- `GET /api/tarot-reading/jobs/:id/stream` — consume SSE events; send `X-Job-Token` (or the `token` query parameter) and an optional `cursor`
- `POST /api/tarot-reading/jobs/:id/cancel` — cancel a running job

The start route issues `jobToken`. The status, stream, and cancel routes require it as the
`X-Job-Token` header; the SSE route also accepts it as the `token` query parameter and
supports an optional `cursor` for replay.

The Durable Object persists job state and a bounded event history, forwards the
caller's credentials for app jobs, and owns the public SSE stream. MCP-originated
principal jobs use separate `/mcp/snapshot` and `/mcp/cancel` paths.

## Validation Commands

```bash
npm run config:check
npm test
npm run test:e2e
npm run test:e2e:integration
npm run test:a11y
npm run docs:check
npm run gate:narrative
npm run gate:vision
npm run lint
```

`npm test` runs the root `tests/*.test.mjs` suite only. It does not run every
`functions/__tests__` file, Playwright, accessibility checks, or the full
narrative/vision gates; run the matching command for the area being changed.
Vision and narrative CI checks are assembled by `npm run ci:vision-check` and
`npm run ci:narrative-check` and write evaluation artifacts under `data/evaluations`.

## Suggested First Reads

1. `README.md`
2. `CLAUDE.md`
3. `docs/README.md`
4. `docs/architecture/narrative-architecture.md`
5. `docs/vision-pipeline.md`
6. `docs/monetization/monetization-logic.md`

## Practical Next Steps

1. Boot `npm run dev:vite` and verify the web app loads.
2. Read `src/main.jsx` and `src/components/AnimatedRoutes.jsx` for app composition.
3. Trace the main reading flow from `src/TarotReading.jsx` and `ReadingContext` to the `/api/tarot-reading/jobs` routes, the `READING_JOBS` Durable Object, and its internal handoff to `functions/api/tarot-reading.js`.
4. Check the active tests around the area you plan to modify before making changes.
