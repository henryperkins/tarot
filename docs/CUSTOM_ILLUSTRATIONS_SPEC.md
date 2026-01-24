# Custom Illustrations Integration Specification

Based on analysis of the Journal screenshot and existing codebase, this document identifies all areas where original custom illustrations could be integrated to enhance the visual experience.

---

## Overview

The Tarot Journal currently uses:

- Phosphor Icons for UI elements
- Spread artwork images in `selectorimages/` (already custom illustrations)
- Deck artwork in `public/images/deck-art/`
- Empty state illustrations via `EmptyJournalIllustration`, `ArchetypeEmptyIllustration`, and `NoFiltersIllustration` backed by `public/images/illustrations/empty-states/`
- Badge art in `public/images/illustrations/badges/` wired into `AchievementsRow.jsx`
- Suit icons in `SuitIcons.jsx` wired into `CardsCallingYou.jsx`

Custom illustrations would elevate the mystical aesthetic while maintaining the dark, sophisticated theme (`bg-surface`, `border-secondary/30`, gold/amber accents).

---

## Integration Areas by Priority

### 🎯 HIGH PRIORITY

#### 1. Empty State Illustrations (Implemented)

**Location:** `src/components/journal/JournalEmptyState.jsx`

**Current:** `JournalEmptyState` renders `EmptyJournalIllustration` with `public/images/illustrations/empty-states/empty-journal.png` (plus `.webp`).

**Files:**

- `src/components/journal/JournalEmptyState.jsx`
- `src/components/illustrations/EmptyJournalIllustration.jsx`
- `public/images/illustrations/empty-states/empty-journal.png`
- `public/images/illustrations/empty-states/empty-journal.webp`

---

#### 2. Archetype Journey Empty State (Implemented)

**Location:** `src/components/ReadingJourney/sections/EmptyState.jsx`

**Current:** `EmptyState` renders `ArchetypeEmptyIllustration` with `public/images/illustrations/empty-states/archetype-empty.png` (plus `.webp`).

**Files:**

- `src/components/ReadingJourney/sections/EmptyState.jsx`
- `src/components/illustrations/ArchetypeEmptyIllustration.jsx`
- `public/images/illustrations/empty-states/archetype-empty.png`
- `public/images/illustrations/empty-states/archetype-empty.webp`

---

#### 3. Journal Pulse Decorative Headers

**Location:** `src/components/journal/JournalSummaryBand.jsx`

**Screenshot area:** "Journal Pulse" section with stats cards

**Current:** Uses `JournalIcons` glyphs for stat chips (entries, reversals, etc.).
**Proposed:** Add small illustrative icons/decorations for each stat category

| Stat Card      | Illustration Concept                   |
| -------------- | -------------------------------------- |
| Entries Logged | Stack of journal pages with quill      |
| Reversal Rate  | Card flipping with motion trails       |
| Top Context    | Heart/Star/Crown based on context type |
| Last Entry     | Moon phase indicator                   |

**Files to modify:**

- `src/components/journal/JournalSummaryBand.jsx`
- Create: `src/components/illustrations/PulseIcons.jsx` (SVG components)

---

### 🔶 MEDIUM PRIORITY

#### 4. Suit/Element Indicator Icons (Implemented)

**Location:** Top cards list in ReadingJourney

**Current:** `CardsCallingYou.jsx` renders suit icons via `getSuitIcon()` from `SuitIcons.jsx`.

**Implementation:**

```jsx
import { getSuitIcon } from '../../illustrations/SuitIcons';

// In card list render:
const SuitIcon = getSuitIcon(card.name);
{SuitIcon && <SuitIcon className={`h-4 w-4 ${suitColor}`} />}
```

**Suit color mapping:**
- Cups: `text-blue-400` (Water)
- Wands: `text-amber-400` (Fire)
- Swords: `text-slate-400` (Air)
- Pentacles: `text-emerald-400` (Earth)
- Major Arcana: `text-purple-400`

**Files:**

- `src/components/illustrations/SuitIcons.jsx` — Icon components + `getSuitIcon()` helper
- `src/components/ReadingJourney/sections/CardsCallingYou.jsx` — Integration

---

#### 5. Recent Themes Visual Accents

**Location:** `src/components/ReadingJourney/JourneySidebar.jsx` and `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Screenshot area:** "Recent Themes" section with bullet list

**Current:** Simple bullet points (colored dots)
**Proposed:** Theme-specific mini illustrations

| Theme Type    | Visual            |
| ------------- | ----------------- |
| Relationships | Intertwined hands |
| Growth        | Sprouting plant   |
| Transition    | Bridge/doorway    |
| Abundance     | Overflowing cup   |
| Challenge     | Mountain peak     |

**Files to modify:**

- `src/components/ReadingJourney/JourneySidebar.jsx`
- `src/components/ReadingJourney/JourneyMobileSheet.jsx`
- Create: `src/components/illustrations/ThemeIcons.jsx`

---

#### 6. Achievement/Badge Illustrations (Implemented)

**Location:** `src/components/ReadingJourney/sections/AchievementsRow.jsx`

**Current:** Uses `BadgeIllustrations` components with Phosphor icon fallbacks.

**Implementation:**

```jsx
import {
  FirstReadingBadge,
  TenReadingsBadge,
  FiftyReadingsBadge,
  StreakBadge,
  MasteryBadge,
} from '../../illustrations/BadgeIllustrations';

// Badge type mapping
const BADGE_ILLUSTRATIONS = {
  star: FirstReadingBadge,
  first_reading: FirstReadingBadge,
  medal: TenReadingsBadge,
  ten_readings: TenReadingsBadge,
  trophy: FiftyReadingsBadge,
  fifty_readings: FiftyReadingsBadge,
  fire: StreakBadge,
  flame: StreakBadge,
  streak: StreakBadge,
  sparkle: MasteryBadge,
  mastery: MasteryBadge,
};
```

**Badge illustrations:**

| Badge Type | Component | Asset Path |
|------------|-----------|------------|
| First reading | `FirstReadingBadge` | `/images/illustrations/badges/first-reading.png` |
| 10 readings | `TenReadingsBadge` | `/images/illustrations/badges/ten-readings.png` |
| 50 readings | `FiftyReadingsBadge` | `/images/illustrations/badges/fifty-readings.png` |
| Streak | `StreakBadge` | `/images/illustrations/badges/streak-fire.png` |
| Mastery | `MasteryBadge` | `/images/illustrations/badges/mastery-glow.png` |

**Files:**

- `src/components/illustrations/BadgeIllustrations.jsx` — Badge components with WebP fallback
- `src/components/ReadingJourney/sections/AchievementsRow.jsx` — Integration

---

#### 7. Suggested Focus Decorative Frame

**Location:** `src/components/ReadingJourney/sections/SeasonSummary.jsx`

**Screenshot area:** Coach suggestion callout ("💡" suggestion)

**Current:** Plain bordered card
**Proposed:** Mystical frame illustration around the suggestion

**Design concept:**

- Corner flourishes with cosmic/celestial motifs
- Subtle animated shimmer effect (CSS)
- Integrated "Intention Coach" brand mark

**Files to modify:**

- `src/components/ReadingJourney/sections/SeasonSummary.jsx`
- Create: `public/images/illustrations/coach-frame.svg`

---

### 🔵 LOWER PRIORITY (Enhancement)

#### 8. Filter Section Background Pattern

**Location:** `src/components/JournalFilters.jsx`

**Current:** Solid dark surface background
**Proposed:** Subtle repeating pattern overlay

**Pattern concepts:**

- Faint star constellation grid
- Sacred geometry (seed of life, subtle)
- Moon phase strip at edges

**Implementation:**

```css
.journal-filters-panel {
  background-image: url("/images/patterns/stars-subtle.svg");
  background-repeat: repeat;
  background-size: 200px;
  background-blend-mode: soft-light;
  opacity: 0.03;
}
```

**Files to create:**

- `public/images/patterns/stars-subtle.svg`
- Modify: `src/styles/tarot.css`

---

#### 9. Context Mix Visual Legend

**Location:** `src/components/ReadingJourney/sections/ContextBreakdown.jsx`

**Screenshot area:** "Context Mix" section with tags

**Current:** Plain colored tags (love, career, spiritual, etc.)
**Proposed:** Each context has a unique mini-illustration

| Context   | Visual Symbol          |
| --------- | ---------------------- |
| Love      | Heart with wings       |
| Career    | Rising sun/ladder      |
| Self      | Mirror/reflection      |
| Spiritual | Third eye/lotus        |
| Wellbeing | Balanced scales        |
| Decision  | Forking path           |
| General   | Four elements combined |

**Files to create:**

- `src/components/illustrations/ContextIcons.jsx`

---

#### 10. Loading State Animation

**Location:** `src/components/Journal.jsx` (search/loading state)

**Current:** Simple spinning border circle
**Proposed:** Custom animated illustration

**Animation concept:**

- Three cards slowly fanning out
- Stars twinkling around
- Moon phases cycling

**Files to create:**

- `src/components/illustrations/JournalLoader.jsx` (Lottie or CSS animation)

---

#### 11. Share Link Visual Cards

**Location:** `src/components/ReadingJourney/sections/ExportSection.jsx`

**Screenshot area:** "Active Share Links" section

**Current:** Plain cards with copy/delete buttons
**Proposed:** Each link shows a preview card with custom art

**Concept:**

- Mini "postcard" style with envelope illustration
- Decorative seal/stamp effect
- View count shown as eye icon with rays

---

#### 12. "Today" Section Illustration (Removed)

**Status:** The "Keep today's focus handy" panel is no longer present in the current journal layout.

**If reintroduced:** Consider anchoring the illustration in `src/components/journal/JournalSummaryBand.jsx` or `src/components/ReadingJourney/sections/SeasonSummary.jsx`.

**Proposed:** Small illustration of sunrise/dawn with open book

**Files to create (if reintroduced):**

- `public/images/illustrations/today-dawn.svg`

---

## Illustration Style Guide

### Color Palette

```
Primary Gold:    #e5c48e (accent)
Secondary Gold:  #f3d08d (highlights)
Deep Purple:     #a992ff (celtic/spiritual)
Soft Pink:       #f08fb1 (relationships)
Cyan:            #6fe0ff (clarity)
Amber:           #f6b756 (decisions)
Surface Dark:    #0f0c13 (backgrounds)
```

### Visual Principles

1. **Line weight:** Thin, elegant strokes (1-2px)
2. **Glow effects:** Subtle outer glow using accent colors
3. **Opacity:** Background elements at 5-15% opacity
4. **Animation:** Prefer CSS over JS; respect `prefers-reduced-motion`
5. **Format:** SVG preferred for scalability; PNG for complex gradients

### File Organization

```
public/
└── images/
    └── illustrations/
        ├── empty-states/
        │   ├── empty-journal.png
        │   ├── empty-journal.webp
        │   ├── archetype-empty.png
        │   ├── archetype-empty.webp
        │   ├── no-filters-match.png
        │   └── no-filters-match.webp
        └── badges/
            ├── first-reading.png
            ├── first-reading.webp
            ├── ten-readings.png
            ├── ten-readings.webp
            ├── fifty-readings.png
            ├── fifty-readings.webp
            ├── streak-fire.png
            ├── streak-fire.webp
            ├── mastery-glow.png
            └── mastery-glow.webp
```

---

## Implementation Phases

### Phase 1: Empty States (Week 1) ✅ COMPLETE

- [x] Empty journal illustration (`EmptyJournalIllustration.jsx`)
- [x] Archetype journey empty state (`ArchetypeEmptyIllustration.jsx`)
- [x] No filters match illustration (`NoFiltersIllustration.jsx`)

### Phase 2: Section Icons (Week 2) ✅ COMPLETE

- [x] Wire `SuitIcons.jsx` into top-card lists (`CardsCallingYou.jsx`)
- [x] Swap achievements to `BadgeIllustrations.jsx`
- [ ] Wire suit icons into entry card chips (`ComfortableHeader.jsx`)
- [ ] Create `ContextIcons.jsx` and integrate into `ContextBreakdown`
- [ ] Create `ThemeIcons.jsx` and integrate into Recent Themes lists

### Phase 3: Decorative Elements (Week 3)

- [ ] Journal Pulse stat icons
- [ ] Coach suggestion frame
- [ ] Today section illustration

### Phase 4: Polish (Week 4)

- [ ] Loading animation
- [ ] Background patterns
- [ ] Theme-specific accents
- [ ] Share link visual cards

---

## Component Integration Example

```jsx
// src/components/illustrations/EmptyJournalIllustration.jsx
import { useReducedMotion } from "../hooks/useReducedMotion";

export function EmptyJournalIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <picture>
        <source
          srcSet="/images/illustrations/empty-states/empty-journal.webp"
          type="image/webp"
        />
        <img
          src="/images/illustrations/empty-states/empty-journal.png"
          alt=""
          role="presentation"
          className={`
            w-full max-w-sm mx-auto
            ${prefersReducedMotion ? "" : "animate-float-gentle"}
          `}
        />
      </picture>
    </div>
  );
}

// Usage in JournalEmptyState.jsx
import { EmptyJournalIllustration } from "../illustrations/EmptyJournalIllustration";

export function JournalEmptyState() {
  return (
    <div className="animate-fade-in space-y-6 rounded-3xl p-8 text-center">
      <EmptyJournalIllustration className="mx-auto mb-2 w-40" />
      {/* ... rest of content */}
    </div>
  );
}
```

---

## Accessibility Considerations

1. All decorative illustrations use `role="presentation"` and empty `alt=""`
2. Informational icons include proper `aria-label`
3. Animations respect `prefers-reduced-motion` media query
4. Color contrast meets WCAG AA for any text overlays
5. SVGs include `<title>` elements for screen readers where meaningful

---

## Related Files Reference

| Component         | File Path                                    | Lines to Modify     |
| ----------------- | -------------------------------------------- | ------------------- |
| Journal empty state | `src/components/journal/JournalEmptyState.jsx` | Empty journal illustration |
| Journal summary band | `src/components/journal/JournalSummaryBand.jsx` | Journal Pulse stats |
| Journey analytics | `src/components/ReadingJourney/`            | Themes, context, share |
| Entry cards       | `src/components/journal/entry-card/EntryHeader/ComfortableHeader.jsx` | Card chips |
| Coach suggestion  | `src/components/ReadingJourney/sections/SeasonSummary.jsx` | Suggestion callout |
| Achievements      | `src/components/ReadingJourney/sections/AchievementsRow.jsx` | Badge icon mapping |

---

## Current Component Inventory

```
src/components/illustrations/
├── ArchetypeEmptyIllustration.jsx   # Phase 1 ✅
├── BadgeIllustrations.jsx           # Phase 2 ✅ (wired into AchievementsRow)
├── EmptyJournalIllustration.jsx     # Phase 1 ✅
├── NoFiltersIllustration.jsx        # Phase 1 ✅
└── SuitIcons.jsx                    # Phase 2 ✅ (wired into CardsCallingYou)
```

### SuitIcons.jsx Exports

| Export | Type | Description |
|--------|------|-------------|
| `CupsIcon` | Component | Water element chalice |
| `WandsIcon` | Component | Fire element wand |
| `SwordsIcon` | Component | Air element sword |
| `PentaclesIcon` | Component | Earth element pentacle |
| `MajorIcon` | Component | Major Arcana star |
| `getSuitFromCardName(name)` | Function | Detects suit from card name string |
| `getSuitIcon(cardOrName)` | Function | Returns appropriate icon component |

### BadgeIllustrations.jsx Exports

| Export | Type | Description |
|--------|------|-------------|
| `FirstReadingBadge` | Component | First reading milestone |
| `TenReadingsBadge` | Component | 10 readings milestone |
| `FiftyReadingsBadge` | Component | 50 readings milestone |
| `StreakBadge` | Component | Daily streak achievement |
| `MasteryBadge` | Component | Card mastery achievement |

---

_Document created: 2025-12-05_
_Last updated: 2026-01-24_
