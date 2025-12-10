# Unified Journey Design

> Consolidated design for combining Journal Insights and Archetype Journey features.

## Problem Statement

Currently, the Journal page has two separate analytics components:

1. **JournalInsightsPanel** — Entry-based stats, context breakdown, themes, coach suggestions, export/share
2. **ArchetypeJourneySection** — Card frequency tracking, badges/streaks, Major Arcana map, growth prompts

### Issues

| Problem | Impact |
|---------|--------|
| **Data duplication** | Both show "top cards" and 6-month cadence charts |
| **Mobile UX friction** | Users must expand 3 accordions (Filters, Insights, Archetype) |
| **Split mental model** | "Stats" vs "Card tracking" feels arbitrary |
| **No unified narrative** | Coach suggestion doesn't incorporate badge/streak data |

### Data Overlap

| Data Point | Journal Insights | Archetype Journey |
|------------|------------------|-------------------|
| Card frequency | Client-side `frequentCards` | D1 `card_appearances` |
| Monthly cadence | `monthlyCadence` (6 months) | 6-month trend data |
| Top cards display | Top 4 with reversal count | Top 5 with trend arrows |

### Complementary Data (No Overlap)

| Insights-Only | Archetype-Only |
|---------------|----------------|
| Context breakdown (Love, Career, etc.) | Badges/achievements |
| Preference drift analysis | Streak tracking |
| Reversal rate | Major Arcana tiles |
| Recent themes | Growth prompts per card |
| Journey story prose | Per-card appearance history |
| Export (PDF/MD/CSV) | — |
| Share links | — |

---

## Design Principles

1. **Single source of truth** — Use Archetype Journey's D1 data for card frequency; fall back to client-side for unauthenticated users
2. **Story-first** — Lead with narrative ("Your December was defined by..."), not raw numbers
3. **Progressive disclosure** — Hero summary → Tabbed details → Deep dive
4. **Mobile-first** — Design for constraints, then expand for desktop
5. **Task-oriented** — Surface what users need when they need it
6. **Gamification without overwhelm** — Badges woven into narrative, not separate section

---

## Information Architecture

```
Your Reading Journey
│
├── Level 1: Season Summary (always visible)
│   ├── Narrative headline ("A month of transformation...")
│   ├── Top card with badge + count
│   ├── Stat chips (readings, streak, top context)
│   └── Coach suggestion with CTA
│
├── Level 2: Tabbed Detail View
│   │
│   ├── [Cards] Tab
│   │   ├── Cards Calling You (top 5 with inline badges)
│   │   ├── Growth prompt (expandable, not modal)
│   │   ├── Major Arcana heatmap
│   │   ├── Minor Arcana suit breakdown
│   │   └── Achievements row (horizontal scroll)
│   │
│   ├── [Patterns] Tab
│   │   ├── Context breakdown with bars
│   │   ├── Context timeline ribbon (6 months)
│   │   ├── Preference drift indicator
│   │   ├── Theme tags
│   │   ├── Reading cadence chart (single, merged)
│   │   └── Journey story prose
│   │
│   └── [Export] Tab
│       ├── Export buttons (PDF, Markdown, CSV, SVG)
│       ├── Share composer (scope, expiry, title)
│       └── Active share links management
│
└── Level 3: Full-Page Mode (optional /journey route)
    └── Expanded bento grid with all sections visible
```

---

## Desktop Layout: Bento Grid

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR READING JOURNEY                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✦ Your December Journey                                      ││
│  │ "A month of transformation. The Tower appeared 4× — your     ││
│  │  most persistent messenger. Love readings dominated."        ││
│  │                                                              ││
│  │ [🃏 Tower: 4×] [🔥 3-streak] [❤️ Love]    [Start Reading →] ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │     📊 AT-A-GLANCE          │ │     🃏 CARDS CALLING YOU     │ │
│ │ ───────────────────────     │ │ ─────────────────────────── │ │
│ │ 24 readings  │  156 cards   │ │  1. The Tower ×5 🔥         │ │
│ │ 23% reversed │  3-day streak│ │  2. High Priestess ×4       │ │
│ │                             │ │  3. Nine of Swords ×3 🔥    │ │
│ │                             │ │  4. The Moon ×3             │ │
│ │                             │ │  5. Ace of Cups ×2          │ │
│ └─────────────────────────────┘ │                             │ │
│                                 │  💡 "Tower's recurrence      │ │
│                                 │  invites you to examine..."  │ │
│                                 └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │    📈 READING RHYTHM        │ │    🔮 PATTERNS & THEMES      │ │
│ │ ───────────────────────     │ │ ─────────────────────────── │ │
│ │                             │ │                             │ │
│ │  ▁▂▄▆█▅▃▂▁▂▄▆▇▅▃           │ │  Love     ████████  45%     │ │
│ │  J  A  S  O  N  D           │ │  Career   █████     28%     │ │
│ │                             │ │  Self     ███       15%     │ │
│ │  Context Timeline:          │ │  Spiritual██        12%     │ │
│ │  ●●●○●●●●○○●●●●            │ │                             │ │
│ │  (Love-heavy lately)        │ │  ⚡ Drift: +Spiritual       │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┤
│ │                   ✨ MAJOR ARCANA MAP                         │
│ │ ─────────────────────────────────────────────────────────     │
│ │ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐               │
│ │ │ 0││ I││II││III││IV││ V││VI││VII││VIII││IX││ X│              │
│ │ │▓▓││░░││▓▓││░░││░░││▓▓││░░││▓▓ ││░░ ││▓▓││░░│              │
│ │ └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘               │
│ │ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐               │
│ │ │XI││XII││XIII││XIV││XV││XVI││XVII││XVIII││XIX││XX││XXI│       │
│ │ │░░││▓▓││░░ ││░░││░░││▓▓▓││░░ ││░░  ││░░││░░││░░│           │
│ │ └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘               │
│ │ (heat intensity = frequency)                                  │
│ └───────────────────────────────────────────────────────────────┤
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┤
│ │                   📖 YOUR JOURNEY STORY                       │
│ │ ─────────────────────────────────────────────────────────     │
│ │ "This month, your readings have centered on transformation    │
│ │ and hidden truths. The Tower's repeated appearances suggest   │
│ │ a period of necessary upheaval, while the High Priestess      │
│ │ reminds you to trust your intuition through the changes..."   │
│ │                                                               │
│ │  Recent themes: 🌙 Intuition  ⚡ Change  💔 Release           │
│ └───────────────────────────────────────────────────────────────┤
├─────────────────────────────────────────────────────────────────┤
│   [Share ↗]    [Export ▼]    [Settings ⚙]          [? Help]    │
└─────────────────────────────────────────────────────────────────┘
```

### Desktop: Sidebar Variant (Right Rail)

When rendered in the Journal's right rail, use a condensed single-column layout with collapsible sections:

```
┌─────────────────────────────┐
│ YOUR JOURNEY                │
├─────────────────────────────┤
│ Season Summary (always)     │
├─────────────────────────────┤
│ ▼ Cards Calling You         │
│ ▼ Patterns & Themes         │
│ ▼ Major Arcana Map          │
├─────────────────────────────┤
│ [Share] [Export] [⚙]        │
└─────────────────────────────┘
```

---

## Mobile Layout: Hero + Tabbed Sheet

### Collapsed State (Default)

```
┌─────────────────────────────────┐
│         YOUR JOURNEY            │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │     🃏 THE TOWER            │ │
│ │     appeared 5× this month   │ │
│ │     ─────────────────────    │ │
│ │     "A period of necessary   │ │
│ │      upheaval awaits..."     │ │
│ │                              │ │
│ │     🔥 Streak badge earned   │ │
│ └─────────────────────────────┘ │
│                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │  24   │ │  156  │ │   3   │ │
│  │readings│ │ cards │ │streak │ │
│  └───────┘ └───────┘ └───────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💡 Try: "What is The Tower  │ │
│ │ teaching me about release?" │ │
│ │                [Start →]    │ │
│ └─────────────────────────────┘ │
│                                 │
│     [ See Full Journey ↓ ]     │
└─────────────────────────────────┘
                               ┌───┐
                               │ ✦ │ ← FAB (coach shortcut)
                               └───┘
```

### Expanded State (Bottom Sheet with Tabs)

```
┌─────────────────────────────────┐
│ ════════════════════════════════│  ← drag handle
│                                 │
│  [🃏 Cards] [📊 Patterns] [↗ Export]   ← horizontal tabs
│                                 │
├─────────────────────────────────┤
│                                 │
│  {Content for selected tab}     │
│                                 │
│  ← swipe left/right to switch → │
│                                 │
└─────────────────────────────────┘
```

### Cards Tab (Mobile)

```
┌─────────────────────────────────┐
│ Cards Calling You               │
│ "These cards keep appearing"    │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [img] The Tower      5× 🔥  │ │
│ │       ↑ trending            │ │
│ │       [Tap for insight →]   │ │
│ ├─────────────────────────────┤ │
│ │ [img] High Priestess 4×     │ │
│ │       → steady              │ │
│ ├─────────────────────────────┤ │
│ │ [img] Nine of Swords 3× 🔥  │ │
│ │       ↑ trending            │ │
│ └─────────────────────────────┘ │
│                                 │
│ Major Arcana This Month         │
│ ┌─────────────────────────────┐ │
│ │ [0][I][II][III]... (scroll) │ │
│ └─────────────────────────────┘ │
│                                 │
│ Achievements                    │
│ [🔥 Tower] [⭐ Priestess] [...] │
│ (horizontal scroll)             │
└─────────────────────────────────┘
```

### Patterns Tab (Mobile)

```
┌─────────────────────────────────┐
│ Reading Patterns                │
├─────────────────────────────────┤
│ Your Focus Areas                │
│ ┌─────────────────────────────┐ │
│ │ ❤️ Love    ████████░░  65%  │ │
│ │ 💼 Career  ████░░░░░░  20%  │ │
│ │ 🌟 Spirit  ██░░░░░░░░  15%  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Context Timeline (6 mo)         │
│ ┌─────────────────────────────┐ │
│ │ J  A  S  O  N  D            │ │
│ │ ●● ●● ●● ●● ●● ●●  Love     │ │
│ │ ○  ○  ●  ●  ○  ○   Career   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ⚡ Emerging: Spiritual +3×     │
│    since October [Settings →]   │
│                                 │
│ Themes                          │
│ [Transformation] [Release] ...  │
│                                 │
│ Reading Cadence                 │
│ ▁▂▄▆█▇▅▃▂▁▂▄▆ (20/mo avg)      │
│                                 │
│ ▼ Your Journey Story            │
│ "This month was about..."       │
└─────────────────────────────────┘
```

### Export Tab (Mobile)

```
┌─────────────────────────────────┐
│ Export & Share                  │
├─────────────────────────────────┤
│ Export Your Journal             │
│ ┌─────────┐ ┌─────────┐        │
│ │ 📄 PDF  │ │ 📝 MD   │        │
│ └─────────┘ └─────────┘        │
│ ┌─────────┐ ┌─────────┐        │
│ │ 📊 CSV  │ │ 🖼️ SVG  │        │
│ └─────────┘ └─────────┘        │
│                                 │
│ Share a Reading                 │
│ ┌─────────────────────────────┐ │
│ │ Scope: ○ Recent  ○ Single   │ │
│ │ Entries: [3 ▼]              │ │
│ │ Expires: [1 week ▼]         │ │
│ │ Title: [_______________]    │ │
│ │                             │ │
│ │      [Create Share Link →]  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Active Links                    │
│ • "Nov Journey" Dec 17 [×]     │
│ • "Celtic Cross" never  [×]    │
└─────────────────────────────────┘
```

---

## Interaction Patterns

### Desktop Interactions

| Action | Behavior |
|--------|----------|
| Hover on card tile | Show meaning snippet + sparkline |
| Click card tile | Filter journal to readings with that card |
| Click context bar | Filter journal to that context |
| Click badge | Show achievement details inline |
| Click Major Arcana tile | Filter journal + show growth prompt |
| Shift+click tile | Add to multi-filter |
| Press `E` | Open export menu |
| Press `S` | Open share composer |
| Press `C` | Scroll to Cards section |
| Press `P` | Scroll to Patterns section |
| Press `N` | Start new reading with coach suggestion |
| Press `?` | Show keyboard shortcuts |

### Mobile Interactions

| Action | Behavior |
|--------|----------|
| Tap hero card | Expand to show growth prompt |
| Tap "See Full Journey" | Open bottom sheet |
| Swipe sheet down | Dismiss to hero view |
| Swipe left/right in sheet | Switch tabs |
| Tap card tile | Expand inline for details |
| Long-press card | Context menu (filter, growth prompt) |
| Tap FAB | Start reading with coach suggestion |
| Pull down on sheet | Haptic feedback + dismiss |

---

## Component Architecture

### File Structure

```
src/components/
├── ReadingJourney/
│   ├── index.jsx                    # Main container, responsive layout
│   ├── JourneyBentoGrid.jsx         # Desktop full-page bento
│   ├── JourneySidebar.jsx           # Desktop rail variant
│   ├── JourneyMobileSheet.jsx       # Mobile bottom sheet
│   ├── JourneyHeroCard.jsx          # Hero summary (mobile)
│   ├── JourneyTabs.jsx              # Tab navigation
│   │
│   ├── tabs/
│   │   ├── CardsTab.jsx             # Cards Calling You + Arcana map
│   │   ├── PatternsTab.jsx          # Context + themes + cadence
│   │   └── ExportTab.jsx            # Export + share
│   │
│   ├── sections/
│   │   ├── SeasonSummary.jsx        # Narrative headline + chips
│   │   ├── AtAGlanceStats.jsx       # Stats row (2x2 or inline)
│   │   ├── CardsCallingYou.jsx      # Top cards with badges
│   │   ├── CardFrequencyTile.jsx    # Individual card row
│   │   ├── MajorArcanaMap.jsx       # Heatmap grid
│   │   ├── AchievementsRow.jsx      # Horizontal badge scroll
│   │   ├── ContextBreakdown.jsx     # Bars + timeline
│   │   ├── ThemeTags.jsx            # Theme chips
│   │   ├── CadenceChart.jsx         # Single 6-month sparkline
│   │   └── JourneyStory.jsx         # Prose narrative
│   │
│   ├── actions/
│   │   ├── JourneyActions.jsx       # Action bar container
│   │   ├── ExportButtons.jsx        # PDF/MD/CSV/SVG
│   │   ├── ShareComposer.jsx        # Share link creation
│   │   └── ActiveLinks.jsx          # Manage existing links
│   │
│   └── shared/
│       ├── BadgeIndicator.jsx       # Achievement badge chip
│       ├── GrowthPrompt.jsx         # Expandable reflection prompt
│       ├── TrendArrow.jsx           # ↑ ↓ → indicators
│       └── CoachFAB.jsx             # Floating action button (mobile)
│
├── JournalInsightsPanel.jsx         # DEPRECATED
└── ArchetypeJourneySection.jsx      # DEPRECATED
```

### Data Hook: `useJourneyData`

#### Season Window Definition

The "season" time window is defined as follows:

| Mode | Window | Use Case |
|------|--------|----------|
| **Default** | Current calendar month | No filters active |
| **Filtered** | Derived from `filteredEntries` date range | User applied timeframe filter |
| **Custom** | Explicit `seasonWindow` prop | `/journey` full-page with date picker |

The narrative, stats, and charts all reflect this same window to avoid inconsistency.

#### D1 Data Filtering Strategy

**Problem**: D1 `card_appearances` stores monthly aggregates. When the user applies a filter (e.g., "last 30 days" or a context filter), D1 data won't match the filtered journal view.

**Solution**: Hybrid approach with client-side re-aggregation for filtered views.

| Scenario | Data Source | Rationale |
|----------|-------------|-----------|
| **No filters (default)** | D1 `card_appearances` | Server data is accurate for current month |
| **Timeframe filter (30d, 90d, YTD)** | Client-side from `filteredEntries` | D1 monthly buckets don't align with arbitrary windows |
| **Context/spread/deck filter** | Client-side from `filteredEntries` | D1 doesn't store per-context breakdowns |
| **Custom date range** | Client-side from `filteredEntries` | Same as timeframe filter |

**Implementation**: When `filteredEntries` differs from `entries`, the hook falls back to client-side card frequency computation regardless of authentication status. D1 data is only used when showing the unfiltered "all time" or "current month" view.

```javascript
const useServerData = isAuthenticated &&
  !filtersActive &&
  !seasonWindow; // No custom window override
```

**Future optimization**: Add date range parameters to `/api/archetype-journey` endpoint:
```
GET /api/archetype-journey?start=2024-11-01&end=2024-11-30
```

This would allow server-side filtering for performance, but is not required for MVP.

#### Data Shape Normalization

D1 `card_appearances` and client-side `frequentCards` have different shapes:

| Source | Card Name Field | Count Field | Reversed Field |
|--------|-----------------|-------------|----------------|
| D1 (Archetype) | `card_name` | `count` | N/A |
| Client (Insights) | `name` | `count` | `reversed` |

The hook normalizes to a unified `CardFrequency` type:

```typescript
type CardFrequency = {
  name: string;       // Normalized card name
  count: number;      // Appearance count in season window
  reversedCount: number;  // Reversed appearances (0 if from D1)
  trend: 'up' | 'down' | 'stable';  // vs previous period
  hasBadge: boolean;  // Has streak badge this month
};
```

#### Hook Implementation

**Important**: This hook is client-only. It uses browser APIs (localStorage) and should not be called during SSR. Wrap usage in a client boundary or guard with `typeof window !== 'undefined'`.

```javascript
// src/hooks/useJourneyData.js

import { useMemo, useCallback } from 'react';
import { useArchetypeJourney } from './useArchetypeJourney';
import {
  computeJournalStats,
  computePreferenceDrift,
  computeMajorArcanaMapFromEntries,
  computeStreakFromEntries,
  computeBadgesFromEntries,
} from '../lib/journalInsights';

// Empty stats fallback (computeJournalStats returns null for empty entries)
const EMPTY_STATS = {
  totalReadings: 0,
  totalCards: 0,
  reversalRate: 0,
  frequentCards: [],
  contextBreakdown: [],
  monthlyCadence: [],
  recentThemes: [],
};

// Empty Archetype data fallback
const EMPTY_ARCHETYPE = {
  topCards: [],
  badges: [],
  majorArcanaFrequency: [],
  trends: [],
  currentStreak: 0,
  isLoading: false,
  hasBackfilled: false,
};

/**
 * Unified data hook for Reading Journey dashboard.
 * CLIENT-ONLY: Uses localStorage, do not call during SSR.
 *
 * @param {Object} options
 * @param {Array} options.entries - All journal entries (unfiltered)
 * @param {Array} options.filteredEntries - Filtered entries (when filters active)
 * @param {boolean} options.filtersActive - Explicit flag: true when any filter is applied
 * @param {boolean} options.isAuthenticated - User auth state
 * @param {string} options.userId - User ID for Archetype data
 * @param {Object} options.seasonWindow - Optional explicit date range { start: Date; end: Date }
 * @param {string} options.locale - User locale for date formatting (default: 'en-US')
 * @param {string} options.timezone - User timezone (default: browser timezone)
 */
export function useJourneyData({
  entries,
  filteredEntries,
  filtersActive: filtersActiveProp, // Explicit prop from parent (recommended)
  isAuthenticated,
  userId,
  seasonWindow,
  locale = 'en-US',
  timezone,
}) {
  // Filter detection: prefer explicit prop, fall back to entry comparison
  // IMPORTANT: Length-only comparison misses context/spread filters that keep count.
  // The parent component should pass filtersActive explicitly based on filter state.
  const filtersActive = useMemo(() => {
    // If explicit prop provided, trust it
    if (typeof filtersActiveProp === 'boolean') {
      return filtersActiveProp;
    }

    // Fallback: compare entry identity (more reliable than length)
    if (!filteredEntries || !entries) return false;
    if (filteredEntries.length !== entries.length) return true;

    // If same length, compare first/last entry IDs as a heuristic
    // (Full deep equality is expensive; this catches most filter cases)
    if (filteredEntries.length > 0) {
      const firstMatch = filteredEntries[0]?.id === entries[0]?.id;
      const lastMatch = filteredEntries.at(-1)?.id === entries.at(-1)?.id;
      return !(firstMatch && lastMatch);
    }

    return false;
  }, [filtersActiveProp, entries, filteredEntries]);

  // Determine which entries to use for stats
  const activeEntries = filtersActive ? filteredEntries : entries;

  // Derive season window from data if not explicit
  const effectiveSeasonWindow = useMemo(() => {
    if (seasonWindow) return seasonWindow;

    // If filtered entries exist, derive window from their date range
    if (filtersActive && filteredEntries?.length) {
      const timestamps = filteredEntries
        .map(e => e.ts || (e.created_at ? e.created_at * 1000 : null))
        .filter(Boolean);
      if (timestamps.length) {
        return {
          start: new Date(Math.min(...timestamps)),
          end: new Date(Math.max(...timestamps)),
        };
      }
    }

    // Default to current calendar month
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, [seasonWindow, filteredEntries, filtersActive]);

  // Determine if we should fetch server data
  // Gate the fetch to avoid wasted network calls and telemetry skew
  const shouldFetchServerData = isAuthenticated && !filtersActive && !seasonWindow;

  // Server-side data - ONLY fetch when we'll actually use it
  // Pass enabled flag to prevent unnecessary API calls
  const archetypeData = useArchetypeJourney(
    userId,
    shouldFetchServerData // Only fetch when auth'd AND unfiltered
  ) ?? EMPTY_ARCHETYPE;

  // Decide whether to use D1 server data or client-side computation
  // D1 data is only valid for unfiltered "current month" view
  const useServerData = useMemo(() => {
    return isAuthenticated &&
      !filtersActive &&
      !seasonWindow && // No custom window override
      archetypeData.topCards?.length > 0;
  }, [isAuthenticated, filtersActive, seasonWindow, archetypeData.topCards]);

  // Client-side stats with null guard
  const insightsStats = useMemo(() => {
    const stats = computeJournalStats(activeEntries);
    return stats ?? EMPTY_STATS;
  }, [activeEntries]);

  // Preference drift - computed on ACTIVE entries to respect the filter window
  // Compares drift within the selected timeframe, not all-time
  const preferenceDrift = useMemo(() => {
    if (!activeEntries?.length) return null;
    // When filtered, compute drift within the filter window
    // When unfiltered, compare recent vs older entries
    return computePreferenceDrift(activeEntries);
  }, [activeEntries]);

  // Badges - use server data when unfiltered, otherwise compute from entries
  // Note: Client-side badge computation is a subset (only cards in filtered entries)
  const sortedBadges = useMemo(() => {
    if (useServerData) {
      // Unfiltered: use D1 badges, sorted by earned_at DESC
      const badges = archetypeData.badges || [];
      return [...badges].sort((a, b) => (b.earned_at || 0) - (a.earned_at || 0));
    }

    // Filtered: compute "virtual" badges from filtered entries
    // These are cards that appear 3+ times in the filtered view
    // Note: These aren't persisted badges, just indicators of frequency
    return computeBadgesFromEntries(activeEntries);
  }, [useServerData, archetypeData.badges, activeEntries]);

  // Major Arcana heatmap - must match the current view (filtered or all)
  const majorArcanaMap = useMemo(() => {
    if (useServerData) {
      // Unfiltered: use D1 data
      return archetypeData.majorArcanaFrequency || [];
    }

    // Filtered: compute from filtered entries
    return computeMajorArcanaMapFromEntries(activeEntries);
  }, [useServerData, archetypeData.majorArcanaFrequency, activeEntries]);

  // Current streak - must reflect the data view
  const currentStreak = useMemo(() => {
    if (useServerData) {
      // Unfiltered: use D1 streak
      return archetypeData.currentStreak || 0;
    }

    // Filtered: compute streak from filtered entries (consecutive days with readings)
    return computeStreakFromEntries(activeEntries);
  }, [useServerData, archetypeData.currentStreak, activeEntries]);

  // Normalize D1 card data to unified shape
  const normalizeD1Card = useCallback((d1Card, badges) => ({
    name: d1Card.card_name,
    count: d1Card.count,
    reversedCount: 0, // D1 doesn't track reversals
    trend: d1Card.trend || 'stable',
    hasBadge: badges?.some(b => b.card_name === d1Card.card_name) ?? false,
  }), []);

  // Normalize client-side card data to unified shape
  const normalizeClientCard = useCallback((clientCard, badges) => ({
    name: clientCard.name,
    count: clientCard.count,
    reversedCount: clientCard.reversed || 0,
    trend: 'stable', // Client-side doesn't compute trends
    hasBadge: badges?.some(b => b.card_name === clientCard.name) ?? false,
  }), []);

  // Card frequency - respects filter/window selection
  const cardFrequency = useMemo(() => {
    // When filters active or custom window, ALWAYS use client-side data
    // to ensure consistency with the filtered journal view
    if (!useServerData) {
      return (insightsStats.frequentCards || []).map(c =>
        normalizeClientCard(c, sortedBadges)
      );
    }

    // Unfiltered view: use D1 data, enrich with client reversals
    return archetypeData.topCards.map(d1Card => {
      const normalized = normalizeD1Card(d1Card, sortedBadges);
      // Enrich with client-side reversal data if available
      const clientMatch = insightsStats.frequentCards?.find(
        c => c.name === normalized.name
      );
      if (clientMatch) {
        normalized.reversedCount = clientMatch.reversed || 0;
      }
      return normalized;
    });
  }, [
    useServerData,
    archetypeData.topCards,
    sortedBadges,
    insightsStats.frequentCards,
    normalizeD1Card,
    normalizeClientCard,
  ]);

  // Cadence data - respects filter/window selection
  const cadence = useMemo(() => {
    // When filters active, use client-side cadence
    if (!useServerData) {
      return insightsStats.monthlyCadence || [];
    }

    // Unfiltered: prefer server data if richer
    const archetypeCadence = archetypeData.trends || [];
    const insightsCadence = insightsStats.monthlyCadence || [];

    if (archetypeCadence.length >= insightsCadence.length) {
      return archetypeCadence;
    }
    return insightsCadence;
  }, [useServerData, archetypeData.trends, insightsStats.monthlyCadence]);

  // Generate season narrative using effective window
  const seasonNarrative = useMemo(() => {
    const topCard = cardFrequency[0];
    const topContext = insightsStats.contextBreakdown?.[0];
    const topTheme = insightsStats.recentThemes?.[0];

    if (!topCard) return null;

    return generateSeasonNarrative({
      topCard,
      topContext,
      topTheme,
      badges: sortedBadges,
      totalReadings: insightsStats.totalReadings,
      seasonWindow: effectiveSeasonWindow,
      locale,
      timezone,
    });
  }, [
    cardFrequency,
    insightsStats.contextBreakdown,
    insightsStats.recentThemes,
    insightsStats.totalReadings,
    sortedBadges,
    effectiveSeasonWindow,
    locale,
    timezone,
  ]);

  // Journey story prose - returns null when insufficient data
  // UI should hide the "Journey Story" section when this is null
  const journeyStory = useMemo(() => {
    if (!activeEntries?.length || activeEntries.length < 3) return null;
    // generateJourneyStory is a new function to add to journalInsights.js
    // For now, return null - implementation TBD
    // UI components should check `journeyStory !== null` before rendering
    return null;
  }, [activeEntries]);

  // Enhanced coach suggestion - uses sorted badges (most recent first)
  const coachSuggestion = useMemo(() => {
    return computeEnhancedCoachSuggestion({
      topCard: cardFrequency[0],
      topContext: insightsStats.contextBreakdown?.[0],
      topTheme: insightsStats.recentThemes?.[0],
      badges: sortedBadges,
      preferenceDrift,
    });
  }, [
    cardFrequency,
    insightsStats.contextBreakdown,
    insightsStats.recentThemes,
    sortedBadges,
    preferenceDrift,
  ]);

  // Backfill state with loading guard
  const needsBackfill = useMemo(() => {
    // Don't show backfill prompt while still loading
    if (archetypeData.isLoading) return false;
    // Only authenticated users can backfill
    if (!isAuthenticated) return false;
    // Check if backfill has been done
    return !archetypeData.hasBackfilled && entries?.length > 0;
  }, [isAuthenticated, archetypeData.isLoading, archetypeData.hasBackfilled, entries]);

  return {
    // Card data - all computed to respect filters
    cardFrequency,
    badges: sortedBadges,
    majorArcanaMap,

    // Pattern data
    contextBreakdown: insightsStats.contextBreakdown || [],
    themes: insightsStats.recentThemes || [],
    preferenceDrift,
    cadence,

    // Stats - all computed to respect filters
    totalReadings: insightsStats.totalReadings,
    totalCards: insightsStats.totalCards,
    reversalRate: insightsStats.reversalRate,
    currentStreak,

    // Narrative
    seasonNarrative,
    journeyStory, // null when < 3 entries; UI should hide section
    coachSuggestion,

    // Time window
    seasonWindow: effectiveSeasonWindow,
    filtersActive,

    // State
    isLoading: archetypeData.isLoading && shouldFetchServerData,
    hasBackfilled: archetypeData.hasBackfilled,
    needsBackfill,
    isEmpty: !activeEntries?.length,

    // Data source indicator (for debugging/testing)
    _dataSource: useServerData ? 'server' : 'client',
  };
}

/**
 * Generate narrative text for the season summary.
 * Uses the effective season window, not current date.
 *
 * @param {Object} options
 * @param {string} options.locale - Locale for date formatting (e.g., 'en-US', 'fr-FR')
 * @param {string} options.timezone - IANA timezone (e.g., 'America/New_York')
 */
function generateSeasonNarrative({
  topCard,
  topContext,
  topTheme,
  badges,
  totalReadings,
  seasonWindow,
  locale = 'en-US',
  timezone,
}) {
  // Format the time period from the data window with explicit locale/timezone
  const formatPeriod = (window) => {
    const formatOptions = {
      month: 'long',
      ...(timezone && { timeZone: timezone }),
    };

    const start = window.start;
    const end = window.end;

    // Use explicit locale to avoid inconsistent formatting across environments
    const startMonth = start.toLocaleString(locale, formatOptions);
    const endMonth = end.toLocaleString(locale, formatOptions);
    const startYear = start.toLocaleString(locale, {
      year: 'numeric',
      ...(timezone && { timeZone: timezone }),
    });
    const endYear = end.toLocaleString(locale, {
      year: 'numeric',
      ...(timezone && { timeZone: timezone }),
    });

    // Same month (compare formatted strings to handle timezone edge cases)
    if (startMonth === endMonth && startYear === endYear) {
      return startMonth;
    }
    // Same year, different months
    if (startYear === endYear) {
      return `${startMonth}–${endMonth}`;
    }
    // Different years
    return `${startMonth} ${startYear}–${endMonth} ${endYear}`;
  };

  const period = formatPeriod(seasonWindow);
  const hasBadge = badges?.some(b => b.card_name === topCard?.name);

  let narrative = `Your ${period} `;

  if (topTheme) {
    narrative += `has been shaped by themes of ${topTheme.toLowerCase()}. `;
  }

  if (topCard) {
    narrative += `${topCard.name} appeared ${topCard.count}× — your most persistent messenger`;
    if (hasBadge) {
      narrative += `, earning you a streak badge`;
    }
    narrative += `. `;
  }

  if (topContext) {
    narrative += `${topContext.name} readings dominated, signaling where your energy flows.`;
  }

  return narrative;
}

/**
 * Compute coach suggestion with priority ordering.
 *
 * Badge ordering: badges array is expected to be pre-sorted by earned_at DESC
 * (most recent first). The hook sorts badges before passing to this function.
 *
 * Priority order:
 * 1. Preference drift (user exploring new contexts)
 * 2. Most recent badge card (if matches top card)
 * 3. Top theme from recent readings
 * 4. Top context from readings
 * 5. Default generic prompt
 */
function computeEnhancedCoachSuggestion({
  topCard,
  topContext,
  topTheme,
  badges, // Pre-sorted: most recent first
  preferenceDrift,
}) {
  // Priority 1: Drift detection (user exploring unexpected contexts)
  if (preferenceDrift?.hasDrift && preferenceDrift.driftContexts?.[0]) {
    const drift = preferenceDrift.driftContexts[0];
    return {
      source: 'drift',
      text: `You've been exploring ${drift.context} readings lately. What draws you there?`,
      spread: 'threeCard',
    };
  }

  // Priority 2: Most recent badge card (badges[0] is most recent due to pre-sort)
  const recentBadgeCard = badges?.[0]?.card_name;
  if (recentBadgeCard && topCard?.name === recentBadgeCard) {
    return {
      source: 'badge',
      text: `What is ${topCard.name} trying to teach you?`,
      spread: 'single',
    };
  }

  // Priority 3: Top theme
  if (topTheme) {
    return {
      source: 'theme',
      text: `Explore the theme of ${topTheme.toLowerCase()} in your next reading.`,
      spread: 'threeCard',
    };
  }

  // Priority 4: Top context
  if (topContext) {
    return {
      source: 'context',
      text: `Continue your ${topContext.name.toLowerCase()} exploration.`,
      spread: 'threeCard',
    };
  }

  return {
    source: 'default',
    text: 'What do I most need to understand right now?',
    spread: 'single',
  };
}
```

#### Required Changes to `journalInsights.js`

The hook assumes these functions exist or will be added:

| Function | Status | Notes |
|----------|--------|-------|
| `computeJournalStats()` | Exists | Returns `null` for empty entries (handled by hook) |
| `computePreferenceDrift()` | Exists | Currently in JournalInsightsPanel, needs export |
| `computeMajorArcanaMapFromEntries()` | **TODO** | Compute Major Arcana frequency from entries array |
| `computeStreakFromEntries()` | **TODO** | Compute consecutive-day reading streak from entries |
| `computeBadgesFromEntries()` | **TODO** | Compute "virtual" badges (cards appearing 3+ times) |
| `generateJourneyStory()` | **TODO** | New function to generate prose narrative from entries |

**Function signatures:**

```javascript
/**
 * Compute Major Arcana frequency map from entries.
 * @param {Array} entries - Journal entries
 * @returns {Array<{ cardNumber: number; name: string; count: number }>}
 */
function computeMajorArcanaMapFromEntries(entries) { ... }

/**
 * Compute reading streak (consecutive days with readings).
 * @param {Array} entries - Journal entries (should be sorted by date)
 * @returns {number} - Current streak in days
 */
function computeStreakFromEntries(entries) { ... }

/**
 * Compute virtual badges for cards appearing 3+ times.
 * These are not persisted to D1, just computed for filtered views.
 * @param {Array} entries - Journal entries
 * @returns {Array<{ card_name: string; count: number; earned_at: number }>}
 */
function computeBadgesFromEntries(entries) { ... }
```

#### Cache Invalidation Strategy

The narrative cache (localStorage) should be invalidated when:

| Event | Invalidation |
|-------|--------------|
| New entry saved | Clear cache, recompute on next render |
| Entry deleted | Clear cache |
| Backfill completed | Clear cache |
| Filter changed | Don't cache filtered views (compute fresh) |
| Different device | Cache is per-device; server data (Archetype) syncs |

#### Season Key Specification

The cache key must uniquely identify the narrative context to prevent collisions:

**Key format:**
```
{userId}:{viewType}:{windowStart}:{windowEnd}:{locale}:{timezone}
```

**Components:**

| Component | Format | Example |
|-----------|--------|---------|
| `userId` | User ID string | `user_abc123` |
| `viewType` | `default` \| `filtered:{hash}` | `default` or `filtered:a1b2c3` |
| `windowStart` | ISO date (date only) | `2024-12-01` |
| `windowEnd` | ISO date (date only) | `2024-12-31` |
| `locale` | BCP 47 locale tag | `en-US` |
| `timezone` | IANA timezone | `America/New_York` |

**Examples:**

```javascript
// Unfiltered current month view
"user_abc123:default:2024-12-01:2024-12-31:en-US:America/New_York"

// Filtered view (never cached, but key shown for reference)
"user_abc123:filtered:f7e2a1:2024-11-15:2024-12-10:en-US:America/New_York"
```

**Filter hash computation:**
```javascript
function computeFilterHash(filteredEntries) {
  // Use first 6 chars of hash of sorted entry IDs
  const ids = filteredEntries.map(e => e.id).sort().join(',');
  return hashString(ids).slice(0, 6);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
```

**Key generation helper:**
```javascript
function buildSeasonKey({
  userId,
  filtersActive,
  filteredEntries,
  seasonWindow,
  locale,
  timezone,
}) {
  const viewType = filtersActive
    ? `filtered:${computeFilterHash(filteredEntries)}`
    : 'default';

  const startDate = seasonWindow.start.toISOString().split('T')[0];
  const endDate = seasonWindow.end.toISOString().split('T')[0];
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return `${userId}:${viewType}:${startDate}:${endDate}:${locale}:${tz}`;
}
```

**Important:** Filtered views should NOT be cached (return early in `setCachedNarrative`). The key format supports them for debugging/logging only.

#### Cache Implementation

```javascript
// In useJourneyData or a separate useNarrativeCache hook
const NARRATIVE_CACHE_KEY = 'journey_narrative_cache';

/**
 * SSR-safe storage abstraction.
 * Returns null operations when localStorage is unavailable (SSR, Workers, etc.)
 */
const safeStorage = {
  isAvailable: typeof window !== 'undefined' && window.localStorage,

  getItem(key) {
    if (!this.isAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      // Handle quota exceeded, private browsing, etc.
      return null;
    }
  },

  setItem(key, value) {
    if (!this.isAvailable) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if storage is unavailable
    }
  },
};

function getCachedNarrative(userId, seasonKey) {
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

function setCachedNarrative(userId, seasonKey, narrative) {
  // Don't cache filtered views (seasonKey includes filter hash)
  if (seasonKey.includes('filtered:')) return;

  const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
  const cache = raw ? JSON.parse(raw) : {};

  cache[`${userId}:${seasonKey}`] = {
    narrative,
    timestamp: Date.now(),
  };

  safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
}

function invalidateNarrativeCache(userId) {
  const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
  if (!raw) return;

  try {
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
    safeStorage.setItem(NARRATIVE_CACHE_KEY, '{}');
  }
}

// Call invalidateNarrativeCache when:
// - useJournal's saveEntry succeeds
// - useJournal's deleteEntry succeeds
// - Archetype backfill completes

// Example integration in useJournal hook:
// useEffect(() => {
//   if (lastSaveSuccess) {
//     invalidateNarrativeCache(userId);
//   }
// }, [lastSaveSuccess, userId]);
```

---

## Integration with Journal.jsx

### Desktop (Right Rail)

```jsx
// In Journal.jsx
import { ReadingJourney } from './ReadingJourney';

// Compute filtersActive from filter state (not from entry comparison)
const filtersActive = Boolean(
  activeContext || activeSpread || activeDeck || activeTimeframe
);

// Desktop layout
<aside className="hidden lg:block lg:w-[380px]">
  <div className="lg:sticky lg:top-6 space-y-6">
    <JournalFilters ... />

    <ReadingJourney
      entries={entries}
      filteredEntries={filteredEntries}
      filtersActive={filtersActive}  // Explicit flag from filter state
      isAuthenticated={isAuthenticated}
      userId={user?.id}
      variant="sidebar"
      onCreateShareLink={createShareLink}
      onStartReading={handleStartReading}
    />
  </div>
</aside>
```

### Mobile (Single Accordion → Sheet)

```jsx
// In Journal.jsx
// Replace 3 accordions with single Journey section

<div className="lg:hidden space-y-4">
  <JournalFilters variant="compact" ... />

  <ReadingJourney
    entries={entries}
    filteredEntries={filteredEntries}
    filtersActive={filtersActive}  // Explicit flag from filter state
    isAuthenticated={isAuthenticated}
    userId={user?.id}
    variant="mobile"
    onCreateShareLink={createShareLink}
    onStartReading={handleStartReading}
  />
</div>
```

### Component Props

```typescript
interface ReadingJourneyProps {
  // Data
  entries: JournalEntry[];           // All entries (unfiltered)
  filteredEntries?: JournalEntry[];  // Filtered entries (when filters active)

  // Filter state - RECOMMENDED: pass explicitly from filter state, not derived from entries
  filtersActive?: boolean;           // True when any filter is applied

  // Auth
  isAuthenticated: boolean;
  userId?: string;

  // Layout
  variant: 'sidebar' | 'mobile' | 'fullpage';

  // Optional explicit time window (defaults to current month or filter range)
  seasonWindow?: { start: Date; end: Date };

  // Localization (for date formatting in narratives)
  locale?: string;    // e.g., 'en-US', 'fr-FR' (default: 'en-US')
  timezone?: string;  // IANA timezone, e.g., 'America/New_York' (default: browser)

  // Callbacks
  onCreateShareLink?: (options: ShareOptions) => Promise<ShareResult>;
  onStartReading?: (suggestion: CoachSuggestion) => void;
}
```

**Note on `filtersActive`**: This prop should be computed from the actual filter state (e.g., `Boolean(activeContext || activeSpread)`) rather than derived from entry comparison. Length-only comparison misses filters that don't change entry count (e.g., context filters on a homogeneous journal). If not provided, the hook falls back to entry ID comparison as a heuristic.

**Note on localization**: The component uses explicit locale/timezone to ensure consistent date formatting across environments. If not provided, `locale` defaults to `'en-US'` and `timezone` uses the browser's default. For server-rendered previews or share pages, pass these explicitly from user preferences or request headers.

---

## Migration Path

### Phase 1: Create Unified Hook (Non-Breaking)

- [ ] Build `useJourneyData` hook
- [ ] Add `generateSeasonNarrative()` utility
- [ ] Add `computeEnhancedCoachSuggestion()` utility
- [ ] Export `computePreferenceDrift()` from `journalInsights.js` (currently only used internally)
- [ ] Add `computeMajorArcanaMapFromEntries()` to `journalInsights.js`
- [ ] Add `computeStreakFromEntries()` to `journalInsights.js`
- [ ] Add `computeBadgesFromEntries()` to `journalInsights.js`
- [ ] Add `generateJourneyStory()` to `journalInsights.js` (new function)
- [ ] Add `safeStorage` abstraction for SSR-safe localStorage
- [ ] Add `buildSeasonKey()` helper for cache keys
- [ ] Unit tests for data merging logic
- [ ] Unit tests for null/empty entry handling
- [ ] Unit tests for filter detection (explicit prop vs fallback)

### Phase 2: Build Season Summary

- [ ] Create `SeasonSummary` component
- [ ] Display above existing Insights/Archetype panels
- [ ] Gather user feedback on narrative quality
- [ ] A/B test engagement with coach suggestion

### Phase 3: Implement Tabbed Interface

- [ ] Build `JourneyTabs` with swipe support
- [ ] Create `CardsTab` (migrate from ArchetypeJourneySection)
- [ ] Create `PatternsTab` (migrate from JournalInsightsPanel)
- [ ] Create `ExportTab` (extract from JournalInsightsPanel)
- [ ] Add `JourneyMobileSheet` with bottom sheet behavior

### Phase 4: Desktop Bento Grid

- [ ] Build `JourneyBentoGrid` layout
- [ ] Create `/journey` full-page route
- [ ] Build `JourneySidebar` condensed variant
- [ ] Add keyboard shortcuts
- [ ] Add hover states for cards

### Phase 5: Deprecate & Polish

- [ ] Remove `JournalInsightsPanel.jsx`
- [ ] Remove `ArchetypeJourneySection.jsx`
- [ ] Add haptic feedback on mobile
- [ ] Add reduced motion support
- [ ] Performance audit (lazy load tabs, memoization)
- [ ] Accessibility audit (ARIA, keyboard nav, screen reader)

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Tab navigation | Arrow keys cycle through tabs |
| Screen reader | Announce tab changes, badge earnings |
| Reduced motion | Disable swipe animations, use instant transitions |
| Focus management | Trap focus in bottom sheet when open |
| Color contrast | All text meets WCAG AA (4.5:1) |
| Touch targets | Minimum 44×44px on mobile |

---

## Performance Considerations

| Optimization | Approach |
|--------------|----------|
| Lazy load tabs | Only render active tab content |
| Memoize stats | `useMemo` for all computed values |
| Virtualize badges | If > 20 badges, use virtual scroll |
| Debounce filters | 150ms debounce on filter changes |
| Cache narrative | Store in localStorage with 24h TTL |
| Skeleton loading | Show placeholders during data fetch |

---

## Summary

| Aspect | Current State | Unified Design |
|--------|---------------|----------------|
| **Components** | 2 separate panels | 1 unified `ReadingJourney` |
| **Mobile UX** | 3 accordions | Hero card + tabbed bottom sheet |
| **Desktop UX** | Stacked panels in rail | Bento grid or condensed sidebar |
| **Data** | Duplicated (top cards, cadence) | Single source via `useJourneyData` |
| **Narrative** | Separate story panel | Integrated Season Summary |
| **Badges** | Own section | Inline with cards |
| **Coach** | Buried in Insights | FAB + Season Summary |
| **Export** | Toolbar buttons | Dedicated tab |
| **Mental model** | "Stats" vs "Tracking" | "Your Reading Journey" |

### Key Benefits

- **Reduced cognitive load** — One place for all journey insights
- **Better mobile UX** — Hero card + swipeable tabs vs. 3 accordions
- **No duplication** — Single cadence chart, single card frequency list
- **Coherent narrative** — Story connects cards, patterns, and coach
- **Cleaner codebase** — Single component tree, one data hook
