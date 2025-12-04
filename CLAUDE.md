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
| Storage | Cloudflare KV + R2 | Metrics, feedback, exports, archives |

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
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, secrets |
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
- `api/journal-export.js` — PDF/text export of readings (stores in R2)
- `api/feedback.js` — User feedback (stored in KV)
- `lib/narrative/` — Spread-specific narrative builders
- `lib/spreadAnalysis.js` — Card relationship detection
- `lib/knowledgeGraph.js` — Archetypal relationships
- `lib/scheduled.js` — Cron tasks: KV→R2 archival, session cleanup

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

## Cloudflare Bindings

Configured in `wrangler.jsonc`:

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | Main database (users, sessions, journal, etc.) |
| `RATELIMIT` | KV | Rate limiting counters (auto-expires) |
| `METRICS_DB` | KV | Reading metrics (archived to R2 daily) |
| `FEEDBACK_KV` | KV | User feedback (archived to R2 daily) |
| `LOGS_BUCKET` | R2 | Archives, exports, logs storage |
| `ASSETS` | Assets | Static frontend files |

### R2 Bucket Structure (`tarot-logs`)

```
tarot-logs/
├── archives/
│   ├── metrics/{date}/{timestamp}.json    # Archived from METRICS_DB
│   ├── feedback/{date}/{timestamp}.json   # Archived from FEEDBACK_KV
│   └── summaries/{date}.json              # Daily archival summary
└── exports/
    ├── readings/{userId}/{entryId}.pdf    # Single reading exports
    └── journals/{userId}/{timestamp}.pdf  # Full journal exports
```

### Scheduled Tasks (Cron)

Daily at 3 AM UTC (`0 3 * * *`):
1. Archive `METRICS_DB` keys to R2 and delete from KV
2. Archive `FEEDBACK_KV` keys to R2 and delete from KV
3. Clean up expired sessions from D1
4. Store archival summary in R2

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

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tarot-reading` | POST | Generate a reading |
| `/api/tts` | POST | Text-to-speech |
| `/api/journal` | GET/POST | List/save journal entries |
| `/api/journal/:id` | GET/DELETE | Get/delete single entry |
| `/api/journal-export` | GET | Export journal as PDF/txt/json |
| `/api/journal-export/:id` | GET | Export single reading |
| `/api/share` | POST | Create share link |
| `/api/share/:token` | GET/DELETE | View/revoke share |
| `/api/feedback` | POST | Submit feedback |
| `/api/archetype-journey` | GET/POST/PUT | Analytics: GET data, POST track cards, PUT preferences |
| `/api/archetype-journey-backfill` | POST | Backfill card_appearances from existing journal entries |
| `/api/auth/*` | Various | Login, logout, register, me |
| `/api/keys` | GET/POST | API key management |
| `/api/admin/archive` | POST | Manual archival trigger (requires ADMIN_API_KEY) |

## Secrets (via `wrangler secret put`)

- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL`
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET`
- `ADMIN_API_KEY` — For manual archival trigger
