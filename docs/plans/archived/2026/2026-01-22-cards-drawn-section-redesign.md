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
- Arc/fan rotation (cards fan out like held in hand)
- Cards arranged in curved arc, overlapping ~40%
- Center card(s) upright, outer cards progressively rotated
- Transform-origin at bottom center for natural rotation
- No scrolling required for up to 10 cards

### Arc Geometry
- Total arc span: 40° (from -20° to +20°)
- Cards distributed evenly across arc
- Vertical offset follows arc curve (parabolic)
- Cards scale slightly smaller toward edges (0.95)

### Card Sizing
- Thumbnail: 52×78px (slightly smaller to fit arc)
- All cards visible simultaneously
- Scales responsively: smaller on narrow screens

### Card Information
- No labels shown in arc view (too cluttered)
- Position revealed on hover/focus as overlay
- Reversed: thumbnail rotated 180° + "Rev" badge top-right
- Card name shown on hover/tap tooltip

### Vertical Space
- Arc height determined by card size + rotation
- Thumbnail: 78px tall
- Arc rise (vertical offset at edges): ~20px
- **Total expanded height: ~140px**

### Interaction in Arc
- Cards lift on hover/focus (translateY -4px, scale 1.05)
- Active card rises above others (z-index boost)
- Touch: tap to select card, tap again for details

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
- Duration: 350ms
- Easing: `ease-out` (fast start, gentle stop)
- Stagger: 40ms delay between each card (from center outward)
- Cards fan out from stacked position to arc positions
- Height animates from ~100px to ~140px

### Collapse Animation
- Duration: 280ms (slightly faster than expand)
- Reverse of expand: cards converge back to stack
- Stagger from edges inward (outer cards first)

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
├── CardFan.jsx                # Expanded arc/fan view
├── CardThumbnail.jsx          # Individual card with labels
└── useCardFan.js              # Animation/state/geometry hook
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

1. **Image loading:** Use `loading="lazy"` on thumbnails beyond visible count. Preload visible stack cards.

2. **Performance:** Memoize card list with `useMemo`. Individual `CardThumbnail` components wrapped in `memo()`.

3. **Arc geometry:** Calculate rotation and position using `getArcPosition(index, total, arcSpan)` helper.

4. **Transform origin:** Set `transform-origin: center bottom` on cards so rotation pivots from bottom.

5. **Testing:** Add Playwright tests for expand/collapse, arc layout, and card detail interaction.

---

## Success Criteria

- [ ] Collapsed state renders in <100px vertical space
- [ ] 10-card Celtic Cross fans out cleanly on iPhone SE (375px)
- [ ] Card art recognizable at 52×78px thumbnail size
- [ ] Arc geometry distributes cards evenly without overflow
- [ ] Expand/collapse animation runs at 60fps
- [ ] Keyboard navigation works (arrows move through arc)
- [ ] Screen reader announces card information correctly
- [ ] Reduced motion preference respected
