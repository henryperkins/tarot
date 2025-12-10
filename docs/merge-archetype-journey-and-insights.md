# Unified Journal + Archetype Journey Design

## Current State Analysis

### Desktop Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Journal Pulse (constellation stats)                         │
├─────────────────────────────────┬───────────────────────────┤
│                                 │ Filters                   │
│  Journal History                │───────────────────────────│
│  (entries list)                 │ JournalInsightsPanel      │
│                                 │ • Cadence chart           │
│                                 │ • Frequent cards          │
│                                 │ • Context mix             │
│                                 │ • Themes + Coach          │
│                                 │───────────────────────────│
│                                 │ ArchetypeJourneySection   │
│                                 │ • Top 5 cards             │
│                                 │ • Badges/streaks          │
│                                 │ • Major Arcana focus      │
└─────────────────────────────────┴───────────────────────────┘
```

### Mobile Layout
```
┌─────────────────────────────────┐
│ Journal Pulse (2x2 grid)        │
├─────────────────────────────────┤
│ ▸ Filters (accordion)           │
│ ▸ Insights (accordion)          │
│ ▸ Archetype Journey (accordion) │
├─────────────────────────────────┤
│ Journal History (entries)       │
└─────────────────────────────────┘
```

### Data Overlap & Duplication

| Data Point | Journal Insights | Archetype Journey |
|------------|------------------|-------------------|
| Card frequency | Client-side `frequentCards` | D1 `card_appearances` |
| Monthly cadence | `monthlyCadence` (6 months) | 6-month trend data |
| Top cards display | Top 4 with reversal count | Top 5 with trend arrows |
| Context breakdown | Yes | No |
| Themes | Yes | No |
| Badges/streaks | No | Yes (3+ appearances) |
| Growth prompts | Coach suggestion | Per-card prompts |

---

## Design Vision: "Your Journey" Unified Dashboard

### Core Principles

1. **Single source of truth** — Use Archetype Journey's D1 data for card frequency (server-side, persistent); fall back to client-side computation for unauthenticated users
2. **Story-first** — Lead with narrative ("Your November was defined by..."), not raw stats
3. **Progressive disclosure** — Summary → Details → Deep dive
4. **Mobile-first** — Thumb-friendly, swipeable, minimal accordions
5. **Gamification without overwhelm** — Badges as rewards woven into narrative

---

## Information Architecture

### Level 1: Season Summary (Always Visible)

A single, compelling summary card that combines both features:

```
┌─────────────────────────────────────────────────────────────┐
│ ✦ Your December Journey                                     │
├─────────────────────────────────────────────────────────────┤
│ "A month of transformation. The Tower appeared 4× — your    │
│  most persistent messenger. Love readings dominated,        │
│  signaling where your energy flows."                        │
│                                                             │
│ [🃏 The Tower: 4×] [💫 3-read streak] [❤️ Love focus]      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Coach suggests: "What is The Tower trying to teach me   │ │
│ │ about releasing control in my relationships?"           │ │
│ │                                     [Start Reading →]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Top card + count → Archetype Journey
- Context breakdown → Journal Insights
- Streak badge → Archetype Journey badges
- Coach suggestion → Journal Insights (enhanced with card data)

---

### Level 2: Tabbed Detail View

Replace the accordion pattern with horizontal tabs on mobile, two-column layout on desktop:

```
Mobile:
┌─────────────────────────────────────────────────────────────┐
│ [Cards] [Patterns] [Export]                                 │
├─────────────────────────────────────────────────────────────┤
│ {Content for selected tab}                                  │
└─────────────────────────────────────────────────────────────┘

Desktop:
┌─────────────────────────────────┬───────────────────────────┐
│ Cards + Patterns                │ Export & Share            │
│ (scrollable column)             │ (sticky)                  │
└─────────────────────────────────┴───────────────────────────┘
```

---

### Tab: Cards

Unified card frequency display merging both features:

```
┌─────────────────────────────────────────────────────────────┐
│ Cards Calling You                                           │
│ "These cards keep appearing in your readings"               │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 1. The Tower          4× this month  ↑ trending         ││
│ │    [🔥 3+ streak badge]                                  ││
│ │    "What is being dismantled to make room for new?"     ││
│ │                                    [Growth prompt →]     ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ 2. Six of Cups        3× (2 reversed)                   ││
│ │    [🔥 3+ streak badge]                                  ││
│ │    Nostalgia, childhood, past connections               ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ 3. The Star           2×                                ││
│ │    Hope, renewal, spiritual insight                     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ Major Arcana This Month          Minor Arcana Suits        │
│ ┌─────┬─────┬─────┬─────┐       ┌─────┬─────┬─────┬─────┐  │
│ │ 0 F │ I M │ II  │ III │       │Wands│Cups │Swrd│Pent │  │
│ │ ●●  │ ●   │     │ ●   │       │ ●●● │ ●●  │ ●  │     │  │
│ └─────┴─────┴─────┴─────┘       └─────┴─────┴─────┴─────┘  │
│                                                             │
│ Achievements                                                │
│ [🔥 Tower Streak] [⭐ Six of Cups] [📖 10 Readings]        │
└─────────────────────────────────────────────────────────────┘
```

**Key changes:**
- Badge inline with card (not separate section)
- Growth prompt accessible via expand, not modal
- Reversal count shown inline
- Major/Minor heatmap combined view
- Achievements row (horizontal scroll on mobile)

---

### Tab: Patterns

Unified patterns view combining context, themes, and cadence:

```
┌─────────────────────────────────────────────────────────────┐
│ Reading Patterns                                            │
├─────────────────────────────────────────────────────────────┤
│ Your Focus Areas                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │   ❤️ Love        ████████████████░░░░  65% (13)        │ │
│ │   💼 Career      █████░░░░░░░░░░░░░░  20% (4)          │ │
│ │   🌟 Spiritual   ███░░░░░░░░░░░░░░░░  15% (3)          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ Context Timeline (6 months)                                 │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Jul │ Aug │ Sep │ Oct │ Nov │ Dec │                     │ │
│ │ ████│ ████│ ████│ ████│ ████│ ████│  ← Love           │ │
│ │  ░░ │  ░░ │ ░░░░│ ░░░░│ ░░░ │  ░░ │  ← Career         │ │
│ │     │ ░░  │     │ ░░  │ ░░  │ ░░░ │  ← Spiritual       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🔍 Emerging Interest: "Spiritual" readings increased 3×    │
│    since October. Update your focus areas? [Settings →]    │
│                                                             │
│ Themes Surfacing                                            │
│ [Transformation] [Letting Go] [New Beginnings] [Trust]     │
│                                                             │
│ Reading Cadence                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ▁▂▄▆█▇▅▃▂▁▂▄▆█▇▅▃▂▁▂▄▆█▇▅▃▂▁▂▄▆ (20 readings/month avg) │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ Story of This Season                                        │
│ "November was about confronting what no longer serves you.  │
│  The Tower's repeated appearances, especially in love       │
│  readings, suggest a necessary dismantling..."              │
│                                              [Read more →]  │
└─────────────────────────────────────────────────────────────┘
```

**Key changes:**
- Context breakdown with visual bars (not just badges)
- Context timeline ribbon (from JournalInsights)
- Drift detection inline (not separate component)
- Story panel integrated (was JourneyStoryPanel)
- Single cadence chart (not duplicated)

---

### Tab: Export & Share

Unified export/share interface:

```
┌─────────────────────────────────────────────────────────────┐
│ Export & Share                                              │
├─────────────────────────────────────────────────────────────┤
│ Export Your Journal                                         │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │   📄 PDF    │ │   📝 MD     │ │   📊 CSV    │            │
│ │ Full format │ │ Obsidian    │ │ Spreadsheet │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🖼️ Visual Card                                          │ │
│ │ Download a shareable image of your journey stats        │ │
│ │                                      [Generate SVG →]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Share a Reading                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Scope:    ○ Recent entries  ○ Single entry              │ │
│ │ Entries:  [3 ▼] entries to include                      │ │
│ │ Expires:  [1 week ▼]                                    │ │
│ │ Title:    [My November Journey____________]             │ │
│ │                                                         │ │
│ │                              [Create Share Link →]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Active Share Links                                          │
│ • "My November Journey" — expires Dec 17 [Copy] [Delete]   │
│ • "Celtic Cross Dec 3" — never expires   [Copy] [Delete]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Mobile-Specific Patterns

### 1. Bottom Sheet Instead of Accordion

Replace 3 accordion sections with a single expandable bottom sheet:

```
┌─────────────────────────────────────────────────────────────┐
│ Journal History                                             │
│ ...entries...                                               │
├─────────────────────────────────────────────────────────────┤
│ ━━━━━  (drag handle)                                       │
│ [🃏 Cards] [📊 Patterns] [↗️ Export]        [Filters 🔽]   │
└─────────────────────────────────────────────────────────────┘

↓ Pull up to expand ↓

┌─────────────────────────────────────────────────────────────┐
│ ━━━━━                                                       │
│ [🃏 Cards] [📊 Patterns] [↗️ Export]        [Filters 🔽]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ {Full tab content}                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Swipe Navigation Between Tabs

- Horizontal swipe to switch tabs
- Dot indicators for current tab
- Haptic feedback on tab change

### 3. Floating Action Button for Coach

```
┌───────────────────────────────┐
│                               │
│                               │
│                          ┌───┐│
│                          │ ✦ ││  ← "Start suggested reading"
│                          └───┘│
└───────────────────────────────┘
```

### 4. Compact Card Tiles

On mobile, card frequency tiles are more compact:

```
┌─────────────────────────────────┐
│ [Tower img] The Tower   4×  🔥 │
│             ↑ trending         │
├─────────────────────────────────┤
│ [Six Cups]  Six of Cups 3×  🔥 │
│             2 reversed         │
└─────────────────────────────────┘
```

Tap to expand for growth prompt (inline, not modal).

---

## Desktop-Specific Patterns

### 1. Two-Column Detail View

```
┌───────────────────────────────────┬─────────────────────────┐
│ Cards & Patterns                  │ Quick Actions           │
│ ┌─────────────────────────────┐   │ ┌─────────────────────┐ │
│ │ Cards Calling You           │   │ │ Export              │ │
│ │ ...                         │   │ │ [PDF][MD][CSV]      │ │
│ └─────────────────────────────┘   │ └─────────────────────┘ │
│ ┌─────────────────────────────┐   │ ┌─────────────────────┐ │
│ │ Patterns                    │   │ │ Share               │ │
│ │ ...                         │   │ │ [Create link...]    │ │
│ └─────────────────────────────┘   │ └─────────────────────┘ │
│                                   │                         │
│                                   │ Active Links            │
│                                   │ • Link 1 [Copy][×]     │
│                                   │ • Link 2 [Copy][×]     │
└───────────────────────────────────┴─────────────────────────┘
```

### 2. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `E` | Open export menu |
| `S` | Open share composer |
| `C` | Jump to Cards tab |
| `P` | Jump to Patterns tab |
| `N` | Start new reading (coach suggestion) |
| `?` | Show shortcuts |

### 3. Hover States for Cards

On desktop, hovering over a card tile shows:
- Brief meaning snippet
- Link to growth prompt
- Sparkline of appearances over time

---

## Component Architecture

### New Components

```
src/components/
├── JourneyDashboard/
│   ├── JourneyDashboard.jsx       # Main container
│   ├── SeasonSummary.jsx          # Level 1 summary card
│   ├── JourneyTabs.jsx            # Tab navigation (mobile/desktop)
│   ├── CardsTab/
│   │   ├── CardsTab.jsx           # Main cards view
│   │   ├── CardFrequencyTile.jsx  # Individual card with badge
│   │   ├── ArcanaHeatmap.jsx      # Major/Minor heatmaps
│   │   └── AchievementsRow.jsx    # Horizontal badge list
│   ├── PatternsTab/
│   │   ├── PatternsTab.jsx        # Main patterns view
│   │   ├── ContextBreakdown.jsx   # Context bars + timeline
│   │   ├── ThemeCloud.jsx         # Theme tags
│   │   ├── CadenceChart.jsx       # Reading frequency
│   │   └── SeasonStory.jsx        # Narrative summary
│   ├── ExportTab/
│   │   ├── ExportTab.jsx          # Main export view
│   │   ├── ExportButtons.jsx      # PDF/MD/CSV/SVG
│   │   ├── ShareComposer.jsx      # Share link creation
│   │   └── ActiveLinks.jsx        # Manage existing links
│   └── hooks/
│       ├── useJourneyData.js      # Unified data hook
│       ├── useSeasonNarrative.js  # Generate story text
│       └── useCoachSuggestion.js  # Smart recommendation
```

### Data Hook: `useJourneyData`

```javascript
function useJourneyData({ entries, isAuthenticated, userId }) {
  // Combine Archetype Journey (server) + Journal Insights (client)

  const archetypeData = useArchetypeJourney(userId, isAuthenticated);
  const insightsStats = useMemo(() => computeJournalStats(entries), [entries]);

  return {
    // Card frequency (prefer server data if authenticated)
    cardFrequency: isAuthenticated
      ? archetypeData.topCards
      : insightsStats.frequentCards,

    // Badges always from Archetype Journey
    badges: archetypeData.badges,

    // Context/themes from Journal Insights
    contextBreakdown: insightsStats.contextBreakdown,
    themes: insightsStats.recentThemes,

    // Cadence (merge both sources for richest data)
    cadence: mergeCadenceData(archetypeData.trends, insightsStats.monthlyCadence),

    // Coach suggestion (enhanced with badge data)
    coachSuggestion: computeEnhancedCoachSuggestion({
      topCard: cardFrequency[0],
      topContext: contextBreakdown[0],
      topTheme: themes[0],
      badges,
    }),

    // Drift detection
    preferenceDrift: insightsStats.preferenceDrift,

    // Loading states
    isLoading: archetypeData.isLoading,
    hasBackfilled: archetypeData.hasBackfilled,
  };
}
```

---

## Migration Path

### Phase 1: Create Unified Container (Non-breaking)
- Add `JourneyDashboard` wrapper that renders both existing components
- Add `useJourneyData` hook to unify data fetching
- No visual changes yet

### Phase 2: Build Season Summary
- Create `SeasonSummary` component with combined narrative
- Display above existing components
- Test with users, gather feedback

### Phase 3: Implement Tabbed Interface
- Build tab navigation (horizontal swipe on mobile)
- Migrate Insights → `PatternsTab`
- Migrate Archetype Journey → `CardsTab`
- Add `ExportTab` (extracted from Insights)

### Phase 4: Deprecate Old Components
- Remove `JournalInsightsPanel` and `ArchetypeJourneySection`
- Remove accordion sections on mobile
- Add keyboard shortcuts on desktop

### Phase 5: Polish & Enhance
- Add haptic feedback on mobile
- Implement bottom sheet gesture
- Add growth prompt inline expansion
- Add hover states on desktop

---

## Technical Considerations

### Performance
- **Lazy load tabs**: Only render active tab content
- **Memoize computations**: `useMemo` for stats, cadence, narrative
- **Virtualize badge list**: If > 20 badges, use virtual scroll

### Accessibility
- Tab navigation via arrow keys
- ARIA labels for all interactive elements
- Reduced motion support for tab transitions
- Screen reader announcements for tab changes

### Data Sync
- On new reading saved → refresh both Archetype Journey + local stats
- On backfill complete → invalidate all cached data
- Show optimistic updates for badge awards

---

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Mobile UX** | 3 accordions | Bottom sheet + tabs |
| **Card frequency** | Duplicated | Single source (Archetype Journey) |
| **Narrative** | Separate story panel | Integrated season summary |
| **Badges** | Separate section | Inline with cards |
| **Coach** | Buried in Insights | Floating FAB + summary |
| **Export** | Toolbar in Insights | Dedicated tab |
| **Data hook** | Two separate sources | Unified `useJourneyData` |

This design reduces cognitive load, eliminates duplication, and creates a cohesive "journey" narrative that helps users understand their tarot practice holistically.
