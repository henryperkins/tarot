# Responsive Fixes Implementation Guide

This document provides detailed instructions for fixing responsive issues across the Mystic Tarot application. Fixes are organized by priority level.

> **Last verified:** 2025-11-27
>
> This guide has been verified against the current codebase. Each fix includes accurate line numbers and current code snippets.

## Quick Status Overview

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | Card.jsx | 🔧 Needs fix | Add `useLandscape` hook for landscape height handling |
| 2 | GuidedIntentionCoach.jsx | 🔧 Partial | Already has landscape handling; may need refinement |
| 3 | ReadingGrid.jsx | 🔧 Optional | Uses `landscapeCardWidth` variable; consider max-width cap |
| 4 | MobileActionBar.jsx | 🔧 Needs fix | Button text truncation in landscape |
| 5 | StreamingNarrative.jsx | 🔧 Needs fix | Add responsive max-width |
| 6 | ExperienceSettings.jsx | 🔧 Optional | Dropdown text sizing |
| 7 | OnboardingWizard.jsx | 🔧 Optional | Landscape padding refinement |
| 8 | SpreadSelector.jsx | 🔧 Optional | Add snap-stop for iOS |
| 9 | ReadingDisplay.jsx | 🔧 Optional | Padding consistency |
| 10 | JournalFilters.jsx | ✅ Done | Already has `flex-wrap` |

---

## High Priority Fixes

### 1. Card Component Min-Height Overflow in Landscape

**File:** `src/components/Card.jsx`

**Problem:** The `min-h-[45vh]` causes cards to overflow on landscape devices where viewport height is ~400px or less.

**Current code (lines 299, 335):**
```jsx
className="... min-h-[45vh] min-h-[45svh] max-h-[65vh] max-h-[65svh] sm:min-h-[24rem] sm:max-h-none ..."
```

**Solution:** Use dynamic height calculation based on landscape detection.

```jsx
// Add import at top of file
import { useLandscape } from '../hooks/useLandscape';

// Inside component, add hook
const isLandscape = useLandscape();

// Replace the card container's min-height class
// FROM:
className="... min-h-[45vh] min-h-[45svh] max-h-[65vh] max-h-[65svh] ..."

// TO:
className={`... ${isLandscape ? 'min-h-[200px] max-h-[280px]' : 'min-h-[45vh] min-h-[45svh] max-h-[65vh] max-h-[65svh]'} sm:min-h-[24rem] sm:max-h-none ...`}
```

**Alternative CSS-only approach** (add to `tarot.css`):

```css
/* Card height in landscape mode */
@media (orientation: landscape) and (max-height: 500px) {
  .card-swipe-container {
    min-height: 180px;
    max-height: 280px;
  }
}
```

---

### 2. GuidedIntentionCoach Dialog Height Overflow in Landscape

**File:** `src/components/GuidedIntentionCoach.jsx`

**Problem:** The dialog can overflow on landscape mobile devices with very limited viewport height.

**Current code (line 1090):**
```jsx
className={`relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl ...`}
```

**Note:** The component already imports `useLandscape` and uses it in various places. The current implementation uses `sm:max-h-[90vh]` (not `max-h-[85vh]` as originally documented).

**Solution:** Add explicit landscape handling for very short viewports:

```jsx
// The component already imports useLandscape and has isLandscape variable
// Update the dialog container (line 1090):

// FROM:
className={`... sm:max-h-[90vh] ...`}

// TO:
className={`... ${isLandscape ? 'max-h-[98vh]' : 'sm:max-h-[90vh]'} ...`}

// Also update inner content padding for landscape compactness:
// FROM:
className="... p-4 sm:p-6 ..."

// TO:
className={`... ${isLandscape ? 'p-2 sm:p-3' : 'p-4 sm:p-6'} ...`}
```

**Additional fix for conversation scroll container:**

```jsx
// Find the conversation messages container and add:
className={`... ${isLandscape ? 'max-h-[40vh]' : 'max-h-[50vh]'} overflow-y-auto ...`}
```

---

### 3. Celtic Cross Carousel Card Sizing in ReadingGrid

**File:** `src/components/ReadingGrid.jsx`

**Problem:** Cards in the Celtic Cross carousel may be too narrow in landscape mode, clipping card artwork.

**Current code (line 151):**
```jsx
const landscapeCardWidth = isLandscape ? 'min-w-[45vw]' : 'min-w-[68vw]';
```

**Note:** The implementation uses `landscapeCardWidth` variable (not `celticCarouselClass` as originally documented). The current values use viewport-relative widths.

**Solution:** Adjust card widths for better landscape display:

```jsx
// Find the landscapeCardWidth definition (line 151)
// Update the landscape card sizing:

// FROM:
const landscapeCardWidth = isLandscape ? 'min-w-[45vw]' : 'min-w-[68vw]';

// TO:
const landscapeCardWidth = isLandscape ? 'min-w-[50vw] max-w-[12rem]' : 'min-w-[68vw]';
```

**Also consider updating the carousel container gap for landscape:**

```jsx
// In the grid className (around line 342), the carousel already has landscape-aware gap
// If needed, adjust:
className={`flex ${isLandscape ? 'gap-2' : 'gap-4'} overflow-x-auto ...`}
```

---

### 4. MobileActionBar Button Text Truncation

**File:** `src/components/MobileActionBar.jsx`

**Problem:** "Reveal next (X/Y)" text truncates on narrow landscape buttons.

**Solution:** Use abbreviated text in landscape mode and adjust minimum widths.

```jsx
// Find the 'revealing' case in renderActions function (around line 274-303)
// Update the label logic:

// FROM:
const nextLabel = isLandscape
  ? `Next (${Math.min(dealIndex + 1, readingLength)}/${readingLength})`
  : `Reveal next (${Math.min(dealIndex + 1, readingLength)}/${readingLength})`;

// TO:
const nextLabel = isLandscape
  ? `${Math.min(dealIndex + 1, readingLength)}/${readingLength}`  // Just show counter
  : `Reveal next (${Math.min(dealIndex + 1, readingLength)}/${readingLength})`;

// Also update width classes (around line 197-204):
// FROM:
const widthClasses = {
  primary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[5.5rem]' : 'flex-1 min-w-[7.5rem]',
  ...
};

// TO:
const widthClasses = {
  primary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[4rem]' : 'flex-1 min-w-[7.5rem]',
  prepPrimary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[3.5rem]' : 'flex-1 min-w-[6rem]',
  secondary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[4rem]' : 'flex-1 min-w-[7.5rem]',
  tertiary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[3rem]' : 'flex-1 min-w-[7.5rem]',
  icon: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-none w-[2.25rem]' : 'flex-none w-[3rem]',
  coach: variant === 'inline' ? 'w-full' : 'flex-none'
};
```

---

## Medium Priority Fixes

### 5. StreamingNarrative Prose Width Optimization

**File:** `src/components/StreamingNarrative.jsx`

**Problem:** `max-w-[65ch]` (equivalent to `max-w-prose`) creates excessive side margins on mobile.

**Current code (line 235):**
```jsx
className="prose prose-sm sm:prose-base md:prose-lg max-w-[65ch] w-full min-h-[8rem] xs:min-h-[10rem] px-1 sm:px-0 mx-auto"
```

**Note:** The current implementation uses `prose prose-sm sm:prose-base md:prose-lg max-w-[65ch]` (not `prose prose-invert max-w-prose` as originally documented).

**Solution:** Use responsive max-width classes:

```jsx
// Find the prose container (line 235)
// FROM:
className="prose prose-sm sm:prose-base md:prose-lg max-w-[65ch] ..."

// TO:
className="prose prose-sm sm:prose-base md:prose-lg max-w-full sm:max-w-[65ch] ..."
```

**Add to `tarot.css` for better mobile reading:**

```css
/* Optimize narrative reading on mobile */
@media (max-width: 479px) {
  .prose {
    font-size: 0.9375rem; /* 15px - slightly smaller for mobile */
    line-height: 1.7;
  }

  .prose p {
    margin-bottom: 1.25em;
  }
}
```

---

### 6. ExperienceSettings Dropdown Text Truncation

**File:** `src/components/ExperienceSettings.jsx`

**Problem:** Reversal framework dropdown options get truncated on narrow screens.

**Solution:** Reduce font size on mobile and use shorter option labels.

```jsx
// Find the reversalSelectClass (around line 46-47)
// FROM:
const reversalSelectClass =
  'w-full rounded-2xl border border-secondary/25 bg-surface/70 px-3 py-2.5 min-h-[44px] text-[0.72rem] uppercase tracking-[0.08em] text-main transition ...';

// TO:
const reversalSelectClass =
  'w-full rounded-2xl border border-secondary/25 bg-surface/70 px-2 xs:px-3 py-2.5 min-h-[44px] text-[0.65rem] xs:text-[0.72rem] uppercase tracking-[0.06em] xs:tracking-[0.08em] text-main transition ...';

// Optionally, use shorter mobile-friendly option labels:
// Consider abbreviating on very narrow screens via CSS:
```

**Add to `tarot.css`:**

```css
/* Dropdown text sizing on narrow screens */
@media (max-width: 374px) {
  select option {
    font-size: 0.625rem;
    letter-spacing: 0.04em;
  }
}
```

---

### 7. OnboardingWizard Landscape Padding

**File:** `src/components/onboarding/OnboardingWizard.jsx`

**Problem:** Content area has minimal padding (`py-2`) in landscape, causing cramped appearance.

**Solution:** Improve vertical spacing while maintaining scrollability.

```jsx
// Find the main content area (around line 229-238)
// FROM:
<main
  className={`relative z-10 flex-1 overflow-y-auto overflow-x-hidden ${
    isLandscape ? 'px-4 py-2' : 'px-4 py-6 sm:px-8 sm:py-8'
  }`}
>

// TO:
<main
  className={`relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth ${
    isLandscape ? 'px-3 py-3 sm:px-4' : 'px-4 py-6 sm:px-8 sm:py-8'
  }`}
  style={{ scrollPaddingTop: '1rem', scrollPaddingBottom: '1rem' }}
>

// Also update the header padding:
// FROM:
className={`... ${isLandscape ? 'py-2' : 'py-4'}`}

// TO:
className={`... ${isLandscape ? 'py-1.5' : 'py-4'}`}
```

---

### 8. SpreadSelector Snap Alignment

**File:** `src/components/SpreadSelector.jsx`

**Problem:** Carousel snap alignment can drift on some iOS devices.

**Current code (line 336):**
```jsx
className={`spread-selector-grid flex ${isLandscape ? 'gap-2 pb-2' : 'gap-3 pb-3'} overflow-x-auto snap-x snap-mandatory sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-4`}
```

**Note:** The carousel already has landscape-aware gap handling (`gap-2 pb-2` vs `gap-3 pb-3`).

**Solution:** Add scroll-snap-stop and improve scroll-padding:

```jsx
// Find the carousel container (line 336)
// Add scroll-smooth and style prop:
className={`spread-selector-grid flex ${isLandscape ? 'gap-2 pb-2' : 'gap-3 pb-3'} overflow-x-auto snap-x snap-mandatory scroll-smooth sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-4`}
style={{ scrollPaddingLeft: '1rem', scrollPaddingRight: '1rem' }}

// For each spread card (line 361), add snap-always:
// FROM:
className={`... snap-center ...`}

// TO:
className={`... snap-center snap-always ...`}
```

**Add to `tarot.css`:**

```css
/* Improve carousel scroll behavior */
.spread-selector-grid {
  scroll-padding-inline: 1rem;
  -webkit-overflow-scrolling: touch;
}

.spread-selector-grid > * {
  scroll-snap-stop: always;
}
```

---

## Low Priority Fixes

### 9. ReadingDisplay Narrative Panel Padding Consistency

**File:** `src/components/ReadingDisplay.jsx`

**Problem:** Inconsistent padding between panels (`p-3` vs `p-5 sm:p-8`).

**Solution:** Standardize padding classes.

```jsx
// Find all panel containers and standardize:
// Use this consistent pattern:
className={`... ${isLandscape ? 'p-3' : 'p-4 sm:p-6'} ...`}

// Specifically update line 341 (narrative panel):
// FROM:
className={`... ${isLandscape ? 'p-3' : 'p-5 sm:p-8'}`}

// TO:
className={`... ${isLandscape ? 'p-3' : 'p-4 sm:p-6 md:p-8'}`}
```

---

### 10. Journal Filter Chip Overflow

**File:** `src/components/JournalFilters.jsx`

**Status:** ✅ **ALREADY IMPLEMENTED**

**Current code (line 183):**
```jsx
<div className="flex flex-wrap items-center gap-3">
```

The filter chips container already uses `flex-wrap`, which addresses the overflow issue on narrow screens.

**Optional enhancement:** If further refinement is desired, consider adding horizontal scroll on larger screens:

```jsx
// Current implementation is sufficient, but optionally:
<div className="flex flex-wrap gap-3 xs:flex-nowrap xs:overflow-x-auto xs:pb-2">
```

**Optional CSS enhancement:**

```css
/* Filter chips scrollable container - optional enhancement */
@media (min-width: 480px) {
  .journal-filters-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    -webkit-overflow-scrolling: touch;
  }

  .journal-filters-chips::-webkit-scrollbar {
    height: 4px;
  }
}
```

---

## Global CSS Improvements

**File:** `src/styles/tarot.css`

**Already implemented in tarot.css:**
- ✅ Mobile typography improvements (lines 8-29)
- ✅ Safe area `@supports` rules for `.app-shell` and `.pb-safe` (lines 182-189)
- ✅ Mobile action bar safe area handling (lines 219-229)
- ✅ Landscape mode safeguards for header, action bar, deck pile (lines 231-265)
- ✅ Spread card landscape handling (lines 455-461)
- ✅ Tarot card shell landscape sizing (lines 1131-1176)
- ✅ Reduced motion support (lines 1704-1757) - comprehensive implementation
- ✅ Spread selector grid scroll padding (lines 410-420)

**Add these additional utilities to `src/styles/tarot.css`:**

```css
/* ================================
   ADDITIONAL RESPONSIVE UTILITIES
   ================================ */

/* Safe area padding utility class (supplement existing @supports rules) */
.safe-area-padding {
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* Landscape-specific utility classes */
@media (orientation: landscape) and (max-height: 500px) {
  .landscape-compact {
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .landscape-hide {
    display: none;
  }

  .landscape-smaller {
    font-size: 0.875em;
  }
}

/* Improved touch targets */
@media (pointer: coarse) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Generic carousel scroll utility */
.carousel-scroll {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.carousel-scroll::-webkit-scrollbar {
  display: none;
}

/* Card container responsive heights utility */
.card-container-responsive {
  min-height: 40vh;
  max-height: 70vh;
}

@media (orientation: landscape) and (max-height: 500px) {
  .card-container-responsive {
    min-height: 160px;
    max-height: 260px;
  }
}

@media (min-width: 640px) {
  .card-container-responsive {
    min-height: 35vh;
    max-height: 60vh;
  }
}
```

---

## Tailwind Config Updates

**File:** `tailwind.config.js`

**Current breakpoints (lines 15-19):**
```js
screens: {
  'xxs': '320px',
  'xs': '375px',
  ...defaultTheme.screens,
},
```

**Note:** The `xs` breakpoint exists at `375px` (not `480px` as originally suggested). The project also has `xxs: '320px'`.

**Add these additional screen breakpoints for landscape/orientation detection:**

```js
export default {
  theme: {
    screens: {
      'xxs': '320px',
      'xs': '375px',
      ...defaultTheme.screens,
    },
    extend: {
      screens: {
        // Add landscape detection (for short landscape viewports)
        'landscape': { 'raw': '(orientation: landscape) and (max-height: 500px)' },
        'portrait': { 'raw': '(orientation: portrait)' },
        // Short viewport (useful for foldables and small tablets in landscape)
        'short': { 'raw': '(max-height: 600px)' },
      },
    },
  },
}
```

This allows usage like:
```jsx
className="landscape:p-2 portrait:p-4 short:text-sm"
```

---

## Testing Checklist

After applying fixes, test on:

- [ ] iPhone SE (375 x 667) - Portrait
- [ ] iPhone SE - Landscape (667 x 375)
- [ ] iPhone 12/13/14 (390 x 844) - Portrait
- [ ] iPhone 12/13/14 - Landscape (844 x 390)
- [ ] iPad Mini (768 x 1024) - Portrait
- [ ] Android small (360 x 640) - Portrait
- [ ] Android small - Landscape
- [ ] Desktop narrow (1024 x 768)
- [ ] Desktop wide (1920 x 1080)

Key interactions to verify:
1. Card reveal and reflection input
2. Spread selection carousel swipe
3. Narrative reading scrolling
4. Mobile action bar button visibility
5. Settings panel in landscape
6. Onboarding wizard completion
7. Journal page filters and entries

---

## Implementation Order

1. Apply high-priority fixes first (items 1-4)
2. Test on multiple devices
3. Apply medium-priority fixes (items 5-8)
4. Test again
5. Apply low-priority fixes and global CSS (items 9-10)
6. Final cross-device testing
