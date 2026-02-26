# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Tableu** — React + Vite tarot reading app on Cloudflare Workers. Designed to feel like sitting with a practiced reader, not a generic card widget.

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | React + Vite | `src/` |
| Backend | Cloudflare Workers | `functions/api/` |
| AI | Azure GPT-5.1 (fallback: Claude/local composer) | `functions/api/tarot-reading.js` |
| Database | Cloudflare D1 | `migrations/*.sql` |
| Storage | Cloudflare KV + D1 archival | Metrics, feedback |

**Deck**: 78 cards (22 Major + 56 Minor Arcana) with 1909 Rider-Waite public domain images.

## Commands

```bash
npm run dev:vite      # Full-stack dev (Vite 5173/5174 + Worker 8787)
npm run dev           # Serve built dist via Express (PORT=5000)
npm run dev:frontend  # Vite-only for UI work
npm run dev:workers   # Worker dev server with live reload
npm run build         # Production build to dist/
npm run deploy        # Deploy to Cloudflare Workers (auto-applies migrations)
npm test              # Unit tests (tests/*.test.mjs)
npm run test:deploy   # Deploy script tests
npm run test:e2e      # Playwright E2E
npm run test:a11y     # Accessibility checks (contrast + WCAG)
npm run lint          # ESLint
npm run lint:fix      # Auto-fix lint issues
npm run gate:design   # Verify design contract compliance
```

## Architecture

### Three `lib/` Folders (Critical!)

| Path | Environment | Can Access | Cannot Access |
|------|-------------|------------|---------------|
| `src/lib/` | Browser | DOM, window, localStorage, React | env, D1, KV, R2, secrets |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, AI binding | DOM, window, React |
| `scripts/*/lib/` | Node.js | fs, process, node modules | DOM, Cloudflare bindings |

**Never import browser code into Workers or vice versa.** Shared logic goes in `shared/`.

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
- `api/journal-export/index.js` — PDF/text export (stores in R2)
- `api/feedback.js` — User feedback (stored in KV)
- `lib/narrative/prompts/` — Modular prompt assembly (`buildEnhancedClaudePrompt.js`, `systemPrompt.js`, `userPrompt.js`, `budgeting.js`, `graphRAGReferenceBlock.js`, etc.). Top-level `prompts.js` is a re-export shim.
- `lib/narrative/spreads/` — Per-spread narrative builders (`singleCard.js`, `threeCard.js`, `fiveCard.js`, `decision.js`, `relationship.js`, `celticCross.js`, `base.js`)
- `lib/spreadAnalysis.js` — Elemental dignities, theme analysis, reversal framework selection
- `lib/spreadAnalysisOrchestrator.js` — Pipeline orchestration (extracted from tarot-reading.js)
- `lib/knowledgeGraph.js` — Pattern detection: triads, dyads, Fool's Journey, suit progressions
- `lib/graphContext.js` — Builds graph context for prompt injection
- `lib/graphRAG.js` — Retrieval-augmented generation from knowledge base
- `lib/knowledgeBase.js` — Curated passages for GraphRAG retrieval
- `lib/evaluation.js` — Automated reading quality evaluation (Workers AI)
- `lib/scheduled.js` — Cron tasks: KV→R2 archival, session cleanup

**Scripts (`scripts/`)**
- `lib/dataAccess.js` — Shared R2/KV/D1 access helpers (Node.js)
- `training/exportReadings.js` — Export training data
- `evaluation/exportEvalData.js` — Export eval data for calibration
- `evaluation/calibrateEval.js` — Analyze score distributions

**Shared (`shared/`)**
- `contracts/` — Shared type contracts (spreads, readings) used by both frontend and Workers
- `vision/` — Physical deck recognition pipeline
- `vision/deckAssets.js` — Deck-specific asset mappings
- `symbols/symbolAnnotations.js` — Symbol meanings database
- `journal/summary.js` — Shared journal summary logic
- `monetization/` — Subscription tier logic shared across layers

**Components (`src/components/`)**
- Core: `Card.jsx`, `ReadingGrid.jsx`, `SpreadSelector.jsx`, `RitualControls.jsx`, `QuestionInput.jsx`
- Settings: `AudioControls.jsx`, `ExperienceSettings.jsx`
- Journal: `Journal.jsx`, `JournalEntryCard.jsx`, `JournalFilters.jsx`
- Vision: `PhotoInputModal.jsx`, `VisionValidationPanel.jsx`, `CameraCapture.jsx`
- Auth: `AuthModal.jsx`, `GlobalNav.jsx`, `UserMenu.jsx`
- Charts: `charts/CardRelationshipGraph.jsx`, `charts/TrendSparkline.jsx`

## Spreads (from `src/data/spreads.js`)

| Key | Name | Cards | Positions |
|-----|------|-------|-----------|
| `single` | One-Card Insight | 1 | Theme/Guidance |
| `threeCard` | Three-Card Story | 3 | Past → Present → Future |
| `fiveCard` | Five-Card Clarity | 5 | Core, Challenge, Hidden, Support, Direction |
| `decision` | Decision/Two-Path | 5 | Heart, Path A, Path B, Clarity, Free Will |
| `relationship` | Relationship Snapshot | 3 | You, Them, Connection |
| `celtic` | Celtic Cross | 10 | Present, Challenge, Past, Near Future, Conscious, Subconscious, Self/Advice, External, Hopes/Fears, Outcome |

**Constraint**: Position meanings used by `buildCardsSection` and frontend text. Don't change casually.

## Reading Flow

1. **Question** — Open-ended prompts ("How can I...?", "What influences...?"). Avoid yes/no.
2. **Ritual** — Knocks + cut position + question → `computeSeed()`
3. **Draw** — `drawSpread()` uses seeded shuffle, assigns upright/reversed
4. **Reveal** — Card flip animation, user reflections per card
5. **Narrative** — Azure GPT-5.1 via API (fallback: Claude/local composer)

**Pipeline**: `spreadAnalysis.js` (dignities, reversals) + `knowledgeGraph.js` (patterns) → `graphContext.js` → `graphRAG.js` (passages) → `prompts.js` → AI → `evaluation.js` (async scoring)

## Interpretation Rules

- **Position-first**: Same card reads differently in "Challenge" vs "Advice" vs "Outcome"
- **Reversals** (pick ONE model per reading): blocked/delayed, excess/deficiency, internalized, opposite
- **Synthesis**: Identify tension → map causes → offer practical steps

## Knowledge Graph & Pattern Detection

Pattern detection in `functions/lib/knowledgeGraph.js`, data in `src/data/knowledgeGraphData.js`.

**Fool's Journey** (`FOOLS_JOURNEY`):
| Stage | Cards | Theme |
|-------|-------|-------|
| Initiation | 0-7 | Building ego, learning identity, establishing in the world |
| Integration | 8-14 | Shadow work, surrender, necessary endings, finding balance |
| Culmination | 15-21 | Shadow confrontation, revelation, cosmic consciousness |

**Archetypal Triads** (`ARCHETYPAL_TRIADS`):
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
| Stage | Ranks | Theme |
|-------|-------|-------|
| Beginning | 1-3 | Ignition, opening, foundation |
| Challenge | 4-7 | Testing, complexity, management |
| Mastery | 8-10 | Culmination, crisis, completion |

**Court Family Patterns**: When 2+ court cards from same suit appear, indicating lineage dynamics.

## GraphRAG (Retrieval-Augmented Generation)

`functions/lib/graphRAG.js` retrieves passages from curated knowledge base based on detected patterns.

**Retrieval Priority**:
1. Complete triads (highest narrative value)
2. Fool's Journey stage (developmental context)
3. High-significance dyads
4. Strong suit progressions

**Quality Filtering** (enabled by default):
- Keyword overlap scoring
- Optional semantic similarity via embeddings
- Deduplication of similar passages
- Relevance threshold: 30% minimum

## Reversal Frameworks

Selected per-reading based on spread size, reversal ratio, and question keywords. Defined in `functions/lib/spreadAnalysis.js:REVERSAL_FRAMEWORKS`.

| Framework | When Selected | Interpretation Model |
|-----------|---------------|---------------------|
| `none` | All cards upright | N/A |
| `blocked` | ≥60% reversed or 2+ reversed Majors | Energy meeting resistance |
| `delayed` | ≥40% reversed | Timing not ripe |
| `contextual` | Default | Position-specific |
| `shadow` | Question contains fear/avoid/hidden | Disowned emotions surfacing |
| `mirror` | Question contains pattern/repeat | Projection/unconscious behavior |
| `potentialBlocked` | Question contains talent/gift | Latent strengths awaiting activation |

**Spread-Size Adjustments**: Small spreads (≤5 cards) use adjusted thresholds.

## Deck Variations

The `deckStyle` parameter affects card names, court titles, and features. Config in `src/data/knowledgeGraphData.js:DECK_STYLE_OVERRIDES`.

| Style | Court Titles | Features |
|-------|--------------|----------|
| `rws-1909` | Page, Knight, Queen, King | Default; standard meanings |
| `thoth-a1` | Princess, Prince, Queen, Knight | Epithets (e.g., "Dominion"), decan astrology |
| `marseille-classic` | Valet, Chevalier, Reine, Roi | Numerology themes, pip geometry |

## Ethics (Non-Negotiable)

- Tarot = guidance, NOT replacement for medical/legal/financial/mental health professionals
- Emphasize agency: "likely path if unchanged", not determinism
- **No hallucinated cards** — only reference actual `cardsInfo`
- Trauma-informed, empowering language
- Include disclaimers for sensitive topics

## Card Images

- Source: 1909 Rider-Waite "Roses & Lilies" (Wikimedia Commons, public domain)
- Location: `public/images/cards/RWS1909_-_*.jpeg`
- Naming: `RWS1909_-_XX_Name.jpeg` (Major), `RWS1909_-_Suit_XX.jpeg` (Minor)
- Also: `marseille/*.jpg`, `thoth/*.png`

## Database Schema

Tables organized by migration (see `migrations/`):

**Auth & Content**: `users` (subscription info: tier, status, stripe_customer_id), `sessions`, `user_tokens`, `journal_entries` (dedup on `user_id, session_seed`)

**Sharing**: `share_tokens`, `share_token_entries`, `share_notes`

**Analytics & Journey**: `card_appearances`, `archetype_badges`, `user_analytics_prefs`, `pattern_occurrences`

**Personalization**: `user_memories` (AI insights for follow-up: theme, card_affinity, communication, life_context)

**Subscriptions & Usage**: `api_keys`, `usage_tracking`, `processed_webhook_events`

**Quality & Evaluation**: `quality_stats`, `quality_alerts`, `ab_experiments`

**Archival**: `metrics_archive`, `feedback_archive`, `archival_summaries`

**Legacy**: `readings`, `cards`, `reading_stats`, `_migrations`

### Migration Deploy Order

**IMPORTANT**: Always apply D1 migrations BEFORE deploying code using new columns.

```bash
npm run deploy              # Auto-applies migrations + deploys (recommended)
npm run deploy:dry-run      # Preview
npm run migrations:status   # Check pending
npm run migrations:apply    # Apply only
```

## Cloudflare Bindings

Configured in `wrangler.jsonc`:

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | Main database (users, sessions, journal) |
| `AI` | Workers AI | Evaluation (Qwen 30B) |
| `RATELIMIT` | KV | Rate limiting (auto-expires) |
| `METRICS_DB` | KV | Metrics + eval scores (→ R2 daily) |
| `FEEDBACK_KV` | KV | User feedback (→ R2 daily) |
| `R2_LOGS` | R2 | Archives, exports, logs |
| `ASSETS` | Assets | Static frontend files |

**R2 Structure**: `archives/metrics/{date}/`, `archives/feedback/{date}/`, `exports/readings/`, `exports/journals/`

**Cron** (daily 3 AM UTC): Archive KV→D1, cleanup expired sessions, store summary.

## Evaluation System

Every AI reading is scored async via Workers AI (Llama 3 8B) using `waitUntil()`:

**Dimensions** (1-5 scale):
- `personalization` — Addresses user's specific question?
- `tarot_coherence` — Accuracy to cards, positions, traditional meanings
- `tone` — Empowering, agency-preserving language
- `safety` — Avoids harmful advice
- `overall` — Holistic quality
- `safety_flag` — Binary flag for egregious violations

**Config** (`wrangler.jsonc` vars):
| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_ENABLED` | `"true"` | Master switch |
| `EVAL_GATE_ENABLED` | `"false"` | Block on low scores |
| `ENABLE_PROMPT_SLIMMING` | `"false"` | Token budget slimming |
| `FEATURE_FOLLOW_UP_ENABLED` | `"true"` | Follow-up questions |
| `AZURE_OPENAI_STREAMING_ENABLED` | `"true"` | Token streaming |

**Export**:
```bash
node scripts/training/exportReadings.js --metrics-source r2 --out readings.jsonl
node scripts/evaluation/exportEvalData.js --days=7
```

See `docs/evaluation-system.md` for full details.

## Tests

### Unit Tests
```bash
npm test  # Runs tests/*.test.mjs
```
Key files: `deck.test.mjs`, `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`, `evaluation.test.mjs`

### E2E Tests (Playwright)

| Mode | Command | Server | Use Case |
|------|---------|--------|----------|
| Frontend | `npm run test:e2e` | Vite (5173) | UI flows, no API |
| Integration | `npm run test:e2e:integration` | Full stack (8787) | API-dependent |

```bash
npm run test:e2e:ui       # Interactive debugging (recommended)
npm run test:e2e:headed   # Visible browser
npm run test:e2e:debug    # Step-through
```

Integration tests require `.dev.vars` with API credentials.

Test files: `tarot-reading.spec.js`, `journal-filters.spec.js`, `*.integration.spec.js`

### Accessibility Tests
```bash
npm run test:a11y     # Contrast + WCAG
npm run test:contrast # Color contrast only
npm run test:wcag     # Static ARIA analysis
```

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

## API Endpoints

**Core Reading**:
- `POST /api/tarot-reading` — Generate reading
- `POST /api/generate-question` — AI question suggestions (Plus/Pro)
- `POST /api/tts`, `POST /api/tts-hume` — Text-to-speech
- `GET /api/speech-token` — Azure Speech SDK token
- `POST /api/feedback` — Submit feedback

**Journal**:
- `GET|POST /api/journal` — List/save entries
- `GET|DELETE /api/journal/:id` — Single entry
- `GET /api/journal-export`, `GET /api/journal-export/:id` — Export
- `POST /api/journal-summary` — AI summary
- `GET /api/journal/pattern-alerts` — Recurring patterns (90 days)

**Sharing**:
- `POST /api/share` — Create link
- `GET|DELETE /api/share/:token` — View/revoke
- `GET /api/share/:token/og-image` — OpenGraph image
- `GET|POST /api/share-notes/:token` — Notes on shared readings

**Analytics**:
- `GET|POST|PUT /api/archetype-journey` — Journey data/tracking/prefs
- `GET /api/archetype-journey/card-frequency` — Card stats
- `POST /api/archetype-journey-backfill` — Backfill from journal

**Memories**:
- `GET|POST|DELETE /api/memories` — User memory management

**Auth**:
- `POST /api/auth/login`, `/register`, `/logout`
- `POST /api/auth/forgot-password`, `/reset-password`
- `GET /api/auth/verify-email`, `POST /api/auth/verify-email/resend`
- `GET /api/auth/me`
- `GET|POST /api/keys`, `DELETE /api/keys/:id`
- `GET /api/usage`

**Subscriptions**:
- `POST /api/create-checkout-session`, `/create-portal-session`
- `POST /api/webhooks/stripe`

**Admin** (requires `ADMIN_API_KEY`):
- `POST /api/admin/archive`
- `GET|POST /api/admin/quality-stats`
- `GET|POST /api/coach-extraction-backfill`

**Health**: `GET /api/health/tarot-reading`, `GET /api/health/tts`

**Vision**: `POST /api/vision-proof`

## Secrets

Via `wrangler secret put`:
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL`
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET`
- `RESEND_API_KEY` — Email delivery (auth verification/reset)
- `ADMIN_API_KEY` — Admin endpoints
