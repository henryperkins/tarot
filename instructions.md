# Tableau (Mystic Tarot) — Project Instructions

> **Use these instructions to begin tasks effectively.** This file provides project context aligned with CLAUDE.md.

## What This Is

A React + Vite tarot reading app on Cloudflare Workers. Users draw physical cards, the app identifies them via vision AI, and generates narrative readings using Azure GPT-5.1 (fallback: Claude/local composer). TTS narration via gpt-4o-mini-tts.

**Goal**: Feel like sitting with a practiced reader using a real deck, not a generic widget.

**Deck**: 78 cards (22 Major + 56 Minor Arcana) with 1909 Rider-Waite public domain images.

---

## Hard Constraints (Non-Negotiable)

### 1. The 900-Line Rule
**Any module exceeding 900 lines is over-engineered and must be refactored.**
- Break into focused submodules
- Use data-driven JSON configs for repetitive structures
- Re-export from parent for backward compatibility

### 2. No Over-Engineering
- Prefer simple, readable solutions over clever abstractions
- If you're adding layers of indirection, stop and reconsider
- One file should do one thing well

### 3. Fail Gracefully
- Azure unavailable → local narrative fallback
- TTS fails → synthesized waveform fallback
- Always log errors, never surface them raw to users

### 4. Ethics (Non-Negotiable)
- Tarot = guidance, NOT replacement for medical/legal/financial/mental health professionals
- Emphasize agency: "likely path if unchanged", not determinism
- **No hallucinated cards** — only reference actual `cardsInfo`
- Trauma-informed, empowering language
- Include disclaimers for sensitive topics

---

## Architecture

### Three `lib/` Folders (Critical!)

| Path | Environment | Can Access | Cannot Access |
|------|-------------|------------|---------------|
| `src/lib/` | Browser | DOM, window, localStorage, React | env, D1, KV, R2, secrets |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, AI binding | DOM, window, React |
| `scripts/*/lib/` | Node.js | fs, process, node modules | DOM, Cloudflare bindings |

**Never import browser code into Workers or vice versa.** Shared logic goes in `shared/`.

### Directory Structure

```
src/                          # React frontend (Vite)
├── worker/index.js           # Cloudflare Workers entry point (unified router)
├── components/               # UI components
├── contexts/                 # React contexts (AuthContext.jsx)
├── hooks/                    # Custom hooks
├── data/                     # Static data (spreads.js, majorArcana.js, minorArcana.js)
├── lib/                      # Client utilities (browser-only)
└── TarotReading.jsx          # Main orchestrator

functions/                    # API handlers (Cloudflare Workers)
├── api/                      # Endpoint handlers
│   ├── tarot-reading.js      # Main reading endpoint
│   ├── reading-followup.js   # Follow-up conversation with memory
│   ├── tts.js                # Azure TTS
│   ├── journal.js            # Reading history
│   ├── auth/                 # Authentication endpoints
│   └── health/               # Health checks
└── lib/                      # Server utilities (Workers runtime)
    ├── narrative/            # Narrative builders
    │   ├── prompts.js        # buildEnhancedClaudePrompt()
    │   └── spreads/          # Per-spread builders
    ├── spreadAnalysis.js     # Elemental dignities, themes
    ├── knowledgeGraph.js     # Pattern detection
    ├── graphRAG.js           # Retrieval-augmented generation
    └── evaluation.js         # Automated quality scoring

shared/                       # Cross-environment modules
├── symbols/                  # Symbol annotations
├── vision/                   # Vision model lexicons
└── journal/                  # Shared journal logic

scripts/                      # Node.js tooling
├── evaluation/               # Quality gates
└── training/                 # ML workflows
```

---

## Key Files to Know

| Task | Start Here |
|------|------------|
| API routing | `src/worker/index.js` |
| Reading generation | `functions/api/tarot-reading.js` → `lib/narrative/prompts.js` |
| TTS/audio | `functions/api/tts.js`, `src/lib/audio.js` |
| Card data | `src/data/majorArcana.js`, `src/data/minorArcana.js` |
| Spread definitions | `src/data/spreads.js` |
| Pattern detection | `functions/lib/knowledgeGraph.js`, `src/data/knowledgeGraphData.js` |
| Main UI orchestration | `src/TarotReading.jsx` |
| Cloudflare config | `wrangler.jsonc` |

---

## Commands

```bash
# Development
npm run dev              # Full-stack (Vite 5173/5174 + Worker 8787)
npm run dev:frontend     # Vite only (localhost:5173, no API)
npm run dev:wrangler     # Wrangler Workers dev server
npm run dev:workers      # Wrangler with live reload

# Build & Deploy
npm run build            # Production build → dist/
npm run deploy           # Build + deploy (auto-applies migrations)
npm run deploy:dry-run   # Preview deploy without publishing

# Testing
npm test                 # Unit tests (Node test runner)
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Interactive Playwright debugging
npm run test:a11y        # Accessibility tests (contrast + WCAG)
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix lint issues

# Quality Gates
npm run gate:vision      # Vision pipeline quality
npm run gate:narrative   # Narrative generation quality

# Database Migrations
npm run migrations:status       # Check pending migrations
npm run migrations:apply        # Apply to production
npm run migrations:apply:local  # Apply locally

# Secrets management
wrangler secret put SECRET_NAME
wrangler secret list
```

---

## Spread Types

| Key | Name | Cards | Positions |
|-----|------|-------|-----------|
| `single` | One-Card Insight | 1 | Theme/Guidance |
| `threeCard` | Three-Card Story | 3 | Past → Present → Future |
| `fiveCard` | Five-Card Clarity | 5 | Core, Challenge, Hidden, Support, Direction |
| `decision` | Decision/Two-Path | 5 | Heart, Path A, Path B, Clarity, Free Will |
| `relationship` | Relationship Snapshot | 3 | You, Them, Connection |
| `celtic` | Celtic Cross | 10 | Present, Challenge, Past, Near Future, Conscious, Subconscious, Self/Advice, External, Hopes/Fears, Outcome |

**Constraint**: Position meanings are used by `buildCardsSection` and frontend text. Don't change casually.

---

## Reading Flow

1. **Question** — Open-ended prompts ("How can I...?", "What influences...?"). Avoid yes/no.
2. **Ritual** — Knocks + cut position + question → `computeSeed()`
3. **Draw** — `drawSpread()` uses seeded shuffle, assigns upright/reversed
4. **Reveal** — Card flip animation, user reflections per card
5. **Narrative** — Azure GPT-5.1 via API, or local `composeReading()` fallback

**Pipeline**: `spreadAnalysis.js` (dignities, reversals) + `knowledgeGraph.js` (patterns) → `graphContext.js` → `graphRAG.js` (passages) → `prompts.js` → AI → `evaluation.js` (async scoring)

---

## Patterns to Follow

### Reversal Frameworks

| Framework | When Selected | Interpretation Model |
|-----------|---------------|---------------------|
| `none` | All cards upright | N/A |
| `blocked` | ≥60% reversed or 2+ reversed Majors | Energy meeting resistance |
| `delayed` | ≥40% reversed | Timing not ripe |
| `contextual` | Default | Position-specific |
| `shadow` | Question contains fear/avoid/hidden | Disowned emotions surfacing |
| `mirror` | Question contains pattern/repeat | Projection/unconscious behavior |

### Error Handling Pattern

```javascript
try {
  // Primary: Azure OpenAI
  return await azureCall();
} catch (err) {
  console.error('Azure failed, falling back:', err);
  // Fallback: local generation
  return localFallback();
}
```

---

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

**Sharing**:
- `POST /api/share` — Create link
- `GET|DELETE /api/share/:token` — View/revoke

**Auth**:
- `POST /api/auth/login`, `/register`, `/logout`
- `POST /api/auth/forgot-password`, `/reset-password`
- `GET /api/auth/me`

**Health**: `GET /api/health/tarot-reading`, `GET /api/health/tts`

**Vision**: `POST /api/vision-proof`

---

## Infrastructure

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | Main database (users, sessions, journal) |
| `AI` | Workers AI | Evaluation (Qwen 30B) |
| `RATELIMIT` | KV | Rate limiting (auto-expires) |
| `METRICS_DB` | KV | Metrics + eval scores (→ R2 daily) |
| `FEEDBACK_KV` | KV | User feedback (→ R2 daily) |
| `R2_LOGS` | R2 | Archives, exports, logs |
| `ASSETS` | Assets | Static frontend files |

### Secrets (via `wrangler secret put`)

- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_GPT5_MODEL`
- `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`, `AZURE_OPENAI_TTS_API_KEY`, `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `VISION_PROOF_SECRET`
- `RESEND_API_KEY` — Email delivery
- `ADMIN_API_KEY` — Admin endpoints

---

## Common Tasks

### Adding a New Spread
1. Define spread in `src/data/spreads.js` (positions, meanings, roleKeys)
2. Create builder in `functions/lib/narrative/spreads/newSpread.js`
3. Export from `functions/lib/narrativeBuilder.js`
4. Add prompt builder in `functions/lib/narrative/prompts.js`

### Adding a New API Endpoint
1. Create handler in `functions/api/newEndpoint.js` with `onRequestGet`/`onRequestPost` exports
2. Add route pattern to `src/worker/index.js` routes array
3. Import handler at top of `src/worker/index.js`
4. Test locally with `npm run dev`

### Modifying Prompt Engineering
- **System prompts**: `functions/lib/narrative/prompts.js` → `buildSystemPrompt()`
- **User prompts**: Same file → `buildUserPrompt()`
- **Per-spread prompts**: Same file → `build{SpreadType}PromptCards()`

---

## Don't

- **Exceed 900 lines** — Refactor before it becomes a problem
- **Add unnecessary abstractions** — If a simple function works, don't wrap it
- **Use `wrangler pages` commands** — Project uses Workers now
- **Duplicate code across spread builders** — Extract to helpers
- **Use deterministic language** — Never "you will", "this means"; use "suggests", "the path leans toward"
- **Provide directives** — No medical/legal/financial advice in readings
- **Hallucinate cards** — Only reference cards actually in the spread
- **Skip the fallback** — Every Azure call needs a local fallback path
- **Import browser code into Workers** — Keep `src/lib/` and `functions/lib/` separate

---

## Quick Reference

### Key Imports

```javascript
// Server-side narrative generation
import { buildEnhancedClaudePrompt } from './lib/narrative/prompts.js';
import { analyzeSpreadThemes } from './lib/spreadAnalysis.js';
import { detectAllPatterns } from './lib/knowledgeGraph.js';

// GraphRAG
import { retrievePatternPassages } from './lib/graphRAG.js';
```

### Environment Variables

```bash
# Required for Azure OpenAI readings
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_GPT5_MODEL

# Optional TTS (falls back to shared credentials)
AZURE_OPENAI_TTS_ENDPOINT
AZURE_OPENAI_TTS_API_KEY
AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT

# Feature flags (in wrangler.jsonc)
EVAL_ENABLED                      # true/false
EVAL_GATE_ENABLED                 # true/false
FEATURE_FOLLOW_UP_MEMORY          # true/false
AZURE_OPENAI_STREAMING_ENABLED    # true/false
```

---

*Last updated: January 2026*
