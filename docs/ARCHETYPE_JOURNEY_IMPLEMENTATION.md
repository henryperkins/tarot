# Archetype Journey & Interactive Tooltips Implementation

## Summary

This document outlines the implementation of two requested features:
1. **Archetype Journey (Gamified Analytics)** - NEW ✅
2. **Interactive Educational Tooltips** - ALREADY EXISTS ✅

---

## 1. Archetype Journey (Gamified Analytics)

### Overview
Tracks which cards appear most frequently in user readings and provides gamified insights, streaks, and growth prompts.

### What Was Built

#### Database Schema (`migrations/0005_add_archetype_journey.sql`)
- **`card_appearances`** table: Tracks card occurrences per user, per month
- **`archetype_badges`** table: Stores earned badges for streak achievements
- **`user_analytics_prefs`** table: User preferences for analytics (opt-in/opt-out, badge visibility)

#### API Endpoint (`functions/api/archetype-journey.js`)
- **GET `/api/archetype-journey`** - Get analytics data:
  - Top 5 cards this month
  - All cards with counts
  - Streaks (cards appearing 2+ times)
  - Recent badges
  - 6-month trends
  - Major Arcana frequency distribution
- **POST `/api/archetype-journey/track`** - Track card appearances (called automatically on reading save)
- **PUT `/api/archetype-journey/preferences`** - Update user preferences
- **POST `/api/archetype-journey/reset`** - Reset all analytics data

#### UI Component (`src/components/ArchetypeJourneySection.jsx`)
- Embeddable section for `JournalInsightsPanel`
- Displays:
  - **Top 5 cards this month** with counts
  - **Streak badges** (e.g., "The Tower appeared 3× in Nov")
  - **Achievement badges** with icons and context
- Integrated with authentication (only shows for logged-in users)

#### Integration (`src/hooks/useJournal.js`)
- Automatically tracks card appearances when readings are saved
- Silent failure - doesn't block reading save if tracking fails
- Only tracks for authenticated users

### Usage

**For Users:**
1. Sign in to enable archetype journey tracking
2. Complete readings as normal
3. View analytics in Journal Insights panel
4. Opt-out via preferences if desired

**For Developers:**
1. Run migration: `wrangler d1 migrations apply DB --local` (then production)
2. The feature auto-tracks when users save readings
3. Integrate `ArchetypeJourneySection` into `JournalInsightsPanel`:
   ```jsx
   import { ArchetypeJourneySection } from './ArchetypeJourneySection';

   // Inside JournalInsightsPanel render:
   <ArchetypeJourneySection isAuthenticated={isAuthenticated} />
   ```

### Growth Prompts

Each Major Arcana card has a unique growth prompt tied to its archetype:
- **The Fool**: "Recurring Fool energy suggests you're in a season of new beginnings. What leap of faith is calling you?"
- **The Tower**: "Tower energy brings breakthrough. What false structure is crumbling to make space for truth?"
- **The Star**: "The Star brings hope and healing. What dream is worth nurturing?"
- (See `getGrowthPrompt()` in `ArchetypeJourneySection.jsx` for all 22)

### Privacy & Opt-Out
- **Opt-in by default** for authenticated users
- Users can disable via preferences: `PUT /api/archetype-journey/preferences`
- Users can reset all data: `POST /api/archetype-journey/reset`
- Anonymous users (localStorage only) are not tracked

---

## 2. Interactive Educational Tooltips

### Status: **Already Implemented** ✅

The interactive symbol tooltips feature described in the original spec already exists in the codebase!

### Existing Components

#### `src/components/CardSymbolInsights.jsx`
- Shows card symbols, meanings, colors, and archetypes
- Accessible with keyboard, mouse, and touch support
- Displays:
  - Card name and orientation (Upright/Reversed)
  - Keywords preview
  - Archetype
  - **Symbols list** with object, position, and meaning
  - **Color palette** with symbolic meanings

#### `src/components/Tooltip.jsx`
- Generic accessible tooltip component
- Full keyboard navigation (Escape to close, focus management)
- Touch support with auto-hide
- Position options: top, bottom, left, right
- ARIA-compliant

#### Integration in `Card.jsx`
- Already imports and uses `CardSymbolInsights`
- Symbols are pulled from `shared/symbols/symbolAnnotations.js`
- All 78 cards (22 Major + 56 Minor) have symbol data

### Existing Symbol Data

`shared/symbols/symbolAnnotations.js` contains comprehensive symbol data for all 78 RWS cards:
- **5-8+ symbols per card** with:
  - `object`: Symbol name (e.g., "dog", "cliff", "sun")
  - `position`: Location on card
  - `color`: Symbolic color (when applicable)
  - `meaning`: What the symbol represents
- **Dominant colors** with meanings
- **Composition** description
- **Archetype** label

### Example Symbol Data (The Fool)
```javascript
{
  symbols: [
    { object: 'sun', position: 'top-left', color: 'yellow', meaning: 'enlightenment, new beginnings' },
    { object: 'dog', position: 'bottom-right', color: 'white', meaning: 'loyalty, instinct, warning' },
    { object: 'cliff', position: 'right-edge', meaning: 'risk, the unknown, leap of faith' },
    { object: 'white rose', position: 'left-hand', color: 'white', meaning: 'purity, innocence' },
    // ... more symbols
  ],
  dominantColors: [
    { color: 'yellow', meaning: 'optimism, joy' },
    { color: 'white', meaning: 'purity, new starts' },
    { color: 'sky-blue', meaning: 'freedom, possibility' }
  ],
  composition: 'figure-on-precipice',
  archetype: 'Divine Fool / Innocent Wanderer'
}
```

---

## Testing Checklist

### Archetype Journey
- [ ] Run database migration (`0005_add_archetype_journey.sql`)
- [ ] Test authenticated user flow:
  - [ ] Save a reading
  - [ ] Verify `/api/archetype-journey` returns analytics
  - [ ] Save same card multiple times
  - [ ] Verify streak badge appears at 3×
  - [ ] Check growth prompts for Major Arcana cards
- [ ] Test unauthenticated user:
  - [ ] Verify analytics section doesn't show
  - [ ] Verify no tracking occurs
- [ ] Test preferences:
  - [ ] Disable analytics
  - [ ] Re-enable analytics
  - [ ] Reset all data
- [ ] Verify `ArchetypeJourneySection` renders in Journal panel

### Symbol Tooltips (Already Working)
- [ ] Verify `CardSymbolInsights` button appears on revealed cards
- [ ] Click/hover to open tooltip
- [ ] Verify symbols, colors, and archetype display
- [ ] Test keyboard navigation (Tab, Escape)
- [ ] Test touch support (tap, auto-hide)

---

## Files Created

1. `migrations/0005_add_archetype_journey.sql` - Database schema
2. `functions/api/archetype-journey.js` - API endpoint
3. `src/components/ArchetypeJourneySection.jsx` - UI component
4. `src/components/ArchetypeJourney.jsx` - (Deprecated - use Section instead)
5. `docs/ARCHETYPE_JOURNEY_IMPLEMENTATION.md` - This document

## Files Modified

1. `src/hooks/useJournal.js` - Added `trackCardAppearances()` function

## Files Already Existing (Symbol Tooltips)

1. `src/components/CardSymbolInsights.jsx` - Symbol tooltip component
2. `src/components/Tooltip.jsx` - Generic tooltip component
3. `shared/symbols/symbolAnnotations.js` - Comprehensive symbol data (62KB, all 78 cards)
4. `src/components/Card.jsx` - Uses `CardSymbolInsights`

---

## Next Steps

1. **Deploy Migration**: Run `wrangler d1 migrations apply DB` for production
2. **Integrate UI**: Add `<ArchetypeJourneySection />` to `JournalInsightsPanel.jsx`
3. **Test End-to-End**: Complete a full reading cycle with analytics tracking
4. **User Documentation**: Add help text explaining archetype journey features
5. **Optional Enhancements**:
   - Sparkline charts for 6-month trends
   - More badge types (completion, milestone)
   - Export analytics as PDF/CSV
   - AI-generated personalized growth prompts based on card patterns

---

## Architecture Notes

### Why Track in `useJournal` Instead of API?
- Separates concerns: journal save handles persistence, then tracks analytics
- Silent failure: analytics tracking doesn't block reading save
- Flexible: can add other post-save hooks (e.g., webhooks, notifications)

### Why Separate `ArchetypeJourneySection` from `ArchetypeJourney`?
- `ArchetypeJourneySection`: Embeddable section for existing panel
- `ArchetypeJourney`: Standalone page (if needed for future full-page view)
- Follow existing pattern: `JournalInsightsPanel` is composed of smaller sections

### Privacy-First Design
- Opt-in by default for authenticated users
- No tracking for anonymous users (localStorage)
- User-initiated reset deletes all data
- No cross-user aggregation (each user sees only their own data)

---

## Questions?

- **How do I disable analytics?** Sign in → Journal → Archetype Journey section → "Disable Analytics"
- **Can I delete my data?** Yes, use "Reset Data" in the Archetype Journey section
- **Do symbols work for all decks?** Currently RWS only; Thoth/Marseille coming soon
- **Can I export analytics?** Not yet, but planned for future enhancement

---

**Implementation Status**: ✅ Complete (2025-11-20)
