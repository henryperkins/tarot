# Tableu Logo Implementation

## Overview

Successfully converted the Tableu logo from PNG to SVG sprite system and integrated it throughout the application, including on the card backs during the reveal sequence.

## Files Created

### 1. `/public/images/tableu-sprite.svg` (8.7KB)

SVG sprite sheet containing 6 logo variants:

- **`#tableu-primary`** - Full detailed logo (default gold color)
- **`#tableu-icon`** - Simplified version (no eye, wand, or bottom sparkle)
- **`#tableu-mono`** - Monochrome black version
- **`#tableu-dark`** - Dark mode white version
- **`#tableu-favicon`** - Minimal octopus-only mark
- **`#tableu-full`** - Complete logo with "TABLEU" wordmark

### 2. `/src/components/TableuLogo.jsx`

React component for easy logo usage across the application.

**Props:**
```jsx
{
  variant: 'primary' | 'icon' | 'mono' | 'dark' | 'favicon' | 'full',
  size: number | string,        // Width in pixels
  className: string,             // Additional CSS classes
  color: string,                 // Custom color override
  ariaLabel: string             // Accessibility label
}
```

**Example Usage:**
```jsx
// Header with wordmark
<TableuLogo variant="full" size={180} />

// Icon version for navigation
<TableuLogo variant="icon" size={48} />

// Favicon
<TableuLogo variant="favicon" size={32} />

// Custom color
<TableuLogo variant="primary" size={120} color="#8B5CF6" />
```

### 3. `/src/components/TableuLogo.example.jsx`

Documentation file showing all variants and usage guidelines (not imported in production).

## Files Updated

### `/src/components/Card.jsx`

**Changed:** Card back design now displays Tableu logo instead of CSS geometric pattern.

**Before:**
```jsx
<div className="tarot-card-shell mx-auto">
  <div className="tarot-card-back">
    <div className="tarot-card-back-symbol">
      <div className="tarot-card-back-glyph" />
    </div>
  </div>
</div>
```

**After:**
```jsx
<div className="mx-auto flex items-center justify-center p-4 bg-gradient-to-br from-surface-muted/50 to-surface/50 rounded-xl border-2 border-primary/20 shadow-lg">
  <TableuLogo
    variant="icon"
    size={160}
    className="opacity-75 hover:opacity-90 transition-opacity"
    ariaLabel="Tableu card back - tap to reveal"
  />
</div>
```

### `/src/components/Header.jsx`

**Changed:** Replaced PNG logo with SVG `full` variant (includes wordmark).

### `/src/TarotReading.jsx`

**Changed:** Replaced PNG logo in main header with SVG `full` variant.

## Logo Design Elements

The logo contains these symbolic elements:

1. **Card Frame** - Rounded rectangle representing a tarot card
2. **Crescent Moon** - Top left, mystical symbolism
3. **Four-Pointed Star** - Top right, cosmic guidance
4. **Center Divider Line** - Separating conscious/subconscious
5. **Octopus** - Central mascot with friendly smile
6. **Six Tentacles** - Spreading downward, representing reach/connection
7. **Wand with Sparkle** - Magic and intention
8. **Eye Symbol** - Right side, intuition and insight
9. **Bottom Sparkle** - Additional mystical accent
10. **Curved Baseline** - Foundation/grounding

## Theme System

The SVG uses CSS custom properties for easy theming:

```css
.theme-primary { --fill:#C9B36E; --stroke:#C9B36E; --sw:6; }
.theme-mono    { --fill:#000000; --stroke:#000000; --sw:6; }
.theme-dark    { --fill:#FFFFFF; --stroke:#FFFFFF; --sw:6; }
```

You can override colors via the `color` prop or by setting `currentColor` in CSS.

## Usage Guidelines

| Context | Variant | Size | Notes |
|---------|---------|------|-------|
| **Page Headers** | `full` | 180-240px | Includes wordmark |
| **Navigation** | `icon` | 40-60px | Simplified, no wordmark |
| **Card Backs** | `icon` | 160px | Currently implemented |
| **Favicon** | `favicon` | 32-48px | Octopus only |
| **Social Cards** | `primary` | 400-600px | Full detail |
| **Dark Backgrounds** | `dark` | Any | White on dark |
| **Print** | `mono` | Any | Black, high contrast |

## Performance

- **SVG Sprite Size:** 8.7KB (vs 2.1MB PNG - **99.6% smaller**)
- **Format:** Inline SVG via `<use>` tag (no HTTP request)
- **Scalability:** Vector format scales perfectly at any size
- **Caching:** Served from `/public` folder, cached by browser

## Build Verification

✅ Build completed successfully
✅ SVG sprite copied to `dist/images/tableu-sprite.svg`
✅ All components compile without errors
✅ Logo displays in header and card backs

## Original PNG Location

The original PNG logo remains at:
- `/public/images/logo.png` (2.1MB)

You may want to keep this as a backup or for high-resolution print needs. All web usage now uses the SVG sprite.

## Future Enhancements

Potential improvements:

1. **Animated Variants** - Add subtle animations (sparkle twinkle, tentacle sway)
2. **Color Themes** - Create variants for different deck styles (Thoth purple, Marseille blue)
3. **Micro-interactions** - Hover effects on individual elements
4. **Loading States** - Use simplified favicon variant for loading indicators
5. **Favicon Integration** - Update `public/manifest.webmanifest` and favicons to use new SVG

## Notes

- The SVG uses semantic grouping with `<symbol>` and `<use>` for clean sprite architecture
- All symbols are reusable and composable
- Stroke widths and fills are theme-aware via CSS custom properties
- Accessibility labels are customizable per usage context
- The card back design now matches the brand identity throughout the app
