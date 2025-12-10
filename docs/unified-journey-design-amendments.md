# Unified Journey Design — Amendments & Risk Mitigations

> Addresses critical issues identified in the unified-journey-design.md and unified-journey-implementation-plan.md review.

---

## Table of Contents

1. [Filter Detection Heuristic Fix](#1-filter-detection-heuristic-fix)
2. [SSR/Client-Only Hook Guard](#2-ssrclient-only-hook-guard)
3. [Narrative Cache User ID Collision Fix](#3-narrative-cache-user-id-collision-fix)
4. [Card Frequency Data Source Consistency](#4-card-frequency-data-source-consistency)
5. [Feature Flag for Legacy Panel Replacement](#5-feature-flag-for-legacy-panel-replacement)
6. [Questions & Recommendations](#6-questions--recommendations)

---

## 1. Filter Detection Heuristic Fix

### Problem

The current design in [`unified-journey-design.md:529-558`](./unified-journey-design.md) uses a heuristic fallback for filter detection:

```javascript
// Current heuristic - PROBLEMATIC
const filtersActive = useMemo(() => {
  if (typeof filtersActiveProp === 'boolean') {
    return filtersActiveProp;
  }
  // Fallback: compare entry identity
  if (filteredEntries.length !== entries.length) return true;
  // Compare first/last entry IDs as heuristic
  const firstMatch = filteredEntries[0]?.id === entries[0]?.id;
  const lastMatch = filteredEntries.at(-1)?.id === entries.at(-1)?.id;
  return !(firstMatch && lastMatch);
}, [filtersActiveProp, entries, filteredEntries]);
```

**Failure mode:** Context or spread filters that don't change entry count (e.g., filtering a homogeneous journal) will incorrectly return `filtersActive = false`, routing to D1 data and showing mismatched frequencies/cadence.

### Solution: Fail Closed to Client Data

**Require explicit `filtersActive` prop; when absent, default to client-side data (safe fallback).**

```javascript
// src/hooks/useJourneyData.js — AMENDED

export function useJourneyData({
  entries,
  filteredEntries,
  filtersActive: filtersActiveProp, // REQUIRED for accurate routing
  isAuthenticated,
  userId,
  seasonWindow,
  locale = 'en-US',
  timezone,
}) {
  // FAIL CLOSED: If filtersActive not explicitly provided, assume filters ARE active
  // This ensures we fall back to client-side data (safe) rather than D1 (possibly wrong)
  const filtersActive = useMemo(() => {
    // Explicit prop takes precedence
    if (typeof filtersActiveProp === 'boolean') {
      return filtersActiveProp;
    }

    // WARNING: No explicit prop provided - fail closed to client data
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[useJourneyData] filtersActive prop not provided. ' +
        'Defaulting to true (client-side data). ' +
        'Pass explicit filtersActive from filter state for accurate routing.'
      );
    }

    // Fail closed: assume filters are active when we can't determine
    return true;
  }, [filtersActiveProp]);

  // ... rest of hook
}
```

### Integration Change in Journal.jsx

The existing [`Journal.jsx:257`](../src/components/Journal.jsx:257) already computes `filtersActive` correctly:

```javascript
const filtersActive = Boolean(
  filters.query.trim() ||
  filters.contexts.length > 0 ||
  filters.spreads.length > 0 ||
  filters.decks.length > 0 ||
  filters.timeframe !== 'all' ||
  filters.onlyReversals
);
```

**Ensure this is always passed to `ReadingJourney`:**

```jsx
<ReadingJourney
  entries={entries}
  filteredEntries={filteredEntries}
  filtersActive={filtersActive}  // REQUIRED - do not omit
  isAuthenticated={isAuthenticated}
  userId={user?.id}
  variant="sidebar"
/>
```

### PropTypes/TypeScript Enforcement

```typescript
// ReadingJourneyProps — make filtersActive required
interface ReadingJourneyProps {
  entries: JournalEntry[];
  filteredEntries?: JournalEntry[];
  filtersActive: boolean;  // REQUIRED, not optional
  isAuthenticated: boolean;
  userId?: string;
  // ...
}
```

---

## 2. SSR/Client-Only Hook Guard

### Problem

[`unified-journey-design.md:475-514`](./unified-journey-design.md) marks `useJourneyData` as client-only due to localStorage usage, but the integration plan at [`unified-journey-implementation-plan.md:331-355`](./journal-features-implementation-plan.md) drops it into Journal.jsx without a guard.

**Failure mode:** SSR, pre-rendered surfaces, or Jest without jsdom will throw `ReferenceError: localStorage is not defined` before hydration.

### Solution A: Guard at Component Entry Point

```jsx
// src/components/ReadingJourney/index.jsx

import { lazy, Suspense } from 'react';

// Lazy load the entire journey module to defer localStorage access
const JourneyContent = lazy(() => import('./JourneyContent'));

function JourneyFallback() {
  return (
    <div className="animate-pulse rounded-3xl border border-amber-300/12 bg-[#0b0c1d] p-5 h-64" />
  );
}

export function ReadingJourney(props) {
  // SSR guard: render nothing on server, lazy load on client
  if (typeof window === 'undefined') {
    return <JourneyFallback />;
  }

  return (
    <Suspense fallback={<JourneyFallback />}>
      <JourneyContent {...props} />
    </Suspense>
  );
}
```

### Solution B: Guard Within Hook (Defense in Depth)

Add guards to all localStorage access points in the hook:

```javascript
// src/hooks/useJourneyData.js — Add SSR guards

const safeStorage = {
  isAvailable: typeof window !== 'undefined' && typeof localStorage !== 'undefined',

  getItem(key) {
    if (!this.isAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    if (!this.isAvailable) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail
    }
  },

  removeItem(key) {
    if (!this.isAvailable) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },
};
```

### Solution C: Jest Setup (for Tests)

```javascript
// jest.setup.js or setupTests.js

// Mock localStorage for tests
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = {};
  window.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}
```

### Recommendation

**Implement both Solution A (component-level lazy boundary) and Solution B (hook-level guards) for defense in depth.** The lazy boundary prevents the entire module from loading during SSR, while the hook guards protect against edge cases.

---

## 3. Narrative Cache User ID Collision Fix

### Problem

[`unified-journey-design.md:1073-1136`](./unified-journey-design.md) shows cache keys always include `userId`:

```javascript
// Current key format
`${userId}:${viewType}:${startDate}:${endDate}:${locale}:${tz}`
```

But [`unified-journey-design.md:1220-1248`](./unified-journey-design.md) shows integration passing `user?.id`:

```jsx
<ReadingJourney
  userId={user?.id}  // undefined for guests/signed-out
  // ...
/>
```

**Failure modes:**
1. Guests cache under `undefined:default:...`, causing cross-user leakage on shared devices
2. After logout, stale stories persist unless explicitly invalidated
3. After login, user may see another user's cached narrative briefly

### Solution: Gate Caching to Authenticated Users Only

```javascript
// src/hooks/useJourneyData.js — AMENDED cache functions

const NARRATIVE_CACHE_KEY = 'journey_narrative_cache';

/**
 * Get cached narrative — ONLY for authenticated users with valid userId.
 * Returns null for guests to prevent cross-user leakage.
 */
function getCachedNarrative(userId, seasonKey) {
  // SECURITY: Never cache for unauthenticated users
  if (!userId || userId === 'undefined' || userId === 'null') {
    return null;
  }

  if (!safeStorage.isAvailable) return null;

  const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
  if (!raw) return null;

  try {
    const cache = JSON.parse(raw);
    const entry = cache[`${userId}:${seasonKey}`];
    if (!entry) return null;

    // Check TTL (24 hours)
    if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
      return null;
    }

    return entry.narrative;
  } catch {
    return null;
  }
}

/**
 * Set cached narrative — ONLY for authenticated users.
 * Silently no-ops for guests.
 */
function setCachedNarrative(userId, seasonKey, narrative) {
  // SECURITY: Never cache for unauthenticated users
  if (!userId || userId === 'undefined' || userId === 'null') {
    return;
  }

  // Don't cache filtered views
  if (seasonKey.includes('filtered:')) return;

  if (!safeStorage.isAvailable) return;

  try {
    const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};

    cache[`${userId}:${seasonKey}`] = {
      narrative,
      timestamp: Date.now(),
    };

    safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail
  }
}

/**
 * Invalidate all cached narratives for a user.
 * Call on logout, backfill completion, or entry save/delete.
 */
function invalidateNarrativeCache(userId) {
  if (!safeStorage.isAvailable) return;

  // If no userId, clear the entire cache (logout scenario)
  if (!userId) {
    safeStorage.removeItem(NARRATIVE_CACHE_KEY);
    return;
  }

  try {
    const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
    if (!raw) return;

    const cache = JSON.parse(raw);
    // Remove all entries for this user
    Object.keys(cache).forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        delete cache[key];
      }
    });
    safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // If parse fails, clear the whole cache
    safeStorage.removeItem(NARRATIVE_CACHE_KEY);
  }
}

/**
 * Hard invalidate on logout — clear ALL narrative caches.
 * Export this for use in AuthContext logout handler.
 */
export function clearAllNarrativeCaches() {
  if (!safeStorage.isAvailable) return;
  safeStorage.removeItem(NARRATIVE_CACHE_KEY);
}
```

### Integration with AuthContext

```javascript
// src/contexts/AuthContext.jsx — Add cache invalidation on logout

import { clearAllNarrativeCaches } from '../hooks/useJourneyData';

// In logout handler:
const handleLogout = async () => {
  // ... existing logout logic ...
  
  // Hard invalidate narrative caches to prevent leakage
  clearAllNarrativeCaches();
};
```

### Integration with useJournal Hook

```javascript
// src/hooks/useJournal.js — Add cache invalidation on entry changes

import { invalidateNarrativeCache } from './useJourneyData';

// In saveEntry success handler:
const saveEntry = async (entry) => {
  // ... save logic ...
  if (success && userId) {
    invalidateNarrativeCache(userId);
  }
};

// In deleteEntry success handler:
const deleteEntry = async (entryId) => {
  // ... delete logic ...
  if (success && userId) {
    invalidateNarrativeCache(userId);
  }
};
```

---

## 4. Card Frequency Data Source Consistency

### Problem

[`unified-journey-design.md:440-446`](./unified-journey-design.md) states "Single source of truth" depends on D1, but [`unified-journey-design.md:590-612`](./unified-journey-design.md) shows custom windows/filtered views automatically fall back to client recomputation. Date-ranged Archetype API is marked as "future optimization."

**Failure mode:** Badges/trends disappear for historical months (e.g., viewing November in December), undermining the consolidation goal.

### Solution Options

#### Option A: Block Server Fetches When seasonWindow is Set (Recommended for MVP)

Simple and safe — just use client-side data for all non-default views:

```javascript
// src/hooks/useJourneyData.js — AMENDED

// Determine if we should fetch server data
// Gate the fetch to avoid wasted network calls and telemetry skew
const shouldFetchServerData = useMemo(() => {
  // Only fetch from D1 when:
  // 1. User is authenticated
  // 2. No filters active (unfiltered view)
  // 3. No custom season window (default = current month)
  return isAuthenticated && !filtersActive && !seasonWindow;
}, [isAuthenticated, filtersActive, seasonWindow]);
```

**Pros:**
- Simple, no API changes needed
- Consistent behavior (filtered/custom = always client)
- Badges/trends show only for current month (D1) or full journal (client)

**Cons:**
- No server-side badges/trends for custom date ranges

#### Option B: Add D1 Date-Range Parameter (Better UX, More Work)

Extend `/api/archetype-journey` to accept date range parameters:

```javascript
// functions/api/archetype-journey.js — EXTENDED

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Parse optional date range parameters
  const startDate = url.searchParams.get('start'); // YYYY-MM-DD
  const endDate = url.searchParams.get('end');     // YYYY-MM-DD
  
  // Validate date format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasValidRange = startDate && endDate && 
    datePattern.test(startDate) && datePattern.test(endDate);
  
  // Query with date range if provided
  let query;
  if (hasValidRange) {
    const startMonth = startDate.slice(0, 7); // YYYY-MM
    const endMonth = endDate.slice(0, 7);
    
    query = await env.DB.prepare(`
      SELECT card_name, card_number, SUM(count) as count
      FROM card_appearances
      WHERE user_id = ? AND year_month >= ? AND year_month <= ?
      GROUP BY card_name, card_number
      ORDER BY count DESC
      LIMIT 10
    `).bind(userId, startMonth, endMonth).all();
  } else {
    // Default: current month only
    const currentMonth = new Date().toISOString().slice(0, 7);
    query = await env.DB.prepare(`
      SELECT card_name, card_number, count
      FROM card_appearances
      WHERE user_id = ? AND year_month = ?
      ORDER BY count DESC
      LIMIT 10
    `).bind(userId, currentMonth).all();
  }
  
  // ... rest of handler
}
```

**Client-side hook update:**

```javascript
// src/hooks/useJourneyData.js — With date range support

const shouldFetchServerData = useMemo(() => {
  return isAuthenticated && !filtersActive;
  // Note: seasonWindow is now handled by API params
}, [isAuthenticated, filtersActive]);

// Build API URL with date range if seasonWindow provided
const apiUrl = useMemo(() => {
  const base = '/api/archetype-journey';
  if (!seasonWindow) return base;
  
  const start = seasonWindow.start.toISOString().split('T')[0];
  const end = seasonWindow.end.toISOString().split('T')[0];
  return `${base}?start=${start}&end=${end}`;
}, [seasonWindow]);
```

### Recommendation

**For MVP: Use Option A (block server fetches when seasonWindow is set).**

This is safe, simple, and the UX impact is limited:
- Current month view → D1 data with badges/trends ✓
- Filtered view → Client data (accurate for filter) ✓
- Custom date range → Client data (no badges, but accurate counts) ✓

**Post-MVP: Implement Option B** when `/journey` full-page route is built, as users will expect historical badges/trends there.

---

## 5. Feature Flag for Legacy Panel Replacement

### Problem

[`unified-journey-implementation-plan.md:331-355`](./journal-features-implementation-plan.md) (referenced as unified-journey-design.md Phase 5) replaces legacy panels outright:

> - [ ] Remove `JournalInsightsPanel.jsx`
> - [ ] Remove `ArchetypeJourneySection.jsx`

**Failure modes:**
- Regression risk during phased delivery
- No A/B validation possible
- No quick rollback if issues discovered post-deploy

### Solution: Feature Flag with Gradual Rollout

#### Step 1: Add Feature Flag

```javascript
// src/hooks/useFeatureFlags.js — Add journey flag

export function useFeatureFlags() {
  // ... existing flags ...
  
  return {
    // ... existing flags ...
    
    /**
     * Unified Reading Journey
     * When true, show new ReadingJourney component instead of
     * JournalInsightsPanel + ArchetypeJourneySection
     */
    unifiedJourney: getFlag('unified_journey', false),
  };
}

// Flag can be controlled via:
// 1. localStorage override: localStorage.setItem('ff_unified_journey', 'true')
// 2. URL param: ?ff_unified_journey=true
// 3. Server-side config (future)
```

#### Step 2: Conditional Rendering in Journal.jsx

```jsx
// src/components/Journal.jsx — AMENDED

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { ReadingJourney } from './ReadingJourney';

export default function Journal() {
  const { unifiedJourney } = useFeatureFlags();
  // ... existing code ...

  const desktopRailContent = (!loading && hasEntries && !isMobileLayout) ? (
    <div className="space-y-6 lg:space-y-8 w-full">
      <div className="w-full">
        <JournalFilters ... />
      </div>
      
      {unifiedJourney ? (
        // NEW: Unified Reading Journey
        <ReadingJourney
          entries={entries}
          filteredEntries={filteredEntries}
          filtersActive={filtersActive}
          isAuthenticated={isAuthenticated}
          userId={user?.id}
          variant="sidebar"
          onCreateShareLink={isAuthenticated ? createShareLink : null}
          onStartReading={handleStartReading}
        />
      ) : (
        // LEGACY: Separate panels
        <>
          {(allStats || filteredStats) && (
            <div className="w-full">
              <InsightsErrorBoundary>
                <JournalInsightsPanel
                  stats={filteredStats}
                  allStats={allStats}
                  entries={filteredEntries}
                  allEntries={entries}
                  isAuthenticated={isAuthenticated}
                  filtersActive={filtersActive}
                  onCreateShareLink={isAuthenticated ? createShareLink : null}
                />
              </InsightsErrorBoundary>
            </div>
          )}
          {isAuthenticated && (
            <div className="w-full">
              <ArchetypeJourneySection 
                isAuthenticated={isAuthenticated} 
                userId={user?.id} 
                showEmptyState 
              />
            </div>
          )}
        </>
      )}
    </div>
  ) : null;

  // Similar conditional for mobile rail content...
}
```

#### Step 3: Rollout Plan

| Phase | Flag State | Audience |
|-------|------------|----------|
| 1. Internal Testing | `true` for team | Developers only |
| 2. Beta | `true` for beta users | Opt-in via settings |
| 3. Gradual Rollout | 10% → 50% → 100% | Random sampling |
| 4. GA | `true` default | All users |
| 5. Cleanup | Remove flag, delete legacy | — |

#### Step 4: Analytics Events

```javascript
// Track which experience users see
analytics.track('journal_view', {
  experience: unifiedJourney ? 'unified' : 'legacy',
  filtersActive,
  entryCount: entries.length,
});
```

---

## 6. Questions & Recommendations

### Question 1: Server Fetch Blocking vs D1 Date-Range Param

> Do we want to block server fetches whenever `seasonWindow` is set, or should we add a quick D1 date-range param now to keep badges/trends intact for /journey or custom ranges?

**Recommendation: Block server fetches for MVP, add date-range param post-MVP.**

**Rationale:**
1. **Simplicity**: Blocking is a one-line change; date-range param requires API changes, testing, and migration considerations.
2. **Risk**: The consolidated view is already complex; adding API parameters increases surface area for bugs.
3. **UX Impact**: Limited — most users view current month. Historical views are a "nice to have" for power users.
4. **Timeline**: Date-range param can be added when `/journey` full-page route is built (Phase 4 in implementation plan).

**Implementation:**

```javascript
// useJourneyData.js — Simple blocking
const shouldFetchServerData = isAuthenticated && !filtersActive && !seasonWindow;
```

### Question 2: Narrative Caching for Unauthenticated Users

> Should narrative caching be disabled for unauthenticated users entirely to avoid `undefined:*` collisions and respect shared-device privacy?

**Recommendation: Yes, disable caching for unauthenticated users entirely.**

**Rationale:**
1. **Security**: `undefined:*` cache keys create collision risk on shared devices.
2. **Privacy**: Guests on shared devices shouldn't see each other's journey narratives.
3. **Simplicity**: Guest narratives are computed fresh anyway (no D1 data), so caching provides minimal benefit.
4. **Consistency**: Matches the pattern where guests don't get Archetype Journey features at all.

**Implementation:**

```javascript
function getCachedNarrative(userId, seasonKey) {
  // Disable caching for unauthenticated users
  if (!userId) return null;
  // ... rest of function
}

function setCachedNarrative(userId, seasonKey, narrative) {
  // Disable caching for unauthenticated users
  if (!userId) return;
  // ... rest of function
}
```

**Additional safeguard — clear on logout:**

```javascript
// AuthContext.jsx logout handler
const handleLogout = () => {
  // ... logout logic ...
  clearAllNarrativeCaches(); // Prevent leakage to next user
};
```

---

## Summary of Amendments

| Issue | Section | Fix | Priority |
|-------|---------|-----|----------|
| Filter detection heuristic | §1 | Require explicit `filtersActive`, fail closed | **Critical** |
| SSR/client-only hook | §2 | Lazy boundary + hook guards | **Critical** |
| Cache user ID collision | §3 | Gate to auth users, invalidate on logout | **Critical** |
| Card frequency consistency | §4 | Block server fetch when `seasonWindow` set | High |
| No feature flag for rollout | §5 | Add `unifiedJourney` flag, gradual rollout | High |

---

## Implementation Checklist

### Before Phase 1 (Hook Creation)
- [ ] Add `safeStorage` abstraction with SSR guards
- [ ] Update `useJourneyData` to require `filtersActive` prop
- [ ] Add fail-closed logic when prop missing
- [ ] Gate narrative caching to authenticated users only

### Before Phase 3 (Integration)
- [ ] Create lazy-loaded `ReadingJourney` wrapper
- [ ] Add `unifiedJourney` feature flag
- [ ] Implement conditional rendering in Journal.jsx
- [ ] Add cache invalidation to AuthContext logout

### Before Phase 5 (Deprecation)
- [ ] Run A/B test comparing legacy vs unified
- [ ] Ensure 100% rollout with no regressions
- [ ] Remove feature flag and legacy components

---

*Created: December 10, 2024*
*Status: Proposed amendments pending review*