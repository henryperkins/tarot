# Tableu

Tableu is an AI-powered tarot reading application built around a React web client, a Cloudflare Worker backend, and an in-progress Expo native app. The reading experience combines deterministic card draws, structured spread semantics, knowledge-graph pattern detection, and LLM-generated narrative synthesis.

## Overview

- Frontend: React 19 + Vite in `src/`
- Backend: Cloudflare Worker router in `src/worker/index.js` with handlers in `functions/api/`
- Native app: Expo / React Native in `native/`
- Shared logic: `shared/`
- Data and migrations: `data/`, `migrations/`

## Core Features

- Multiple spread types, including One-Card Insight, Three-Card Story, Five-Card Clarity, Decision/Two-Path, Relationship Snapshot, and Celtic Cross
- LLM-generated readings with Azure OpenAI as primary and Claude/local-composer fallback paths
- Knowledge-graph and GraphRAG-assisted narrative context
- Azure OpenAI TTS, Azure Speech SDK, and Hume-backed narration options
- Journal, sharing, follow-ups, and subscription-aware feature gating
- Optional vision research flow for card-photo proofing and telemetry
- PWA support, accessibility features, and reduced-motion support

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Cloudflare Workers |
| Native | Expo SDK 55 preview, React Native 0.83 |
| AI | Azure OpenAI, Azure Anthropic Claude, local composer |
| Data | Cloudflare D1, KV, R2 |

## Project Structure

```text
src/                     React frontend
functions/               Worker route handlers and backend libraries
server/                  Express server for local static preview and auth flows
native/                  Expo native app
shared/                  Isomorphic contracts and shared logic
scripts/                 Evaluation, training, deployment, and tooling scripts
docs/                    Documentation
migrations/              Database migrations
```

## Getting Started

### Prerequisites

- Node.js 20+
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
npm run dev:vite
```

Starts Vite on `http://localhost:5173` (or `5174`) and Wrangler Worker dev on `http://localhost:8787`.

### Static Preview + Auth Server

```bash
npm run dev
```

Builds `dist/` and serves it from `server/index.ts` on `http://localhost:5000`.

### Native

```bash
npm run dev:native
npm run dev:native:ios
npm run dev:native:android
```

## Common Commands

| Command | Description |
| --- | --- |
| `npm run dev:vite` | Full-stack local development |
| `npm run dev` | Build and serve via Express |
| `npm run dev:frontend` | Vite only |
| `npm run dev:workers` | Wrangler Worker dev |
| `npm run build` | Production frontend build |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:a11y` | Static accessibility checks |
| `npm run gate:vision` | Vision quality gate |
| `npm run gate:narrative` | Narrative quality gate |
| `npm run lint` | ESLint |

## Deployment

```bash
npm run deploy
```

The deploy flow is managed by `scripts/deploy.js` and supports migrations, dry runs, and local migration application via the npm scripts in `package.json`.

## Documentation

- `docs/README.md` - documentation index
- `docs/DEVELOPER_ONBOARDING.md` - contributor setup and architecture orientation
- `docs/architecture/full-system-diagrams.md` - detailed architecture diagrams
- `docs/VISION_PIPELINE.md` - current vision pipeline and evaluation flow
- `docs/monetization/monetization-logic.md` - implemented monetization behavior
- `docs/native/react-native-migration-plan.md` - native app migration background and status

## Contributing

1. Use Conventional Commit prefixes like `feat:`, `fix:`, `docs:`, and `test:`.
2. Run relevant tests before opening a PR.
3. Keep documentation changes aligned with code changes.
4. Prefer updating canonical reference docs over adding new one-off notes.
