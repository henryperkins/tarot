# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Tableu** — React + Vite tarot reading app deployed to Cloudflare Workers. Designed to feel like sitting with a practiced reader, not a generic card widget.

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | React + Vite | `src/` |
| Backend | Cloudflare Workers | `src/worker/index.js` → `functions/api/` |
| AI | Claude Sonnet 4.5 (fallback: local composer) | `functions/api/tarot-reading.js` |
| Database | Cloudflare D1 | `migrations/*.sql` |

**Deck**: 78 cards (22 Major + 56 Minor Arcana) with 1909 Rider-Waite public domain images.

## Commands

```bash
npm run dev      # Vite dev server at localhost:5173
npm run build    # Production build to dist/
npm run deploy   # Deploy to Cloudflare Workers
```

## Architecture

### Three `lib/` Folders (Important!)

| Path | Environment | Access |
|------|-------------|--------|
| `src/lib/` | Browser | DOM, window APIs |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, secrets |
| `scripts/evaluation/lib/` | Node.js | Development tooling |

### Key Files

**Frontend (`src/`)**
- `TarotReading.jsx` — Main orchestration (ritual → spread → draw → reading)
- `data/spreads.js` — Spread definitions (source of truth for positions)
- `data/majorArcana.js`, `data/minorArcana.js` — Card data with meanings
- `lib/deck.js` — Seeded shuffle, `drawSpread()`, `computeSeed()`

**Backend (`functions/`)**
- `api/tarot-reading.js` — Main endpoint: validates payload, calls Claude or local composer
- `api/tts.js` — Azure TTS with rate limiting
- `api/journal.js` — Reading history (dedup by `session_seed`)
- `lib/narrative/` — Spread-specific narrative builders
- `lib/spreadAnalysis.js` — Card relationship detection
- `lib/knowledgeGraph.js` — Archetypal relationships

**Shared (`shared/`)**
- `vision/` — Physical deck recognition pipeline
- `symbols/symbolAnnotations.js` — Symbol meanings database

### Components (`src/components/`)

Core: `Card.jsx`, `ReadingGrid.jsx`, `SpreadSelector.jsx`, `RitualControls.jsx`, `QuestionInput.jsx`
Settings: `AudioControls.jsx`, `ExperienceSettings.jsx`
Journal: `Journal.jsx`, `JournalEntryCard.jsx`, `JournalInsightsPanel.jsx`
Vision: `PhotoInputModal.jsx`, `VisionValidationPanel.jsx`, `CameraCapture.jsx`
Auth: `AuthModal.jsx`, `GlobalNav.jsx`, `UserMenu.jsx`

## Spreads (from `src/data/spreads.js`)

| Key | Name | Cards | Positions |
|-----|------|-------|-----------|
| `single` | One-Card Insight | 1 | Theme/Guidance |
| `threeCard` | Three-Card Story | 3 | Past → Present → Future |
| `fiveCard` | Five-Card Clarity | 5 | Core, Challenge, Hidden, Support, Direction |
| `decision` | Decision/Two-Path | 5 | Heart, Path A, Path B, Clarity, Free Will |
| `relationship` | Relationship Snapshot | 3 | You, Them, Connection |
| `celtic` | Celtic Cross | 10 | Present, Challenge, Past, Near Future, Conscious, Subconscious, Advice, External, Hopes/Fears, Outcome |

**Constraint**: Position meanings are used by `buildCardsSection` and frontend text. Don't change casually.

## Reading Flow

1. **Question** — Open-ended prompts ("How can I...?", "What influences...?"). Avoid yes/no.
2. **Ritual** — Knocks + cut position + question → `computeSeed()`
3. **Draw** — `drawSpread()` uses seeded shuffle, assigns upright/reversed
4. **Reveal** — Card flip animation, user reflections per card
5. **Narrative** — Claude Sonnet 4.5 via API, or local `composeReading()` fallback

## Interpretation Rules

**Position-first**: Same card reads differently in "Challenge" vs "Advice" vs "Outcome"

**Reversals** (pick ONE model per reading):
- Blocked/delayed expression
- Excess or deficiency
- Internalized process
- Opposite meaning (when narrative supports)

**Synthesis**: Identify tension → map causes → offer practical steps

## Ethics (Non-Negotiable)

- Tarot = guidance, NOT replacement for medical/legal/financial/mental health professionals
- Emphasize agency: "likely path if unchanged", not determinism
- No hallucinated cards — only reference actual `cardsInfo`
- Trauma-informed, empowering language
- Include disclaimers for sensitive topics

## Card Images

- Source: 1909 Rider-Waite "Roses & Lilies" (Wikimedia Commons, public domain)
- Location: `public/images/cards/RWS1909_-_*.jpeg`
- Naming: `RWS1909_-_XX_Name.jpeg` (Major), `RWS1909_-_Suit_XX.jpeg` (Minor)
- Also: `marseille/*.jpg`, `thoth/*.png`

## Database Schema

Key tables (see `migrations/`):
- `users`, `sessions` — Auth
- `journal_entries` — Saved readings (dedup index on `user_id, session_seed`)
- `share_tokens` — Reading sharing
- `archetype_journey` — User's card history tracking

## Tests

```bash
npm test  # Runs tests in tests/
```

Key test files: `deck.test.mjs`, `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`

## Working with This Repo

1. **Spreads/cards** in `src/data/` are the source of truth
2. **Narratives** must derive from actual `cardsInfo` — never invent cards
3. **New spreads** need: position definitions, narrative builder in `functions/lib/narrative/spreads/`
4. **Visual changes** must preserve A11y (labels, focus, ARIA)
5. Keep the authentic tarot feel — this isn't a generic card app
