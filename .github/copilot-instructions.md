# Mystic Tarot – AI coding guide

## Architecture & entrypoints
- React+Vite SPA in `src/` with routes defined in `src/main.jsx` (`/` → `TarotReading.jsx`, `/journal` → `components/Journal.jsx`).
- Cloudflare Pages Functions in `functions/api/`:
  - `tarot-reading.js` – spread analysis + narrative generation.
  - `tts.js` – Azure OpenAI TTS bridge with local waveform fallback.
- Card data and spreads live in `src/data/`; analysis and narrative logic live server-side under `functions/lib/` (including `narrative/`, `spreadAnalysis.js`, `knowledgeGraph.js`).

## Dev & test workflow
- Node ESM everywhere (`"type": "module"`); use `import`/`export` and `.test.mjs` for tests.
- Frontend dev: `npm run dev` (Vite at 5173). Full stack: `npm run build` then `npx wrangler pages dev dist` (uses `.dev.vars`).
- Tests: `npm test` (Node’s test runner over `tests/*.test.mjs`, e.g. `deck.test.mjs`, `api.validatePayload.test.mjs`, `narrativeSpine.test.mjs`). Add new tests here and keep them fast and deterministic.

## Tarot flow on the client (`TarotReading.jsx`)
- Builds spreads via `SPREADS` (`src/data/spreads.js`) and deck helpers in `src/lib/deck.js` (`computeSeed`, `drawSpread`, `computeRelationships`); preserve seeded determinism (question + knocks + cut) for reproducible draws.
- Manages question, ritual, reveal state, reflections, and then POSTs to `/api/tarot-reading` with `{ spreadInfo: { name }, cardsInfo: [...] }`.
- Persists user state in localStorage (`tarot-voice-enabled`, `tarot-ambience-enabled`, `tarot-theme`, `tarot_journal`); do not change these shapes without migration logic.

## `functions/api/tarot-reading.js` contract & pipeline
- Payload validation is centralized in `validatePayload()` (card counts via `SPREAD_NAME_MAP`, required fields on `cardsInfo[]`). When adding spreads, update `SPREAD_NAME_MAP` and `tests/api.validatePayload.test.mjs`.
- `performSpreadAnalysis()` is the canonical analyzer:
  - Builds `themes` (suits, elements, reversals, timing) and per-spread `spreadAnalysis` using `functions/lib/spreadAnalysis.js` and `functions/lib/knowledgeGraph.js`.
  - Response shape includes `{ reading, provider, themes, context, spreadAnalysis }`; the UI should trust these server fields instead of re-deriving analysis.
- Narrative generation:
  - Primary: `generateWithAzureGPT5Responses()` (Azure Responses API; env: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL`, optional `AZURE_OPENAI_API_VERSION`).
  - Fallback: `composeReadingEnhanced()` → spread builders in `functions/lib/narrative/spreads/*.js` + `narrativeSpine.js` to enforce the “what / why / what’s next” story spine.
  - Keep prompts and builders aligned with `CLAUDE.md` ethics: no invented cards, no absolute predictions, and no medical/legal/financial or crisis advice.

## Knowledge graph & tarot semantics
- Tarot pattern system is documented in `docs/knowledge-graph/*.md` and implemented in `functions/lib/knowledgeGraph.js` (+ `functions/lib/spreadAnalysis.js`).
- `detectAllPatterns()` + `getPriorityPatternNarratives()` select at most a small set of high-value patterns (triads, Fool’s Journey stage, dyads); avoid adding APIs that flood the UI with low-signal combinations.
- When extending patterns or spread analysis, update the docs and tests (`functions/lib/__tests__/knowledgeGraph.test.js`) so new behavior is well-specified.

## Audio, UX, and safety
- Audio: `src/lib/audio.js` orchestrates ambience and narration against `/api/tts`; `functions/api/tts.js` prefers Azure GPT‑4o‑mini TTS (`AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`) and falls back to a local WAV tone. Preserve the `GET /api/tts` health response shape `{ status, provider, timestamp }`.
- UI: `Card.jsx`, `ReadingGrid.jsx`, and `styles/tarot.css` intentionally avoid copyrighted deck art; keep geometry/typography–only visuals and existing ARIA / reduced-motion behaviors.
- Ethics: treat readings as reflective guidance. Any new copy, prompts, or features should:
  - Emphasize agency and free will, not fixed fate.
  - Avoid diagnosing, prescribing, or replacing professional help for health, safety, legal, or financial issues.
  - Stay inclusive and trauma‑aware in tone (see `CLAUDE.md` and `guide.md` for reference language).

## React & styling conventions
- Components: functional React with hooks only; keep `TarotReading.jsx` as the orchestration layer and keep `src/components/*` mostly presentational (receive props, no global side effects).
- Styling: Tailwind-first via `src/styles/tailwind.css` with small, semantic utility classes in `tarot.css` (`.modern-surface`, `.ai-panel-modern`, `.tarot-card-*`, `.cc-grid`). Prefer composing existing classes over introducing new ad-hoc colors or globals.
- Cards: `Card.jsx` expects the `.tarot-card-*` CSS hooks and CSS variable suit accents; if you adjust card layout, keep the back/face split, upright vs reversed classes, and `isMinor`/`getMinorPipCount` logic intact.
- Layout: use the Celtic Cross grid utilities (`.cc-grid` + `.cc-*` areas) for 10-card layouts; don’t re-encode grid rules in JSX—lean on the existing responsive CSS.
- Theming & motion: theme toggling is done by toggling `light` on `<html>`; add light-mode overrides in `tarot.css` alongside existing ones. Respect `prefers-reduced-motion` (see `flipCard` keyframes and scroll-behavior) and the focus-visible ring styles when adding interactive elements.
