# Unified Journey Implementation Plan

> Implementation roadmap for consolidating Journal Insights and Archetype Journey per `unified-journey-design.md`.

## Current State vs Target

| Layer | Current | Target |
|-------|---------|--------|
| **UI** | `JournalInsightsPanel` + `ArchetypeJourneySection` as separate accordions | Single `ReadingJourney` component (hero + tabs/bento) |
| **Data** | In-component D1 fetch (ignores filters) + client stats (separate) | `useJourneyData` hook with filter-aware data source selection |
| **Narrative** | `JourneyStoryPanel` + `shared/journal/summary.js` heuristics | `generateSeasonNarrative()` + `computeEnhancedCoachSuggestion()` |
| **Mobile** | 3 accordions in `Journal.jsx:657-686` | Bottom sheet with tabs |
| **Desktop** | Stacked panels in right rail | Bento grid or tabbed sidebar |

---

## Phase 1: Data Layer Foundation

### 1.1 Create Data Utilities in `src/lib/journalInsights.js`

**Files to modify:** `src/lib/journalInsights.js`

```javascript
// New exports needed:

export function computeMajorArcanaMapFromEntries(entries) {
  // Extract all cards from entries, filter to Major Arcana (0-21)
  // Return: Array<{ cardNumber: number; name: string; count: number }>
}

export function computeStreakFromEntries(entries) {
  // Compute consecutive days with readings
  // Return: number (current streak in days)
}

export function computeBadgesFromEntries(entries) {
  // Find cards appearing 3+ times in the entry set
  // Return: Array<{ card_name: string; count: number; earned_at: number }>
}

export function generateJourneyStory(entries, options) {
  // Generate prose narrative from entries (requires 3+ entries)
  // Return: string | null
}

// Already exists but needs export:
export { computePreferenceDrift } from './journalInsights';
```

**Tasks:**
- [ ] Implement `computeMajorArcanaMapFromEntries()`
- [ ] Implement `computeStreakFromEntries()`
- [ ] Implement `computeBadgesFromEntries()`
- [ ] Implement `generateJourneyStory()` (or stub returning null initially)
- [ ] Export `computePreferenceDrift()` (currently internal to JournalInsightsPanel)
- [ ] Add unit tests in `tests/journalInsights.test.mjs`

### 1.2 Create Safe Storage Utilities

**Files to create:** `src/lib/safeStorage.js`

```javascript
// SSR-safe localStorage abstraction
export const safeStorage = {
  isAvailable: typeof window !== 'undefined' && window.localStorage,
  getItem(key) { ... },
  setItem(key, value) { ... },
};

// Cache key builder
export function buildSeasonKey({ userId, filtersActive, filteredEntries, seasonWindow, locale, timezone }) { ... }

// Filter hash computation
export function computeFilterHash(filteredEntries) { ... }

// Cache helpers with TTL
export function getCachedNarrative(userId, seasonKey) { ... }
export function setCachedNarrative(userId, seasonKey, narrative) { ... }
export function invalidateNarrativeCache(userId) { ... }
```

**Tasks:**
- [ ] Create `src/lib/safeStorage.js`
- [ ] Implement `safeStorage` abstraction with try/catch guards
- [ ] Implement `buildSeasonKey()` per spec
- [ ] Implement cache get/set/invalidate with 24h TTL
- [ ] Add logout hook to clear cache (integrate with auth)
- [ ] Unit tests for SSR safety and cache operations

### 1.3 Create `useJourneyData` Hook

**Files to create:** `src/hooks/useJourneyData.js`

This is the core hook from the design doc. Key responsibilities:

1. Accept `entries`, `filteredEntries`, `filtersActive`, `isAuthenticated`, `userId`, `seasonWindow`, `locale`, `timezone`
2. Compute `shouldFetchServerData` based on auth + filter state
3. Call `useArchetypeJourney()` only when needed (gated fetch)
4. Fall back to client-side computation when filters active
5. Merge and normalize data to unified `CardFrequency` shape
6. Generate `seasonNarrative` and `coachSuggestion`
7. Expose loading/backfill state

**Tasks:**
- [ ] Create `src/hooks/useJourneyData.js`
- [ ] Implement filter detection (explicit prop + ID comparison fallback)
- [ ] Implement `useServerData` gating logic
- [ ] Implement data normalization (`normalizeD1Card`, `normalizeClientCard`)
- [ ] Implement `cardFrequency` merge with filter-aware source selection
- [ ] Implement `majorArcanaMap` with filtered fallback
- [ ] Implement `badges` with filtered fallback (virtual badges)
- [ ] Implement `currentStreak` with filtered fallback
- [ ] Implement `cadence` merge
- [ ] Implement `seasonNarrative` generation
- [ ] Implement `coachSuggestion` computation
- [ ] Wire up cache for unfiltered narratives
- [ ] Unit tests: server vs client fallback, filter detection, empty states

### 1.4 Refactor `useArchetypeJourney` Hook

**Files to modify:** `src/hooks/useArchetypeJourney.js` (or create if doesn't exist)

Currently, `ArchetypeJourneySection.jsx:189-365` fetches D1 data in-component. Extract to a hook that:

1. Accepts `userId` and `enabled` flag
2. Returns `{ topCards, badges, majorArcanaFrequency, trends, currentStreak, isLoading, hasBackfilled }`
3. Skips fetch when `enabled=false`

**Tasks:**
- [ ] Extract D1 fetch logic from `ArchetypeJourneySection.jsx` into `useArchetypeJourney.js`
- [ ] Add `enabled` parameter to gate network calls
- [ ] Return consistent shape matching `EMPTY_ARCHETYPE` fallback
- [ ] Ensure backfill detection works

---

## Phase 2: Narrative & Coach Logic

### 2.1 Implement Season Narrative Generator

**Files to modify:** `src/hooks/useJourneyData.js` or `src/lib/narrativeHelpers.js`

```javascript
function generateSeasonNarrative({
  topCard,
  topContext,
  topTheme,
  badges,
  totalReadings,
  seasonWindow,
  locale,
  timezone,
}) {
  // Format period from seasonWindow with locale/timezone
  // Build narrative string combining top card, theme, context
  // Return string
}
```

**Tasks:**
- [ ] Implement `generateSeasonNarrative()` with locale-aware date formatting
- [ ] Handle edge cases (no theme, no context, no badge)
- [ ] Unit tests for various data combinations

### 2.2 Implement Coach Suggestion Logic

**Files to modify:** `src/hooks/useJourneyData.js` or `src/lib/narrativeHelpers.js`

```javascript
function computeEnhancedCoachSuggestion({
  topCard,
  topContext,
  topTheme,
  badges, // pre-sorted by earned_at DESC
  preferenceDrift,
}) {
  // Priority: drift > badge card > theme > context > default
  // Return: { source, text, spread }
}
```

**Tasks:**
- [ ] Implement priority-based suggestion selection
- [ ] Ensure badge array is sorted before use
- [ ] Unit tests for each priority path

---

## Phase 3: UI Components

### 3.1 Create Component Structure

**Files to create:**

```
src/components/ReadingJourney/
├── index.jsx                    # Main container, responsive layout
├── JourneyBentoGrid.jsx         # Desktop full-page bento
├── JourneySidebar.jsx           # Desktop rail variant
├── JourneyMobileSheet.jsx       # Mobile bottom sheet
├── JourneyHeroCard.jsx          # Hero summary (mobile)
├── JourneyTabs.jsx              # Tab navigation
│
├── tabs/
│   ├── CardsTab.jsx             # Cards Calling You + Arcana map
│   ├── PatternsTab.jsx          # Context + themes + cadence
│   └── ExportTab.jsx            # Export + share
│
├── sections/
│   ├── SeasonSummary.jsx        # Narrative headline + chips
│   ├── AtAGlanceStats.jsx       # Stats row (2x2 or inline)
│   ├── CardsCallingYou.jsx      # Top cards with badges
│   ├── CardFrequencyTile.jsx    # Individual card row
│   ├── MajorArcanaMap.jsx       # Heatmap grid
│   ├── AchievementsRow.jsx      # Horizontal badge scroll
│   ├── ContextBreakdown.jsx     # Bars + timeline
│   ├── ThemeTags.jsx            # Theme chips
│   ├── CadenceChart.jsx         # Single 6-month sparkline
│   └── JourneyStory.jsx         # Prose narrative (hide when null)
│
├── actions/
│   ├── JourneyActions.jsx       # Action bar container
│   ├── ExportButtons.jsx        # PDF/MD/CSV/SVG
│   ├── ShareComposer.jsx        # Share link creation
│   └── ActiveLinks.jsx          # Manage existing links
│
└── shared/
    ├── BadgeIndicator.jsx       # Achievement badge chip
    ├── GrowthPrompt.jsx         # Expandable reflection prompt
    ├── TrendArrow.jsx           # ↑ ↓ → indicators
    └── CoachFAB.jsx             # Floating action button (mobile)
```

### 3.2 Implement Main Entry Point

**File:** `src/components/ReadingJourney/index.jsx`

```jsx
export function ReadingJourney({
  entries,
  filteredEntries,
  filtersActive,
  isAuthenticated,
  userId,
  variant, // 'sidebar' | 'mobile' | 'fullpage'
  seasonWindow,
  locale,
  timezone,
  onCreateShareLink,
  onStartReading,
}) {
  const journeyData = useJourneyData({
    entries,
    filteredEntries,
    filtersActive,
    isAuthenticated,
    userId,
    seasonWindow,
    locale,
    timezone,
  });

  if (variant === 'mobile') {
    return <JourneyMobileSheet {...journeyData} ... />;
  }
  if (variant === 'sidebar') {
    return <JourneySidebar {...journeyData} ... />;
  }
  return <JourneyBentoGrid {...journeyData} ... />;
}
```

**Tasks:**
- [ ] Create `ReadingJourney/index.jsx` with variant switching
- [ ] Wire up `useJourneyData` hook
- [ ] Pass data to variant components
- [ ] Handle loading/empty states

### 3.3 Implement Mobile Components

**Priority components for mobile:**

1. `JourneyHeroCard.jsx` - Featured top card + stats + coach CTA
2. `JourneyMobileSheet.jsx` - Bottom sheet with drag handle
3. `JourneyTabs.jsx` - Horizontal tab navigation with swipe

**Tasks:**
- [ ] Create `JourneyHeroCard` with top card, stat chips, coach suggestion
- [ ] Create `JourneyMobileSheet` with bottom sheet behavior (use existing patterns or `@radix-ui/react-dialog`)
- [ ] Create `JourneyTabs` with horizontal tabs and swipe navigation
- [ ] Create `CardsTab` pulling from existing ArchetypeJourneySection logic
- [ ] Create `PatternsTab` pulling from existing JournalInsightsPanel logic
- [ ] Create `ExportTab` extracting export/share from JournalInsightsPanel
- [ ] Add `CoachFAB` floating action button

### 3.4 Implement Desktop Components

**Priority components for desktop:**

1. `JourneySidebar.jsx` - Condensed view for right rail
2. `SeasonSummary.jsx` - Narrative card at top
3. Collapsible sections for Cards, Patterns, Actions

**Tasks:**
- [ ] Create `JourneySidebar` with collapsible sections
- [ ] Create `SeasonSummary` with narrative + chips + coach CTA
- [ ] Adapt existing section components for sidebar layout
- [ ] Add keyboard shortcuts (E, S, C, P, N, ?)

### 3.5 Implement Shared Sections

These can be reused across mobile and desktop:

- [ ] `CardsCallingYou` - Top cards list with inline badges
- [ ] `CardFrequencyTile` - Single card row with badge, count, trend
- [ ] `MajorArcanaMap` - Heatmap grid (horizontal scroll on mobile)
- [ ] `AchievementsRow` - Horizontal badge scroll
- [ ] `ContextBreakdown` - Context bars + timeline ribbon
- [ ] `ThemeTags` - Theme chips
- [ ] `CadenceChart` - Single sparkline (reuse existing)
- [ ] `GrowthPrompt` - Expandable prompt (not modal)

---

## Phase 4: Integration

### 4.1 Update Journal.jsx

**File:** `src/components/Journal.jsx`

Replace lines 594-688 (separate panels) with unified component:

```jsx
// Compute filtersActive from filter state
const filtersActive = Boolean(
  activeContext || activeSpread || activeDeck || activeTimeframe
);

// Desktop
<aside className="hidden lg:block lg:w-[380px]">
  <JournalFilters ... />
  <ReadingJourney
    entries={entries}
    filteredEntries={filteredEntries}
    filtersActive={filtersActive}
    isAuthenticated={isAuthenticated}
    userId={user?.id}
    variant="sidebar"
    onCreateShareLink={createShareLink}
    onStartReading={handleStartReading}
  />
</aside>

// Mobile - replace 3 accordions with single component
<div className="lg:hidden">
  <JournalFilters variant="compact" ... />
  <ReadingJourney
    entries={entries}
    filteredEntries={filteredEntries}
    filtersActive={filtersActive}
    isAuthenticated={isAuthenticated}
    userId={user?.id}
    variant="mobile"
    ...
  />
</div>
```

**Tasks:**
- [ ] Add `filtersActive` computation in Journal.jsx
- [ ] Replace desktop `JournalInsightsPanel` + `ArchetypeJourneySection` with `ReadingJourney`
- [ ] Replace mobile accordion sections with `ReadingJourney variant="mobile"`
- [ ] Remove `renderMobileAccordionSection` for insights/archetype
- [ ] Wire up `onStartReading` to navigate to reading flow with coach suggestion
- [ ] Test filter state propagation

### 4.2 Optional: Add `/journey` Route

**File:** `src/App.jsx` or routing config

If a full-page journey view is desired:

```jsx
<Route path="/journey" element={
  <JourneyPage /> // Uses ReadingJourney variant="fullpage"
} />
```

**Tasks:**
- [ ] Decide if `/journey` route is needed
- [ ] Create `JourneyPage.jsx` wrapper if yes
- [ ] Add route to app router
- [ ] Add navigation link from Journal

### 4.3 Deprecate Old Components

After unified component is stable:

- [ ] Mark `JournalInsightsPanel.jsx` as deprecated
- [ ] Mark `ArchetypeJourneySection.jsx` as deprecated
- [ ] Mark `JourneyStoryPanel.jsx` as deprecated
- [ ] Remove after validation period

---

## Phase 5: Testing

### 5.1 Unit Tests for Data Layer

**File:** `tests/useJourneyData.test.mjs`

```javascript
describe('useJourneyData', () => {
  describe('filter detection', () => {
    it('uses explicit filtersActive prop when provided');
    it('falls back to entry ID comparison');
    it('detects filters that keep same entry count');
  });

  describe('data source selection', () => {
    it('uses server data when authenticated and unfiltered');
    it('uses client data when filters active');
    it('uses client data for custom seasonWindow');
    it('gates fetch when shouldFetchServerData is false');
  });

  describe('card frequency', () => {
    it('normalizes D1 data shape');
    it('normalizes client data shape');
    it('enriches D1 data with client reversals');
  });

  describe('filtered fallbacks', () => {
    it('computes majorArcanaMap from entries when filtered');
    it('computes virtual badges from entries when filtered');
    it('computes streak from entries when filtered');
  });

  describe('empty states', () => {
    it('handles null entries');
    it('handles empty entries array');
    it('returns EMPTY_STATS fallback');
  });
});
```

**Tasks:**
- [ ] Create `tests/useJourneyData.test.mjs`
- [ ] Test filter detection logic
- [ ] Test data source selection
- [ ] Test data normalization
- [ ] Test filtered fallbacks
- [ ] Test empty/null handling

### 5.2 Unit Tests for Utilities

**File:** `tests/journalInsights.test.mjs` (extend existing)

- [ ] Test `computeMajorArcanaMapFromEntries()`
- [ ] Test `computeStreakFromEntries()`
- [ ] Test `computeBadgesFromEntries()`
- [ ] Test `generateJourneyStory()` (when implemented)

**File:** `tests/safeStorage.test.mjs`

- [ ] Test SSR safety (mock `window` undefined)
- [ ] Test cache TTL expiration
- [ ] Test cache invalidation
- [ ] Test `buildSeasonKey()` uniqueness

### 5.3 Integration Tests

**File:** `e2e/reading-journey.spec.js`

- [ ] Test unified component renders in Journal
- [ ] Test filter changes update displayed data
- [ ] Test mobile sheet opens/closes
- [ ] Test tab navigation
- [ ] Test export actions
- [ ] Test coach suggestion CTA

---

## Implementation Order

### Sprint 1: Data Foundation (1-2 days)
1. Create data utilities in `journalInsights.js`
2. Create `safeStorage.js`
3. Extract `useArchetypeJourney` hook
4. Create `useJourneyData` hook (core logic)
5. Unit tests for data layer

### Sprint 2: Narrative & Coach (0.5-1 day)
1. Implement `generateSeasonNarrative()`
2. Implement `computeEnhancedCoachSuggestion()`
3. Wire into `useJourneyData`
4. Unit tests

### Sprint 3: Mobile UI (1-2 days)
1. Create `ReadingJourney/index.jsx`
2. Create `JourneyHeroCard`
3. Create `JourneyMobileSheet`
4. Create `JourneyTabs`
5. Create `CardsTab`, `PatternsTab`, `ExportTab`
6. Wire up in Journal.jsx (mobile only first)

### Sprint 4: Desktop UI (1-2 days)
1. Create `JourneySidebar`
2. Create `SeasonSummary`
3. Adapt shared sections
4. Wire up in Journal.jsx (desktop)
5. Add keyboard shortcuts

### Sprint 5: Polish & Test (1 day)
1. Integration tests
2. A11y audit
3. Performance audit
4. Deprecate old components

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing Journal UX | Feature flag to toggle old vs new |
| D1 fetch regressions | Keep old code path until new is validated |
| Mobile sheet performance | Use lightweight animation library |
| Cache staleness | Aggressive invalidation on save/delete/backfill |

---

## Success Criteria

- [ ] Single `ReadingJourney` component replaces both panels
- [ ] Filters correctly switch between server/client data
- [ ] No duplicate card frequency displays
- [ ] Mobile: hero card + bottom sheet with tabs
- [ ] Desktop: condensed sidebar or bento grid
- [ ] Coach suggestion surfaces in hero and FAB
- [ ] All existing export/share functionality preserved
- [ ] Unit test coverage for data layer
- [ ] No console errors or warnings
