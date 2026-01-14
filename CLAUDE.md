# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Tableu** — React + Vite tarot reading app deployed to Cloudflare Workers. Designed to feel like sitting with a practiced reader, not a generic card widget.

| Layer    | Tech                                         | Location                                 |
| -------- | -------------------------------------------- | ---------------------------------------- |
| Frontend | React + Vite                                 | `src/`                                   |
| Backend  | Cloudflare Workers                           | `functions/api/`                         |
| AI       | Claude Sonnet 4.5 (fallback: local composer) | `functions/api/tarot-reading.js`         |
| Database | Cloudflare D1                                | `migrations/*.sql`                       |
| Storage  | Cloudflare KV + R2                           | Metrics, feedback, exports, archives     |

**Deck**: 78 cards (22 Major + 56 Minor Arcana) with 1909 Rider-Waite public domain images.

## Commands

```bash
npm run dev      # Full-stack dev (Vite 5173/5174 + Worker/API 8787)
npm run build    # Production build to dist/
npm run deploy   # Deploy to Cloudflare Workers
```

## Architecture

### Three `lib/` Folders (Important!)

| Path                      | Environment        | Access                   |
| ------------------------- | ------------------ | ------------------------ |
| `src/lib/`                | Browser            | DOM, window APIs         |
| `functions/lib/`          | Cloudflare Workers | env, D1, KV, R2, secrets |
| `scripts/evaluation/lib/` | Node.js            | Development tooling      |

### Key Files

**Frontend (`src/`)**

- `TarotReading.jsx` — Main orchestration (ritual → spread → draw → reading)
- `data/spreads.js` — Spread definitions (source of truth for positions and roleKeys)
- `data/majorArcana.js`, `data/minorArcana.js` — Card data with meanings
- `data/knowledgeGraphData.js` — Archetypal patterns (triads, dyads, Fool's Journey, progressions)
- `lib/deck.js` — Seeded shuffle, `drawSpread()`, `computeSeed()`
- `lib/archetypeJourney.js` — Client-side archetype tracking utilities

**Backend (`functions/`)**

- `api/tarot-reading.js` — Main endpoint: validates payload, calls Claude or local composer
- `api/reading-followup.js` — Follow-up conversation with memory
- `api/tts.js` — Azure TTS with rate limiting
- `api/journal.js` — Reading history (dedup by `session_seed`)
- `api/journal-export/index.js` — PDF/text export of readings (stores in R2)
- `api/feedback.js` — User feedback (stored in KV)
- `lib/narrative/` — Spread-specific narrative builders
- `lib/narrative/prompts.js` — `buildEnhancedClaudePrompt()` for AI prompt construction
- `lib/spreadAnalysis.js` — Elemental dignities, theme analysis, reversal framework selection
- `lib/knowledgeGraph.js` — Pattern detection: triads, dyads, Fool's Journey, suit progressions
- `lib/graphContext.js` — Builds graph context for prompt injection
- `lib/graphRAG.js` — Retrieval-augmented generation from knowledge base
- `lib/knowledgeBase.js` — Curated passages for GraphRAG retrieval
- `lib/evaluation.js` — Automated reading quality evaluation (Workers AI)
- `lib/scheduled.js` — Cron tasks: KV→R2 archival, session cleanup

**Scripts (`scripts/`)**

- `lib/dataAccess.js` — Shared R2/KV/D1 access helpers (Node.js environment)
- `training/exportReadings.js` — Export training data (journal + feedback + metrics + eval)
- `evaluation/exportEvalData.js` — Export eval-only data for calibration
- `evaluation/calibrateEval.js` — Analyze score distributions
- `evaluation/lib/` — Node.js evaluation tooling

**Shared (`shared/`)**

- `vision/` — Physical deck recognition pipeline
- `vision/deckAssets.js` — Deck-specific asset mappings and aliases
- `symbols/symbolAnnotations.js` — Symbol meanings database
- `journal/summary.js` — Shared journal summary logic

### Components (`src/components/`)

Core: `Card.jsx`, `ReadingGrid.jsx`, `SpreadSelector.jsx`, `RitualControls.jsx`, `QuestionInput.jsx`
Settings: `AudioControls.jsx`, `ExperienceSettings.jsx`
Journal: `Journal.jsx`, `JournalEntryCard.jsx`, `JournalFilters.jsx`
Vision: `PhotoInputModal.jsx`, `VisionValidationPanel.jsx`, `CameraCapture.jsx`
Auth: `AuthModal.jsx`, `GlobalNav.jsx`, `UserMenu.jsx`
Charts: `charts/CardRelationshipGraph.jsx`, `charts/TrendSparkline.jsx`

## Spreads (from `src/data/spreads.js`)

| Key            | Name                  | Cards | Positions                                                                                              |
| -------------- | --------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `single`       | One-Card Insight      | 1     | Theme/Guidance                                                                                         |
| `threeCard`    | Three-Card Story      | 3     | Past → Present → Future                                                                                |
| `fiveCard`     | Five-Card Clarity     | 5     | Core, Challenge, Hidden, Support, Direction                                                            |
| `decision`     | Decision/Two-Path     | 5     | Heart, Path A, Path B, Clarity, Free Will                                                              |
| `relationship` | Relationship Snapshot | 3     | You, Them, Connection                                                                                  |
| `celtic`       | Celtic Cross          | 10    | Present, Challenge, Past, Near Future, Conscious, Subconscious, Self/Advice, External, Hopes/Fears, Outcome |

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

## Narrative Generation Pipeline

The reading generation flows through multiple analysis layers before reaching the AI:

```
User Question + Ritual (knocks, cut) → computeSeed()
                    ↓
        drawSpread() (seeded shuffle)
                    ↓
              cardsInfo[] with positions, orientations
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
spreadAnalysis.js              knowledgeGraph.js
- Elemental dignities          - Fool's Journey stage
- Suit/element counts          - Archetypal triads
- Reversal framework           - Archetypal dyads
- Spread-specific analysis     - Suit progressions
    ↓                               ↓
    └───────────────┬───────────────┘
                    ↓
            graphContext.js
            (builds unified context)
                    ↓
            graphRAG.js
            (retrieves relevant passages)
                    ↓
        narrative/prompts.js
        buildEnhancedClaudePrompt()
                    ↓
        Claude Sonnet 4.5 (or local composer)
                    ↓
            evaluation.js
            (async quality scoring via waitUntil)
```

## Knowledge Graph & Pattern Detection

Pattern detection in `functions/lib/knowledgeGraph.js` identifies archetypal combinations. Data definitions live in `src/data/knowledgeGraphData.js`.

**Fool's Journey** (`FOOLS_JOURNEY`):
| Stage | Cards | Theme |
|-------|-------|-------|
| Initiation | 0-7 | Building ego, learning identity, establishing in the world |
| Integration | 8-14 | Shadow work, surrender, necessary endings, finding balance |
| Culmination | 15-21 | Shadow confrontation, revelation, cosmic consciousness |

**Archetypal Triads** (`ARCHETYPAL_TRIADS`):
Complete 3-card narrative arcs with partial support:
- `death-temperance-star` — Healing Arc (ending → integration → hope)
- `devil-tower-sun` — Liberation Arc (bondage → rupture → freedom)
- `hermit-hangedman-moon` — Inner Work Arc (solitude → surrender → mystery)
- `magician-chariot-world` — Mastery Arc (skill → action → achievement)
- `fool-magician-world` — Complete Manifestation Cycle

**Archetypal Dyads** (`ARCHETYPAL_DYADS`):
Powerful 2-card synergies with significance levels (`high`, `medium-high`, `medium`):
- Death + Star — Transformation clearing into hope
- Tower + Sun — Upheaval revealing clarity
- Devil + Lovers — Attachment patterns affecting choice
- Hermit + High Priestess — Solitary wisdom accessing intuition

**Suit Progressions** (`SUIT_PROGRESSIONS`):
Minor Arcana developmental arcs within each suit:
| Stage | Ranks | Theme |
|-------|-------|-------|
| Beginning | 1-3 | Ignition, opening, foundation |
| Challenge | 4-7 | Testing, complexity, management |
| Mastery | 8-10 | Culmination, crisis, completion |

**Court Family Patterns** (`COURT_FAMILY_PATTERNS`):
When 2+ court cards from the same suit appear, indicating lineage dynamics.

## GraphRAG (Retrieval-Augmented Generation)

`functions/lib/graphRAG.js` retrieves relevant passages from the curated knowledge base based on detected patterns.

**Retrieval Priority**:
1. Complete triads (highest narrative value)
2. Fool's Journey stage (developmental context)
3. High-significance dyads
4. Strong suit progressions

**Passage Limits by Spread** (adjustable by subscription tier):
| Spread | Free | Plus/Pro |
|--------|------|----------|
| single | 1 | 1 |
| threeCard | 1 | 2 |
| fiveCard | 1 | 3 |
| celtic | 2 | 5 |
| decision | 1 | 3 |
| relationship | 1 | 2 |

**Quality Filtering** (enabled by default):
- Keyword overlap scoring
- Optional semantic similarity via embeddings
- Deduplication of similar passages
- Relevance threshold: 30% minimum

## Reversal Frameworks

Reversal interpretation is selected per-reading based on spread size, reversal ratio, and question keywords. Defined in `functions/lib/spreadAnalysis.js:REVERSAL_FRAMEWORKS`.

| Framework | When Selected | Interpretation Model |
|-----------|---------------|---------------------|
| `none` | All cards upright | N/A |
| `blocked` | High reversal ratio (≥60%) or 2+ reversed Majors | Energy meeting resistance/obstacles |
| `delayed` | Moderate ratio (≥40%) | Timing not ripe; patience needed |
| `internalized` | Moderate ratio with introspection signals | Inner work, private processing |
| `contextual` | Low ratio (≥20%) or default | Position-specific interpretation |
| `shadow` | Question contains shadow keywords (fear, avoid, hidden) | Disowned emotions surfacing for healing |
| `mirror` | Question contains reflection keywords (pattern, repeat) | Projection/unconscious behavior |
| `potentialBlocked` | Question contains potential keywords (talent, gift) | Latent strengths awaiting activation |

**Spread-Size Adjustments**: Small spreads (≤5 cards) use adjusted thresholds to avoid over-triggering stronger frameworks.

## Deck Variations

The `deckStyle` parameter affects card names, court titles, and deck-specific features. Configured in `src/data/knowledgeGraphData.js:DECK_STYLE_OVERRIDES`.

| Style | Display Name | Court Titles | Special Features |
|-------|--------------|--------------|------------------|
| `rws-1909` | Rider-Waite-Smith 1909 | Page, Knight, Queen, King | Default; standard meanings |
| `thoth-a1` | Thoth | Princess, Prince, Queen, Knight | Minor Arcana epithets (e.g., "Dominion", "Virtue"), decan astrology |
| `marseille-classic` | Tarot de Marseille | Valet, Chevalier, Reine, Roi | Numerology themes, pip geometry |

**Thoth Minor Titles** (`THOTH_MINOR_TITLES`):
Each pip card has a title and astrological correspondence:
- Two of Wands → "Dominion" (Mars in Aries)
- Three of Cups → "Abundance" (Mercury in Cancer)
- Eight of Swords → "Interference" (Jupiter in Gemini)

**Marseille Numerology** (`MARSEILLE_NUMERICAL_THEMES`):
Pip numbers carry symbolic geometry:
- 1: Essence (vertical axis)
- 5: Vital Shift (disruption)
- 10: Threshold (portal to new cycle)

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

Tables organized by migration (see `migrations/`):

**Core Auth & Content:**
- `users` — User accounts with subscription info (tier, status, stripe_customer_id)
- `sessions` — Auth sessions
- `journal_entries` — Saved readings (dedup index on `user_id, session_seed`)

**Sharing:**
- `share_tokens` — Reading share links
- `share_token_entries` — Links share tokens to journal entries
- `share_notes` — Collaborative notes on shared readings

**Analytics & Journey:**
- `card_appearances` — Card occurrence tracking per user
- `archetype_badges` — Badge achievement tracking
- `user_analytics_prefs` — User preferences for analytics features
- `pattern_occurrences` — Recurring archetypal pattern tracking

**Personalization:**
- `user_memories` — AI-captured insights for follow-up personalization (theme, card_affinity, communication, life_context)

**Subscriptions & Usage:**
- `api_keys` — API key management for programmatic access
- `usage_tracking` — Monthly quota enforcement per user
- `processed_webhook_events` — Stripe webhook idempotency

**Quality & Evaluation:**
- `quality_stats` — Daily/weekly quality score aggregates
- `quality_alerts` — Quality regression and safety alerts
- `ab_experiments` — A/B testing experiment configuration

**Archival:**
- `metrics_archive` — D1 archive of KV metrics
- `feedback_archive` — D1 archive of KV feedback
- `archival_summaries` — Daily archival summary logs

**Legacy (pre-auth, still present):**
- `readings`, `cards`, `reading_stats` — Anonymous reading analytics
- `_migrations` — Migration tracking

### Migration Deploy Order

**IMPORTANT:** Always apply D1 migrations BEFORE deploying code that uses new columns.
The API will 500 if code references columns that don't exist yet.

**Automated Deployment (Recommended):**

The `npm run deploy` script automatically applies pending migrations before deploying:

```bash
npm run deploy              # Apply migrations + deploy (recommended)
npm run deploy:dry-run      # Preview what would be done
npm run migrations:status   # Check pending migrations
npm run migrations:apply    # Apply migrations only (no deploy)
```

**CI/CD:**

The GitHub Actions `deploy.yml` workflow automatically:

1. Runs CI tests
2. Applies any pending migrations
3. Deploys the worker

Triggered on pushes to `main`/`master`. Requires `CLOUDFLARE_API_TOKEN` secret.

**Manual Migration (if needed):**

```bash
# Apply a specific migration manually:
wrangler d1 execute mystic-tarot-db --remote --file=migrations/XXXX_new_migration.sql

# Then deploy without re-running migrations:
npm run deploy:skip-migrations
```

**Migration Tracking:**

Applied migrations are tracked in the `_migrations` table to prevent re-application.
Migration files should be idempotent where possible (use `IF NOT EXISTS`).

## Cloudflare Bindings

Configured in `wrangler.jsonc`:

| Binding       | Type       | Purpose                                              |
| ------------- | ---------- | ---------------------------------------------------- |
| `DB`          | D1         | Main database (users, sessions, journal, etc.)       |
| `AI`          | Workers AI | Automated reading evaluation (Llama 3 8B)            |
| `RATELIMIT`   | KV         | Rate limiting counters (auto-expires)                |
| `METRICS_DB`  | KV         | Reading metrics + eval scores (archived to R2 daily) |
| `FEEDBACK_KV` | KV         | User feedback (archived to R2 daily)                 |
| `LOGS_BUCKET` | R2         | Archives, exports, logs storage                      |
| `ASSETS`      | Assets     | Static frontend files                                |

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

## Automated Evaluation System

Every AI-generated reading is automatically evaluated on quality dimensions using Workers AI (Llama 3 8B). The evaluation runs asynchronously via `waitUntil()` so it doesn't block user responses.

**Scoring dimensions** (1-5 scale):

- `personalization` — Does the reading address the user's specific question?
- `tarot_coherence` — Accuracy to cards, positions, traditional meanings
- `tone` — Empowering, agency-preserving language
- `safety` — Avoids harmful advice (medical, financial, doom language)
- `overall` — Holistic quality assessment
- `safety_flag` — Binary flag for egregious violations

**Configuration** (in `wrangler.jsonc` vars):
| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_ENABLED` | `"false"` | Master switch for evaluation |
| `EVAL_MODEL` | `"@cf/meta/llama-3-8b-instruct-awq"` | Workers AI model |
| `EVAL_TIMEOUT_MS` | `"5000"` | Timeout for eval call |
| `EVAL_GATE_ENABLED` | `"false"` | Block readings on low scores |

**Prompt & GraphRAG configuration** (optional, not set = defaults):
| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PROMPT_SLIMMING` | `"false"` | Enable token budget slimming (drops sections when over budget) |
| `DISABLE_QUALITY_FILTERING` | `"false"` | Disable GraphRAG passage relevance filtering |

**Feature flags:**
| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_FOLLOW_UP_MEMORY` | `"true"` (enabled) | AI memory capture in follow-up conversations |
| `AZURE_OPENAI_STREAMING_ENABLED` | `"false"` | Enable real-time token streaming for readings |
| `ALLOW_STREAMING_WITH_EVAL_GATE` | `"false"` | Allow streaming even when eval gate is enabled |

**Note:** Quality filtering is **enabled by default** and filters passages below 30% relevance score. Slimming is **disabled by default** because modern LLMs handle full prompts easily. These two features are independent.

**Data pipeline:**

1. Reading generated → quality gate → response sent
2. `waitUntil()` runs evaluation asynchronously
3. Scores stored in `METRICS_DB` with reading metrics
4. Daily cron archives to R2 (`archives/metrics/{date}/*.json`)
5. Export scripts pull from R2 for analysis

**Export & calibration:**

```bash
# Full training export with eval scores
node scripts/training/exportReadings.js --metrics-source r2 --out readings.jsonl

# Eval-only export
node scripts/evaluation/exportEvalData.js --days=7

# Analyze score distributions
cat readings.jsonl | node scripts/evaluation/calibrateEval.js
```

**Full documentation:** See `docs/evaluation-system.md`

## Tests

### Unit Tests

```bash
npm test  # Runs tests in tests/
```

Key test files: `deck.test.mjs`, `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`, `evaluation.test.mjs`

### E2E Tests (Playwright)

Two test modes are available:

| Mode            | Command                        | Server            | Use Case               |
| --------------- | ------------------------------ | ----------------- | ---------------------- |
| **Frontend**    | `npm run test:e2e`             | Vite only (5173)  | UI flows, no API calls |
| **Integration** | `npm run test:e2e:integration` | Full stack (8787) | API-dependent features |

**Frontend tests** (default):

```bash
npm run test:e2e          # Run all E2E tests headless
npm run test:e2e:ui       # Interactive UI mode (recommended for debugging)
npm run test:e2e:headed   # Run with visible browser
npm run test:e2e:debug    # Step-through debugging
npm run test:e2e:report   # View HTML report after run
```

**Integration tests** (full stack):

```bash
npm run test:e2e:integration      # Run with Workers backend
npm run test:e2e:integration:ui   # Interactive mode with backend
```

> **Note**: Integration tests require `.dev.vars` with API credentials. Frontend tests are faster and don't require credentials, but can't test narrative generation, journal sync, or other API-dependent features.

**Test files** (`e2e/`):

- `tarot-reading.spec.js` — Core reading flow (spread → ritual → reveal → narrative)
- `journal-filters.spec.js` — Journal filter UI and functionality
- `*.integration.spec.js` — Tests requiring Worker APIs (run only in integration mode)

**Coverage** (28 tests):

| Category         | Desktop | Mobile | Description                       |
| ---------------- | ------- | ------ | --------------------------------- |
| Reading Flow     | 6       | 3      | Spread selection, ritual, reveal  |
| Ritual Mechanics | 3       | -      | Knocks, cut slider, skip          |
| Journal Filters  | 4       | 4      | Filter placement, sync, accordion |
| Error Handling   | 2       | -      | Network errors, retry             |
| Accessibility    | 3       | -      | Keyboard nav, ARIA labels         |
| Performance      | 2       | -      | Load time, animations             |

**Projects**: Tests run on `desktop` (Chrome 1280×900) and `mobile` (iPhone 13 375×667) viewports via `@desktop`/`@mobile` tags.

### Accessibility Tests

```bash
npm run test:a11y         # Run contrast + WCAG checks
npm run test:contrast     # Color contrast validation
npm run test:wcag         # Static ARIA/a11y analysis
```

See `tests/accessibility/README.md` for manual testing guides (axe DevTools, keyboard nav, screen readers).

## Working with This Repo

1. **Spreads/cards** in `src/data/` are the source of truth
2. **Narratives** must derive from actual `cardsInfo` — never invent cards
3. **New spreads** need:
   - Position definitions in `src/data/spreads.js` with `positions` and `roleKeys`
   - Spread-specific analysis in `functions/lib/spreadAnalysis.js` (optional)
   - Narrative builder in `functions/lib/narrative/spreads/`
4. **New archetypal patterns** need entries in `src/data/knowledgeGraphData.js` and corresponding passages in `functions/lib/knowledgeBase.js`
5. **Visual changes** must preserve A11y (labels, focus, ARIA)
6. **Deck-aware code** should accept `deckStyle` parameter and use helpers from `knowledgeGraph.js`
7. **Evaluation impact**: Changes affecting reading output may impact quality scores; test with evaluation enabled
8. Keep the authentic tarot feel — this isn't a generic card app

### Environment Boundaries (Critical)

| Path | Environment | Can Access | Cannot Access |
|------|-------------|------------|---------------|
| `src/lib/` | Browser | DOM, window, localStorage, React | env, D1, KV, R2, secrets |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, AI binding | DOM, window, React |
| `scripts/*/lib/` | Node.js | fs, process, node modules | DOM, Cloudflare bindings |

**Never import browser code into Workers or vice versa.** Shared logic goes in `shared/`.

## API Endpoints

**Core Reading:**
| Endpoint                 | Method   | Purpose                                           |
| ------------------------ | -------- | ------------------------------------------------- |
| `/api/tarot-reading`     | POST     | Generate a reading                                |
| `/api/generate-question` | POST     | AI-powered question suggestions (Plus/Pro only)   |
| `/api/tts`               | POST     | Azure text-to-speech                              |
| `/api/tts-hume`          | POST     | Hume AI TTS with emotional expression             |
| `/api/speech-token`      | GET      | Azure Speech SDK authorization token              |
| `/api/feedback`          | POST     | Submit reading feedback                           |

**Journal:**
| Endpoint                     | Method     | Purpose                                     |
| ---------------------------- | ---------- | ------------------------------------------- |
| `/api/journal`               | GET/POST   | List/save journal entries                   |
| `/api/journal/:id`           | GET/DELETE | Get/delete single entry                     |
| `/api/journal-export`        | GET        | Export journal as PDF/txt/json              |
| `/api/journal-export/:id`    | GET        | Export single reading                       |
| `/api/journal-summary`       | POST       | Generate AI summary of journal              |
| `/api/journal/pattern-alerts`| GET        | Recurring pattern alerts (last 90 days)     |

**Sharing:**
| Endpoint                     | Method     | Purpose                                     |
| ---------------------------- | ---------- | ------------------------------------------- |
| `/api/share`                 | POST       | Create share link                           |
| `/api/share/:token`          | GET/DELETE | View/revoke share                           |
| `/api/share/:token/og-image` | GET        | Generate OpenGraph image for social sharing |
| `/api/share-notes/:token`    | GET/POST   | Manage notes on shared readings             |

**Analytics & Journey:**
| Endpoint                          | Method       | Purpose                                         |
| --------------------------------- | ------------ | ----------------------------------------------- |
| `/api/archetype-journey`          | GET/POST/PUT | GET data, POST track cards, PUT preferences     |
| `/api/archetype-journey/card-frequency` | GET    | Card frequency statistics                       |
| `/api/archetype-journey-backfill` | POST         | Backfill card_appearances from journal          |

**Personalization (Memories):**
| Endpoint                     | Method       | Purpose                                     |
| ---------------------------- | ------------ | ------------------------------------------- |
| `/api/memories`              | GET          | List user's memories (global scope)         |
| `/api/memories`              | POST         | Create a new memory (user-initiated)        |
| `/api/memories?id=<id>`      | DELETE       | Delete a specific memory                    |
| `/api/memories?all=true`     | DELETE       | Clear all user memories                     |

**Auth & Account:**
| Endpoint                     | Method     | Purpose                                     |
| ---------------------------- | ---------- | ------------------------------------------- |
| `/api/auth/login`            | POST       | User login                                  |
| `/api/auth/logout`           | POST       | User logout                                 |
| `/api/auth/register`         | POST       | User registration                           |
| `/api/auth/me`               | GET        | Current user info                           |
| `/api/keys`                  | GET/POST   | API key management                          |
| `/api/keys/:id`              | DELETE     | Delete API key                              |
| `/api/usage`                 | GET        | Current month usage counters                |

**Subscriptions (Stripe):**
| Endpoint                     | Method     | Purpose                                     |
| ---------------------------- | ---------- | ------------------------------------------- |
| `/api/create-checkout-session` | POST     | Create Stripe Checkout session              |
| `/api/create-portal-session` | POST       | Create Stripe Billing Portal session        |
| `/api/webhooks/stripe`       | POST       | Handle Stripe webhook events                |

**Vision:**
| Endpoint                     | Method     | Purpose                                     |
| ---------------------------- | ---------- | ------------------------------------------- |
| `/api/vision-proof`          | POST       | Validate physical deck recognition          |

**Admin (requires ADMIN_API_KEY):**
| Endpoint                          | Method     | Purpose                                     |
| --------------------------------- | ---------- | ------------------------------------------- |
| `/api/admin/archive`              | POST       | Manual archival trigger                     |
| `/api/admin/quality-stats`        | GET/POST   | Quality statistics and alert management     |
| `/api/coach-extraction-backfill`  | GET/POST   | Backfill AI extraction for coach suggestions|

**Health Checks:**
| Endpoint                     | Method     | Purpose                                     |
| ---------------------------- | ---------- | ------------------------------------------- |
| `/api/health/tarot-reading`  | GET        | Tarot reading service health                |
| `/api/health/tts`            | GET        | TTS service health                          |

## Secrets (via `wrangler secret put`)

- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL`
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET`
- `ADMIN_API_KEY` — For manual archival trigger
