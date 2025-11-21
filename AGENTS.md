# Repository Guidelines

## Project Structure & Module Organization
- Frontend (React + Vite) lives in `src/`: `components/` reusable UI, `pages/` routed screens, `contexts/` providers, `hooks/` shared logic, `styles/tailwind.css` for Tailwind setup.
- Cloudflare Pages Functions sit in `functions/api/`; shared server logic in `functions/lib/` with tests in `functions/lib/__tests__/`.
- Domain/unit tests reside in `tests/*.test.mjs`. Static decks/data live in `public/` and `data/`; build output lands in `dist/`.

## Build, Test, and Development Commands
- `npm run dev` — runs `dev.sh` to start Vite plus Wrangler proxy at http://localhost:8788.
- `npm run dev:frontend` for UI-only work; `npm run dev:wrangler` when you only need the proxy.
- `npm run build` → `dist/`; `npm run preview:pages` serves that bundle locally; `npm run deploy` publishes to Cloudflare Pages (`tableau`).
- `npm test` executes Node tests. Quality gates for ML flows: `npm run gate:vision` and `npm run gate:narrative` when touching vision or narrative code.

## Coding Style & Naming Conventions
- ESM and functional React components throughout; 2-space indent, single quotes, and terminal semicolons.
- Components/pages use PascalCase filenames; hooks start with `use`; Pages Functions stay kebab-case.
- Prefer Tailwind utilities; share tokens in `styles/tailwind.css` or `tailwind.config.js`. Keep inline styles rare and justified.
- Keep side effects in hooks/context or `functions/lib/`; UI components stay presentational.

## Testing Guidelines
- Mirror file names in tests (`graphRAG.test.mjs`, etc.). New modules should gain matching tests under `tests/` or `__tests__/`.
- Stub external services in server tests; for hooks, mock context/provider wrappers. Cover edge cases and error paths, not only the happy path.
- Run `npm test` before pushing; if vision/narrative logic changes, also run the relevant `gate:*` command and record results.

## Commit & Pull Request Guidelines
- Prefer Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); imperative subject; avoid placeholders like `up`.
- PRs: concise summary, linked issue, tests run, and screenshots/recordings for UI changes; note any config/env steps needed post-merge.

## Security & Configuration Tips
- Keep secrets out of the repo. Local values go in `.dev.vars`; set production/preview secrets with `wrangler pages secret put` (see `wrangler.toml` for required `AZURE_OPENAI_*`, `VISION_PROOF_SECRET`, etc.).
- Do not log keys or PII; rotate credentials immediately if leaked.
