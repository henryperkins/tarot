# Test Coverage Analysis

## Executive Summary

The codebase has **strong backend/business logic test coverage** (~85% of tests) but **critically weak frontend/UI test coverage** with:
- **0 component tests** for 100+ React components
- **1 hook test** for 30 custom hooks
- **6 E2E tests** for a complex multi-feature application
- **No mobile gesture testing** despite mobile-first design

---

## Current Test Inventory

| Category | Location | Count |
|----------|----------|-------|
| Unit Tests | `tests/*.test.mjs` | 68 |
| E2E Tests | `e2e/*.spec.js` | 6 |
| Accessibility | `tests/accessibility/` | 3 |
| **Total** | | **77** |

---

## What's Well Tested

### 1. Core Deck Logic (`deck.test.mjs`)
- Deterministic seeding (`computeSeed()`)
- Shuffling algorithms (`seededShuffle()`, `cryptoShuffle()`)
- Spread drawing (`drawSpread()`)
- Card relationships (`computeRelationships()`)

### 2. Evaluation System (`evaluation.test.mjs` - 1,735 lines)
- AI quality scoring via Workers AI
- Heuristic fallback scoring
- Safety flagging (medical advice, death predictions, self-harm)
- Token truncation/budgeting
- Database storage

### 3. Narrative Generation
- `narrativeBuilder.promptCompliance.test.mjs` (1,176 lines)
- `narrativeBuilder.reversal.test.mjs` - Reversal interpretation
- `narrativeSpine.test.mjs` - Story structure
- `narrativeInputGuards.test.mjs` - Input validation
- `narrativePromptSafety.test.mjs` - Safety/ethics

### 4. Knowledge Graph & Pattern Detection
- `graphRAG.test.mjs` (1,320 lines) - RAG retrieval
- `graphContext.test.mjs` - Context building
- `knowledgeGraph.test.js` - Fool's Journey, Triads, Dyads

### 5. Authentication & Payments
- `stripe.webhook.test.mjs` - Webhook handling
- `stripe.tierExtraction.test.mjs` - Tier derivation
- `auth.apiKeyTierDerivation.test.mjs` - API key auth

### 6. TTS & Audio
- `tts.test.mjs` (805 lines) - Azure Speech SDK
- `tts-hume.test.mjs` - Hume AI TTS

### 7. Journal System
- `journalDedupe.test.mjs` - Deduplication
- `journalEntryApi.test.mjs` - CRUD operations
- `journalStats.test.mjs` - Statistics
- `journalInsights.test.mjs` - CSV/markdown export

---

## Major Coverage Gaps

### 1. React Components (100+ components - 0% tested)

**Critical untested components:**

| Component | Risk Level | Reason |
|-----------|------------|--------|
| `Card.jsx` | High | Core display, flip animation, touch events |
| `ReadingGrid.jsx` | High | Complex layout, responsive behavior |
| `DeckRitual.jsx` | High | Multi-step ritual flow, state machine |
| `SpreadSelector.jsx` | High | User selection, spread validation |
| `FollowUpChat.jsx` | High | Streaming messages, conversation state |
| `Journal.jsx` | Medium | List rendering, filtering, pagination |
| `AuthModal.jsx` | Medium | Form validation, auth flow |
| `QuestionInput.jsx` | Medium | Input validation, character limits |
| `AudioControls.jsx` | Medium | Audio state, playback control |

**Recommended testing approach:**
```javascript
// Example: Card.jsx component test structure
import { render, fireEvent } from '@testing-library/react';
import Card from '../src/components/Card';

describe('Card', () => {
  it('renders card face when not flipped', () => {});
  it('shows card back when flipped', () => {});
  it('triggers onFlip callback on click', () => {});
  it('shows reversed indicator when isReversed', () => {});
  it('displays position label correctly', () => {});
  it('handles touch events on mobile', () => {});
});
```

### 2. Custom Hooks (30 hooks - 1 tested)

**Currently tested:** `useJourneyData.test.mjs` (594 lines)

**Untested hooks requiring coverage:**

| Hook | Complexity | Critical Functions |
|------|------------|-------------------|
| `useAudioController.js` | High | Play/pause/seek, audio caching |
| `useFeatureFlags.js` | Medium | Flag evaluation, defaults |
| `useSwipeNavigation.js` | High | Gesture detection, thresholds |
| `useSaveReading.js` | High | Save workflow, deduplication |
| `useMemories.js` | Medium | CRUD operations, sync |
| `useVisionValidation.js` | High | Image processing, validation |
| `useJournalFilters.js` | Medium | Filter state, persistence |
| `useModalA11y.js` | Medium | Focus trap, escape key |
| `useTarotState.js` | High | Reading state machine |

**Recommended testing pattern:**
```javascript
// Example: useAudioController hook test
import { renderHook, act } from '@testing-library/react-hooks';
import { useAudioController } from '../src/hooks/useAudioController';

describe('useAudioController', () => {
  it('initializes with paused state', () => {});
  it('plays audio when play() called', () => {});
  it('pauses audio when pause() called', () => {});
  it('handles audio errors gracefully', () => {});
  it('caches audio correctly', () => {});
});
```

### 3. API Endpoints (52 endpoints - ~15 tested)

**Untested/minimally tested endpoints:**

| Endpoint | Risk | Reason |
|----------|------|--------|
| `generate-question.js` | Medium | AI integration, tier gating |
| `archetype-journey.js` | Medium | Complex aggregation |
| `journal-summary.js` | Medium | AI summarization |
| `speech-token.js` | Low | Token issuance |
| `vision-proof.js` | High | Image upload, validation |
| `admin/quality-stats.js` | Low | Admin only |
| `share/[token]/og-image.js` | Medium | Image generation |
| `tarot-reading-job-*.js` | High | Job queue system |

### 4. E2E Coverage Gaps

**Current E2E tests (6 files):**
- `tarot-reading.spec.js` - Basic reading flow
- `journal-filters.spec.js` - Filter UI
- `follow-up-questions.spec.js` - Follow-up chat
- `journal-save.integration.spec.js` - Save workflow
- `saved-intentions-modal.spec.js` - Modal interactions
- `cards-drawn-section.spec.js` - Card display

**Missing E2E scenarios:**

| Scenario | Priority |
|----------|----------|
| Error states (API failures, timeouts) | High |
| Network offline/reconnect | Medium |
| Authentication flow (login/register/forgot) | High |
| Subscription upgrade flow | Medium |
| Share reading flow | Medium |
| Vision/camera capture flow | High |
| Archetype journey view | Medium |
| Admin dashboard | Low |
| Mobile gestures (swipe, pinch) | High |
| Keyboard-only navigation | High |

### 5. Frontend Utilities (0% tested)

**Untested utility files in `src/lib/`:**

| File | Functions |
|------|-----------|
| `audio.js` | Audio playback, caching |
| `audioCache.js` | Cache management |
| `cardInsights.js` | Insight generation |
| `cardLookup.js` | Card data lookup |
| `coachStorage.js` | Local storage for coach |
| `formatting.js` | Text formatting |
| `highlightUtils.js` | Text highlighting |
| `onboardingMetrics.js` | Onboarding tracking |
| `pdfExport.js` | PDF generation |
| `safeStorage.js` | Safe localStorage wrapper |

### 6. Data Files (Source of Truth - 0% validated)

**Untested data integrity:**

| File | Validation Needed |
|------|------------------|
| `spreads.js` | Position count matches, roleKeys valid |
| `majorArcana.js` | All 22 cards present, meanings valid |
| `minorArcana.js` | All 56 cards present, suits complete |
| `knowledgeGraphData.js` | Triad/dyad references valid |

---

## Priority Recommendations

### Priority 1: High Impact (Immediate)

1. **Add React Testing Library** for component tests
   - Start with `Card.jsx`, `ReadingGrid.jsx`, `SpreadSelector.jsx`
   - Target: 10 core components with full coverage

2. **Hook testing infrastructure**
   - Add `@testing-library/react-hooks`
   - Test `useTarotState.js`, `useAudioController.js`, `useSaveReading.js`

3. **E2E error state coverage**
   - Add API failure scenarios
   - Test offline behavior
   - Verify error messages display correctly

4. **Data file validation tests**
   - Ensure card counts are correct
   - Validate cross-references in knowledge graph

### Priority 2: Medium Impact (Next Sprint)

5. **API endpoint coverage**
   - `generate-question.js` - AI question generation
   - `archetype-journey.js` - Journey tracking
   - `tarot-reading-job-*.js` - Job queue

6. **Mobile-specific E2E**
   - Swipe gestures
   - Touch interactions
   - Landscape/portrait transitions

7. **Frontend utility tests**
   - `audio.js`, `audioCache.js`
   - `pdfExport.js`
   - `safeStorage.js`

### Priority 3: Nice to Have

8. **Visual regression testing**
   - Add Percy or Chromatic
   - Screenshot comparison for card layouts

9. **Performance benchmarks**
   - Bundle size tests
   - Render performance tests

10. **Full accessibility audit**
    - ARIA validation beyond contrast
    - Screen reader testing

---

## Suggested Test File Structure

```
tests/
├── unit/
│   ├── deck.test.mjs          (existing)
│   ├── evaluation.test.mjs    (existing)
│   └── ...
├── components/                 (NEW)
│   ├── Card.test.jsx
│   ├── ReadingGrid.test.jsx
│   ├── SpreadSelector.test.jsx
│   └── ...
├── hooks/                      (NEW)
│   ├── useAudioController.test.js
│   ├── useTarotState.test.js
│   └── ...
├── lib/                        (NEW)
│   ├── audio.test.js
│   ├── pdfExport.test.js
│   └── ...
├── data/                       (NEW)
│   ├── spreads.validation.test.js
│   ├── cards.validation.test.js
│   └── knowledgeGraph.validation.test.js
└── accessibility/             (existing)
    ├── contrast-checker.mjs
    └── wcag-analyzer.mjs

e2e/
├── tarot-reading.spec.js      (existing)
├── error-states.spec.js       (NEW)
├── auth-flow.spec.js          (NEW)
├── mobile-gestures.spec.js    (NEW)
└── keyboard-navigation.spec.js (NEW)
```

---

## Required Dependencies

```bash
# Component & Hook testing
npm install --save-dev @testing-library/react @testing-library/react-hooks @testing-library/jest-dom

# Visual regression (optional)
npm install --save-dev @percy/cli @percy/playwright
```

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Component test coverage | 0% | 60% |
| Hook test coverage | 3% | 80% |
| E2E scenario coverage | ~20% | 70% |
| API endpoint coverage | ~30% | 80% |
| Data validation tests | 0% | 100% |

---

## Conclusion

The backend test coverage is excellent - evaluation, narrative generation, and knowledge graph systems are well-tested with safety-critical paths thoroughly covered. The critical gap is **frontend testing**: components, hooks, and user interactions have almost no automated test coverage.

Immediate focus should be:
1. Core component tests (Card, ReadingGrid, SpreadSelector)
2. State management hook tests (useTarotState, useSaveReading)
3. E2E error state scenarios
4. Data file validation

This will significantly improve confidence in deployments and catch UI regressions before they reach users.
