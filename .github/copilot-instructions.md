# Tableau (Tarot) – Copilot Instructions

## Architecture (Workers + SPA)

- Frontend: React 18 + Vite SPA in `src/` (routes in `src/main.jsx`), built to `dist/`.
- Backend: a single Cloudflare Worker (`src/worker/index.js`) that:
  - serves `dist/` via the `ASSETS` binding (see `wrangler.jsonc`), and
  - routes `/api/*` to modules in `functions/api/*`.
- API handlers follow the Pages-style shape (`export async function onRequestGet/onRequestPost(...)`) and must return a `Response`.
- Shared cross-runtime code lives in `shared/` (e.g. `shared/journal/dedupe.js`). Tarot canon is in `src/data/`; images/audio in `public/`.

## Hard boundaries (don’t cross-import)

- `src/lib/*` = browser-only (DOM/localStorage/etc).
- `functions/lib/*` + `functions/api/*` = Worker/server-only (`env` bindings: D1/KV/R2/secrets).
- `scripts/*` = Node.js tooling.

## Local dev / build / deploy

- `npm run dev` runs `dev.sh`: Vite HMR on 5173/5174 + Wrangler dev on 8787.
- Use the Vite URL for UI work; `/api` is proxied to 8787 (see `vite.config.js`).
- Wrangler serves static assets from `dist/`; if you test the full Worker-served app at 8787, rebuild after UI changes.
- `npm run deploy` uses `scripts/deploy.js` (applies D1 migrations, then deploys with `wrangler`).

## D1 migrations & “degrade gracefully” pattern

- DB schema lives in `migrations/*.sql`; apply migrations before shipping code that depends on new columns.
- Many endpoints guard against partial rollouts (e.g. "no such column" fallback + per-row JSON parsing in `functions/api/journal.js`). Keep that resiliency when editing queries.

## Tarot reading invariants

- Deterministic draws: `computeSeed()` + `drawSpread()` in `src/lib/deck.js` (seed depends on question + knocks + cut).
- The narrative must only reference the provided cards/positions; tarot payload validation is in `validatePayload()` in `functions/api/tarot-reading.js`.

## Tests & gates

- Unit: `npm test` (Node test runner; `tests/*.test.mjs`).
- E2E: `npm run test:e2e` (frontend-only) or `npm run test:e2e:integration` (full stack; requires `.dev.vars`).
- If touching vision/narrative evaluation flows: run `npm run gate:vision` / `npm run gate:narrative`.
