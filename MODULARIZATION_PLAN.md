# Hooks & Component Modularization Plan

## Executive Summary

This plan provides a **complete mapping of all 52 components** against all 12 custom hooks and 3 contexts. It identifies which hooks are currently used, which should be added, and provides a prioritized implementation roadmap for improving code organization, testability, and mobile UX.

---

## Complete Hook-Component Matrix

### Legend
- ✅ = Currently using
- 🔶 = Should add (high priority)
- 🔷 = Could benefit (medium priority)
- ⬜ = Not applicable
- Contexts: `Auth` = AuthContext, `Pref` = PreferencesContext, `Read` = ReadingContext

---

### Core Reading Experience Components

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | useModalA11y | useFeatureFlags | useSaveReading | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|--------------|-----------------|----------------|----------|-------|
| **TarotReading.jsx** | 706 | ✅ | ✅ | 🔶 | ⬜ | 🔷 | ✅ | Pref, Read | Main orchestrator - add landscape for layout switching |
| **ReadingDisplay.jsx** | 470 | 🔶 | ✅ | 🔶 | ⬜ | ✅ | ✅ | Pref, Read, Auth | Heavy component - needs landscape for narrative layout |
| **ReadingGrid.jsx** | 420 | ✅ | ✅ | 🔶 | ⬜ | ⬜ | ⬜ | ⬜ | Grid should adapt columns in landscape |
| **Card.jsx** | 475 | ✅ | ✅ | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | Could reduce card size in cramped landscape |
| **ReadingPreparation.jsx** | ~200 | ⬜ | 🔷 | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | Props-driven, but could use responsive for tab sizing |
| **StreamingNarrative.jsx** | ~150 | ✅ | ✅ | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | Could use landscape for side-by-side layout |
| **SpreadPatterns.jsx** | ~300 | 🔷 | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Props-driven, could animate pattern reveals |

### Spread & Deck Selection

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | useModalA11y | useFeatureFlags | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|--------------|-----------------|----------|-------|
| **SpreadSelector.jsx** | 424 | ✅ | 🔶 | 🔶 | ⬜ | ⬜ | ⬜ | Needs responsive for compact thumbnails |
| **SpreadPatternThumbnail.jsx** | ~100 | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | SVG animations respect reduced motion |
| **SpreadTable.jsx** | ~100 | ✅ | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | Table might need horizontal scroll on small |
| **DeckSelector.jsx** | ~200 | ✅ | 🔷 | 🔷 | ⬜ | ⬜ | ⬜ | Deck cards should shrink in landscape |
| **DeckPile.jsx** | ~150 | ✅ | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | Pile animations respect reduced motion |
| **DeckRitual.jsx** | 450 | ✅ | 🔷 | 🔶 | ⬜ | ⬜ | ⬜ | Ritual UI cramped in landscape - needs adaptation |

### Modal & Overlay Components

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | useModalA11y | useBodyScrollLock | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|--------------|-------------------|----------|-------|
| **MobileSettingsDrawer.jsx** | ~150 | 🔷 | ⬜ | 🔷 | ✅ | (via a11y) | ⬜ | Already uses modal a11y |
| **PhotoInputModal.jsx** | ~200 | 🔷 | 🔷 | 🔷 | ✅ | (via a11y) | ⬜ | Modal with camera - landscape important |
| **CardModal.jsx** | ~150 | 🔷 | 🔷 | 🔷 | ✅ | (via a11y) | ⬜ | Card detail modal |
| **ConfirmModal.jsx** | 132 | 🔷 | ⬜ | ⬜ | 🔶 | 🔶 | ⬜ | **Should use useModalA11y instead of manual impl** |
| **AuthModal.jsx** | 423 | 🔷 | 🔷 | ⬜ | 🔶 | ⬜ | Auth | **Should use useModalA11y for consistency** |
| **GuidedIntentionCoach.jsx** | 1406 | 🔶 | 🔶 | 🔶 | 🔶 | ⬜ | ⬜ | **Heavy component - needs all responsive hooks** |

### Navigation & Header

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|----------|-------|
| **Header.jsx** | ~200 | ✅ | 🔷 | 🔷 | ⬜ | Smooth scroll uses reduced motion |
| **GlobalNav.jsx** | 66 | 🔷 | 🔷 | ⬜ | ⬜ | Nav could be more compact on small |
| **StepProgress.jsx** | ~200 | 🔷 | 🔷 | 🔷 | ⬜ | Step indicators could adapt to landscape |
| **MobileActionBar.jsx** | ~200 | 🔷 | ⬜ | 🔶 | ⬜ | **Critical: Action bar cramped in landscape** |

### Journal & History

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | useJournal | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|------------|----------|-------|
| **Journal.jsx** | 519 | 🔷 | 🔷 | 🔷 | ✅ | Auth | Journal list could have landscape layout |
| **JournalEntryCard.jsx** | 416 | 🔷 | ✅ | 🔷 | ⬜ | ⬜ | Card layout could adapt |
| **JournalInsightsPanel.jsx** | 736 | 🔷 | 🔶 | 🔶 | ⬜ | ⬜ | **Heavy analytics - needs responsive** |
| **JournalFilters.jsx** | ~100 | ⬜ | 🔷 | ⬜ | ⬜ | ⬜ | Filter UI could collapse on small |
| **ArchetypeJourney.jsx** | ~200 | 🔷 | 🔷 | ⬜ | ⬜ | Auth | Journey visualization |
| **ArchetypeJourneySection.jsx** | ~150 | 🔷 | ⬜ | ⬜ | ⬜ | ⬜ | Section component |

### Settings & Controls

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|----------|-------|
| **AudioControls.jsx** | ~150 | ⬜ | 🔷 | ⬜ | Pref | Could use responsive for layout |
| **HumeAudioControls.jsx** | ~150 | ⬜ | 🔷 | ⬜ | ⬜ | Standalone Hume controls |
| **ExperienceSettings.jsx** | ~200 | ⬜ | 🔷 | ⬜ | Pref | Settings panel |
| **RitualControls.jsx** | ~150 | 🔷 | 🔷 | 🔷 | Pref | Knock/cut controls - landscape adaptation |
| **InteractiveCardOverlay.jsx** | ~100 | ✅ | ⬜ | ⬜ | ⬜ | Overlay animations |

### Input & Forms

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | Contexts | Notes |
|-----------|-------|------------------|----------------|--------------|----------|-------|
| **QuestionInput.jsx** | ~150 | ⬜ | 🔷 | 🔷 | ⬜ | Input could expand in landscape |
| **FeedbackPanel.jsx** | ~200 | ⬜ | 🔷 | ⬜ | ⬜ | Rating UI could adapt |
| **CoachSuggestion.jsx** | ~100 | 🔷 | ⬜ | ⬜ | ⬜ | Suggestion chips - animation |
| **SavedIntentionsList.jsx** | ~100 | 🔷 | ⬜ | ⬜ | ⬜ | List animations |

### Vision Research (Feature-Flagged)

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | useFeatureFlags | useVisionValidation | Notes |
|-----------|-------|------------------|----------------|--------------|-----------------|---------------------|-------|
| **VisionValidationPanel.jsx** | ~200 | 🔷 | 🔷 | 🔷 | 🔶 | ✅ | Should check feature flag directly |
| **VisionHeatmapOverlay.jsx** | ~100 | 🔷 | ⬜ | ⬜ | 🔶 | ⬜ | Needs feature gate |
| **CardSymbolInsights.jsx** | ~150 | 🔷 | 🔷 | ⬜ | 🔶 | ⬜ | Needs feature gate |
| **CameraCapture.jsx** | ~150 | ⬜ | 🔷 | 🔶 | ⬜ | ⬜ | **Camera UI critical in landscape** |

### Shared/Collaborative

| Component | Lines | useReducedMotion | useSmallScreen | useLandscape | useModalA11y | Notes |
|-----------|-------|------------------|----------------|--------------|--------------|-------|
| **SharedSpreadView.jsx** | ~200 | 🔷 | 🔷 | 🔷 | ⬜ | Shared view should be responsive |
| **CollaborativeNotesPanel.jsx** | ~200 | 🔷 | 🔷 | ⬜ | ⬜ | Notes panel |

### Utility Components (No Hooks Needed)

| Component | Lines | Notes |
|-----------|-------|-------|
| **UserMenu.jsx** | ~50 | Auth context only - appropriate |
| **Tooltip.jsx** | ~150 | Self-contained positioning logic |
| **MarkdownRenderer.jsx** | ~50 | Pure rendering |
| **ImagePreview.jsx** | ~100 | Pure preview |
| **Icon.jsx** | ~50 | Pure icon wrapper |
| **TableuLogo.jsx** | ~50 | Pure SVG |
| **HelperToggle.jsx** | ~50 | Simple toggle |
| **GlowToggle.jsx** | ~50 | Simple toggle |
| **CarouselDots.jsx** | ~50 | Simple indicator |
| **MobileInfoSection.jsx** | ~100 | Static info |

---

## Priority Summary

### 🔴 Critical (Immediate Impact on Mobile UX)

| Component | Missing Hook | Reason |
|-----------|--------------|--------|
| **GuidedIntentionCoach.jsx** | useModalA11y, useResponsive | 1406 lines, fullscreen modal, no a11y hook |
| **MobileActionBar.jsx** | useLandscape | Action bar is cramped in landscape mode |
| **ConfirmModal.jsx** | useModalA11y | Duplicates modal a11y logic manually |
| **AuthModal.jsx** | useModalA11y | Should use shared modal accessibility |
| **JournalInsightsPanel.jsx** | useSmallScreen, useLandscape | Heavy analytics panel, no responsive |
| **CameraCapture.jsx** | useLandscape | Camera viewfinder critical in landscape |

### 🟠 High Priority (Consistency & UX)

| Component | Missing Hook | Reason |
|-----------|--------------|--------|
| **ReadingDisplay.jsx** | useReducedMotion, useLandscape | Heavy component, narrative could side-by-side |
| **SpreadSelector.jsx** | useSmallScreen, useLandscape | Thumbnails should shrink |
| **DeckRitual.jsx** | useLandscape | Ritual UI needs landscape adaptation |
| **ReadingGrid.jsx** | useLandscape | Grid columns should adapt |

### 🟡 Medium Priority (Nice to Have)

| Component | Missing Hook | Reason |
|-----------|--------------|--------|
| Vision components | useFeatureFlags | Should gate themselves |
| Journal components | useReducedMotion | List animations |
| Various modals | useReducedMotion | Transition animations |

---

## Current State Analysis

### Hook Inventory (1,794 lines total)

| Hook | Lines | Category | Current Usage |
|------|-------|----------|---------------|
| `useJournal` | 404 | Data/Persistence | Journal component only |
| `useVisionAnalysis` | 274 | Feature | ReadingContext aggregation |
| `useTarotState` | 272 | Core State | ReadingContext aggregation |
| `useAudioController` | 247 | Core State | ReadingContext aggregation |
| `useModalA11y` | 183 | Modal/A11y | 3 modal components |
| `useBodyScrollLock` | 76 | Modal/A11y | Used by useModalA11y |
| `useSaveReading` | 66 | Data/Persistence | TarotReading, ReadingDisplay |
| `useReducedMotion` | 48 | Responsive | 10+ components |
| `useLandscape` | 45 | Responsive | **UNDERUTILIZED - 0 components!** |
| `useFeatureFlags` | 37 | Feature | ReadingDisplay, VisionPanel |
| `useSmallScreen` | 36 | Responsive | 8+ components |

### Architecture Strengths

1. **Context Aggregation Pattern** - ReadingContext successfully aggregates 3 hooks into unified API
2. **Single Responsibility** - Each hook has clear, focused purpose
3. **SSR Safety** - All hooks check `typeof window !== 'undefined'`
4. **Accessibility Built-In** - useModalA11y provides comprehensive a11y

### Pain Points Identified

1. **useTarotState is monolithic** (272 lines) - Manages 5+ distinct concerns
2. **Responsive hooks scattered** - Same 3 hooks imported repeatedly across 10+ components
3. **useLandscape underutilized** - Only defined, not actively used for mobile landscape optimization
4. **No hook testing infrastructure** - Hooks are only tested indirectly via components
5. **ReadingContext is oversized** (559 lines) - Combines too many responsibilities

### Usage Statistics

| Hook | Components Using | Should Use | Gap |
|------|------------------|------------|-----|
| `useReducedMotion` | 11 | 25+ | +14 |
| `useSmallScreen` | 6 | 18+ | +12 |
| `useLandscape` | **0** | **15+** | **+15** |
| `useModalA11y` | 3 | 6 | +3 |
| `useFeatureFlags` | 2 | 5 | +3 |

### Context Usage

| Context | Components Using | Correct Usage |
|---------|------------------|---------------|
| `PreferencesContext` | 5 | ✅ Appropriate |
| `ReadingContext` | 2 | ✅ Appropriate (consumed by TarotReading children) |
| `AuthContext` | 5 | ✅ Appropriate |

---

## Proposed Modularization

### Phase 1: Hook Directory Reorganization

Reorganize `src/hooks/` into categorical subdirectories:

```
src/hooks/
├── index.js                    # Re-export all hooks
├── core/                       # Core reading state
│   ├── useTarotState.js
│   ├── useRitualState.js       # NEW: Extract from useTarotState
│   └── useCardReveal.js        # NEW: Extract from useTarotState
├── audio/                      # Audio/TTS management
│   └── useAudioController.js
├── responsive/                 # Device/preference detection
│   ├── useSmallScreen.js
│   ├── useLandscape.js
│   ├── useReducedMotion.js
│   └── useResponsive.js        # NEW: Composite hook
├── modal/                      # Modal utilities
│   ├── useModalA11y.js
│   └── useBodyScrollLock.js
├── data/                       # Persistence layer
│   ├── useJournal.js
│   └── useSaveReading.js
└── feature/                    # Feature-specific
    ├── useFeatureFlags.js
    └── useVisionAnalysis.js
```

### Phase 2: Extract Sub-Hooks from useTarotState

Current `useTarotState` manages:
- Spread selection
- Ritual state (knocks, cuts, seed)
- Card reveal state
- Shuffle logic
- Deck announcements

**Proposed Split:**

```javascript
// src/hooks/core/useRitualState.js
export function useRitualState(deckSize) {
  const [hasKnocked, setHasKnocked] = useState(false);
  const [knockCount, setKnockCount] = useState(0);
  const [hasCut, setHasCut] = useState(false);
  const [cutIndex, setCutIndex] = useState(Math.floor(deckSize / 2));
  const knockTimesRef = useRef([]);

  const handleKnock = useCallback(() => { /* ... */ }, [hasKnocked]);
  const applyCut = useCallback(() => { /* ... */ }, []);
  const resetRitual = useCallback(() => { /* ... */ }, []);

  return {
    hasKnocked, knockCount, hasCut, cutIndex, knockTimesRef,
    handleKnock, applyCut, setCutIndex, resetRitual
  };
}

// src/hooks/core/useCardReveal.js
export function useCardReveal(reading, speak) {
  const [revealedCards, setRevealedCards] = useState(new Set());
  const [dealIndex, setDealIndex] = useState(0);

  const dealNext = useCallback(() => { /* ... */ }, [reading, dealIndex]);
  const revealCard = useCallback((index) => { /* ... */ }, [reading, revealedCards]);
  const revealAll = useCallback(() => { /* ... */ }, [reading]);
  const resetReveal = useCallback(() => { /* ... */ }, []);

  return {
    revealedCards, dealIndex,
    dealNext, revealCard, revealAll, resetReveal
  };
}

// src/hooks/core/useTarotState.js (simplified)
export function useTarotState(speak) {
  const { deckSize } = usePreferences();
  const ritual = useRitualState(deckSize);
  const reveal = useCardReveal(reading, speak);

  // Spread selection and shuffle logic remain here
  // ...

  return {
    ...ritual,
    ...reveal,
    // spread and shuffle exports
  };
}
```

**Benefits:**
- Each sub-hook is independently testable
- Ritual and reveal logic can be reused in other contexts
- Reduces cognitive load when debugging

### Phase 3: Create Composite Responsive Hook

Currently, components repeatedly import 3 hooks:
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';
```

**Proposed Composite:**

```javascript
// src/hooks/responsive/useResponsive.js
import { useSmallScreen } from './useSmallScreen';
import { useLandscape } from './useLandscape';
import { useReducedMotion } from './useReducedMotion';

export function useResponsive(options = {}) {
  const {
    smallBreakpoint = 640,
    mediumBreakpoint = 768,
    landscapeMaxHeight = 500
  } = options;

  const isSmallScreen = useSmallScreen(smallBreakpoint);
  const isMediumScreen = useSmallScreen(mediumBreakpoint);
  const isLandscape = useLandscape(landscapeMaxHeight);
  const prefersReducedMotion = useReducedMotion();

  // Derived states for common patterns
  const isMobilePortrait = isSmallScreen && !isLandscape;
  const isMobileLandscape = isSmallScreen && isLandscape;
  const isCrampedLandscape = isLandscape && !isSmallScreen; // Tablet landscape

  // Animation helpers
  const animationDuration = prefersReducedMotion ? 0 : undefined;
  const shouldReduceAnimations = prefersReducedMotion || isCrampedLandscape;

  return {
    // Raw values
    isSmallScreen,
    isMediumScreen,
    isLandscape,
    prefersReducedMotion,

    // Derived helpers
    isMobilePortrait,
    isMobileLandscape,
    isCrampedLandscape,
    shouldReduceAnimations,
    animationDuration,

    // Breakpoint helpers
    breakpoint: isSmallScreen ? 'sm' : isMediumScreen ? 'md' : 'lg'
  };
}
```

**Usage:**
```javascript
// Before: 3 imports, 3 hook calls
const isSmallScreen = useSmallScreen();
const prefersReducedMotion = useReducedMotion();
const isLandscape = useLandscape();

// After: 1 import, 1 hook call with derived values
const { isSmallScreen, prefersReducedMotion, isMobileLandscape } = useResponsive();
```

### Phase 4: Component-Hook Mapping Matrix

Map which hooks each component should use:

| Component | useResponsive | useModalA11y | useFeatureFlags | Notes |
|-----------|--------------|--------------|-----------------|-------|
| **TarotReading.jsx** | ✅ | - | - | Main orchestrator |
| **Card.jsx** | ✅ | - | - | Animation timing |
| **ReadingGrid.jsx** | ✅ | - | - | Layout adaptation |
| **ReadingDisplay.jsx** | ✅ | - | ✅ | Vision feature gate |
| **MobileSettingsDrawer.jsx** | ✅ | ✅ | - | Modal + responsive |
| **PhotoInputModal.jsx** | - | ✅ | ✅ | Modal + vision gate |
| **CardModal.jsx** | - | ✅ | - | Modal only |
| **SpreadSelector.jsx** | ✅ | - | - | Touch optimization |
| **GuidedIntentionCoach.jsx** | ✅ | ✅ | - | Fullscreen modal |
| **StreamingNarrative.jsx** | ✅ | - | - | Scroll behavior |
| **VisionValidationPanel.jsx** | - | - | ✅ | Feature gated |

### Phase 5: Mobile UX Enhancements Using useLandscape

The `useLandscape` hook is defined but underutilized. Apply it to improve cramped landscape experience:

```javascript
// src/components/ReadingGrid.jsx
export function ReadingGrid({ cards, onReveal, ...props }) {
  const { isLandscape, isCrampedLandscape } = useResponsive();

  // Adapt grid for landscape mobile
  const gridColumns = isCrampedLandscape
    ? Math.min(cards.length, 5)  // Horizontal scroll for large spreads
    : isLandscape
      ? Math.min(cards.length, 4)
      : Math.min(cards.length, 3);

  const cardScale = isCrampedLandscape ? 0.7 : 1;

  return (
    <div
      className={cn(
        'grid gap-4',
        isCrampedLandscape && 'overflow-x-auto py-2'
      )}
      style={{
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
        '--card-scale': cardScale
      }}
    >
      {/* ... */}
    </div>
  );
}
```

**Components to Update:**

1. **ReadingGrid** - Horizontal scroll in landscape, smaller cards
2. **SpreadSelector** - Compact thumbnails in landscape
3. **Card** - Reduce padding, smaller touch targets (but still accessible)
4. **ReadingDisplay** - Side-by-side narrative in landscape
5. **MobileActionBar** - Thinner bar, icon-only in landscape

### Phase 6: Add Hook Testing Infrastructure

Create test utilities for hooks:

```javascript
// tests/hooks/setup.js
import { renderHook, act } from '@testing-library/react-hooks';
import { PreferencesProvider } from '../../src/contexts/PreferencesContext';
import { ReadingProvider } from '../../src/contexts/ReadingContext';

export function renderWithProviders(hook, options = {}) {
  const wrapper = ({ children }) => (
    <PreferencesProvider>
      <ReadingProvider>
        {children}
      </ReadingProvider>
    </PreferencesProvider>
  );

  return renderHook(hook, { wrapper, ...options });
}

// tests/hooks/useRitualState.test.js
import { renderWithProviders } from './setup';
import { useRitualState } from '../../src/hooks/core/useRitualState';

describe('useRitualState', () => {
  it('tracks knock count up to 3', () => {
    const { result } = renderWithProviders(() => useRitualState(78));

    act(() => result.current.handleKnock());
    expect(result.current.knockCount).toBe(1);

    act(() => result.current.handleKnock());
    expect(result.current.knockCount).toBe(2);

    act(() => result.current.handleKnock());
    expect(result.current.knockCount).toBe(3);
    expect(result.current.hasKnocked).toBe(true);
  });

  it('resets cut index when deck size changes', () => {
    // ...
  });
});
```

---

## Implementation Roadmap

### Sprint 1: Foundation (Low Risk)
- [ ] Create `src/hooks/index.js` barrel export
- [ ] Create `useResponsive` composite hook
- [ ] Update imports in 3-5 components to use `useResponsive`
- [ ] Add hook testing setup

### Sprint 2: Extraction (Medium Risk)
- [ ] Extract `useRitualState` from `useTarotState`
- [ ] Extract `useCardReveal` from `useTarotState`
- [ ] Update ReadingContext to use new hooks
- [ ] Add tests for extracted hooks

### Sprint 3: Mobile UX (Low Risk)
- [ ] Apply `useLandscape` to ReadingGrid
- [ ] Apply landscape optimization to SpreadSelector
- [ ] Update MobileActionBar for landscape
- [ ] Test on actual mobile devices

### Sprint 4: Directory Reorganization (Low Risk)
- [ ] Move hooks to categorical subdirectories
- [ ] Update all imports
- [ ] Update documentation

---

## Component-Specific Recommendations

### High-Priority Updates

#### 1. ReadingDisplay.jsx (470 lines)
**Current:** Uses 6 hooks/contexts directly
**Recommendation:**
- Use `useResponsive()` instead of individual responsive hooks
- Extract narrative rendering into `<NarrativeSection />` component
- Extract card grid into separate concern

#### 2. GuidedIntentionCoach.jsx (1,406 lines)
**Current:** Monolithic component with streaming, modal, and form logic
**Recommendation:**
- Extract `useIntentionStreaming` hook for streaming logic
- Use `useModalA11y` for fullscreen behavior
- Split into `<CoachModal />`, `<CoachForm />`, `<CoachSuggestions />`

#### 3. Card.jsx (475 lines)
**Current:** Uses `useReducedMotion`, `useSmallScreen`
**Recommendation:**
- Use `useResponsive()` for unified responsive logic
- Extract animation logic into `useCardAnimation` hook
- Use `shouldReduceAnimations` from useResponsive

#### 4. TarotReading.jsx (706 lines)
**Current:** Main orchestrator, imports many hooks
**Recommendation:**
- Use `useResponsive()` to simplify responsive logic
- Extract step navigation into `useStepNavigation` hook
- Consider splitting into `<DesktopLayout />` and `<MobileLayout />`

### Medium-Priority Updates

#### 5. Journal.jsx (519 lines)
**Current:** Only component using `useJournal`
**Recommendation:**
- Keep useJournal dedicated to Journal
- Extract search/filter logic into `useJournalSearch`
- Use `useResponsive()` for mobile list view

#### 6. SpreadSelector.jsx (424 lines)
**Current:** Uses `useReading`, `usePreferences`
**Recommendation:**
- Add `useResponsive()` for touch optimization
- Reduce thumbnail size in landscape mode
- Consider `useSpreadSelection` hook for selection logic

---

## Metrics for Success

| Metric | Current | Target |
|--------|---------|--------|
| Hook lines (useTarotState) | 272 | < 150 |
| Responsive hook imports/component | 1-3 | 1 |
| Components using useLandscape | 0 | 5+ |
| Hook test coverage | 0% | 80%+ |
| ReadingContext lines | 559 | < 400 |

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Hook extraction | Medium | Comprehensive tests before/after |
| Directory reorganization | Low | Staged imports, no behavior change |
| useResponsive composite | Low | Individual hooks still exported |
| Mobile landscape updates | Low | Feature flag for rollout |

---

## Appendix: Full Hook Dependencies Graph

```
ReadingContext
├── useTarotState
│   ├── usePreferences (context)
│   └── [proposed] useRitualState
│   └── [proposed] useCardReveal
├── useAudioController
│   └── usePreferences (context)
└── useVisionAnalysis
    └── usePreferences (context)
    └── useFeatureFlags

TarotReading.jsx
├── usePreferences (context)
├── useReading (context)
├── useSaveReading
│   └── useReading (context)
│   └── useJournal
└── [proposed] useResponsive
    ├── useSmallScreen
    ├── useLandscape
    └── useReducedMotion

Modal Components
└── useModalA11y
    └── useBodyScrollLock
```

---

*Plan created: 2025-11-26*
*Based on codebase analysis of 52 components, 3 contexts, and 12 hooks*
