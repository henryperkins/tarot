# Interactive Card Tooltips (P5)

## Overview

Interactive Card Tooltips transform card symbols from passive metadata lists into an explorable "Museum Mode" experience. Users can tap/click directly on symbols within card images to discover their meanings contextually.

## Implementation

### Architecture

The feature uses **SVG overlay** for optimal mobile support:

- **Fully responsive**: SVG viewBox scales perfectly across all screen sizes
- **Touch-optimized**: Large hit areas (60-100 units) for accurate tapping
- **Visual affordance**: Pulsing indicator dots show interactive regions
- **Tap-based tooltips**: Mobile-friendly (no hover dependency)

### Components

#### 1. `InteractiveCardOverlay.jsx`

Location: `src/components/InteractiveCardOverlay.jsx`

**Purpose**: SVG overlay that renders clickable symbol regions over card images

**Props**:
- `card` - Card object with `number` property for coordinate lookup

**Features**:
- Supports 3 shape types: `circle`, `rect`, `polygon`
- Click/tap toggles tooltips (tap same symbol to close)
- Tooltips show: symbol name, color (if applicable), meaning
- Pulsing indicator dots hint at interactivity
- Subtle hover effects (desktop) and active states

#### 2. `symbolCoordinates.js`

Location: `src/data/symbolCoordinates.js`

**Purpose**: Maps descriptive symbol positions to actual SVG coordinates

**ViewBox**: `820 x 1430` (standard RWS aspect ratio)

**Data Structure**:
```javascript
export const SYMBOL_COORDINATES = {
  0: { // Card number (The Fool)
    symbols: [
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[0], // Reference to symbol metadata
        shape: 'circle',
        cx: 120,    // Center X
        cy: 140,    // Center Y
        r: 70,      // Radius
        indicatorCx: 120, // Indicator dot position
        indicatorCy: 140
      },
      {
        symbol: SYMBOL_ANNOTATIONS[0].symbols[1],
        shape: 'rect',
        x: 520,     // Top-left X
        y: 1100,    // Top-left Y
        width: 150,
        height: 180,
        indicatorCx: 595,
        indicatorCy: 1190
      }
      // ... more symbols
    ]
  }
};
```

### Current Coverage

✅ **The Fool (0)** - 6 symbols:
- Sun (top-left)
- Dog (bottom-right)
- Cliff (right edge)
- White rose (left hand)
- Bundle (over shoulder)
- Feather in hat

✅ **The Magician (1)** - 7 symbols:
- Infinity symbol (above head)
- Wand (right hand)
- Cup (on table)
- Sword (on table)
- Pentacle (on table)
- Red roses (garden)
- White lilies (garden)

### Integration

The overlay is integrated into `Card.jsx`:

```jsx
<div className="relative">
  <img src={card.image} alt={...} className="..." />
  <InteractiveCardOverlay card={card} />
</div>
```

The overlay automatically:
- Only renders for cards with mapped coordinates
- Returns `null` for unmapped cards (graceful degradation)
- Falls back to existing `CardSymbolInsights` button for all cards

## Adding New Cards

### Process

1. **View the card image**:
   - Open an existing card image, e.g. `public/images/cards/RWS1909_-_02_High_Priestess.jpeg` (files follow `RWS1909_-_NN_Name.jpeg`)
   - Study symbol positions

2. **Choose shapes**:
   - `circle` - for radial/organic symbols (sun, moon, orbs)
   - `rect` - for geometric/rectangular regions (tables, pillars, garden beds)
   - `polygon` - for complex/irregular shapes (flowing robes, animals)

3. **Map coordinates**:
   - Coordinate system: `(0,0)` is top-left, `(820, 1430)` is bottom-right
   - Use browser dev tools or SVG editor to measure positions
   - Make touch targets **60-100 units minimum** for mobile usability

4. **Add to `symbolCoordinates.js`**:
   ```javascript
   // Card 2: The High Priestess
   2: {
     symbols: [
       {
         symbol: SYMBOL_ANNOTATIONS[2].symbols[0], // Pillars
         shape: 'rect',
         x: 50,
         y: 300,
         width: 700,
         height: 800,
         indicatorCx: 400,
         indicatorCy: 700
       }
       // ... more symbols
     ]
   }
   ```

5. **Test across devices**:
   - Desktop (hover effects)
   - Mobile (touch targets, tooltip positioning)
   - Different screen sizes (responsive scaling)

### Coordinate Tuning Tips

- **Start rough, refine iteratively**: Initial estimates from visual inspection, then adjust in browser
- **Use indicator dots**: Position them at symbol centers to verify alignment
- **Test reversed cards**: Ensure coordinates work when card is rotated 180°
- **Generous touch targets**: Better to overlap slightly than miss taps
- **Tooltip positioning**: Use `Math.min()` to keep tooltips within viewport bounds

### Testing Checklist

- [ ] All symbols are tappable on mobile
- [ ] Touch targets are minimum 44x44px (iOS) / 48x48dp (Android)
- [ ] Tooltips don't obscure the card or overflow viewport
- [ ] Hover effects work on desktop
- [ ] Indicator dots align with symbol centers
- [ ] Coordinates work for both upright and reversed orientations
- [ ] Multiple taps toggle tooltips correctly
- [ ] Tapping outside closes active tooltip

## Mobile Optimization

### Touch Targets

Minimum sizes:
- **iOS**: 44x44 points (Apple HIG)
- **Android**: 48x48 dp (Material Design)
- **Our implementation**: 60-100 viewBox units (generous for accuracy)

### Interaction Pattern

1. **No hover**: Mobile has no hover state, so we use tap-to-reveal
2. **Toggle behavior**: Tap symbol to open, tap again to close
3. **Click outside**: Tap SVG background to close tooltip
4. **No scrolljacking**: Tooltips use `pointer-events-none` to avoid blocking scrolls

### Responsive Scaling

SVG viewBox automatically scales with image size:
- Desktop: `max-w-[280px]`
- Mobile: `max-w-[65%]`
- Coordinates remain accurate at all sizes

## Visual Design

### Indicator Dots

- **Purpose**: Hint that symbols are interactive
- **Style**: Pulsing yellow dots (`animate-pulse`)
- **Position**: Symbol centers (defined by `indicatorCx/Cy`)
- **Visibility**: Hidden when tooltip is active

### Hover/Active States

- **Hover (desktop)**: `fill-yellow-400/20`, `stroke-yellow-400/60`
- **Active (tap)**: `fill-yellow-400/30`, `stroke-yellow-400/80`
- **Transition**: Smooth 200ms

### Tooltips

- **Background**: `bg-surface/95` with backdrop blur
- **Border**: `border-2 border-accent/60`
- **Shadow**: `shadow-2xl` for depth
- **Content**:
  - Symbol name (bold, accent color)
  - Color (if applicable, secondary text)
  - Meaning (readable body text)

## Differences from Existing `CardSymbolInsights`

| Feature | `CardSymbolInsights` (Existing) | `InteractiveCardOverlay` (New) |
|---------|--------------------------------|-------------------------------|
| **Trigger** | Separate "Info" button | Click/tap card image regions |
| **Granularity** | Shows all symbols at once | Shows one symbol at a time |
| **Engagement** | Passive reading (list view) | Active exploration (discovery) |
| **Data req.** | Textual position descriptions | Coordinate mappings required |
| **Coverage** | All 78 cards | Currently 2 cards (expandable) |

**Both features coexist**: Cards without coordinate mappings still show the traditional Info button.

## Future Enhancements

### Short-term

1. **Map remaining Major Arcana** (cards 2-21)
2. **Add coordinate validation tests** (ensure no overlapping regions, all symbols covered)
3. **Analytics**: Track which symbols users explore most

### Long-term

1. **Minor Arcana support** (56 cards with suit-specific patterns)
2. **Symbol relationships**: Highlight related symbols when one is tapped
3. **Guided tours**: "Explore this card" walkthrough for new users
4. **Accessibility**: Keyboard navigation (arrow keys to move between symbols)
5. **Advanced shapes**: Bezier paths for flowing elements (robes, water, clouds)

## Performance Considerations

- **Lightweight**: SVG overlays add minimal overhead (~2KB per card)
- **Lazy loading**: Only loads coordinates for revealed cards
- **No runtime calculations**: Coordinates are pre-defined, no hit detection math
- **Graceful degradation**: Missing coordinates = no overlay, no errors

## Accessibility

Current implementation:
- Clickable regions have `cursor-pointer`
- Tooltips use semantic markup
- Color contrast meets WCAG AA standards

**TODO**:
- Add ARIA labels to symbol regions
- Add keyboard navigation support
- Screen reader announcements for tooltip open/close

## References

- Component: `src/components/InteractiveCardOverlay.jsx`
- Coordinates: `src/data/symbolCoordinates.js`
- Symbol data: `shared/symbols/symbolAnnotations.js`
- Integration: `src/components/Card.jsx:552-553`
- Modal integration (desktop only): `src/components/CardModal.jsx:259-261`

## Questions?

For coordinate mapping help or implementation questions, see inline comments in `symbolCoordinates.js`.
