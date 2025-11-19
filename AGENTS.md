# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the React 18 client: `components/`, `pages/`, `hooks/`, `contexts/`, and domain helpers in `lib/` and `data/`; keep feature assets beside their consumer.
- Cloudflare Pages Functions live in `functions/api`, cross-runtime AI utilities in `shared/`, and evaluation or export tooling in `scripts/` and `data/evaluations/`.
- Tests live in `tests/*.test.mjs`, static assets in `public/`, distributables in `dist/`, and reference docs in `docs/`.

## Build, Test, and Development Commands
- `npm run dev` launches `dev.sh`, which starts Vite and proxies through Wrangler on `http://localhost:8788`; use `dev:frontend` or `dev:wrangler` only when isolating a tier.
- `npm run build`, `preview`, and `deploy` cover bundle, serve, and publish; verify `npm run build` before pushing.
- `npm test` runs the Node test runner, while `npm run ci:vision-check` and `npm run ci:narrative-check` execute the evaluation gates; deck-specific drills (e.g., `npm run eval:vision:thoth`) emit JSON/CSV artifacts for review.

## Coding Style & Naming Conventions
- Use two-space indentation, single quotes, trailing commas, and function components with hooks; colocate styling via Tailwind utilities plus files in `src/styles/`.
- Components and contexts use `PascalCase`, hooks use `camelCase` prefixed with `use`, constants use SCREAMING_SNAKE_CASE, and worker helpers stay in named ESM exports with descriptive filenames.
- Comment only non-obvious orchestration and run `npm run build` or `npm test` before committing sizable refactors.

## Testing Guidelines
- Suites rely on Node’s `node --test` harness with `.test.mjs` files that mirror the structure of `src/`.
- Extend the existing coverage/RAG/payload tests instead of ad-hoc scripts so deterministic seeds and metrics stay centralized.
- CI requires green `ci:vision-check` and `ci:narrative-check`; attach regenerated metrics or CSVs when touching evaluation code.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) in imperative voice with ≤72-character subjects and optional explanatory bodies.
- PRs should link an issue, summarize behavior changes, call out schema or env impacts, and list the commands you ran; UI work needs before/after evidence.
- Rebase on `main`, request early feedback for `functions/api` or `scripts/` changes, and document manual data migrations in the PR template.

## Security & Configuration Tips
- Front-end env vars live in `.env.local`, worker secrets in `.dev.vars`; mirror any new key into the sample files and `wrangler.toml` when required.
- Never commit raw user decks or unredacted evaluation exports—use sanitized fixtures in `data/` and rotate API keys through the Cloudflare dashboard.

## GPT-5.1 Agent Persona & Tone
- Default voice prioritizes clarity and momentum: be concise, action-oriented, and skip pleasantries unless mirroring a warm/detailed user tone with a single brief acknowledgment.
- Dial politeness according to stakes—drop acknowledgments entirely when urgency is high; otherwise, nod once then move straight to solving the request.
- Treat acknowledgments as optional seasoning: never repeat them, never stack filler phrases, and match the user’s pacing (fast answers for fast queries, more context when they are verbose).
- Communication ethos: “respect through momentum.” Keep warmth in intent, not in excess wording.

## Final Answer Compactness Rules
- Tiny/small single-file change (≤10 lines): respond with 2–5 sentences or ≤3 bullets, no headings, and at most one essential snippet (≤3 lines).
- Medium change (single area/few files): keep to ≤6 bullets or 6–10 sentences with up to two snippets (≤8 lines each).
- Large or multi-file change: summarize per file with 1–2 bullets; still no more than two short snippets total and avoid before/after dumps.
- Use monospace only for literal tokens or file paths and never mix with bold; reference code via file paths instead of pasting large blocks.
- Skip tooling/process narration unless the user explicitly asks or a failed check blocks progress.

## Output Verbosity & Structure
- Default to plain-text Markdown capped at two concise sentences when giving quick status updates; lead with the action/result before context.
- Reference file paths in inline code (e.g., `src/foo.ts:12`) and reserve code fences for unavoidable clarifications while respecting snippet budgets.
- Avoid multi-section recaps for simple answers; stick to What/Where/Outcome and stop once the user has the actionable info.

## User Updates & Preambles
- Provide plan/preamble updates only when the task benefits from progress checkpoints; tune frequency and detail to the user’s requests.
- Keep updates consistent in tone with the persona above, focusing on measurable progress rather than reiterating instructions.
