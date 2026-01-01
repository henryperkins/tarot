# Repository Guidelines

## Project Structure & Module Organization

- Frontend (React + Vite) lives in `src/`: `components/`, `pages/`, `contexts/`, `hooks/`, `styles/tailwind.css` for Tailwind setup.
- Cloudflare Worker entrypoint is `src/worker/index.js`; route handlers live in `functions/api/`, shared logic in `functions/lib/`, with tests under `tests/*.test.mjs` (plus any `__tests__/`).
- Static decks/data live in `public/` and `data/`; build output lands in `dist/`.

## Build, Test, and Development Commands

- `npm run dev` — starts Vite HMR (5173/5174), builds `dist/`, and runs Wrangler Workers dev on 8787 (cross-platform).
- `npm run dev:frontend` for UI-only work; `npm run dev:wrangler`/`dev:workers` to run the Worker dev server.
- `npm run build` → `dist/`; `npm run preview` serves the built bundle locally; `npm run deploy` publishes the Worker (`tableau`) via wrangler.
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

- Keep secrets out of the repo. Local values go in `.dev.vars`; set production/preview secrets with `wrangler secret put <NAME> --config wrangler.jsonc` (see `wrangler.jsonc` for required `AZURE_OPENAI_*`, `VISION_PROOF_SECRET`, etc.).
- Do not log keys or PII; rotate credentials immediately if leaked.

## Narrative & Prompt Engineering Notes

- Prompt metadata now surfaces GraphRAG state: `semanticScoringRequested/Used/Fallback`, `passagesProvided`, `passagesUsedInPrompt`, `truncatedPassages`, and `includedInPrompt`. Use these to warn when GraphRAG was dropped for budget or trimmed.
- GraphRAG slimming steps can remove the block; check `promptMeta.graphRAG.includedInPrompt` before assuming passages were injected.
- PII redaction covers ISO dates, US phone numbers with extensions, and possessive display names; it is still US-centric for phone formats. Prompt persistence stays opt-in via `PERSIST_PROMPTS=true`.
