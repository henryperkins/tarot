# Tableu – Copilot Instructions

## Big picture (SPA + single Worker)

- Frontend: React 19 + Vite SPA in `src/`, builds to `dist/`.
- Backend: a single Cloudflare Worker router in `src/worker/index.js` that serves static assets (ASSETS binding) and routes `/api/*` to `functions/api/*`.
- API handlers use Pages-style `onRequestGet/onRequestPost(ctx)` and must return `Response` (see `functions/api/tarot-reading.js`).
- Shared logic that runs in both environments belongs in `shared/`.

## Hard runtime boundaries (do not cross-import)

- `src/lib/*` = browser-only (DOM/localStorage/etc.).
- `functions/lib/*` + `functions/api/*` = Worker/server-only (`env` bindings: D1/KV/AI/secrets).
- `scripts/*` = Node.js tooling.

## Core product invariants

- Seeded draws use `computeSeed()` + `drawSpread()` in `src/lib/deck.js`; the current seed includes a per-event timestamp, so a fixed complete seed/session is reproducible while repeating the ritual later can differ.
- Spreads and position semantics live in `src/data/spreads.js`; keep `roleKeys` stable.
- Narratives must only reference the provided `cardsInfo`; validation lives in `functions/api/tarot-reading.js`.
- Knowledge graph patterns: data in `src/data/knowledgeGraphData.js`, detection in `functions/lib/knowledgeGraph.js`.

## Integrations and data flow

- Narratives use the configured order `modal-qwen` → `azure-gpt5` (native OpenAI or Azure Responses) → `claude-opus45` → `local-composer`; see `functions/lib/narrativeBackends.js` and `wrangler.jsonc`.
- Evaluation runs async via Workers AI model `@cf/qwen/qwen3-30b-a3b-fp8` and stores results in D1 `eval_metrics`.
- Vision research mode uses `/api/vision-proof` and `VISION_PROOF_SECRET`; proof is optional but must be valid when provided.

## Dev, deploy, and tests

- `npm run dev:vite` (`scripts/dev.mjs`) loads `.dev.vars`, applies local D1 migrations unless `--skip-migrations`, starts Vite 5173/5174, builds `dist/`, then Wrangler dev on 8787. `/api` is proxied via `vite.config.js`.
- `npm run config:check` validates selected provider and auth configuration; it is not a complete feature-secret audit.
- `npm run deploy` applies remote D1 migrations then builds and deploys; queries should degrade gracefully during partial rollouts.
- Tests: `npm test` (unit), `npm run test:e2e` / `npm run test:e2e:integration` (Playwright), `npm run gate:vision` / `npm run gate:narrative` for quality gates.

## UI conventions (React)

- Functional components only; keep components presentational and Tailwind-first.
- Prefer existing tarot CSS hooks (`.tarot-card-*`, `.cc-grid`) and respect reduced-motion and focus styles.
