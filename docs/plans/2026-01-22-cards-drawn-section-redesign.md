# Cards Drawn Section Redesign

## Overview

Reimagine the CardsDrawnSection component from a bulky list view to a compact, interactive card fan optimized for quick reference on mobile devices.

**Primary use case:** Quick glance to recall which cards appeared in a reading.

**Target spread sizes:** 5-10 cards (Celtic Cross, Five-Card Clarity, etc.)

## Design Summary

| Aspect | Decision |
|--------|----------|
| Visual recognition | Card thumbnails (actual RWS art) |
| Collapsed layout | Stacked pile with rotation offsets |
| Expanded layout | Horizontal scroll strip with snap |
| Interaction | Tap stack to expand, scroll to browse, tap card for details |
| Info displayed | Position label + card name + reversed indicator |

---

## Collapsed State

### Visual Structure
- Cards stacked with subtle rotation: -4°, -2°, 0°, +2°, +4° (alternating from center)
- Horizontal offset: ~6px between cards
- Vertical offset: ~3px between cards
- Top 3 cards visible; remaining hidden beneath
- Stack centered horizontally in container

### Sizing (Mobile-First)
- Card thumbnails: 56×84px
- Total touch target: full container width, minimum 100px tall
- Generous padding for thumb access

### Indicators
- Count badge bottom-right: shows total (e.g., "10 cards")
- First-time affordance: subtle "Tap to view" hint, dismisses after first interaction
- Reversed cards in stack: "Rev" badge visible on thumbnail corner

### Interaction
- Entire stack area is tappable
- No hover-dependent behavior
- Tap triggers expand animation

---

## Expanded State

### Layout
- Horizontal scroll strip (not arc/fan rotation)
- Cards in single row with minimal overlap (~10%)
- Scroll snap to each card (`snap-x snap-mandatory`)
- "Peek" of next card visible on right edge

### Card Sizing
- Thumbnail: 64×96px (larger than collapsed for clarity)
- Card + labels total width: ~80px
- 4-5 cards visible at once on 375px screen
- Consistent size regardless of card count (no shrinking)

### Card Information
```
    ┌─────────────┐
    │  Position   │  ← 10px small caps, muted
    │ ┌─────────┐ │
    │ │  Card   │ │  ← 64×96px thumbnail
    │ │  Image  │ │
    │ │         │ │
    │ └─────────┘ │
    │  Card Name  │  ← 12px, truncate if long
    └─────────────┘
```

- Position label: above thumbnail, `text-[10px] uppercase tracking-wider text-muted`
- Card name: below thumbnail, `text-[12px] font-medium text-main`, truncate with ellipsis
- Reversed: thumbnail rotated 180° + "Rev" badge top-right

### Vertical Space
- Position label height: ~16px
- Thumbnail: 96px
- Card name height: ~20px
- Padding/gaps: ~18px
- **Total expanded height: ~150px**

### Scroll Behavior
- Momentum scrolling enabled
- Snap to card boundaries
- Optional dot indicators below (carousel-style)
- Swipe gestures feel natural and quick

### Collapse Trigger
- Tap section background/header
- Visible collapse chevron (always present when expanded)

---

## Interactions

### Tapping Individual Cards
- Brief highlight: scale to 1.05 for 150ms
- Opens `CardSymbolInsights` bottom sheet (existing component)
- Provides card symbolism, keywords, archetype without leaving journal

### Keyboard Navigation
- Tab into component focuses the stack/first card
- Arrow Left/Right moves between cards when expanded
- Enter/Space expands stack or opens card details
- Escape collapses expanded state

### Accessibility
- `role="group"` on container with `aria-label="Cards drawn in this reading"`
- Each card: `role="button"` with `aria-label="The Fool, Past position, Upright"`
- `aria-expanded` on stack for expand/collapse state
- Focus ring visible on keyboard navigation

---

## Visual Details

### Suit Color Coding
Border accent on left edge of each card (3px):

| Suit | CSS Variable | Color |
|------|--------------|-------|
| Wands | `var(--color-wands)` | Orange |
| Cups | `var(--color-cups)` | Blue |
| Swords | `var(--color-swords)` | Silver/Gray |
| Pentacles | `var(--color-pentacles)` | Green |
| Major Arcana | `var(--brand-primary)` | Gold |

### Reversed Badge
- Position: top-right corner of thumbnail
- Style: existing `styles.reversedBadge` from primitives
- Text: "Rev" (3 chars, compact)

### Shadows & Depth
- Collapsed stack: layered shadows create depth between cards
- Expanded cards: subtle `shadow-md` on each card
- Consistent with existing `EntryCard.primitives.js` shadow patterns

---

## Animation

### Expand Animation
- Duration: 300ms
- Easing: `ease-out` (fast start, gentle stop)
- Stagger: 30ms delay between each card
- Cards translate from stacked position to scroll strip
- Height animates from ~100px to ~150px

### Collapse Animation
- Duration: 250ms (slightly faster than expand)
- Reverse of expand: cards converge back to stack
- Stagger in reverse order (last card first)

### Reduced Motion
- `prefers-reduced-motion`: instant state change, no animation
- Expand/collapse happens immediately
- All functionality preserved

---

## Edge Cases

### Single Card
- No scroll behavior needed
- Card centered, "lifts" slightly on expand
- Labels appear below/above

### Empty State
- Simple text: "No cards recorded"
- No skeleton or placeholder stack

### Very Long Card Names
- Truncate with ellipsis after ~10 characters
- Full name visible in CardSymbolInsights bottom sheet

### Narrow Screens (<360px)
- Collapsed: show top 2 cards instead of 3
- Expanded: same behavior, just fewer visible at once

---

## Component Structure

```
CardsDrawnSection/
├── CardsDrawnSection.jsx      # Main component
├── CardStack.jsx              # Collapsed stack view
├── CardStrip.jsx              # Expanded scroll strip
├── CardThumbnail.jsx          # Individual card with labels
└── useCardFan.js              # Animation/state hook
```

### Props (unchanged interface)
```jsx
CardsDrawnSection.propTypes = {
  cards: PropTypes.array.isRequired,      // Array of card objects
  cardsId: PropTypes.string,              // Accessibility ID
  isSmallScreen: PropTypes.bool,          // Mobile detection (may be unused now)
  hasQuestion: PropTypes.bool,            // Layout spacing hint
  collapsible: PropTypes.bool,            // Ignored (always collapsible now)
  defaultExpanded: PropTypes.bool         // Initial state
};
```

### Dependencies
- `framer-motion` — expand/collapse animations
- Existing: `getCardImage` from `lib/cardLookup`
- Existing: `CardSymbolInsights` for detail bottom sheet
- Existing: `getSuitAccentVar` from `EntryCard.primitives`

---

## Implementation Notes

1. **Image loading:** Use `loading="lazy"` on thumbnails not in initial viewport. Preload visible stack cards.

2. **Performance:** Memoize card list with `useMemo`. Individual `CardThumbnail` components wrapped in `memo()`.

3. **Scroll position:** Reset scroll to start when collapsing, so next expand shows first cards.

4. **Touch handling:** Use CSS `scroll-snap-type` rather than JS-based snap for better performance.

5. **Testing:** Add Playwright tests for expand/collapse, scroll behavior, and card detail interaction.

---

## Success Criteria

- [ ] Collapsed state renders in <100px vertical space
- [ ] 10-card Celtic Cross scrolls smoothly on iPhone SE (375px)
- [ ] Card art recognizable at 64×96px thumbnail size
- [ ] Expand/collapse animation runs at 60fps
- [ ] Keyboard navigation works completely
- [ ] Screen reader announces card information correctly
- [ ] Reduced motion preference respected
