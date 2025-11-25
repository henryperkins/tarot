# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mystic Tarot is a React-based interactive tarot reading web application built with Vite and deployed to Cloudflare Pages.

It is designed to feel like sitting with a practiced reader using a real deck, not a generic "card of the day" widget. The app encodes authentic spreads, visual language, and interpretation frameworks directly into its UX.

- Frontend: React + Vite, with ritual controls, spread selector, guided questions, and authentic 1909 Rider-Waite card imagery.
- Backend: Cloudflare Pages Function `functions/api/tarot-reading.js` handles narrative composition (Anthropic Claude Sonnet 4.5 when available, otherwise deterministic local logic).
- Deck: 78 cards total (22 Major + 56 Minor Arcana) with upright/reversed meanings and public domain card images.
  - Major Arcana: Defined in `src/data/majorArcana.js` with image paths.
  - Minor Arcana: Defined in `src/data/minorArcana.js` with auto-generated image paths via `makeCard()` helper.
  - Images: 1909 "Roses & Lilies" edition Rider-Waite cards from Wikimedia Commons (public domain), stored in `public/images/cards/`.
- Spreads: Real-world formats and position prompts in `src/data/spreads.js`.
- Audio/TTS: Optional ambient sound and narration wired via `src/lib/audio.js` and `functions/api/tts.js`.

## Development Commands

### Local Development
```bash
npm run dev          # Start Vite dev server (default: http://localhost:5173)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
```

### Deployment
```bash
npm run deploy       # Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=tableau
```

## Architecture

### Component-Based Structure

The application has been refactored from a single-component monolith into a modular component architecture:

**Main Experience**

- `src/TarotReading.jsx` — Central orchestration component managing:
  - Ritual input (knocks, cut, seed)
  - Spread selection
  - Card drawing and reveal state
  - Reading fetch from `/api/tarot-reading`
  - Layout for different spreads

**UI Components** (in `src/components/`):

Core reading experience:
- `Header.jsx` — Application header and branding.
- `SpreadSelector.jsx` — Spread type selection UI; wired to curated spreads from `SPREADS`.
- `QuestionInput.jsx` — Guides users toward open-ended, scope-appropriate questions.
- `AudioControls.jsx` — Audio settings panel (voice narration and ambience).
- `ExperienceSettings.jsx` — Experience preferences (theme, deck size, reversal framework).
- `RitualControls.jsx` — Knock and cut deck ritual inputs feeding seeded shuffle.
- `Card.jsx` — Single card display with authentic visuals and reflection input.
- `ReadingGrid.jsx` — Grid layout and position labels for the chosen spread.
- `Tooltip.jsx` — Interactive symbol and card tooltips.
- `StepProgress.jsx` — Reading workflow progress tracker.
- `SpreadPatterns.jsx` — Visual spread pattern display.
- `SpreadPatternThumbnail.jsx` — Visual SVG diagrams showing spread layout patterns.

Intention coaching & refinement:
- `GuidedIntentionCoach.jsx` — AI-powered question refinement and intention setting.

Reading history & journaling:
- `Journal.jsx` — Reading history browser with search, tags, and insights.
- `MarkdownRenderer.jsx` — Renders narrative markdown with proper formatting.

Authentication:
- `AuthModal.jsx` — User login/registration modal.
- `GlobalNav.jsx` — Global navigation with auth state.

Deck selection & vision research:
- `DeckSelector.jsx` — Choose between RWS, Thoth, Marseille decks.
- `CameraCapture.jsx` — Camera input for physical deck photos.
- `PhotoInputModal.jsx` — Photo upload workflow modal.
- `VisionValidationPanel.jsx` — Vision detection research UI.
- `VisionHeatmapOverlay.jsx` — Visual heatmap overlay for vision detection.
- `CardSymbolInsights.jsx` — Symbol interpretation panels.

User feedback:
- `FeedbackPanel.jsx` — User feedback collection component.
- `ImagePreview.jsx` — Image preview component.

UI utilities:
- `HelperToggle.jsx` — Show/hide UI helper controls.

**Data Modules** (in `src/data/`):

- `majorArcana.js` — 22 Major Arcana entries with upright/reversed meanings and image paths to 1909 Rider-Waite cards.
- `minorArcana.js` — 56 Minor Arcana entries (4 suits × 14 ranks) with upright/reversed meanings and auto-generated image paths.
- `spreads.js` — Structured spread definitions:
  - One-Card Insight
  - Three-Card Story (Past · Present · Future)
  - Five-Card Clarity
  - Relationship Snapshot
  - Decision / Two-Path
  - Celtic Cross (Classic 10-Card)
- `exampleQuestions.js` — Suggested, well-phrased questions for different themes.
- `knowledgeGraphData.js` — Archetypal relationships database (Fool's Journey, dyads, triads, suit progressions).

**Contexts** (in `src/contexts/`):

- `AuthContext.jsx` — Global authentication state management (user login/logout, JWT tokens).

**Custom Hooks** (in `src/hooks/`):

- `useJournal.js` — Reading history management (fetch, save, search, tag readings).
- `useVisionValidation.js` — Vision research mode state and operations.

**Library Utilities** (in `src/lib/` - Client-Side):

> **Note:** This is one of **three separate `lib/` folders** in the codebase:
> - `src/lib/` — Browser/frontend utilities (uses DOM, window APIs)
> - `functions/lib/` — Cloudflare Workers/backend utilities (uses env, D1, KV)
> - `scripts/evaluation/lib/` — Development tooling utilities (Node.js)

- `deck.js` — Core tarot card logic:
  - `hashString()`, `xorshift32()` and `seededShuffle()` for deterministic RNG.
  - `cryptoShuffle()` fallback using `window.crypto` or `Math.random`.
  - `computeSeed({ cutIndex, knockTimes, userQuestion })` — combines ritual timing, cut, and question into reproducible seed.
  - `drawSpread({ spreadKey, useSeed, seed })` — validates spread key, shuffles deck, attaches `isReversed`.
  - `computeRelationships(cards)` — detects sequences, curated pairings, and growth arcs.
  - `getDeckPool()` — returns Major/Minor Arcana for selected deck style.

- `audio.js` — Audio and TTS management:
  - `initAudio()`, `toggleAmbience()` — ambient background music.
  - `speakText()` — calls `/api/tts` for text-to-speech.
  - `playFlip()` — card flip sound effect.

- `cardInsights.js` — Card meaning lookups and interpretation helpers.
- `formatting.js` — Text formatting utilities for display.
- `intentionCoach.js` — Question refinement and intention-setting logic.
- `journalInsights.js` — Reading pattern analysis and insights for journal feature.
- `questionQuality.js` — Question validation and quality scoring.

**Serverless Functions** (in `functions/api/` - Cloudflare Pages Functions):

Core reading endpoints:
- `tarot-reading.js` — Main reading generation endpoint:
  - Validates payload: `spreadInfo`, `cardsInfo`, question, reflections.
  - If `env.ANTHROPIC_API_KEY` is set: calls Claude Sonnet 4.5 via `generateWithClaudeSonnet45`.
  - Otherwise: uses local deterministic composer (`composeReading`).
  - Returns `{ reading, provider }`.
  - Core rules: no hallucinated cards, no absolute predictions, trauma-informed, actionable.

- `tts.js` — Text-to-speech endpoint using Azure OpenAI TTS with rate limiting.

Intention & question refinement:
- `generate-question.js` — AI-powered question refinement and intention coaching.

Vision research (experimental):
- `vision-proof.js` — Vision detection proof-of-concept for physical deck recognition.

User feedback:
- `feedback.js` — Collects user feedback and stores in D1 database.

Authentication (in `functions/api/auth/`):
- `login.js` — User login with JWT token generation.
- `logout.js` — User logout and session cleanup.
- `register.js` — User registration with password hashing.
- `me.js` — Get current authenticated user info.

Reading history (in `functions/api/journal/`):
- `journal.js` — Get all readings or create new reading entry.
- `[id].js` — Get specific reading by ID.

Health checks (in `functions/api/health/`):
- `tarot-reading.js` — Health check for reading endpoint.
- `tts.js` — Health check for TTS endpoint.

**Backend Library Utilities** (in `functions/lib/` - Server-Side):

> **Important:** This `lib/` folder is separate from `src/lib/` because it runs in Cloudflare Workers (not the browser) and has access to server-side resources like `env.ANTHROPIC_API_KEY`, D1 database, and KV storage.

Narrative generation:
- `narrativeBuilder.js` — Re-exports spread-specific narrative builders.
- `narrativeSpine.js` — Ensures story spine structure (What → Why → What's Next).
- `narrative/prompts.js` — System prompts for Claude API calls.
- `narrative/helpers.js` — Prompt composition utilities.
- `narrative/spreads/` — Spread-specific narrative builders:
  - `singleCard.js`, `threeCard.js`, `fiveCard.js`
  - `decision.js`, `relationship.js`, `celticCross.js`

Analysis & interpretation:
- `spreadAnalysis.js` — Card relationship detection (44KB - core analysis engine).
- `knowledgeGraph.js` — Archetypal relationships database (29KB).
- `contextDetection.js` — Theme/context detection from user questions.
- `positionWeights.js` — Position-specific weights for narrative emphasis.

Metadata & symbolism:
- `esotericMeta.js` — Esoteric concept mappings (15KB).
- `minorMeta.js` — Minor Arcana metadata and meanings.
- `timingMeta.js` — Temporal pattern detection (seasonal, lunar, cyclical themes).
- `imageryHooks.js` — Symbolic imagery callbacks and visual symbol meanings (32KB).
- `symbolAnnotations.js` — Symbol annotation re-export (links to `shared/symbols/`).

Vision & authentication:
- `visionProof.js` — Vision detection utilities for research mode.
- `auth.js` — JWT authentication helpers (token generation, validation).

General utilities:
- `utils.js` — Shared utility functions.

Tests:
- `__tests__/knowledgeGraph.test.js` — Knowledge graph unit tests.

**Shared Utilities** (in `shared/` - Cross-Environment):

> These modules work in both browser and Cloudflare Workers contexts.

Vision pipeline (in `shared/vision/`):
- `tarotVisionPipeline.js` — Main vision detection pipeline for physical deck recognition.
- `symbolDetector.js` — Symbol extraction from card images (color, pattern, feature analysis).
- `deckProfiles.js` — Deck style profiles (RWS, Thoth, Marseille characteristics).
- `deckAssets.js` — Asset paths for different deck styles.
- `cardNameMapping.js` — Canonical card name resolution.
- `minorSymbolLexicon.js` — Symbol-to-card mappings for Minor Arcana.
- `fineTuneCache.js` — Model cache for vision processing.
- `visionBackends.js` — Backend selection (TensorFlow, ONNX, etc.).

Symbol system:
- `shared/symbols/symbolAnnotations.js` — Comprehensive symbol meanings database (62KB).
- `shared/fallbackAudio.js` — Audio fallback utilities.

**Development Scripts & Tooling** (in `scripts/`):

Azure TTS testing:
- `check-azure-tts.mjs` — Azure TTS health check.
- `test-azure-tts.mjs` — Azure TTS integration testing.
- `test-azure-tts-simple.sh` — Simple TTS test script.

Environment setup:
- `setup-all-environments.sh` — One-shot environment setup for all services.
- `setup-cloudflare-env.sh` — Cloudflare-specific configuration.
- `setup-secrets.sh` / `setup-my-secrets.sh` — Secret management and injection.
- `fix-and-deploy.sh` — Deploy with automated fixes.

Vision research (in `scripts/vision/`):
- `runVisionPrototype.js` — Vision detection prototype runner for testing.

Training data (in `scripts/training/`):
- `exportReadings.js` — Export reading data for ML training datasets.
- `fineTuneVision.js` — Vision model fine-tuning utilities.
- `buildMultimodalDataset.js` — Build multimodal training datasets.

Evaluation & metrics (in `scripts/evaluation/`):
- Vision quality:
  - `runVisionConfidence.js` — Vision detection accuracy evaluation.
  - `computeVisionMetrics.js` — Calculate vision performance metrics.
  - `verifyVisionGate.js` — Quality gate check for vision features.
  - `processVisionReviews.js` — Vision review workflow automation.
- Narrative quality:
  - `runNarrativeSamples.js` — Generate narrative quality samples.
  - `computeNarrativeMetrics.js` — Calculate narrative quality metrics.
  - `verifyNarrativeGate.js` — Quality gate check for narrative generation.
  - `processNarrativeReviews.js` — Narrative review workflow automation.
- Utilities:
  - `lib/csv.js` — CSV parsing for evaluation reports.

Asset generation (in `scripts/assets/`):
- `generate_thoth_placeholders.py` — Generate Thoth deck placeholder images.
- `generate_thoth_placeholders_enhanced.py` — Enhanced placeholder generation.
- `splice_card_photos.py` — Physical card photo splicing utility.
- `splice_card_photos_simple.py` — Simplified photo splicing.
- `install_thoth_scans.sh` — Install physical Thoth deck scans.
- `map_thoth_scans.json` — Mapping config for physical deck scans.

**Testing** (in `tests/`):

- `deck.test.mjs` — Deck shuffling, seeding, and drawing logic tests.
- `narrativeBuilder.reversal.test.mjs` — Card reversal interpretation tests.
- `narrativeBuilder.promptCompliance.test.mjs` — Prompt compliance and ethics validation.
- `narrativeSpine.test.mjs` — Narrative structure validation tests.
- `api.validatePayload.test.mjs` — API payload validation tests.
- `api.vision.test.mjs` — Vision detection endpoint tests.

**Static Assets** (in `public/`):

Card images:
- `public/images/cards/RWS1909_-_*.jpeg` — 78 authentic 1909 Rider-Waite cards (public domain).
- `public/images/cards/marseille/*.jpg` — 78 Marseille deck cards.
- `public/images/cards/thoth/*.png` — 78 Thoth deck cards (active set).
- `public/images/cards/thoth-placeholders-backup/*.png` — Thoth deck backup placeholders.
- `public/images/thoth-scans/*.jpg` — Physical Thoth deck photo documentation.
- `public/images/IMG_*.JPG` — Physical card photos for research.

Audio:
- `public/sounds/ambience.mp3` — Ambient background music (481KB).
- `public/sounds/flip.mp3` — Card flip sound effect (9KB).

Routing:
- `public/_routes.json` — Cloudflare Pages routing configuration.

**Data & Migrations**:

- `data/evaluations/*.json` — Vision and narrative evaluation results.
- `data/evaluations/*.csv` — Review queues for vision and narrative quality.
- `migrations/*.sql` — D1 database schema migrations (initial schema, auth, journals).

## Authentic Reading Flow (What the Code is Aiming For)

This section explains the intended behavior so future edits preserve the authentic experience.

### 1. Intention & Question

- Encourage open-ended, scope-appropriate prompts:
  - Prefer “How can I…?”, “What do I need to understand about…?”, “What is influencing…?”
  - Avoid binary yes/no by default.
- `QuestionInput.jsx` and frontend copy should:
  - Reflect best practices from “Tarot Interpretation Framework (Upright, Reversed, Context)”:
    - Position acts as a question lens.
    - Card responds to that lens.

Any future changes to prompts must keep:
- Clear, ethical language.
- Alignment with how spreads and positions are defined in `SPREADS`.

### 2. Spread Selection (Encoded Professional Formats)

Defined in `src/data/spreads.js` as `SPREADS`:

- `single` — One-Card Insight
  - count: 1
  - Position: `Theme / Guidance of the Moment`
  - Use for: daily pulls, tight focus.

- `threeCard` — Three-Card Story (Past · Present · Future)
  - count: 3
  - Positions:
    - Past — influences that led here
    - Present — where you stand now
    - Future — trajectory if nothing shifts
  - Use for: quick story; reinforces timeline-based reading.

- `fiveCard` — Five-Card Clarity
  - count: 5
  - Positions:
    - Core of the matter
    - Challenge or tension
    - Hidden/subconscious influence
    - Support/helpful energy
    - Likely direction on current path
  - Use for: more nuance without full Celtic Cross.

- `decision` — Decision / Two-Path
  - count: 5
  - Positions:
    - Heart of the decision
    - Path A — energy & likely outcome
    - Path B — energy & likely outcome
    - What clarifies the best path
    - What to remember about your free will
  - Use for: structured option comparison; must emphasize agency.

- `relationship` — Relationship Snapshot
  - count: 3
  - Positions:
    - You / your energy
    - Them / their energy
    - The connection / shared lesson
  - Use for: three-card check-in that centers each person and the shared bond; avoid deterministic outcomes.

- `celtic` — Celtic Cross (Classic 10-Card)
  - count: 10
  - Positions (aligned with “Celtic Cross - How to Read the Spread” note):
    - Present — core situation (1)
    - Challenge — crossing/tension (2)
    - Past — what lies behind (3)
    - Near Future — what lies before (4)
    - Conscious — goals & focus (5)
    - Subconscious — roots/hidden forces (6)
    - Self / Advice — how to meet this (7)
    - External Influences — people & environment (8)
    - Hopes & Fears — deepest wishes & worries (9)
    - Outcome — likely path if unchanged (10)

Constraints for contributors:
- Do NOT change position meanings casually. They are used implicitly by:
  - `buildCardsSection` in `tarot-reading.js`.
  - Frontend text explaining spreads.
- Any new spread should:
  - Define precise prompts per position.
  - Align with the interpretation framework:
    - Position → Card meaning → Context → Narrative.

### 3. Shuffle, Draw, and Reveal (Ritual + Determinism)

Flow (implemented across `TarotReading.jsx` and `src/lib/deck.js`):

- Ritual:
  - Knock timings and cut position captured.
  - User’s question string included.
- Seed:
  - `computeSeed()` blends question hash, cut, and knock intervals.
- Draw:
  - `drawSpread({ spreadKey, useSeed, seed })`:
    - Looks up spread by key.
    - Shuffles `MAJOR_ARCANA`.
    - Selects appropriate number of cards.
    - Chooses upright/reversed via deterministic RNG when seeded.
- Reveal:
  - `Card.jsx`:
    - Click/Enter/Space reveals card.
    - Animations use `flipCard` keyframes.

Design intent:
- Preserve the feel of a conscious ritual.
- Keep reproducibility for the same inputs (good for debugging and “sacred tech” feel).

### 4. Card Visuals — Authentic 1909 Rider-Waite Images

Implemented in:

- `src/components/Card.jsx`
- `src/data/majorArcana.js` — Image paths for 22 Major Arcana
- `src/data/minorArcana.js` — Image paths for 56 Minor Arcana (auto-generated via `makeCard()`)
- `public/images/cards/` — 78 JPEG images from 1909 "Roses & Lilies" edition

Key points:

- **Card Images:**
  - Source: 1909 Rider-Waite "Roses & Lilies" edition from Wikimedia Commons
  - License: Public domain (published over 115 years ago)
  - Format: 78 high-quality JPEG files (~200-380KB each, ~820×1430px)
  - Naming convention: `RWS1909_-_XX_Name.jpeg` (Major), `RWS1909_-_Suit_XX.jpeg` (Minor)

- **Unrevealed:**
  - Uses `.tarot-card-shell` + `.tarot-card-back*` classes for card back
  - Back design:
    - Celestial/mandala motif
    - Cross-wand style glyph
    - Custom geometric design (preserved from original CSS implementation)

- **Revealed:**
  - Displays authentic Rider-Waite card image via `<img src={card.image} />`
  - Features:
    - Responsive sizing (max-width: 280px)
    - Proper rotation for reversed cards (`rotate-180`)
    - Rounded corners with shadow and amber border
    - Lazy loading (`loading="lazy"`) for performance
    - Error handling with fallback placeholder
    - Descriptive alt text for accessibility

- **Orientation chip:**
  - Text: "Upright current" / "Reversed current"
  - Reinforces dynamic expression, not binary good/bad

**Data Structure:**

Each card object now includes an `image` property:

```javascript
// Major Arcana example
{
  name: 'The Fool',
  number: 0,
  upright: '...',
  reversed: '...',
  image: '/images/cards/RWS1909_-_00_Fool.jpeg'
}

// Minor Arcana example (auto-generated)
{
  name: 'Ace of Wands',
  suit: 'Wands',
  rank: 'Ace',
  rankValue: 1,
  upright: '...',
  reversed: '...',
  image: '/images/cards/RWS1909_-_Wands_01.jpeg'  // auto-generated from suit + rankValue
}
```

**Constraints:**
- Images are served from `public/images/cards/` (Vite automatically serves from `public/` at root)
- All visual updates must keep A11y (labels, focus, ARIA) intact
- Card images are public domain; no licensing concerns
- Maintain error handling for missing images

### 5. Interpretation Framework (Upright, Reversed, Context)

The app is aligned with the “Tarot Interpretation Framework (Upright, Reversed, Context)” note:

Principles to preserve:

- Position-first:
  - The spread position acts as a question lens.
  - Same card reads differently in “Challenge” vs “Advice” vs “Outcome”.

- Upright meanings:
  - Based on `MAJOR_ARCANA` text (core keywords).
  - Used as baseline guidance, not exhaustive essays.

- Reversed meanings:
  - Interpreted contextually as:
    - Blocked or delayed expression.
    - Excess/deficient expression.
    - Internalized/private process.
    - Occasionally, clear opposite when narrative supports it.
  - Within one reading, interpreter (LLM or human) should use a consistent reversal model to avoid contradictions.

- Synthesis:
  - Respect relationships:
    - Above vs Below (conscious vs subconscious).
    - Past vs Future.
    - Advice vs Outcome.
    - Staff vs Cross in Celtic Cross.
  - Narrative should:
    - Identify core tension.
    - Map causes and trajectories.
    - Offer practical, ethical steps.

### 6. Narrative Generation (Claude + Local Fallback)

Located in `functions/api/tarot-reading.js`:

- `generateWithClaudeSonnet45`:
  - Uses a system prompt that:
    - Describes spread, cards, and question.
    - Instructs trauma-informed, empowering style.
    - Forbids deterministic fortune telling and restricted-domain advice.
  - Sends:
    - Spread name.
    - Cards with positions, numbers, orientation, meaning text.
    - User reflections.

- `composeReading` (fallback):
  - Mirrors the same structure without external API:
    - Intro tuned to spread and question.
    - `buildCardsSection`:
      - Card-by-card summary using positional context and orientation cues.
    - `buildReflectionSection`:
      - Incorporates querent’s notes.
    - `buildSynthesisSection`:
      - Uses `analyseThemes`:
        - Reversals ratio.
        - Average number.
        - Qualitative themes (e.g., new cycles vs integration vs culmination).

Contributor guidance:
- When modifying prompts or composer logic:
  - Ensure:
    - No extra cards are invented.
    - Text remains specific to actual `cardsInfo`.
    - Ethics: emphasize free will, no guaranteed outcomes.

### 7. Ethics & Boundaries

All changes should keep:

- Tarot as guidance, not replacement for:
  - Medical
  - Legal
  - Financial
  - Mental health professionals
- Emphasis on:
  - Agency and choice.
  - Non-fatalistic language (“likely path if unchanged”).
  - Respectful, inclusive tone.

If adding new features (e.g., yes/no spreads, health topics):

- Implement explicit disclaimers in UI.
- Keep adherence to the same ethical constraints.

## How to Work with This Repo as Claude

- Use spread definitions and card data as the single source of truth for structure.
- When generating or adjusting narratives:
  - Derive all statements from:
    - Provided cards, positions, meanings, and user question.
- When updating visuals:
  - Maintain authentic tarot feel with original, non-infringing art direction.
- When adding new modes/spreads:
  - Document them clearly in `src/data/spreads.js` and update this file accordingly.

This ensures Mystic Tarot remains a coherent, authentic-feeling tarot experience rather than a generic card description app.
