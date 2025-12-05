# Mobile Ergonomics Improvements: Implementation Guide

Based on the codebase analysis, here are the specific code changes needed to address the prioritized mobile ergonomics issues.

---

## Implementation Status

| Section | Status | Notes |
|---------|--------|-------|
| 1. Coach Button 44px+ | ✅ Implemented | [`QuickIntentionCard.jsx:35`](../src/components/QuickIntentionCard.jsx:35) |
| 2. Spread Card Placeholders | ⚠️ Partial | External position indicators **not implemented**; still uses inline `text-[0.55rem]` |
| 3. Step Badges Navigation | ✅ Implemented | [`TarotReading.jsx:639-682`](../src/TarotReading.jsx:639-682) |
| 4. Swipe Hints Persistence | ✅ Implemented | [`ReadingGrid.jsx:178-205`](../src/components/ReadingGrid.jsx:178-205) - 8s timeout with scroll tracking |
| 5. Bottom-Bar Animation | ✅ Implemented | [`MobileActionBar.jsx:452-455`](../src/components/MobileActionBar.jsx:452-455) + `tarot.css` |
| 6. "More" Button Touch Target | ✅ Implemented | [`QuickIntentionCard.jsx`](../src/components/QuickIntentionCard.jsx) |

---

## 1. Coach Button: Bump to 44px+ Touch Target

**Current Issue:** The Coach button uses `text-[0.72rem]` (~11.5px) with `px-3 py-1.5` padding, resulting in a touch target around 32-36px height—below iOS HIG's 44px minimum [^1].

**Location:** `TarotReading.jsx` – Quick Intention Card

### Before:
```jsx
<button
  type="button"
  onClick={() => {
    setPendingCoachPrefill(null);
    setIsIntentionCoachOpen(true);
  }}
  className="inline-flex items-center gap-1 rounded-full border border-secondary/40 px-3 py-1.5 text-[0.72rem] font-semibold text-secondary hover:bg-secondary/10 transition touch-manipulation"
>
  <span className="sr-only">Open guided coach</span>
  Coach
</button>
```

### After:
```jsx
<button
  type="button"
  onClick={() => {
    setPendingCoachPrefill(null);
    setIsIntentionCoachOpen(true);
  }}
  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-secondary/40 min-h-[44px] min-w-[44px] px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
  aria-label="Open guided intention coach"
>
  <Sparkle className="w-4 h-4" weight="duotone" aria-hidden="true" />
  Coach
</button>
```

**Key Changes:**
- Added `min-h-[44px] min-w-[44px]` for guaranteed touch target
- Increased padding to `px-4 py-2`
- Changed text size from `text-[0.72rem]` to `text-xs` (12px)
- Added icon for better visual affordance
- Added `active:` state for tactile feedback
- Added focus-visible ring for accessibility

---

## 2. Spread Card Placeholders: Bump to 44px+

> ⚠️ **Implementation Gap:** This section's external position indicator pattern is **NOT YET IMPLEMENTED**. The current [`SpreadTable.jsx:150`](../src/components/SpreadTable.jsx:150) still uses inline `text-[0.55rem]` text inside compact placeholders.

**Current Issue:** SpreadTable card placeholders use `w-11 h-[60px]` in compact mode with illegible 0.55rem text inside [^2].

**Location:** [`SpreadTable.jsx`](../src/components/SpreadTable.jsx)

### Before:
```jsx
<div
  className={`
    ${compact ? 'w-11 h-[60px] xs:w-12 xs:h-16 sm:w-14 sm:h-[76px]' : 'w-14 h-[76px]...'}
    rounded-lg border-2 border-dashed
    ...
  `}
>
  <span className="text-[0.55rem] font-medium">{position}</span>
</div>
```

### After:
```jsx
<div
  className={`
    ${compact 
      ? 'w-11 h-[60px] xs:w-12 xs:h-16 sm:w-14 sm:h-[76px]' 
      : 'w-14 h-[76px] sm:w-16 sm:h-[88px]'}
    rounded-lg border-2 border-dashed
    flex items-center justify-center
    ...
  `}
  aria-label={`Position ${index + 1}: ${positionLabel}`}
>
  {/* Remove inline text in compact mode - use external indicators */}
  {!compact && (
    <span className="text-[0.65rem] xs:text-xs font-medium text-center px-0.5">
      {position}
    </span>
  )}
</div>

{/* External position indicator for compact mode */}
{compact && (
  <span 
    className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[0.6rem] text-muted font-medium"
    aria-hidden="true"
  >
    {index + 1}
  </span>
)}
```

**Key Changes:**
- Removed illegible inline text in compact mode
- Added external position numbers below cards
- Kept card dimensions but improved accessibility via `aria-label`
- Slightly increased non-compact sizes for better readability

---

## 3. Wire Step Badges as Interactive Navigation

**Current Issue:** Mobile step badges ("Step 1 · Spread", "Step 2 · Question") are purely decorative with 11px text [^3].

**Location:** `TarotReading.jsx`

### Before:
```jsx
{isSmallScreen && (
  <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden text-[11px] uppercase tracking-[0.18em] text-secondary/70">
    <div className="rounded-full border border-secondary/30 bg-surface/70 px-3 py-1.5 text-center font-semibold text-secondary/80">
      Step 1 · Spread
    </div>
    <div className="rounded-full border border-secondary/30 bg-surface/70 px-3 py-1.5 text-center font-semibold text-secondary/80">
      Step 2 · Question
    </div>
  </div>
)}
```

### After:
```jsx
{isSmallScreen && (
  <nav 
    className="mt-3 grid grid-cols-2 gap-2 sm:hidden" 
    aria-label="Reading setup steps"
  >
    <button
      type="button"
      onClick={() => handleStepNav('spread')}
      className={`min-h-[44px] rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.15em] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        activeStep === 'spread'
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-secondary/30 bg-surface/70 text-secondary/80 hover:border-secondary/50'
      }`}
      aria-current={activeStep === 'spread' ? 'step' : undefined}
    >
      <span className="flex items-center justify-center gap-1.5">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] ${
          activeStep === 'spread' ? 'bg-accent text-surface' : 'bg-secondary/20 text-secondary'
        }`}>
          1
        </span>
        Spread
      </span>
    </button>
    
    <button
      type="button"
      onClick={() => handleStepNav('intention')}
      className={`min-h-[44px] rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.15em] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        activeStep === 'intention'
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-secondary/30 bg-surface/70 text-secondary/80 hover:border-secondary/50'
      }`}
      aria-current={activeStep === 'intention' ? 'step' : undefined}
    >
      <span className="flex items-center justify-center gap-1.5">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] ${
          activeStep === 'intention' ? 'bg-accent text-surface' : 'bg-secondary/20 text-secondary'
        }`}>
          2
        </span>
        Question
      </span>
    </button>
  </nav>
)}
```

**Key Changes:**
- Converted from `<div>` to interactive `<button>` elements
- Added `min-h-[44px]` for touch target compliance
- Wired `onClick` handlers to navigate (spread scrolls, question opens drawer)
- Added visual active state based on `activeStep`
- Added `aria-current="step"` for screen readers
- Added numbered badge inside each button

---

## 4. Rework Swipe Hints: Persist Until User Scrolls

**Current Issue:** Swipe hint disappears after 4 seconds regardless of user interaction [^4].

**Location:** [`ReadingGrid.jsx`](../src/components/ReadingGrid.jsx)

### Before:
```jsx
// Hide swipe hint after 4 seconds or when user interacts
useEffect(() => {
  if (!reading || reading.length <= 1 || isListView) return undefined;

  const timer = setTimeout(() => {
    setShowSwipeHint(false);
  }, 4000);

  return () => clearTimeout(timer);
}, [reading, isListView]);
```

### After:
```jsx
const [hasUserScrolled, setHasUserScrolled] = useState(false);
const scrollContainerRef = useRef(null);

// Track user scroll interaction
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container || hasUserScrolled) return;

  const handleScroll = () => {
    // Only count significant scrolls (> 20px movement)
    if (Math.abs(container.scrollLeft) > 20) {
      setHasUserScrolled(true);
      setShowSwipeHint(false);
    }
  };

  container.addEventListener('scroll', handleScroll, { passive: true });
  return () => container.removeEventListener('scroll', handleScroll);
}, [hasUserScrolled]);

// Hide swipe hint only after user scrolls OR after extended timeout (8s)
useEffect(() => {
  if (!reading || reading.length <= 1 || isListView || hasUserScrolled) {
    return undefined;
  }

  const timer = setTimeout(() => {
    setShowSwipeHint(false);
  }, 8000); // Extended from 4s to 8s

  return () => clearTimeout(timer);
}, [reading, isListView, hasUserScrolled]);

// Reset scroll tracking when reading changes
useEffect(() => {
  setHasUserScrolled(false);
  setShowSwipeHint(true);
}, [reading]);
```

**Also update the swipe hint UI for better visibility:**

```jsx
{showSwipeHint && !hasUserScrolled && reading.length > 1 && !isListView && (
  <div 
    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-main/80 backdrop-blur-sm border border-secondary/30 shadow-lg animate-pulse"
    role="status"
    aria-live="polite"
  >
    <ArrowsLeftRight className="w-4 h-4 text-accent" weight="bold" />
    <span className="text-xs font-medium text-main">Swipe to see more cards</span>
  </div>
)}
```

---

## 5. Add Bottom-Bar Animation for Keyboard Avoidance

**Current Issue:** The MobileActionBar jumps abruptly when keyboard opens [^5].

**Location:** `MobileActionBar.jsx`

### Before:
```jsx
return (
  <nav
    className={`mobile-action-bar sm:hidden transition-opacity duration-200 ...`}
    style={effectiveOffset > 0 ? { bottom: effectiveOffset } : undefined}
    ...
  >
```

### After:
```jsx
// Add CSS transition for smooth keyboard avoidance
const barStyle = useMemo(() => ({
  bottom: effectiveOffset > 0 ? effectiveOffset : 0,
  transition: 'bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out',
  willChange: effectiveOffset > 0 ? 'bottom' : 'auto'
}), [effectiveOffset]);

return (
  <nav
    className={`mobile-action-bar sm:hidden fixed left-0 right-0 z-40 ${
      isOverlayActive ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}
    style={barStyle}
    aria-hidden={isOverlayActive}
    ...
  >
```

**Also add CSS in `tarot.css` for enhanced animation:**

```css
/* Mobile action bar keyboard avoidance animation */
.mobile-action-bar {
  /* Smooth bottom position changes */
  transition: 
    bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
  
  /* Prevent layout thrashing */
  contain: layout style;
}

/* When keyboard is open, add subtle slide-up effect */
.mobile-action-bar[style*="bottom"] {
  transform: translateY(0);
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  .mobile-action-bar {
    transition: opacity 0.1s ease-out;
  }
}

/* Safe area handling for notched devices */
.mobile-action-bar {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0.75rem));
}
```

---

## 6. Additional: Improve "More" Button Touch Target

**Location:** `TarotReading.jsx` – Quick Intention Card

### Before:
```jsx
<button
  type="button"
  onClick={() => setIsMobileSettingsOpen(true)}
  className="rounded-xl border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 transition touch-manipulation"
>
  More
</button>
```

### After:
```jsx
<button
  type="button"
  onClick={() => setIsMobileSettingsOpen(true)}
  className="min-h-[44px] min-w-[44px] rounded-xl border border-secondary/40 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  aria-label="Open reading settings"
>
  <span className="flex items-center gap-1">
    <GearSix className="w-4 h-4" weight="duotone" aria-hidden="true" />
    <span className="hidden xxs:inline">More</span>
  </span>
</button>
```

---

## Summary of Changes

| Component | Issue | Fix | Impact |
|-----------|-------|-----|--------|
| Coach button | ~32px height | `min-h-[44px]` + icon | iOS HIG compliance |
| Spread placeholders | Illegible 0.55rem text | External position indicators | Improved readability |
| Step badges | Non-interactive decorative | Wired buttons with navigation | Functional wayfinding |
| Swipe hints | 4s timeout regardless | Scroll-aware + 8s fallback | Better discoverability |
| Bottom bar | Abrupt jump | CSS transition + cubic-bezier | Smooth keyboard avoidance |
| More button | ~36px height | `min-h-[44px]` + icon | iOS HIG compliance |

All changes maintain backward compatibility and respect the existing design system's color tokens and spacing conventions.

---

## Known Implementation Gaps

1. **SpreadTable External Position Indicators (Section 2)** — The documentation describes moving position labels outside the compact placeholders, but [`SpreadTable.jsx:150`](../src/components/SpreadTable.jsx:150) still uses inline `text-[0.55rem]` text. Consider implementing the external indicator pattern for improved legibility.

---

#### Sources

[^1]: [`TarotReading.jsx`](../src/TarotReading.jsx) - Main reading page with Coach button and step badges
[^2]: [`SpreadTable.jsx`](../src/components/SpreadTable.jsx) - Spread layout visualization with card placeholders
[^3]: [`TarotReading.jsx`](../src/TarotReading.jsx) - Step badge navigation
[^4]: [`ReadingGrid.jsx`](../src/components/ReadingGrid.jsx) - Card carousel with swipe hint logic
[^5]: [`TarotReading.jsx`](../src/TarotReading.jsx) - "More" button for settings drawer
