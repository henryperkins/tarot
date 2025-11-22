# Mystic Tarot Frontend Refactoring Roadmap

**Version:** 1.0
**Date:** 2025-11-22
**Estimated Total Effort:** 120-150 hours (15-19 days)
**Recommended Timeline:** 6-8 sprints (2-week sprints)

---

## Executive Summary

This roadmap addresses critical technical debt in the Mystic Tarot frontend without requiring a full recreation. The strategy prioritizes:

1. **Quick wins** to build momentum and demonstrate value
2. **Foundation work** that enables future improvements
3. **Major refactors** of the most problematic components
4. **Quality improvements** to prevent future debt

**Key Targets:**
- Reduce re-renders by 60-75% through context splitting
- Improve testability from 0% to 80%+ coverage
- Reduce largest component from 1,215 → 200 lines
- Add error boundaries and resilience
- Establish testing infrastructure

---

## Prioritization Framework

Each task is scored on three dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Impact** | 40% | User experience improvement + code quality |
| **Effort** | 30% | Time investment required |
| **Risk** | 30% | Probability of introducing bugs |

**Priority Levels:**
- 🔥 **P0 (Critical):** High impact, low-medium effort, blocks other work
- ⭐ **P1 (High):** High impact, may have dependencies
- 📊 **P2 (Medium):** Moderate impact, good ROI
- 🔧 **P3 (Low):** Nice-to-have, technical polish

---

## Phase 1: Quick Wins & Testing Foundation
**Duration:** 2 sprints (4 weeks)
**Total Effort:** 30-35 hours

### 🔥 P0-1: Set Up Testing Infrastructure
**Effort:** 4 hours | **Risk:** Low | **Impact:** Enables all future work

**Why first:**
- Every subsequent refactor needs tests
- Prevents regressions
- Builds confidence in changes

**Tasks:**
1. Install Vitest + Testing Library
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```
2. Create `vitest.config.js`
3. Add test scripts to `package.json`
4. Create `tests/setup.js` with global mocks
5. Write first smoke test for `App.jsx`

**Success Criteria:**
- [ ] `npm test` runs successfully
- [ ] Can run tests in watch mode
- [ ] Coverage reporting enabled

**Files to create:**
- `vitest.config.js`
- `tests/setup.js`
- `tests/App.test.jsx` (smoke test)

---

### 🔥 P0-2: Add Error Boundaries
**Effort:** 3 hours | **Risk:** Low | **Impact:** Prevents full app crashes

**Why early:**
- Protects against errors during refactoring
- Improves UX immediately
- Low effort, high value

**Tasks:**
1. Create `src/components/ErrorBoundary.jsx`
2. Add root error boundary in `main.jsx`
3. Add feature-specific boundaries:
   - `ReadingErrorBoundary` (wraps TarotReading)
   - `JournalErrorBoundary` (wraps Journal)
   - `AuthErrorBoundary` (wraps auth flows)
4. Add error logging (console + optional telemetry hook)

**Success Criteria:**
- [ ] React errors show fallback UI instead of white screen
- [ ] User can recover without full page reload
- [ ] Errors logged for debugging

**Files to create:**
- `src/components/ErrorBoundary.jsx`
- `src/components/ReadingErrorBoundary.jsx`
- `src/components/JournalErrorBoundary.jsx`

---

### ⭐ P1-1: Extract ReadingUIContext (Phase 1)
**Effort:** 3 hours | **Risk:** Low | **Impact:** 75% fewer re-renders on UI state changes

**Why early:**
- Lowest risk context extraction
- Immediate performance improvement
- No complex dependencies
- Proves the context-splitting strategy

**Tasks:**
1. Create `src/contexts/ReadingUIContext.jsx`
2. Move 7 UI state values:
   - `journalStatus`, `setJournalStatus`
   - `reflections`, `setReflections`
   - `lastCardsForFeedback`, `setLastCardsForFeedback`
   - `showAllHighlights`, `setShowAllHighlights`
3. Create `useReadingUI()` hook
4. Update 3 consumers: `TarotReading.jsx`, `ReadingDisplay.jsx`, `useSaveReading.js`
5. Add tests for context

**Success Criteria:**
- [ ] UI state changes don't trigger ReadingContext re-renders
- [ ] Reflections, journal status, highlights work correctly
- [ ] Tests pass for all 3 consumers

**Files to create:**
- `src/contexts/ReadingUIContext.jsx`
- `tests/contexts/ReadingUIContext.test.jsx`

**Files to modify:**
- `src/contexts/ReadingContext.jsx` (remove UI state)
- `src/TarotReading.jsx` (add useReadingUI)
- `src/components/ReadingDisplay.jsx` (add useReadingUI)
- `src/hooks/useSaveReading.js` (add useReadingUI)

---

### ⭐ P1-2: Test Core Utilities (deck.js, formatting.js)
**Effort:** 6 hours | **Risk:** Low | **Impact:** Protects critical logic

**Why early:**
- These are pure functions (easy to test)
- Core business logic that must not break
- Establishes testing patterns

**Tasks:**
1. Test `src/lib/deck.js`:
   - `hashString()` determinism
   - `xorshift32()` PRNG behavior
   - `seededShuffle()` reproducibility
   - `computeSeed()` with different inputs
   - `drawSpread()` for all 6 spreads
2. Test `src/lib/formatting.js`:
   - `normalizeReadingText()`
   - `prepareForTTS()`
   - `splitIntoParagraphs()`
   - `extractSections()`

**Success Criteria:**
- [ ] 90%+ code coverage on both files
- [ ] All edge cases tested (empty inputs, invalid spreads, etc.)
- [ ] Tests run in <500ms

**Files to create:**
- `tests/lib/deck.test.js`
- `tests/lib/formatting.test.js`

---

### 📊 P2-1: Extract Pure Functions from GuidedIntentionCoach
**Effort:** 2 hours | **Risk:** Very low | **Impact:** Reduces complexity by 60 lines

**Why early:**
- Easy first step toward refactoring the monster component
- Immediate readability improvement
- No state dependencies

**Tasks:**
1. Create `src/lib/intentionCoachUtils.js`
2. Move pure functions:
   - `describePrefillSource()`
   - `getTopicLabel()`
   - `getTimeframeLabel()`
   - `getDepthLabel()`
3. Update imports in `GuidedIntentionCoach.jsx`
4. Test functions in isolation

**Success Criteria:**
- [ ] All functions have unit tests
- [ ] GuidedIntentionCoach imports from new file
- [ ] No behavioral changes

**Files to create:**
- `src/lib/intentionCoachUtils.js`
- `tests/lib/intentionCoachUtils.test.js`

**Files to modify:**
- `src/components/GuidedIntentionCoach.jsx`

---

### 📊 P2-2: Optimize ReadingContext with useMemo
**Effort:** 2 hours | **Risk:** Low | **Impact:** Temporary optimization while refactoring

**Why early:**
- Quick performance win
- Doesn't require restructuring
- Buys time for larger refactors

**Tasks:**
1. Wrap context value in `useMemo`:
   ```jsx
   const value = useMemo(() => ({
     ...audioController,
     ...tarotState,
     ...visionAnalysis,
     // ... rest
   }), [/* dependencies */]);
   ```
2. Wrap expensive functions in `useCallback`
3. Profile with React DevTools to measure improvement

**Success Criteria:**
- [ ] Context value only recreated when state actually changes
- [ ] Measurable reduction in re-renders (target: 30-40%)

**Files to modify:**
- `src/contexts/ReadingContext.jsx`

---

### 🔧 P3-1: Add PropTypes or TypeScript Types (Optional)
**Effort:** 8 hours | **Risk:** Low | **Impact:** Better DX, fewer prop bugs

**Tasks:**
1. Choose approach: PropTypes (faster) or TypeScript (better long-term)
2. Add types to 10 most-used components:
   - `Card.jsx`
   - `SpreadSelector.jsx`
   - `QuestionInput.jsx`
   - `RitualControls.jsx`
   - `ReadingGrid.jsx`
   - etc.
3. Enable prop validation in dev mode

**Success Criteria:**
- [ ] Prop warnings in console during development
- [ ] IDE autocomplete for props

---

## Phase 2: Context Architecture Refactor
**Duration:** 2 sprints (4 weeks)
**Total Effort:** 35-40 hours

### 🔥 P0-3: Extract AudioControllerContext (Phase 2)
**Effort:** 4 hours | **Risk:** Medium | **Impact:** Isolates audio from card state

**Dependencies:** P1-1 (ReadingUIContext)

**Tasks:**
1. Create `src/contexts/AudioControllerContext.jsx`
2. Move 8 audio values from ReadingContext
3. Break circular dependency with TarotState:
   - Use callback ref pattern for `speak` function
   - OR use event emitter pattern
4. Update consumers: `TarotReading.jsx`, `ReadingDisplay.jsx`
5. Test audio playback, TTS, narration controls

**Success Criteria:**
- [ ] Audio state changes don't re-render TarotReading
- [ ] TTS works correctly
- [ ] Narration controls functional
- [ ] No circular dependency warnings

**Files to create:**
- `src/contexts/AudioControllerContext.jsx`
- `tests/contexts/AudioControllerContext.test.jsx`

**Files to modify:**
- `src/contexts/ReadingContext.jsx`
- `src/TarotReading.jsx`
- `src/components/ReadingDisplay.jsx`

---

### ⭐ P1-3: Extract VisionAnalysisContext (Phase 3)
**Effort:** 5 hours | **Risk:** Medium | **Impact:** Vision feature isolation

**Dependencies:** P0-3 (AudioControllerContext)

**Tasks:**
1. Create `src/contexts/VisionAnalysisContext.jsx`
2. Move 13 vision values from ReadingContext
3. Keep conflict detection logic encapsulated
4. Update consumers: `TarotReading.jsx`, `ReadingDisplay.jsx`
5. Test vision upload, conflict detection, proof generation

**Success Criteria:**
- [ ] Vision panel updates don't trigger tarot state re-renders
- [ ] Vision validation works correctly
- [ ] Feedback vision summary intact

**Files to create:**
- `src/contexts/VisionAnalysisContext.jsx`
- `tests/contexts/VisionAnalysisContext.test.jsx`

---

### ⭐ P1-4: Extract ReadingGenerationContext (Phase 4)
**Effort:** 6 hours | **Risk:** High | **Impact:** Clean narrative generation flow

**Dependencies:** P1-3 (VisionAnalysisContext)

**Tasks:**
1. Create `src/contexts/ReadingGenerationContext.jsx`
2. Move 14 generation values from ReadingContext
3. Move `generatePersonalReading()` function
4. Move `highlightItems` computation
5. Compose dependencies from other contexts
6. Update consumers: `TarotReading.jsx`, `ReadingDisplay.jsx`, `useSaveReading.js`
7. Test narrative generation, highlights, save flow

**Success Criteria:**
- [ ] Narrative generation isolated from ritual flow
- [ ] Highlights computation works correctly
- [ ] Journal save includes all necessary data

**Files to create:**
- `src/contexts/ReadingGenerationContext.jsx`
- `tests/contexts/ReadingGenerationContext.test.jsx`

---

### 🔥 P0-4: Finalize TarotStateContext (Phase 5)
**Effort:** 3 hours | **Risk:** Medium | **Impact:** Complete context split

**Dependencies:** P1-4 (ReadingGenerationContext)

**Tasks:**
1. Rename `ReadingContext` → `TarotStateContext`
2. Verify only tarot-specific state remains (30 values)
3. Add useMemo/useCallback optimizations
4. Update provider nesting in `main.jsx`
5. Final integration testing

**Success Criteria:**
- [ ] All contexts cleanly separated
- [ ] No prop drilling
- [ ] Provider nesting correct
- [ ] All features work end-to-end

**Files to modify:**
- `src/contexts/ReadingContext.jsx` → `src/contexts/TarotStateContext.jsx`
- `src/main.jsx` (provider nesting)

---

### 📊 P2-3: Test Custom Hooks
**Effort:** 8 hours | **Risk:** Low | **Impact:** Protects complex state logic

**Tasks:**
1. Test `useTarotState.js`:
   - Shuffle, draw, reveal flows
   - Ritual state management
   - Seed computation
2. Test `useJournal.js`:
   - Load entries (API + localStorage fallback)
   - Save entry
   - Delete entry
   - Search/filter
3. Test `useAudioController.js`:
   - TTS state
   - Speak function
   - Narration controls
4. Test `useVisionAnalysis.js`:
   - Vision results handling
   - Conflict detection
   - Proof generation

**Success Criteria:**
- [ ] 80%+ code coverage on all hooks
- [ ] Edge cases tested (errors, empty state, etc.)

**Files to create:**
- `tests/hooks/useTarotState.test.js`
- `tests/hooks/useJournal.test.js`
- `tests/hooks/useAudioController.test.js`
- `tests/hooks/useVisionAnalysis.test.js`

---

### 📊 P2-4: Refactor SpreadSelector to Use Context
**Effort:** 2 hours | **Risk:** Low | **Impact:** Remove 12 props of drilling

**Dependencies:** P0-4 (TarotStateContext finalized)

**Tasks:**
1. Remove 12 props from `SpreadSelector.jsx`
2. Consume contexts directly:
   - `useTarotState()` for reading state
   - `useReadingUI()` for journal status
3. Update parent `TarotReading.jsx` to pass only 4 necessary props
4. Test spread selection flow

**Success Criteria:**
- [ ] SpreadSelector receives <5 props
- [ ] No behavioral changes
- [ ] Spread selection works correctly

**Files to modify:**
- `src/components/SpreadSelector.jsx`
- `src/TarotReading.jsx`

---

## Phase 3: Component Refactoring
**Duration:** 2 sprints (4 weeks)
**Total Effort:** 40-50 hours

### 🔥 P0-5: Extract Components from GuidedIntentionCoach
**Effort:** 8 hours | **Risk:** Medium | **Impact:** Reduces component from 1,215 → ~800 lines

**Dependencies:** P2-1 (pure functions extracted)

**Order of extraction:**
1. `WizardStepIndicator.jsx` (30 lines) - 1 hour
2. `TimeframeSelector.jsx` (25 lines) - 1 hour
3. `TopicSelector.jsx` (50 lines) - 1 hour
4. `DepthSelector.jsx` (40 lines) - 1 hour
5. `WizardFooter.jsx` (40 lines) - 1 hour
6. `PersonalizedSuggestionsPanel.jsx` (50 lines) - 1 hour
7. `QuestionReviewPanel.jsx` (175 lines) - 2 hours
8. `TemplatePanel.jsx` (130 lines) - 2 hours

**Tasks:**
1. Create component files in `src/components/coach/`
2. Extract JSX and local logic
3. Define prop interfaces
4. Update `GuidedIntentionCoach.jsx` to use new components
5. Visual regression testing

**Success Criteria:**
- [ ] GuidedIntentionCoach reduced to ~800 lines
- [ ] All UI functionality preserved
- [ ] No visual regressions
- [ ] Each component has tests

**Files to create:**
- `src/components/coach/WizardStepIndicator.jsx`
- `src/components/coach/TimeframeSelector.jsx`
- `src/components/coach/TopicSelector.jsx`
- `src/components/coach/DepthSelector.jsx`
- `src/components/coach/WizardFooter.jsx`
- `src/components/coach/PersonalizedSuggestionsPanel.jsx`
- `src/components/coach/QuestionReviewPanel.jsx`
- `src/components/coach/TemplatePanel.jsx`
- 8 corresponding test files

---

### ⭐ P1-5: Extract Hooks from GuidedIntentionCoach
**Effort:** 16 hours | **Risk:** High | **Impact:** Reduces component to ~200 lines

**Dependencies:** P0-5 (components extracted)

**Order of extraction:**
1. `useWizardNavigation.js` (2 hours) - Low risk
2. `useCoachPreferences.js` (2 hours) - Low risk
3. `useCoachTemplates.js` (3 hours) - Low risk
4. `useJournalIntegration.js` (3 hours) - Medium risk
5. `useQuestionConfiguration.js` (3 hours) - High risk
6. `useQuestionGeneration.js` (5 hours) - Very high risk

**Critical for Phase 6 (question generation):**
- Preserve deterministic seed behavior
- Maintain request cancellation logic
- Test all creative/guided mode transitions
- Verify API fallback behavior

**Tasks:**
1. Create hook files in `src/hooks/coach/`
2. Extract state and logic from component
3. Define hook interfaces
4. Write comprehensive tests (especially for async hooks)
5. Update `GuidedIntentionCoach.jsx` to compose hooks

**Success Criteria:**
- [ ] GuidedIntentionCoach reduced to ~200 lines
- [ ] All hooks independently tested
- [ ] No functional regressions
- [ ] Question generation works identically

**Files to create:**
- `src/hooks/coach/useWizardNavigation.js`
- `src/hooks/coach/useCoachPreferences.js`
- `src/hooks/coach/useCoachTemplates.js`
- `src/hooks/coach/useJournalIntegration.js`
- `src/hooks/coach/useQuestionConfiguration.js`
- `src/hooks/coach/useQuestionGeneration.js`
- 6 corresponding test files

---

### 📊 P2-5: Split JournalInsightsPanel
**Effort:** 4 hours | **Risk:** Low | **Impact:** Reduces 686-line component

**Tasks:**
1. Create `src/components/journal/` directory
2. Extract sub-components:
   - `JournalStats.jsx` (stats display)
   - `ArchetypeTimeline.jsx` (journey visualization)
   - `ThemeBreakdown.jsx` (theme charts)
   - `InsightsSummary.jsx` (insights text)
3. Update `JournalInsightsPanel.jsx` to compose
4. Test each sub-component

**Success Criteria:**
- [ ] JournalInsightsPanel reduced to <200 lines
- [ ] Each sub-component tested
- [ ] Visual appearance unchanged

**Files to create:**
- `src/components/journal/JournalStats.jsx`
- `src/components/journal/ArchetypeTimeline.jsx`
- `src/components/journal/ThemeBreakdown.jsx`
- `src/components/journal/InsightsSummary.jsx`

---

### 📊 P2-6: Refactor Journal Component
**Effort:** 4 hours | **Risk:** Medium | **Impact:** Reduces 457-line component

**Tasks:**
1. Extract sub-components:
   - `JournalFilters.jsx` (already exists - verify)
   - `JournalEntryCard.jsx` (single entry display)
   - `JournalEmptyState.jsx` (empty state UI)
2. Update `Journal.jsx` to compose
3. Test journal functionality

**Success Criteria:**
- [ ] Journal.jsx reduced to <250 lines
- [ ] All CRUD operations work
- [ ] Search and filters functional

**Files to create:**
- `src/components/journal/JournalEntryCard.jsx`
- `src/components/journal/JournalEmptyState.jsx`

---

## Phase 4: Testing & Quality
**Duration:** 1 sprint (2 weeks)
**Total Effort:** 20-25 hours

### ⭐ P1-6: Test Major Components
**Effort:** 12 hours | **Risk:** Low | **Impact:** Prevent regressions

**Priority components:**
1. `Card.jsx` (3 hours)
   - Reveal/unrevealed states
   - Keyboard navigation
   - Reflection input
   - Orientation display
2. `ReadingDisplay.jsx` (3 hours)
   - Narrative rendering
   - Narration controls
   - Vision validation panel
   - Journal save flow
3. `TarotReading.jsx` (4 hours)
   - Ritual flow
   - Spread selection
   - Card dealing
   - Reading generation
4. `QuestionInput.jsx` (2 hours)
   - Validation
   - Quality scoring
   - Example questions

**Success Criteria:**
- [ ] 70%+ code coverage on tested components
- [ ] All user interactions tested
- [ ] Accessibility tested (keyboard, screen reader)

**Files to create:**
- `tests/components/Card.test.jsx`
- `tests/components/ReadingDisplay.test.jsx`
- `tests/TarotReading.test.jsx`
- `tests/components/QuestionInput.test.jsx`

---

### 📊 P2-7: Add Integration Tests
**Effort:** 8 hours | **Risk:** Medium | **Impact:** Catch multi-component bugs

**Critical flows to test:**
1. Complete reading flow (E2E):
   - Select spread → Ritual → Draw → Reveal → Generate → Save
2. Journal flow:
   - View history → Search → Filter → Delete
3. Auth flow:
   - Register → Login → Authenticated reading → Logout
4. Vision research flow:
   - Upload image → Detect → Resolve conflicts → Generate with proof

**Tasks:**
1. Set up Playwright or Cypress
2. Write E2E tests for critical flows
3. Add CI/CD integration

**Success Criteria:**
- [ ] All 4 critical flows tested E2E
- [ ] Tests run in CI on every PR

**Files to create:**
- `tests/e2e/reading-flow.spec.js`
- `tests/e2e/journal-flow.spec.js`
- `tests/e2e/auth-flow.spec.js`
- `tests/e2e/vision-flow.spec.js`

---

### 🔧 P3-2: Performance Optimization
**Effort:** 6 hours | **Risk:** Low | **Impact:** Faster load, better UX

**Tasks:**
1. Lazy load heavy components:
   ```jsx
   const Journal = lazy(() => import('./components/Journal'));
   const GuidedIntentionCoach = lazy(() => import('./components/GuidedIntentionCoach'));
   const VisionValidationPanel = lazy(() => import('./components/VisionValidationPanel'));
   ```
2. Add code splitting for routes (if multi-page)
3. Optimize images:
   - Compress card images (use WebP with JPEG fallback)
   - Add lazy loading to card images
4. Profile with Lighthouse
5. Add performance budgets

**Success Criteria:**
- [ ] Initial bundle size <200KB (gzipped)
- [ ] Lighthouse performance score >90
- [ ] First Contentful Paint <1.5s

---

## Phase 5: Polish & Documentation
**Duration:** 1 sprint (2 weeks)
**Total Effort:** 15-20 hours

### 📊 P2-8: Consolidate localStorage Usage
**Effort:** 4 hours | **Risk:** Medium | **Impact:** Prevent quota issues

**Tasks:**
1. Audit all localStorage keys (currently 10+)
2. Migrate large data to IndexedDB:
   - Journal entries
   - Coach templates
   - Coach history
3. Add quota monitoring
4. Implement cache eviction strategy

**Success Criteria:**
- [ ] localStorage usage <1MB
- [ ] IndexedDB for large data
- [ ] Quota warnings if approaching limit

**Files to create:**
- `src/lib/storage.js` (abstraction layer)
- `src/lib/indexedDB.js` (IndexedDB wrapper)

---

### 🔧 P3-3: API Payload Validation
**Effort:** 4 hours | **Risk:** Low | **Impact:** Prevent API errors

**Tasks:**
1. Choose schema library (Zod recommended)
2. Define schemas for all API payloads:
   - `/api/tarot-reading` request
   - `/api/journal` POST
   - `/api/auth/*` requests
3. Validate before sending
4. Show user-friendly errors on validation failure

**Success Criteria:**
- [ ] All API requests validated
- [ ] Clear error messages on invalid data

**Files to create:**
- `src/lib/schemas.js`

---

### 🔧 P3-4: Accessibility Audit
**Effort:** 6 hours | **Risk:** Low | **Impact:** WCAG 2.1 AA compliance

**Tasks:**
1. Run axe-core audit
2. Fix identified issues:
   - Missing ARIA labels
   - Insufficient color contrast
   - Keyboard navigation gaps
   - Focus management issues
3. Add skip links
4. Test with screen reader (NVDA/VoiceOver)

**Success Criteria:**
- [ ] 0 critical axe-core violations
- [ ] WCAG 2.1 AA compliant
- [ ] Functional with keyboard only

---

### 🔧 P3-5: Component Documentation
**Effort:** 6 hours | **Risk:** None | **Impact:** Better DX

**Tasks:**
1. Set up Storybook (optional but recommended)
2. Document top 15 components:
   - Prop interfaces (JSDoc or TypeScript)
   - Usage examples
   - Visual variants
3. Create component catalog

**Success Criteria:**
- [ ] All public components documented
- [ ] Storybook running (optional)
- [ ] README updated with architecture overview

---

## Execution Strategy

### Recommended Order

**Sprint 1-2: Foundation**
- Week 1: P0-1 (Testing setup), P0-2 (Error boundaries), P1-1 (ReadingUIContext)
- Week 2: P1-2 (Test utilities), P2-1 (Extract coach utils), P2-2 (Optimize ReadingContext)

**Sprint 3-4: Context Refactor**
- Week 1: P0-3 (AudioContext), P1-3 (VisionContext)
- Week 2: P1-4 (GenerationContext), P0-4 (Finalize TarotState), P2-3 (Test hooks)

**Sprint 5-6: Component Refactor**
- Week 1: P0-5 (Extract coach components)
- Week 2: P1-5 (Extract coach hooks - high risk, allocate more time)

**Sprint 7-8: Quality & Polish**
- Week 1: P1-6 (Test major components), P2-5 (Split JournalInsightsPanel)
- Week 2: P2-7 (Integration tests), P3-2 (Performance), P2-8 (localStorage)

### Parallel Work Opportunities

**Can be done in parallel:**
- P1-2 (Test utilities) + P2-1 (Extract coach utils)
- P2-3 (Test hooks) + P2-4 (Refactor SpreadSelector)
- P2-5 (Split JournalInsightsPanel) + P2-6 (Refactor Journal)
- P3-3 (API validation) + P3-4 (A11y audit) + P3-5 (Documentation)

**Must be sequential:**
- P0-1 (Testing) → everything else (dependency)
- P1-1 (ReadingUIContext) → P0-3 (AudioContext) → P1-3 (VisionContext) → P1-4 (GenerationContext) → P0-4 (Finalize)
- P2-1 (Extract utils) → P0-5 (Extract components) → P1-5 (Extract hooks)

---

## Risk Management

### High-Risk Items

**P1-4 (ReadingGenerationContext) - Context extraction with complex dependencies**
- **Mitigation:** Comprehensive integration tests before/after
- **Rollback:** Feature flag to toggle old/new context
- **Timeline buffer:** Add 50% more time than estimated

**P1-5 (Extract hooks from GuidedIntentionCoach) - Async logic with race conditions**
- **Mitigation:** Extract in order (simple → complex)
- **Rollback:** Keep old component in `GuidedIntentionCoach.legacy.jsx`
- **Timeline buffer:** Allocate full sprint, don't rush

**P2-7 (Integration tests) - Flaky tests can block CI**
- **Mitigation:** Use Playwright's auto-wait and retry logic
- **Rollback:** Make E2E tests non-blocking initially
- **Timeline buffer:** Budget extra time for test stabilization

### Medium-Risk Items

**P0-3 (AudioControllerContext) - Circular dependency with TarotState**
- **Mitigation:** Use callback ref pattern (documented in deep dive)
- **Validation:** Test audio + ritual flow together

**P1-3 (VisionAnalysisContext) - Conflict detection depends on reading state**
- **Mitigation:** Pass reading as prop to conflict detector
- **Validation:** Test vision upload with various card combinations

### De-risking Strategies

1. **Feature Flags:** Use `localStorage.getItem('use-new-context')` to toggle implementations
2. **Incremental Rollout:** Deploy behind feature flag, enable for 10% → 50% → 100%
3. **Monitoring:** Add error tracking (Sentry?) to catch production issues
4. **Rollback Plan:** Keep old code for 1-2 sprints before deleting

---

## Success Metrics

### Code Quality Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Test Coverage** | 0% | 80% | Vitest coverage report |
| **Largest Component** | 1,215 lines | <250 lines | Line count |
| **Context Value Size** | 60+ properties | <15 per context | Manual count |
| **Re-renders per Action** | ~60 | <15 | React DevTools profiler |
| **Cyclomatic Complexity** | 73 (GuidedIntentionCoach) | <15 per function | ESLint complexity rule |

### Performance Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Initial Bundle Size** | ~300KB (est.) | <200KB gzipped | Webpack bundle analyzer |
| **Lighthouse Score** | Unknown | >90 | Lighthouse CI |
| **Time to Interactive** | Unknown | <2.5s | Lighthouse |
| **Re-render Frequency** | High (60+/action) | 60-75% reduction | React DevTools |

### Developer Experience Targets

- [ ] New developers can understand codebase in <2 days
- [ ] Can add new spread without touching >3 files
- [ ] Refactoring confidence (tests catch regressions)
- [ ] Clear component hierarchy (no 1000+ line files)

---

## Maintenance Plan

### After Refactoring

**Prevent regression:**
1. Enforce test coverage minimums (70%+) in CI
2. Add ESLint rule for max file length (500 lines)
3. Add ESLint rule for max function complexity (15)
4. Require tests for all new components/hooks

**Continuous improvement:**
1. Monthly performance audits (Lighthouse)
2. Quarterly dependency updates
3. Address technical debt in backlog grooming

---

## Appendix: Quick Reference

### File Structure After Refactoring

```
src/
├─ components/
│  ├─ coach/                    # GuidedIntentionCoach sub-components
│  │  ├─ WizardStepIndicator.jsx
│  │  ├─ TopicSelector.jsx
│  │  ├─ TimeframeSelector.jsx
│  │  ├─ DepthSelector.jsx
│  │  ├─ QuestionReviewPanel.jsx
│  │  ├─ PersonalizedSuggestionsPanel.jsx
│  │  ├─ TemplatePanel.jsx
│  │  └─ WizardFooter.jsx
│  ├─ journal/                  # Journal sub-components
│  │  ├─ JournalStats.jsx
│  │  ├─ ArchetypeTimeline.jsx
│  │  ├─ ThemeBreakdown.jsx
│  │  ├─ InsightsSummary.jsx
│  │  ├─ JournalEntryCard.jsx
│  │  └─ JournalEmptyState.jsx
│  ├─ ErrorBoundary.jsx
│  ├─ ReadingErrorBoundary.jsx
│  └─ JournalErrorBoundary.jsx
├─ contexts/
│  ├─ AudioControllerContext.jsx  # NEW
│  ├─ TarotStateContext.jsx       # Renamed from ReadingContext
│  ├─ VisionAnalysisContext.jsx   # NEW
│  ├─ ReadingGenerationContext.jsx # NEW
│  └─ ReadingUIContext.jsx        # NEW
├─ hooks/
│  ├─ coach/                    # GuidedIntentionCoach hooks
│  │  ├─ useWizardNavigation.js
│  │  ├─ useCoachPreferences.js
│  │  ├─ useCoachTemplates.js
│  │  ├─ useJournalIntegration.js
│  │  ├─ useQuestionConfiguration.js
│  │  └─ useQuestionGeneration.js
│  ├─ useTarotState.js
│  ├─ useJournal.js
│  ├─ useAudioController.js
│  └─ useVisionAnalysis.js
├─ lib/
│  ├─ intentionCoachUtils.js    # NEW
│  ├─ storage.js                # NEW (localStorage abstraction)
│  ├─ indexedDB.js              # NEW
│  └─ schemas.js                # NEW (API validation)
└─ ...

tests/
├─ components/
│  ├─ coach/                    # 8 test files
│  ├─ journal/                  # 6 test files
│  ├─ Card.test.jsx
│  ├─ ReadingDisplay.test.jsx
│  └─ QuestionInput.test.jsx
├─ contexts/
│  ├─ AudioControllerContext.test.jsx
│  ├─ TarotStateContext.test.jsx
│  ├─ VisionAnalysisContext.test.jsx
│  ├─ ReadingGenerationContext.test.jsx
│  └─ ReadingUIContext.test.jsx
├─ hooks/
│  ├─ coach/                    # 6 test files
│  ├─ useTarotState.test.js
│  ├─ useJournal.test.js
│  ├─ useAudioController.test.js
│  └─ useVisionAnalysis.test.js
├─ lib/
│  ├─ deck.test.js
│  ├─ formatting.test.js
│  └─ intentionCoachUtils.test.js
├─ e2e/
│  ├─ reading-flow.spec.js
│  ├─ journal-flow.spec.js
│  ├─ auth-flow.spec.js
│  └─ vision-flow.spec.js
├─ setup.js
└─ App.test.jsx
```

### Estimated Timeline (Gantt-style)

```
Sprint 1 [████████████████] P0-1, P0-2, P1-1, P2-2
Sprint 2 [████████████████] P1-2, P2-1, P2-4
Sprint 3 [████████████████] P0-3, P1-3
Sprint 4 [████████████████] P1-4, P0-4, P2-3
Sprint 5 [████████████████] P0-5
Sprint 6 [████████████████] P1-5 (high risk - needs focus)
Sprint 7 [████████████████] P1-6, P2-5, P2-6
Sprint 8 [████████████████] P2-7, P3-2, P2-8, P3-3, P3-4, P3-5
```

### Total Effort Summary

| Phase | Duration | Effort | Priority Breakdown |
|-------|----------|--------|-------------------|
| Phase 1: Quick Wins | 2 sprints | 30-35h | 2×P0, 2×P1, 2×P2, 1×P3 |
| Phase 2: Contexts | 2 sprints | 35-40h | 2×P0, 2×P1, 2×P2 |
| Phase 3: Components | 2 sprints | 40-50h | 1×P0, 1×P1, 2×P2 |
| Phase 4: Testing | 1 sprint | 20-25h | 1×P1, 1×P2, 1×P3 |
| Phase 5: Polish | 1 sprint | 15-20h | 2×P2, 3×P3 |
| **Total** | **8 sprints** | **140-170h** | **17-21 days** |

---

**End of Refactoring Roadmap**

For questions or clarifications, refer to the deep dive analyses in the discovery phase documentation.
