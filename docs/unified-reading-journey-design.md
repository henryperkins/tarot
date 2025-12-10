# Unified Reading Journey Design

Combining Journal Insights and Archetype Journey features for desktop and mobile.

## Current State

| Aspect | Journal Insights | Archetype Journey |
|--------|-----------------|-------------------|
| **Focus** | Entry-based, filterable | Card-based, all-time |
| **Data** | Stats, contexts, themes, drift | Top cards, streaks, badges, Major Arcana |
| **Charts** | 6-month cadence | 6-month trends |
| **Actions** | Export, share, coach suggestion | Backfill, growth prompts |
| **Location** | Desktop: right rail / Mobile: accordion | Desktop: right rail / Mobile: accordion |

### Overlap & Redundancy

1. **Top Cards** — Both show frequent cards (Insights: "Frequent Cards", Archetype: "Top 5 This Month")
2. **Cadence Charts** — Both have 6-month visualizations
3. **Reading Stats** — Both count total readings/entries

### Complementary Data

| Insights-Only | Archetype-Only |
|---------------|----------------|
| Context breakdown (Love, Career, etc.) | Badges/achievements |
| Preference drift analysis | Streak tracking |
| Reversal rate | Major Arcana tiles |
| Recent themes | Growth prompts per card |
| Journey story prose | Per-card appearance history |

---

## Proposed Design: "Your Reading Journey" Unified Dashboard

### Design Philosophy

1. **Progressive disclosure** — Show summary first, details on demand
2. **No duplication** — Single source for overlapping data
3. **Mobile-first** — Design for constraints, then expand
4. **Task-oriented** — Surface what users need when they need it

### Information Architecture

```
Your Reading Journey
├── 1. At-a-Glance Stats (combined)
│   ├── Total readings
│   ├── Cards drawn
│   ├── Reversal rate (Insights)
│   └── Current streak (Archetype)
│
├── 2. Cards Calling You (merged top cards)
│   ├── Top 5 cards with appearance counts
│   ├── Badge indicators on achieved cards
│   ├── Context tags (which contexts each appears in)
│   └── Growth prompt for top card
│
├── 3. Reading Patterns (merged)
│   ├── Single 6-month cadence chart
│   ├── Context timeline ribbon
│   └── Preference drift indicator
│
├── 4. Major Arcana Map (Archetype)
│   └── Tile grid with frequency heat
│
├── 5. Themes & Story (Insights)
│   ├── Recent themes with icons
│   ├── Journey story prose (3+ entries)
│   └── Coach suggestion
│
└── 6. Actions Bar
    ├── Share journey
    ├── Export (PDF/CSV/Markdown)
    └── Reset analytics (Archetype)
```

---

## Desktop Layout

### Option A: Bento Grid (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR READING JOURNEY                         │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │     📊 AT-A-GLANCE          │ │     🃏 CARDS CALLING YOU     │ │
│ │ ───────────────────────     │ │ ───────────────────────────  │ │
│ │ 24 readings  │  156 cards   │ │  1. The Tower ×5 🔥          │ │
│ │ 23% reversed │  3-day streak│ │  2. High Priestess ×4        │ │
│ │                             │ │  3. Nine of Swords ×3        │ │
│ │                             │ │  4. The Moon ×3              │ │
│ │                             │ │  5. Ace of Cups ×2           │ │
│ └─────────────────────────────┘ │                              │ │
│                                 │  💡 "Tower's recurrence       │ │
│                                 │  invites you to examine..."   │ │
│                                 └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │    📈 READING RHYTHM        │ │    🔮 PATTERNS & THEMES      │ │
│ │ ───────────────────────     │ │ ───────────────────────────  │ │
│ │                             │ │                              │ │
│ │  ▁▂▄▆█▅▃▂▁▂▄▆▇▅▃           │ │  Career ████████  45%        │ │
│ │  J F M A M J (6-month)      │ │  Self   █████     28%        │ │
│ │                             │ │  Love   ███       15%        │ │
│ │  Context Timeline:          │ │  Other  ██        12%        │ │
│ │  ●●●○●●●●○○●●●●            │ │                              │ │
│ │  (Career-heavy lately)      │ │  ⚡ Drift: +Love emerging    │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────│
│ │                   ✨ MAJOR ARCANA MAP                         │ │
│ │ ─────────────────────────────────────────────────────────     │ │
│ │ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                │ │
│ │ │ 0││ I││II││III││IV││V││VI││VII││VIII││IX││X│                │ │
│ │ │▓▓││░░││▓▓││░░││░░││▓▓││░░││▓▓ ││░░ ││▓▓││░░│               │ │
│ │ └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                │ │
│ │ (heat intensity = frequency)                                  │ │
│ └───────────────────────────────────────────────────────────────│
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────│
│ │                   📖 YOUR JOURNEY STORY                       │ │
│ │ ─────────────────────────────────────────────────────────     │ │
│ │ "This month, your readings have centered on transformation    │ │
│ │ and hidden truths. The Tower's repeated appearances suggest   │ │
│ │ a period of necessary upheaval, while the High Priestess      │ │
│ │ reminds you to trust your intuition through the changes..."   │ │
│ │                                                               │ │
│ │  Recent themes: 🌙 Intuition  ⚡ Change  💔 Release           │ │
│ │                                                               │ │
│ │  ┌──────────────────────────────────────────────────────┐    │ │
│ │  │ 💡 NEXT STEP: Try a Decision spread to explore the   │    │ │
│ │  │    career crossroads your readings keep surfacing.   │    │ │
│ │  │                              [Start Reading →]        │    │ │
│ │  └──────────────────────────────────────────────────────┘    │ │
│ └───────────────────────────────────────────────────────────────│
├─────────────────────────────────────────────────────────────────┤
│            [Share ↗]    [Export ▼]    [Settings ⚙]              │
└─────────────────────────────────────────────────────────────────┘
```

### Desktop Implementation Notes

- **Grid**: `grid grid-cols-2 gap-6` for top sections, full-width for Major Arcana + Story
- **Sticky sidebar** option: Can render condensed version in right rail (current location)
- **Full-page mode**: Accessible via "Expand" button or `/journey` route
- **Constellation variant**: Cards Calling You section could use SVG positioning for visual flair

---

## Mobile Layout

### Option A: Hero Card + Bottom Sheet (Recommended)

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
│     [ See Full Journey ↓ ]     │
└─────────────────────────────────┘
         ↓ tap button
┌─────────────────────────────────┐
│ ════════════════════════════════│  ← drag handle
│                                 │
│  ▼ Cards Calling You            │
│    1. Tower ×5 · 2. High P ×4   │
│                                 │
│  ▼ Reading Rhythm               │
│    [6-month chart]              │
│                                 │
│  ▼ Patterns & Themes            │
│    Career 45% · Self 28%        │
│                                 │
│  ▼ Major Arcana Map             │
│    [scrollable tile row]        │
│                                 │
│  ▼ Your Journey Story           │
│    "This month..."              │
│                                 │
│  ─────────────────────────────  │
│  [Share]  [Export]  [Settings]  │
│                                 │
└─────────────────────────────────┘
```

### Option B: Segmented Control with Swipe

```
┌─────────────────────────────────┐
│         YOUR JOURNEY            │
├─────────────────────────────────┤
│  [ Overview | Cards | Story ]   │  ← segmented control
├─────────────────────────────────┤
│                                 │
│   ← swipe →                     │
│                                 │
│  ┌─────────────────────────────┐│
│  │ OVERVIEW tab content:       ││
│  │                             ││
│  │ Stats row (2×2 grid)        ││
│  │ Reading rhythm chart        ││
│  │ Context breakdown           ││
│  │ Preference drift            ││
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

### Mobile Implementation Notes

- **Hero card**: Shows most impactful insight (top recurring card + badge)
- **Bottom sheet**: `react-spring` or CSS `transform` for smooth animation
- **Accordion fallback**: For browsers without sheet support
- **Horizontal scroll**: For Major Arcana tiles on mobile
- **Touch gestures**: Swipe between tabs/sections

---

## Component Architecture

### New Component Structure

```
src/components/
├── ReadingJourney/
│   ├── index.jsx                    # Main container, layout switching
│   ├── JourneyDashboard.jsx         # Full bento grid (desktop)
│   ├── JourneyMobileSheet.jsx       # Bottom sheet (mobile)
│   ├── JourneyHeroCard.jsx          # Featured card highlight
│   │
│   ├── sections/
│   │   ├── AtAGlanceStats.jsx       # Merged stats row
│   │   ├── CardsCallingYou.jsx      # Merged top cards + badges
│   │   ├── ReadingRhythm.jsx        # Single cadence chart
│   │   ├── PatternsAndThemes.jsx    # Context breakdown + drift
│   │   ├── MajorArcanaMap.jsx       # Tile grid (from Archetype)
│   │   └── JourneyStory.jsx         # Prose + coach (from Insights)
│   │
│   └── shared/
│       ├── JourneyActions.jsx       # Share/Export/Settings bar
│       ├── BadgeIndicator.jsx       # Achievement badges
│       └── GrowthPrompt.jsx         # Reflection prompts
│
├── JournalInsightsPanel.jsx         # DEPRECATED → redirect to ReadingJourney
└── ArchetypeJourneySection.jsx      # DEPRECATED → redirect to ReadingJourney
```

### Data Layer

```javascript
// src/lib/readingJourney.js

export function computeUnifiedJourneyStats(entries, archetypeData) {
  // Merge Insights stats + Archetype analytics
  return {
    // From Insights
    totalEntries: ...,
    totalCards: ...,
    reversalRate: ...,
    contextBreakdown: ...,
    recentThemes: ...,
    preferenceDrift: ...,

    // From Archetype
    currentStreak: ...,
    topCards: ...,          // Deduplicated, merged view
    badges: ...,
    majorArcanaFrequency: ...,

    // Merged
    cadenceData: ...,       // Single 6-month chart data
    journeyStory: ...,      // Prose narrative
    coachSuggestion: ...,   // Next step recommendation
  };
}
```

---

## Integration with Journal.jsx

### Desktop (Right Rail)

```jsx
// In Journal.jsx desktop layout
<aside className="hidden lg:block lg:w-[380px] lg:sticky lg:top-0">
  <JournalFilters ... />

  {/* Replace both panels with unified component */}
  <ReadingJourney
    entries={allEntries}
    filteredEntries={filteredEntries}
    userId={user.id}
    variant="sidebar"  // Condensed view for rail
  />
</aside>
```

### Mobile (Accordion or Sheet)

```jsx
// In Journal.jsx mobile layout
<div className="lg:hidden">
  <JournalFilters ... />

  {/* Single accordion item instead of two */}
  <Accordion>
    <AccordionItem title="Your Journey">
      <ReadingJourney
        entries={allEntries}
        userId={user.id}
        variant="mobile"  // Hero card + "See more" sheet
      />
    </AccordionItem>
  </Accordion>
</div>
```

---

## Interaction Patterns

### Desktop Interactions

| Action | Behavior |
|--------|----------|
| Hover on card in "Cards Calling You" | Show growth prompt tooltip |
| Click card | Filter journal to readings with that card |
| Click context bar segment | Filter journal to that context |
| Click badge | Show achievement modal with history |
| Click "Expand" | Open full-page `/journey` route |
| Shift-click Major Arcana tile | Add to multi-filter |

### Mobile Interactions

| Action | Behavior |
|--------|----------|
| Tap hero card | Expand to show full top 5 |
| Tap "See Full Journey" | Open bottom sheet |
| Swipe sheet down | Dismiss to hero view |
| Tap section header | Expand/collapse accordion |
| Long-press card | Show context menu (filter, details) |

---

## Migration Path

### Phase 1: Create Unified Component (Non-Breaking)

1. Build `ReadingJourney/` component structure
2. Create merged data utilities
3. Add feature flag: `UNIFIED_JOURNEY_ENABLED`
4. Test in parallel with existing panels

### Phase 2: Gradual Rollout

1. Enable for new users by default
2. Add "Try new Journey view" toggle for existing users
3. Collect feedback on usability

### Phase 3: Deprecate Old Components

1. Remove `JournalInsightsPanel.jsx`
2. Remove `ArchetypeJourneySection.jsx`
3. Clean up duplicate utilities

---

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Components** | 2 separate panels | 1 unified dashboard |
| **Data overlap** | Duplicated top cards, cadence | Single source of truth |
| **Mobile UX** | 2 accordions | Hero card + sheet |
| **Desktop UX** | Stacked in rail | Bento grid or condensed |
| **Actions** | Split across panels | Unified action bar |
| **Mental model** | "Stats" vs "Tracking" | "Your Reading Journey" |

### Key Benefits

- **Reduced cognitive load** — One place for all journey insights
- **Better mobile UX** — Hero card surfaces most important insight
- **Deduplication** — Single cadence chart, single top cards list
- **Coherent narrative** — Story + cards + patterns in one flow
- **Cleaner codebase** — Single component tree to maintain
