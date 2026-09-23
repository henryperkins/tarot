# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Tableu** — React + Vite tarot reading app on Cloudflare Workers. Designed to feel like sitting with a practiced reader, not a generic card widget.

Narrative generation uses OpenAI GPT-5.6-sol (high reasoning) via the Responses API (native or Azure; fallback: Claude/local composer) in `functions/api/tarot-reading.js`.

## Architecture

### Three `lib/` Folders (Critical!)

| Path | Environment | Can Access | Cannot Access |
|------|-------------|------------|---------------|
| `src/lib/` | Browser | DOM, window, localStorage, React | env, D1, KV, R2, secrets |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, AI binding | DOM, window, React |
| `scripts/*/lib/` | Node.js | fs, process, node modules | DOM, Cloudflare bindings |

**Never import browser code into Workers or vice versa.** Shared logic goes in `shared/`.

## Spreads

`src/data/spreads.js` is the source of truth for positions and roleKeys.

**Constraint**: Position meanings used by `buildCardsSection` and frontend text. Don't change casually.

## Interpretation Rules

- **Position-first**: Same card reads differently in "Challenge" vs "Advice" vs "Outcome"
- **Reversals** (pick ONE model per reading): blocked/delayed, excess/deficiency, internalized, opposite
- **Synthesis**: Identify tension → map causes → offer practical steps

## Ethics (Non-Negotiable)

- Tarot = guidance, NOT replacement for medical/legal/financial/mental health professionals
- Emphasize agency: "likely path if unchanged", not determinism
- **No hallucinated cards** — only reference actual `cardsInfo`
- Trauma-informed, empowering language
- Include disclaimers for sensitive topics

## Database Migrations

**IMPORTANT**: Always apply D1 migrations BEFORE deploying code using new columns.

```bash
npm run deploy              # Auto-applies migrations + deploys (recommended)
npm run deploy:dry-run      # Preview
npm run migrations:status   # Check pending
npm run migrations:apply    # Apply only
```

## Evaluation

Every AI reading is scored async (`functions/lib/evaluation.js`, via `waitUntil()`). See `docs/evaluation-system.md` for full details.

## Tests

- `npm run test:e2e` runs frontend-only E2E against Vite (5173); `npm run test:e2e:integration` needs the full stack (8787).
- Integration tests require `.dev.vars` with API credentials.

## Working with This Repo

1. **Spreads/cards** in `src/data/` are source of truth
2. **Narratives** must derive from actual `cardsInfo` — never invent cards
3. **New spreads** need:
   - Position definitions in `src/data/spreads.js` with `positions` and `roleKeys`
   - Spread-specific analysis in `functions/lib/spreadAnalysis.js` (optional)
   - Narrative builder in `functions/lib/narrative/spreads/`
4. **New patterns** need entries in `src/data/knowledgeGraphData.js` and passages in `functions/lib/knowledgeBase.js`
5. **Visual changes** must preserve A11y (labels, focus, ARIA)
6. **Deck-aware code** should accept `deckStyle` and use helpers from `knowledgeGraph.js`
7. **Evaluation impact**: Changes affecting reading output may impact quality scores
8. Keep the authentic tarot feel — this isn't a generic card app
