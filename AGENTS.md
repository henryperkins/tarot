# Repository Guidelines

## Project Structure & Module Organization

- **Frontend (React + Vite)** lives in `src/`:
  - `components/` — React UI components
  - `pages/` — Page-level components/routes
  - `contexts/` — React context providers
  - `hooks/` — Custom React hooks
  - `lib/` — Frontend utility libraries
  - `utils/` — Helper utilities
  - `data/` — Static frontend data
  - `styles/tailwind.css` — Tailwind setup
- **Cloudflare Worker** entrypoint is `src/worker/index.js`; route handlers live in `functions/api/`, shared logic in `functions/lib/`.
- **Shared code** between frontend and worker lives in `shared/`: `contracts/`, `journal/`, `monetization/`, `symbols/`, `vision/`.
- **Scripts** live in `scripts/`: `evaluation/` for quality gates, `training/` for ML workflows, `vision/` for vision pipeline tools, `lib/` for shared script utilities.
- **Tests** are organized as:
  - Unit tests: `tests/*.test.mjs` and `functions/__tests__/`
  - E2E tests: `e2e/*.spec.js` (Playwright)
  - Accessibility tests: `tests/accessibility/`
- **Database migrations** are in `migrations/` (numbered SQL files).
- **Static assets** live in `public/` and `data/`; deck images in `selectorimages/`; build output lands in `dist/`.

## Build, Test, and Development Commands

### Development
- `npm run dev` — starts Vite HMR (5173/5174), builds `dist/`, and runs Wrangler Workers dev on 8787 (cross-platform).
- `npm run dev:frontend` — Vite-only for UI work.
- `npm run dev:wrangler` / `npm run dev:workers` — Worker dev server with live reload.

### Build & Deploy
- `npm run build` → `dist/`
- `npm run preview` — serves built bundle locally.
- `npm run deploy` — builds and publishes Worker (`tableau`) via Wrangler with migrations.
- `npm run deploy:dry-run` — preview deployment without applying.
- `npm run deploy:skip-migrations` — deploy without running migrations.

### Database Migrations
- `npm run migrations:status` — check pending migrations (dry-run).
- `npm run migrations:apply` — apply pending migrations to production.
- `npm run migrations:apply:local` — apply migrations locally.

### Testing
- `npm test` — runs Node unit tests (`tests/*.test.mjs`).
- `npm run test:e2e` — runs Playwright E2E tests.
- `npm run test:e2e:ui` — interactive Playwright UI mode.
- `npm run test:e2e:headed` — headed browser E2E tests.
- `npm run test:e2e:debug` — debug mode for E2E tests.
- `npm run test:e2e:integration` — integration-specific E2E tests.

### Accessibility Testing
- `npm run test:contrast` — WCAG contrast checker.
- `npm run test:wcag` — WCAG compliance analyzer.
- `npm run test:a11y` — runs both contrast and WCAG tests.

### Quality Gates (ML Flows)
- `npm run gate:vision` — verify vision pipeline quality across all deck styles.
- `npm run gate:narrative` — verify narrative generation quality.
- `npm run ci:vision-check` — full CI pipeline for vision (eval + metrics + gate).
- `npm run ci:narrative-check` — full CI pipeline for narrative.

### Vision Evaluation
- `npm run eval:vision` — run vision confidence evaluation.
- `npm run eval:vision:all` — evaluate all deck styles (RWS, Thoth, Marseille).
- `npm run eval:vision:metrics` — compute metrics from evaluation results.
- `npm run review:vision` — process human review queue.

### Narrative Evaluation
- `npm run eval:narrative` — run narrative samples and compute metrics.
- `npm run review:narrative` — process narrative review queue.

### Prompt Management
- `npm run prompts:view` — view stored prompts.
- `npm run prompts:stats` — prompt statistics.
- `npm run prompts:export` — export prompts for analysis.

### Linting
- `npm run lint` — run ESLint.
- `npm run lint:fix` — auto-fix linting issues.

## Coding Style & Naming Conventions

- ESM and functional React components throughout; 2-space indent, single quotes, and terminal semicolons.
- Components/pages use PascalCase filenames; hooks start with `use`; Pages Functions stay kebab-case.
- Prefer Tailwind utilities; share tokens in `styles/tailwind.css` or `tailwind.config.js`. Keep inline styles rare and justified.
- Keep side effects in hooks/context or `functions/lib/`; UI components stay presentational.

## Testing Guidelines

- Mirror file names in tests (`graphRAG.test.mjs`, etc.). New modules should gain matching tests under `tests/` or `functions/__tests__/`.
- E2E tests in `e2e/` use Playwright; name as `*.spec.js`. Run `npm run test:e2e:ui` for interactive debugging.
- Accessibility tests live in `tests/accessibility/`; run `npm run test:a11y` for WCAG compliance.
- Stub external services in server tests; for hooks, mock context/provider wrappers. Cover edge cases and error paths, not only the happy path.
- Run `npm test` before pushing; for vision/narrative changes, also run `npm run ci:vision-check` or `npm run ci:narrative-check` and record results.

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
