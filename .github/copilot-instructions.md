# Tableau (Tarot) – Copilot Instructions

## Big picture (SPA + single Worker)

- Frontend: React 18 + Vite SPA in `src/`, built to `dist/`.
- Backend: a single Cloudflare Worker router in `src/worker/index.js` that:
  - serves static assets via the `ASSETS` binding (`wrangler.jsonc`), and
  - routes `/api/*` to modules in `functions/api/*`.
- API handlers use the Pages-style signature (`export async function onRequestGet/onRequestPost(ctx)`) and must return a `Response` (see `functions/api/tarot-reading.js`).
- The Worker adds CORS, maps regex routes + `params`, and injects OpenGraph tags for `/share/:token` (also in `src/worker/index.js`).

## Hard boundaries (don’t cross-import)

- `src/lib/*` = browser-only (DOM/localStorage/etc.)
- `functions/lib/*` + `functions/api/*` = Worker/server-only (`env` bindings: D1/KV/AI/secrets)
- `scripts/*` = Node.js tooling
- Prefer cross-runtime helpers in `shared/` when truly environment-agnostic.

## Local dev workflow (non-obvious bits)

- Run `npm run dev` (uses `scripts/dev.mjs`):
  - loads `.dev.vars` into `process.env` (missing vars are OK; some features fall back),
  - applies **local** D1 migrations (`npm run migrations:apply:local`) unless `--skip-migrations`,
  - starts Vite on 5173/5174, builds `dist/`, then starts Wrangler dev on 8787.
- During UI work, use the Vite URL; `/api` is proxied to 8787 via `vite.config.js`.
- `npm run config:check` (`scripts/checkEnv.js`) tells you which `.dev.vars` entries are required for AI/TTS/vision.

## Deploy & database migrations

- `npm run deploy` runs `scripts/deploy.js`: applies **remote** D1 migrations (tracked in `_migrations`), then builds and deploys.
- Schema lives in `migrations/*.sql`. Many endpoints “degrade gracefully” during partial rollouts (e.g. tolerate missing columns in `functions/api/journal.js`); preserve that pattern when editing queries.
- `wrangler.jsonc` notes current bindings/flags; R2 archival is currently disabled/commented and archival tables live in D1.

## Tarot reading invariants (don’t break determinism)

- Deterministic draws: `computeSeed()` + `drawSpread()` in `src/lib/deck.js` (seed derived from question + knocks + cut).
- Server narratives must only reference the provided cards/positions; payload validation lives in `functions/api/tarot-reading.js`.

## Tests and quality gates

- Unit: `npm test` (Node test runner; `tests/*.test.mjs`).
- E2E: `npm run test:e2e` (frontend-only) vs `npm run test:e2e:integration` (full stack; requires `.dev.vars`).
- If touching evaluation/vision/narrative sampling, run `npm run gate:vision` / `npm run gate:narrative` (see `scripts/evaluation/*`).
