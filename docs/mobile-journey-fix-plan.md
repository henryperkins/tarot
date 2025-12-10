# Mobile Journey UI Fix Plan

> Comprehensive plan to fix mobile UI issues in the ReadingJourney components.

## Executive Summary

The `JourneyMobileSheet` component has 12 identified issues ranging from critical accessibility/UX problems to minor polish items. The fixes are grouped into 4 phases, prioritizing critical issues first.

**Estimated scope**: ~200-250 lines of code changes across 5-6 files.

---

## Phase 1: Critical UX Fixes (High Priority)

### 1.1 Replace Manual Scroll Lock with `useModalA11y`

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code** (lines 90-100):
```jsx
useEffect(() => {
  if (isSheetOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
  return () => {
    document.body.style.overflow = '';
  };
}, [isSheetOpen]);
```

**Problem**:
- Doesn't prevent iOS Safari elastic bounce
- Doesn't restore previous overflow value
- Doesn't handle scrollbar width compensation
- No focus trapping

**Fix**: Use the existing `useModalA11y` hook (same as `MobileSettingsDrawer`):

```jsx
import { useModalA11y } from '../../hooks/useModalA11y';

// Inside component:
const sheetRef = useRef(null);
const closeButtonRef = useRef(null);

useModalA11y(isSheetOpen, {
  onClose: () => setIsSheetOpen(false),
  containerRef: sheetRef,
  initialFocusRef: closeButtonRef,
  scrollLockStrategy: 'simple',
});

// Remove the manual useEffect for body scroll
```

**Also removes**: The manual escape key handler (lines 80-88) since `useModalA11y` handles it.

---

### 1.2 Add Sheet Animation

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code** (line 312):
```jsx
<div
  ref={sheetRef}
  className="relative bg-gradient-to-br ... max-h-[85vh] overflow-hidden flex flex-col"
>
```

**Problem**: Sheet appears/disappears instantly with no animation.

**Fix**: Add the existing `animate-slide-up` class and backdrop fade:

```jsx
{/* Backdrop - add fade animation */}
<div
  className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
  onClick={() => setIsSheetOpen(false)}
/>

{/* Sheet - add slide animation */}
<div
  ref={sheetRef}
  className="relative bg-gradient-to-br ... max-h-[85vh] overflow-hidden flex flex-col animate-slide-up"
>
```

---

### 1.3 Implement Swipe-to-Dismiss

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code**: Drag handle is visual only (lines 315-317).

**Fix**: Port swipe handling from `MobileSettingsDrawer.jsx` (lines 49-143):

```jsx
// Add state for drag handling
const [dragOffset, setDragOffset] = useState(0);
const [isDragging, setIsDragging] = useState(false);
const touchStartY = useRef(null);
const touchStartTime = useRef(null);

// Reset drag state on open/close
useEffect(() => {
  if (!isSheetOpen) {
    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
    touchStartTime.current = null;
  }
}, [isSheetOpen]);

const handleTouchStart = useCallback((event) => {
  const target = event.target;
  const isHandle = target.closest('.journey-sheet__handle');
  const scrollContainer = sheetRef.current?.querySelector('.journey-sheet__body');
  const isAtScrollTop = !scrollContainer || scrollContainer.scrollTop <= 0;

  if (isHandle || isAtScrollTop) {
    touchStartY.current = event.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }
}, []);

const handleTouchMove = useCallback((event) => {
  if (touchStartY.current === null) return;

  const deltaY = event.touches[0].clientY - touchStartY.current;
  if (deltaY > 0) {
    // Apply resistance
    setDragOffset(deltaY * 0.6);
  }
}, []);

const handleTouchEnd = useCallback((event) => {
  if (touchStartY.current === null) {
    setIsDragging(false);
    return;
  }

  const deltaY = event.changedTouches[0].clientY - touchStartY.current;
  const elapsed = Date.now() - (touchStartTime.current || Date.now());
  const velocity = deltaY / Math.max(elapsed, 1);

  // Dismiss if dragged far enough or fast swipe
  const shouldDismiss = deltaY > 200 || (deltaY > 80 && velocity > 0.6);

  if (shouldDismiss) {
    setDragOffset(window.innerHeight);
    setTimeout(() => setIsSheetOpen(false), 150);
  } else {
    setDragOffset(0);
  }

  touchStartY.current = null;
  touchStartTime.current = null;
  setIsDragging(false);
}, []);

// Apply to sheet container
<div
  ref={sheetRef}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  onTouchCancel={() => {
    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
  }}
  style={{
    transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
  }}
  className="..."
>
```

---

## Phase 2: Accessibility Fixes (Medium Priority)

### 2.1 Fix Close Button Touch Target

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code** (lines 328-334):
```jsx
<button
  onClick={() => setIsSheetOpen(false)}
  className="p-2 text-amber-100/60 hover:text-amber-100"
  aria-label="Close"
>
  <X className="h-5 w-5" />
</button>
```

**Problem**: Touch target is ~36px (below 44px minimum).

**Fix**: Use the `mobile-drawer__close` CSS class from tarot.css which has proper sizing:

```jsx
<button
  ref={closeButtonRef}
  onClick={() => setIsSheetOpen(false)}
  className="mobile-drawer__close"
  aria-label="Close journey panel"
>
  <X className="h-5 w-5" />
</button>
```

Or add explicit minimum dimensions:
```jsx
className="p-2 min-h-11 min-w-11 flex items-center justify-center text-amber-100/60 hover:text-amber-100 rounded-lg"
```

---

### 2.2 Fix Tab Touch Targets

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code** (lines 339-356):
```jsx
<button
  key={tab.key}
  onClick={() => setActiveTab(tab.key)}
  className={`
    flex items-center gap-1.5 px-4 py-3 text-xs font-medium
    border-b-2 transition-colors
    ...
  `}
>
```

**Fix**: Add minimum height:
```jsx
className={`
  flex items-center gap-1.5 px-4 py-3 min-h-11 text-xs font-medium
  border-b-2 transition-colors
  ...
`}
```

---

### 2.3 Add Safe Area Inset Handling

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code**: No safe area handling.

**Fix**: Add safe area padding to sheet content:

```jsx
{/* Tab content - add safe area padding */}
<div className="journey-sheet__body flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 overscroll-contain">
```

And to the container:
```jsx
{/* Container - account for top safe area */}
<div
  className="fixed inset-0 z-50 flex flex-col justify-end"
  style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}
>
```

---

## Phase 3: Layout Fixes (Medium Priority)

### 3.1 Fix Bottom Sheet Max Height

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code** (line 312):
```jsx
className="... max-h-[85vh] ..."
```

**Problem**: 85vh is too aggressive on small devices.

**Fix**: Use dynamic max height with safe area:
```jsx
className="... max-h-[calc(100%-8px)] ..."
// or use style for more control:
style={{
  maxHeight: 'calc(100% - 8px)',
  // ... other styles
}}
```

This matches `MobileSettingsDrawer.jsx:170`.

---

### 3.2 Fix MajorArcanaMap Overflow on Narrow Screens

**Files**: `src/components/ReadingJourney/sections/MajorArcanaMap.jsx`

**Current Code** (lines 88-99):
```jsx
<div className="flex-shrink-0 w-7 h-7 rounded ..."
```

**Fix**: Add responsive sizing:
```jsx
<div className="flex-shrink-0 w-6 h-6 xs:w-7 xs:h-7 rounded text-[9px] xs:text-[10px] ..."
```

And ensure container handles overflow gracefully:
```jsx
<div className="flex gap-0.5 xs:gap-1 justify-start overflow-x-auto pb-1 scrollbar-none">
```

---

### 3.3 Fix AchievementsRow Scroll Clip

**Files**: `src/components/ReadingJourney/sections/AchievementsRow.jsx`

**Current Code** (line 45):
```jsx
<div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin ...">
```

**Fix**: Use scroll padding instead of negative margins:
```jsx
<div
  className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-200/20 scrollbar-track-transparent"
  style={{ scrollPaddingInline: '4px' }}
>
```

---

## Phase 4: Polish & Minor Fixes (Lower Priority)

### 4.1 Increase CadenceChart Height on Mobile

**Files**: `src/components/ReadingJourney/sections/CadenceSection.jsx`

**Current Code** (line 22):
```jsx
<CadenceChart data={data} height={60} />
```

**Fix**: Pass responsive height:
```jsx
// In CadenceSection.jsx
const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
<CadenceChart data={data} height={isMobile ? 80 : 60} />
```

Or better, make it responsive in CadenceChart itself using CSS.

---

### 4.2 Add Responsive Text Sizing

**Files**: Multiple section components

**Issue**: No responsive breakpoints for text sizes.

**Fix**: Add Tailwind responsive prefixes throughout:

```jsx
// Example in SeasonSummary.jsx
<p className="text-xs sm:text-sm text-amber-100/85 leading-relaxed mb-3">

// Example in CardsCallingYou.jsx
<span className="text-xs sm:text-sm text-amber-100/85">
```

---

### 4.3 Add `overscroll-contain` to Scrollable Areas

**Files**: `src/components/ReadingJourney/JourneyMobileSheet.jsx`

**Current Code** (line 360):
```jsx
<div className="flex-1 overflow-y-auto p-5 space-y-4">
```

**Fix**: Add overscroll containment:
```jsx
<div className="journey-sheet__body flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain">
```

---

## Implementation Order

### Batch 1: Core UX (Critical) ✅ COMPLETED
1. [x] 1.1 - Replace scroll lock with `useModalA11y`
2. [x] 1.2 - Add sheet animation
3. [x] 1.3 - Implement swipe-to-dismiss

### Batch 2: Accessibility ✅ COMPLETED
4. [x] 2.1 - Fix close button touch target
5. [x] 2.2 - Fix tab touch targets
6. [x] 2.3 - Add safe area handling

### Batch 3: Layout ✅ COMPLETED
7. [x] 3.1 - Fix max height
8. [x] 3.2 - Fix MajorArcanaMap responsive sizing
9. [x] 3.3 - Fix AchievementsRow scroll

### Batch 4: Polish ✅ COMPLETED
10. [x] 4.1 - CadenceChart height
11. [x] 4.2 - Responsive text sizing (via variant prop)
12. [x] 4.3 - Add overscroll-contain

---

## Files to Modify

| File | Changes |
|------|---------|
| `JourneyMobileSheet.jsx` | 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 4.3 |
| `MajorArcanaMap.jsx` | 3.2 |
| `AchievementsRow.jsx` | 3.3 |
| `CadenceSection.jsx` | 4.1 |
| `SeasonSummary.jsx` | 4.2 |
| `CardsCallingYou.jsx` | 4.2 |
| `ContextBreakdown.jsx` | 4.2 |

---

## Testing Checklist

### Device Testing
- [ ] iPhone SE (320px width, 568px height)
- [ ] iPhone 13/14 (390px width, notch)
- [ ] iPhone 14 Pro Max (428px width, Dynamic Island)
- [ ] iPad Mini (768px width, landscape)
- [ ] Small Android (360px width)

### Interaction Testing
- [ ] Swipe down on drag handle dismisses sheet
- [ ] Swipe down on content (when at scroll top) dismisses sheet
- [ ] Swipe resistance feels natural
- [ ] Fast swipe (velocity) dismisses
- [ ] Slow partial swipe snaps back
- [ ] Sheet slide-up animation plays on open
- [ ] Backdrop fade animation plays
- [ ] Escape key closes sheet
- [ ] Tab focus is trapped within sheet
- [ ] Focus returns to trigger button on close

### Layout Testing
- [ ] Content doesn't overlap home indicator on iPhone
- [ ] Content doesn't overlap notch/Dynamic Island area
- [ ] Major Arcana map doesn't clip on 320px width
- [ ] Achievements row scrolls without clip artifacts
- [ ] All touch targets ≥ 44px

### Accessibility Testing
- [ ] VoiceOver can navigate all elements
- [ ] Screen reader announces sheet as dialog
- [ ] Reduced motion: no animations play
- [ ] High contrast mode: all text readable

---

## Rollback Plan

If issues arise after deployment:

1. The feature flag `unifiedJourney` in `useFeatureFlags.js` can be set to `false` to revert to the legacy separate panels
2. Individual fixes are isolated and can be reverted independently via git

---

## Future Enhancements (Out of Scope)

- Full-page `/journey` route with bento grid layout
- Keyboard shortcuts for desktop
- Haptic feedback on swipe dismiss (requires native integration)
- Pull-to-refresh gesture
- Sheet height snap points (half/full)
