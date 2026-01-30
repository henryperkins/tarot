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

## Testing Infrastructure Issues (Second Pass)

### 1. Unused Dependencies

**Vitest installed but not used:**
```json
"devDependencies": {
  "@vitest/coverage-v8": "^4.0.18",
  "vitest": "^4.0.18"
}
```

The project uses Node.js built-in test runner (`node --test`) but has Vitest installed. This adds ~15MB to `node_modules` with no benefit.

**Recommendation:** Either migrate to Vitest (better ecosystem, faster) or remove the unused dependencies.

### 2. Duplicated Mock Classes

The same mock patterns are reimplemented across 14+ test files:

| Mock Class | Files Using It |
|------------|---------------|
| `MockDB` | `evaluation.test.mjs`, `readingFollowup.test.mjs`, `journalEntryApi.test.mjs`, `userMemory.test.mjs`, `journalFollowups.test.mjs`, `readingQuality.test.mjs` |
| `MockKV` | `evaluation.test.mjs`, `tts.test.mjs` |
| `MockAI` | `readingFollowup.test.mjs`, `evaluation.test.mjs` |
| `MockStatement` | `stripe.webhook.test.mjs`, `readingFollowupReservations.test.mjs` |

**Example of duplication:**
```javascript
// tests/journalEntryApi.test.mjs
class MockDB {
  constructor({ sessionRow, entryRow, ... }) { ... }
  prepare(query) { ... }
}

// tests/readingFollowup.test.mjs
class MockDB {
  constructor() { ... }
  prepare(sql) { ... }
}
```

**Recommendation:** Create `tests/helpers/mocks.mjs` with shared mock implementations:
```javascript
// tests/helpers/mocks.mjs
export class MockD1Database { ... }
export class MockKVNamespace { ... }
export class MockAIBinding { ... }
export function createMockEnv(overrides = {}) { ... }
export function createMockRequest(url, options = {}) { ... }
```

### 3. Inconsistent Test API Usage

Mixed usage of Node.js test runner APIs:

| Pattern | Files Using |
|---------|-------------|
| `describe, it` | 35 files |
| `describe, test` | 15 files |
| `test` only | 8 files |

**Recommendation:** Standardize on `describe` + `it` (more readable, BDD-style):
```javascript
// Preferred
describe('feature', () => {
  it('should behave correctly', () => {});
});
```

### 4. No Shared Test Utilities

Missing common test utilities file. Each test reimplements:
- Request creation helpers
- Environment creation helpers
- Response assertion helpers

**Recommendation:** Create `tests/helpers/utils.mjs`:
```javascript
export function createMockRequest(url, options = {}) { ... }
export function createMockEnv(overrides = {}) { ... }
export async function assertJsonResponse(response, expected) { ... }
export function createTestCards(count, options = {}) { ... }
```

### 5. E2E Test Stability Issues

**Excessive `waitForTimeout` calls (flaky test indicators):**
- 40+ explicit timeout waits across 6 E2E files
- Hardcoded timeouts: 150ms, 300ms, 500ms, 600ms, 800ms

**Example problematic patterns:**
```javascript
// e2e/tarot-reading.spec.js
await page.waitForTimeout(150);  // Between knocks
await page.waitForTimeout(300);  // After card flip
await page.waitForTimeout(800);  // After animation
```

**Recommendation:** Replace with explicit waits for state:
```javascript
// Instead of:
await page.waitForTimeout(300);

// Use:
await expect(card).toHaveAttribute('data-flipped', 'true');
// or
await page.waitForFunction(() =>
  document.querySelector('.card').classList.contains('flipped')
);
```

### 6. CI Pipeline Gaps

**Current CI (`ci.yml`) only runs:**
- Unit tests (`npm test`)
- Vision QA gate
- Narrative QA gate

**Missing from CI:**
- E2E tests (not run in CI at all!)
- Accessibility tests (`npm run test:a11y`)
- Integration tests (`npm run test:e2e:integration`)
- Coverage thresholds

**Recommendation:** Update `.github/workflows/ci.yml`:
```yaml
- name: Run unit tests
  run: npm test

- name: Run accessibility tests
  run: npm run test:a11y

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
```

### 7. No Test Coverage Enforcement

**Current state:**
- `npm run test:coverage` uses experimental Node.js coverage
- No coverage thresholds enforced
- No coverage reports generated in CI

**Recommendation:** Add coverage thresholds:
```javascript
// vitest.config.js (if migrating to Vitest)
export default {
  test: {
    coverage: {
      thresholds: {
        functions: 60,
        lines: 60,
        branches: 50
      }
    }
  }
}
```

### 8. Missing Test Setup/Teardown

Only 7 of 68 test files use `beforeEach`/`afterEach`:
- `evaluation.test.mjs`
- `tts.test.mjs`
- `reasoning.test.mjs`
- `azureResponses.test.mjs`
- `followUpToolRoundTripStream.test.mjs`
- `userMemory.test.mjs`
- `tts-hume.test.mjs`

**Issue:** Tests that modify global state (like `global.fetch`) may leak between tests.

**Example of proper cleanup needed:**
```javascript
// tests/tts.test.mjs
const mockFetch = mock.fn();
global.fetch = mockFetch;  // Modified globally!

// Missing: afterEach to restore original fetch
```

### 9. No Snapshot Testing

Zero snapshot tests despite having:
- Complex narrative output
- JSON response structures
- Generated HTML/markdown

**Use cases for snapshots:**
- `buildEnhancedClaudePrompt()` output
- Evaluation score JSON structure
- OG image HTML generation

### 10. Playwright Configuration Issues

**Desktop/Mobile split uses grep patterns:**
```javascript
projects: [
  { name: 'desktop', grep: /@desktop/ },
  { name: 'mobile', grep: /@mobile/ },
]
```

**Problem:** Tests without `@desktop` or `@mobile` tags are never run!

**Recommendation:** Add a default project or require tags:
```javascript
projects: [
  { name: 'chromium', use: devices['Desktop Chrome'] },  // Runs all
  { name: 'mobile', use: devices['iPhone 13'], grep: /@mobile/ },
]
```

---

## Infrastructure Improvement Checklist

### Immediate (This Sprint)

- [ ] Create `tests/helpers/mocks.mjs` with shared mock classes
- [ ] Create `tests/helpers/utils.mjs` with common utilities
- [ ] Standardize on `describe` + `it` pattern
- [ ] Add E2E tests to CI pipeline
- [ ] Fix Playwright project configuration to not skip untagged tests

### Short-term (Next 2 Sprints)

- [ ] Remove unused Vitest dependencies OR migrate to Vitest
- [ ] Replace `waitForTimeout` calls with explicit state waits
- [ ] Add `afterEach` cleanup to tests modifying globals
- [ ] Add accessibility tests to CI
- [ ] Set up coverage reporting in CI

### Long-term

- [ ] Add coverage thresholds (60% functions, 60% lines)
- [ ] Add snapshot tests for complex outputs
- [ ] Add visual regression testing with Percy/Chromatic
- [ ] Create test data factories for cards/spreads/readings

---

## Conclusion

The backend test coverage is excellent - evaluation, narrative generation, and knowledge graph systems are well-tested with safety-critical paths thoroughly covered. The critical gap is **frontend testing**: components, hooks, and user interactions have almost no automated test coverage.

**Infrastructure issues compound the coverage gaps:**
- Duplicated mocks make tests harder to maintain
- Missing E2E in CI means regressions ship to production
- Flaky E2E tests reduce confidence in the test suite
- No coverage enforcement allows coverage to decay

**Immediate focus should be:**
1. **Infrastructure:** Shared mocks, E2E in CI, fix Playwright config
2. **Coverage:** Core component tests (Card, ReadingGrid, SpreadSelector)
3. **Stability:** Replace `waitForTimeout` with explicit waits
4. **Validation:** Data file validation tests

This will significantly improve confidence in deployments and catch regressions before they reach users.
