# Mystic Tarot - Gemini Context

## Project Overview

**Mystic Tarot** is an advanced AI-powered tarot reading application. It combines traditional tarot symbolism with modern Large Language Models (LLMs) to generate context-aware, empathetic, and structured readings. It features a React frontend and a serverless backend hosted on Cloudflare Pages.

## Key Technologies

- **Frontend:** React 18, Vite, Tailwind CSS
- **Backend:** Cloudflare Pages Functions (Node.js compatibility mode)
- **Database:** Cloudflare D1 (SQLite)
- **Key-Value Store:** Cloudflare KV (Rate limiting, Caching)
- **AI Providers:** Azure OpenAI (GPT-5.1 for text, GPT-4o-mini for TTS), Anthropic (Claude Sonnet 4.5)
- **Testing:** Node.js Native Test Runner (`node --test`)

## Architecture

- **`src/`:** React client application.
  - `components/`: UI components.
  - `pages/`: Route handlers.
  - `hooks/`: Custom React hooks.
  - `contexts/`: State management.
  - `lib/`: Frontend domain logic.
- **`functions/`:** Cloudflare Pages Functions (API).
  - `api/`: API endpoints (e.g., `tarot-reading`, `tts`).
  - `lib/`: Shared backend logic and knowledge graph.
- **`scripts/`:** Utility scripts for evaluation, training, and deployment.
- **`docs/`:** Extensive documentation on architecture, vision pipeline, and esoteric models.

## Building and Running

- **Install Dependencies:** `npm install`
- **Development Server:** `npm run dev` (Starts Vite and Wrangler Workers dev)
- **Frontend Only:** `npm run dev:frontend`
- **Build for Production:** `npm run build`
- **Deploy:** `npm run deploy`
- **Run Tests:** `npm test` (Runs `tests/*.test.mjs`)
- **Vision Evaluation:** `npm run eval:vision:all`
- **Narrative Evaluation:** `npm run eval:narrative`

## Development Conventions

- **Code Style:**
  - Use 2-space indentation.
  - React components in `PascalCase`.
  - Hooks in `camelCase` (prefixed with `use`).
  - Constants in `SCREAMING_SNAKE_CASE`.
  - Prefer Tailwind CSS for styling.
- **Testing:**
  - Tests are located in `tests/` and use the `.test.mjs` extension.
  - Run tests before pushing changes.
  - Use `npm run ci:vision-check` and `npm run ci:narrative-check` for quality gates.
- **Commits:**
  - Follow Conventional Commits (`feat:`, `fix:`, `chore:`).
  - Imperative mood.

## Key Files

- `package.json`: Dependency and script management.
- `wrangler.toml`: Cloudflare configuration (bindings, environment variables).
- `SYSTEM_ARCHITECTURE.md`: Comprehensive architectural overview.
- `AGENTS.md`: Specific instructions for AI agents (persona, tone).
- `src/main.jsx`: Frontend entry point.
- `functions/api/tarot-reading.js`: Main logic for generating readings.

## AI Persona (from AGENTS.md)

- **Tone:** Professional, direct, concise ("respect through momentum").
- **Output:** Minimal pleasantries, focus on action/result.
- **Format:** Markdown, max 2-5 sentences for small changes.
