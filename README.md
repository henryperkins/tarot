# Tableu

Tableu is an AI-powered tarot reading application built around a React web client and a Cloudflare Worker backend. The reading experience combines deterministic card draws, structured spread semantics, knowledge-graph pattern detection, and LLM-generated narrative synthesis.

## Overview

- Frontend: React 19 + Vite in `src/`
- Backend: Cloudflare Worker router in `src/worker/index.js` with handlers in `functions/api/`
- Shared logic: `shared/`
- Data and migrations: `data/`, `migrations/`

## Core Features

- Multiple spread types, including One-Card Insight, Three-Card Story, Five-Card Clarity, Decision/Two-Path, Relationship Snapshot, and Celtic Cross
- LLM-generated readings with the configured provider order: `claude-api` (Claude Opus 5.5 via the Anthropic API) → `modal-qwen` → `openai-native` (OpenAI Responses) → `local-composer`
- Knowledge-graph and GraphRAG-assisted narrative context
- User-selectable ElevenLabs v4 (Sarah) or Deepgram Aura-2 (Cora) reading narration with a shared monthly allowance; see [narration safeguards](docs/narration-safeguards.md) for provider setup and selection
- Journal, sharing, follow-ups, and subscription-aware feature gating
- Optional, opt-in vision research flow for card-photo proofing and telemetry
- PWA support, accessibility features, and reduced-motion support

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Cloudflare Workers |
| AI | Anthropic Claude, Modal Qwen, OpenAI native Responses, Cloudflare Workers AI, local composer |
| Data | Cloudflare D1, KV, R2 |

See the [provider inventory and reference](docs/provider-reference.md) for feature routing, model defaults, configuration, infrastructure and React contexts.

## Project Structure

```text
src/                     React frontend
functions/               Worker route handlers and backend libraries
shared/                  Isomorphic contracts and shared logic
scripts/                 Evaluation, training, deployment, and tooling scripts
docs/                    Documentation
migrations/              Database migrations
```

## Getting Started

### Prerequisites

- Node.js 24+ (matching CI)
- npm
- Cloudflare account for Worker deployment

### Install

```bash
git clone https://github.com/henryperkins/tarot.git
cd tarot
npm install
```

### Environment

Create `.dev.vars` with the required local secrets, then verify it:

```bash
npm run config:check
```

See `docs/DEVELOPER_ONBOARDING.md` for the current variable list and setup workflow.

## Development

### Web + Worker

```bash
npm run dev
```

Starts Vite on `http://localhost:5173` (or `5174`) and Wrangler Worker dev on `http://localhost:8787`. (`dev:vite` is an alias for the same script.)

## Common Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Full-stack local development (Vite + Worker) |
| `npm run dev:frontend` | Vite only |
| `npm run dev:workers` | Wrangler Worker dev |
| `npm run build` | Production frontend build |
| `npm test` | Root Node test suite (`tests/*.test.mjs`) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:a11y` | Static accessibility checks |
| `npm run gate:vision` | Vision quality gate |
| `npm run gate:narrative` | Narrative quality gate |
| `npm run docs:check` | Maintained Markdown link check |
| `npm run lint` | ESLint |

## Deployment

```bash
npm run deploy
```

The deploy flow is managed by `scripts/deploy.js` and supports migrations, dry runs, and local migration application via the npm scripts in `package.json`.

Use `npm run deploy` (or `npm run deploy:skip-migrations`) for application releases. After fresh release QA, the script reads the existing Worker's settings with your current Wrangler login or configured Cloudflare credentials. It refreshes those settings immediately before each upload and creates a private temporary config beside `wrangler.jsonc`. Existing dashboard variables, including values that differ from checked-in defaults, are inherited; defaults are uploaded only for new names. Existing secret bindings are inherited without reading their values. Logs, traces, and Issues settings are carried through Wrangler's separate monitoring update. The temporary config is removed after the upload, including on failure.

A failed or malformed settings read stops the release before remote migrations, as does a configured resource binding that would replace an existing variable or secret. The script pins the Worker/account/API target and refuses to upload if `wrangler.jsonc` changes during the release. Only Cloudflare's explicit Worker-not-found response allows a first deployment, which uses the checked-in defaults and enables Issues. After an upload, the script checks variable values, secret names/types, and monitoring settings again; a mismatch fails the release without attempting an automatic settings repair. Credential retrieval disables Wrangler's debug-file logging; credentials are kept in memory and dashboard values are not written to the temporary config. Dry runs and migration-only operations do not read or modify Worker settings.

Dashboard values take precedence on subsequent releases. Change an existing production variable in the dashboard when its value should change; editing its local default affects only new Workers or new variable names. To retire a variable, remove both its local default and its dashboard binding; otherwise the next release recreates the missing name with its default. Avoid direct `wrangler deploy` for releases: `keep_vars` alone retains omitted variables but still allows explicitly configured values to replace dashboard values. Continue to verify the active Worker version and live assets separately after deployment.

## Documentation

- `docs/README.md` - documentation index
- `docs/DEVELOPER_ONBOARDING.md` - contributor setup and architecture orientation
- `docs/architecture/full-system-diagrams.md` - detailed architecture diagrams
- `docs/vision-pipeline.md` - current vision pipeline and evaluation flow
- `docs/monetization/monetization-logic.md` - implemented monetization behavior

## Contributing

1. Use Conventional Commit prefixes like `feat:`, `fix:`, `docs:`, and `test:`.
2. Run relevant tests before opening a PR.
3. Keep documentation changes aligned with code changes.
4. Prefer updating canonical reference docs over adding new one-off notes.
