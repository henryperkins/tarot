# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Tableu** — React + Vite tarot reading app on Cloudflare Workers. Designed to feel like sitting with a practiced reader, not a generic card widget.

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | React + Vite | `src/` |
| Backend | Cloudflare Workers | `functions/api/` |
| AI | `modal-qwen` → `azure-gpt5` (native OpenAI or Azure Responses) → `claude-opus45` → `local-composer` | `functions/api/tarot-reading.js`, `functions/lib/narrativeBackends.js`, `wrangler.jsonc` |
| Database | Cloudflare D1 | `migrations/*.sql` |
| Storage | Cloudflare D1 + KV + R2 | `eval_metrics` in D1 is the primary reading/evaluation store; `METRICS_DB` KV carries media telemetry, media-usage counters, card-video job metadata, and ongoing legacy archival input; R2 stores generated/user media, exports, archives, and logs |

**Deck**: 78 cards (22 Major + 56 Minor Arcana) with 1909 Rider-Waite public domain images.

## Commands

Use Node 24, matching CI. The default branch is `master`. Review current package
scripts before running commands; deploy and remote migrations publish changes.

```bash
npm run dev           # Full-stack dev (Vite 5173/5174 + Worker 8787)
npm run dev:vite      # Alias for `npm run dev`
npm run dev:frontend  # Vite-only for UI work
npm run dev:workers   # Worker dev server with live reload
npm run build         # Production build to dist/
npm run deploy        # Deploy to Cloudflare Workers (auto-applies migrations)
npm test              # Root tests/*.test.mjs only
npm run test:deploy   # Deploy script tests
npm run test:e2e      # Playwright E2E
npm run test:a11y     # Accessibility checks (contrast + WCAG)
npm run lint          # ESLint
npm run docs:check    # Maintained Markdown link check
npm run lint:fix      # Auto-fix lint issues
npm run gate:design   # Verify design contract compliance
```

## Architecture

### Three `lib/` Folders (Critical!)

| Path | Environment | Can Access | Cannot Access |
|------|-------------|------------|---------------|
| `src/lib/` | Browser | DOM, window, localStorage, React | env, D1, KV, R2, secrets |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, AI binding | DOM, window, React |
| `scripts/lib/` and `scripts/*/lib/` | Node.js | fs, process, node modules | DOM, Cloudflare bindings |

**Never import DOM-dependent code into Workers or Worker bindings into the browser.**
Shared logic goes in `shared/`; pure card/spread data in `src/data/` is also used by Workers.

## Spreads (from `src/data/spreads.js`)

**Constraint**: Position meanings used by `buildCardsSection` and frontend text. Don't change casually.

## Reading Flow

1. **Question** — Open-ended prompts ("How can I...?", "What influences...?"). Avoid yes/no.
2. **Ritual** — Knocks + cut position + question → `computeSeed()`
3. **Draw** — `drawSpread()` uses seeded shuffle, assigns upright/reversed
4. **Reveal** — Card flip animation, user reflections per card
5. **Narrative** — Use `modal-qwen` → `azure-gpt5` (native OpenAI or Azure Responses) → `claude-opus45` → `local-composer` in `functions/lib/narrativeBackends.js`; do not assume a model from an older guide.

**Pipeline**: `spreadAnalysis.js` (dignities, reversals) + `knowledgeGraph.js` (patterns) → `graphContext.js` → `graphRAG.js` (passages) → `prompts.js` → AI → structural quality gate (`tarot-reading.js` + `readingQuality.js`) → `evaluation.js` (async scoring). The same analysis invokes `buildReadingReasoning()`; the local composer wraps its builders with `buildReadingWithReasoning()`.

## Interpretation Rules

- **Position-first**: Same card reads differently in "Challenge" vs "Advice" vs "Outcome"
- **Reversals** (pick ONE model per reading): blocked, delayed, internalized, contextual, shadow, mirror, or potentialBlocked; `none` applies to all-upright spreads
- **Synthesis**: Identify tension → map causes → offer practical steps

## Knowledge Graph & Pattern Detection

Pattern detection in `functions/lib/knowledgeGraph.js`, data in `src/data/knowledgeGraphData.js`.

## GraphRAG (Retrieval-Augmented Generation)

`functions/lib/graphRAG.js` retrieves passages from curated knowledge base based on detected patterns.

## Reversal Frameworks

Selected per-reading based on spread size, reversal ratio, and question keywords. Defined in `functions/lib/spreadAnalysis.js:REVERSAL_FRAMEWORKS`.

## Deck Variations

The `deckStyle` parameter affects card names, court titles, and features. Config in `src/data/knowledgeGraphData.js:DECK_STYLE_OVERRIDES`.

## Ethics (Non-Negotiable)

- Tarot = guidance, NOT replacement for medical/legal/financial/mental health professionals
- Emphasize agency: "likely path if unchanged", not determinism
- **Card grounding** — prompts and structural quality gates require references to actual `cardsInfo`; out-of-set references are measured and may be rejected when they exceed configured allowances, not treated as impossible
- Trauma-informed, empowering language
- Include disclaimers for sensitive topics

## Card Images

- Source: 1909 Rider-Waite "Roses & Lilies" (Wikimedia Commons, public domain)
- Location: `public/images/cards/RWS1909_-_*.jpeg`
- Naming: `RWS1909_-_XX_Name.jpeg` (Major), `RWS1909_-_Suit_XX.jpeg` (Minor)
- Also: `marseille/*.jpg`, `thoth/*.png`

## Database Schema

Tables are defined by the migrations in `migrations/`.

### Migration Deploy Order

**IMPORTANT**: Always apply D1 migrations BEFORE deploying code using new columns.

The checked-in deployment workflow (`.github/workflows/deploy.yml`) runs `node scripts/deploy.js`, which applies pending migrations and deploys the Worker. If an external Cloudflare Workers Build is also configured, verify its migration behavior separately; do not assume it matches the checked-in workflow. Apply and verify pending remote migrations before merging, then confirm the active Worker version before another release.

```bash
npm run deploy              # Auto-applies migrations + deploys (recommended)
npm run deploy:dry-run      # Preview
npm run migrations:status   # Check pending
npm run migrations:apply    # Apply only
```

## Evaluation System

When evaluation is enabled, readings are scored asynchronously with the configured
Workers AI `EVAL_MODEL` using `waitUntil()`. Runtime metrics and evaluation payloads
are written directly to the D1 `eval_metrics` table; the current evaluator prompt
version is `2.4.0`. Gate reasons are `safety_flag_true`, `safety_lt_2`, `tone_lt_2`,
`eval_unavailable`, and `eval_incomplete_scores` (the latter two are sync-gate
fallback reasons).

See `docs/evaluation-system.md` for full details.

## Tests

### Unit Tests
```bash
npm test  # Root tests/*.test.mjs only; Functions and Playwright suites are separate
```

Never copy production tokens into fixtures. Test-helper details live in `tests/CLAUDE.md`; Playwright modes and suites in `e2e/CLAUDE.md`.

Record unit, browser, static accessibility, QA gate, deployment, and live proof
separately. For narrative/vision changes, also run the corresponding `ci:*` gate;
do not lower thresholds or claim a local-composer result proves a live provider.

## Working with This Repo

1. **Spreads/cards** in `src/data/` are source of truth
2. **Narratives** must derive from actual `cardsInfo` — never invent cards
3. **New spreads** need:
   - Position definitions in `src/data/spreads.js` with `positions` and `roleKeys`
   - Spread-specific analysis in `functions/lib/spreadAnalysis.js` (optional)
   - Narrative builder in `functions/lib/narrative/spreads/`
4. **New patterns** need entries in `src/data/knowledgeGraphData.js` and passages in `functions/lib/knowledgeBase.js` (internally authored Tableu Tarot Canon; no copyrighted book text is included)
5. **Visual changes** must preserve A11y (labels, focus, ARIA)
6. **Deck-aware code** should accept `deckStyle` and use helpers from `knowledgeGraph.js`
7. **Evaluation impact**: Changes affecting reading output may impact quality scores
8. Keep the authentic tarot feel — this isn't a generic card app

## API Endpoints

Routing lives in `src/worker/index.js`; handlers are in `functions/api/`.
ChatGPT MCP (`/mcp`, `/oauth/*`) uses OAuth 2.1 issued by Tableu with an owner allowlist; see `docs/integrations/openai/chatgpt-mcp.md`.

## Scoped guidance

Read `functions/CLAUDE.md` for Worker authentication, journal contracts, and secrets.
Read `scripts/CLAUDE.md` for evaluation, export, and release commands.
