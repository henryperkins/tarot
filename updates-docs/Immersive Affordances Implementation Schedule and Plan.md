# Immersive Affordances: Implementation Schedule

Based on the codebase patterns, here's a comprehensive implementation plan for improving perceived polish through landscape-safe layouts, gesture-enabled modals, haptic hooks, and responsive spread art.

---

## Implementation Status Overview

| Phase | Status | Key Items |
|-------|--------|-----------|
| Phase 1: Landscape-Safe Layouts | ✅ Mostly Complete | WelcomeHero PRINCIPLES array implemented; TarotReading QuickIntentionCard extracted |
| Phase 2: Gesture-Enabled Modals | ✅ Complete | [`useSwipeDismiss.js`](../src/hooks/useSwipeDismiss.js), [`useSwipeNavigation.js`](../src/hooks/useSwipeNavigation.js) implemented |
| Phase 3: Haptic Hooks | ❌ Not Started | Centralized `useHaptic` hook not created; DeckRitual still uses inline vibrate |
| Phase 4: Responsive Spread Art | ✅ Complete | [`ResponsiveSpreadArt.jsx`](../src/components/ResponsiveSpreadArt.jsx) created; responsive variants (AVIF/WebP at 640/1280px) in `selectorimages/`; [`SpreadSelector.jsx`](../src/components/SpreadSelector.jsx) updated with srcset sources |

### Implementation Gaps
- **GuidedIntentionCoach landscape height**: Doc specifies `max-h-[85vh]` but actual implementation uses `max-h-[98vh]` in landscape mode ([`GuidedIntentionCoach.jsx:1195`](../src/components/GuidedIntentionCoach.jsx:1195))
- **useHaptic centralization**: Haptic patterns still inline in [`DeckRitual.jsx`](../src/components/DeckRitual.jsx) rather than centralized hook

---

## Phase 1: Landscape-Safe Layouts (Week 1)

The app already uses `useLandscape()` throughout components but aggressively hides content rather than adapting it [^1]. Key areas need layout transformation rather than content removal.

### Priority 1.1: Onboarding Flow Landscape Optimization

**Current state:** WelcomeHero hides key principles grid entirely in landscape [^2]. JourneyBegin hides the "First Reading" info card [^3].

**Implementation:**

> **Implementation note:** `WelcomeHero.jsx` currently inlines the three "Reflect / Embrace / Follow" tiles rather than reading from data. Add a local `const PRINCIPLES = [...]` array (or reuse an exported token) before using it below so this snippet compiles.

```jsx
// WelcomeHero.jsx - Transform grid to horizontal scroll instead of hiding
const PRINCIPLES = [
  { icon: Eye, label: 'Reflect & explore' },
  { icon: Path, label: 'Embrace free will' },
  { icon: Lightbulb, label: 'Follow what resonates' }
];

{isLandscape ? (
  <div className="mt-3 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
    {PRINCIPLES.map((principle, i) => (
      <div key={i} className="flex-shrink-0 w-32 snap-center flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/40 border border-secondary/20">
        <principle.icon className="w-5 h-5 text-accent shrink-0" weight="duotone" />
        <span className="text-xs text-muted line-clamp-2">{principle.label}</span>
      </div>
    ))}
  </div>
) : (
  // Original 3-column grid for portrait
  <div className="mt-6 grid grid-cols-1 xs:grid-cols-3 gap-4 max-w-lg mx-auto">
    {/* ... */}
  </div>
)}
```

### Priority 1.2: Reading Setup Landscape Layout

**Current state:** Main content uses reduced spacing (`space-y-3` vs `space-y-6`) but maintains vertical stack [^4].

**Implementation:** Create side-by-side layout for spread selector + intention input in landscape:

> **Implementation note:** the quick-intention UI currently lives inline inside `TarotReading.jsx`. Either extract that block into a `QuickIntentionCard` component as part of this work or replace the reference below with the existing JSX fragment.

```jsx
// TarotReading.jsx - Landscape two-column layout
<section aria-label="Reading setup" className={isLandscape ? 'mb-3' : 'mb-6 xl:mb-4'}>
  <div className={isLandscape 
    ? 'grid grid-cols-[1fr,1fr] gap-4 items-start' 
    : 'space-y-6 max-w-5xl mx-auto'
  }>
    <div aria-label="Spread selection" ref={spreadSectionRef}>
      <SpreadSelector compact={isLandscape} /* ... */ />
    </div>
    {isSmallScreen && (
      <div className={isLandscape ? '' : 'sm:hidden'}>
        {/* Quick intention card - always visible in landscape */}
        <QuickIntentionCard /* existing quick intention markup */ />
      </div>
    )}
  </div>
</section>
```

### Priority 1.3: Modal Height Constraints

**Current state:** GuidedIntentionCoach and MobileSettingsDrawer use `h-full` on mobile [^5].

> ⚠️ **Implementation Note:** The actual [`GuidedIntentionCoach.jsx:1195`](../src/components/GuidedIntentionCoach.jsx:1195) uses `max-h-[98vh]` in landscape mode rather than the `max-h-[85vh]` specified here. Consider whether tighter constraint is needed.

**Implementation:** Add landscape-aware max heights:

```jsx
// GuidedIntentionCoach.jsx - Current implementation differs from spec
<div
  ref={modalRef}
  className={`relative w-full h-full sm:h-auto ${isLandscape ? 'max-h-[98vh]' : 'sm:max-h-[90vh]'} ...`}
>
```

**Recommended (per spec):**
```jsx
// GuidedIntentionCoach.jsx
<div
  ref={modalRef}
  className={`relative w-full ${
    isLandscape
      ? 'h-auto max-h-[85vh] overflow-y-auto'
      : 'h-full sm:h-auto sm:max-h-[90vh]'
  } ...`}
>
```

---

## Phase 2: Gesture-Enabled Modals (Week 2)

The `MobileSettingsDrawer` already has swipe-to-dismiss with velocity detection [^6]. This pattern needs to be extended to other modals.

### Priority 2.1: Shared Gesture Hook

**Implementation:**

```jsx
// hooks/useSwipeDismiss.js
import { useState, useRef, useCallback } from 'react';

export function useSwipeDismiss({ 
  onDismiss, 
  threshold = 150, 
  velocityThreshold = 0.5,
  resistance = 0.6 
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffset(deltaY * resistance);
    }
  }, [resistance]);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) {
      reset();
      return;
    }

    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const elapsed = Date.now() - (touchStartTime.current || Date.now());
    const velocity = deltaY / Math.max(elapsed, 1);

    const shouldDismiss = deltaY > threshold || (deltaY > 80 && velocity > velocityThreshold);

    if (shouldDismiss) {
      setDragOffset(window.innerHeight);
      setTimeout(onDismiss, 150);
    } else {
      reset();
    }
  }, [onDismiss, threshold, velocityThreshold]);

  const reset = useCallback(() => {
    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  return {
    dragOffset,
    isDragging,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: reset
    },
    style: {
      transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
      transition: isDragging ? 'none' : 'transform 0.2s ease-out'
    }
  };
}
```

### Priority 2.2: Apply to GuidedIntentionCoach

**Current state:** Only backdrop click and close button dismiss the modal [^7].

**Implementation:**

```jsx
// GuidedIntentionCoach.jsx
import { useSwipeDismiss } from '../hooks/useSwipeDismiss';

export function GuidedIntentionCoach({ isOpen, onClose, ... }) {
  const { handlers, style, isDragging } = useSwipeDismiss({ 
    onDismiss: onClose,
    threshold: 120 
  });

  return (
    <div className="fixed inset-0 z-50 ...">
      <div
        ref={modalRef}
        className="relative w-full h-full sm:h-auto ..."
        {...handlers}
        style={style}
      >
        {/* Swipe handle indicator - mobile only */}
        <div className="sm:hidden w-12 h-1 bg-secondary/40 rounded-full mx-auto mt-3 mb-2" 
             aria-hidden="true" />
        {/* ... rest of modal content */}
      </div>
    </div>
  );
}
```

### Priority 2.3: OnboardingWizard Gesture Support

**Current state:** 7-step wizard with no gesture navigation between steps [^8].

**Implementation:** Add a reusable horizontal swipe hook, then wire it into the wizard.

```jsx
// hooks/useSwipeNavigation.js
import { useRef, useCallback } from 'react';

export function useSwipeNavigation({ onSwipeLeft, onSwipeRight, threshold = 60 }) {
  const startX = useRef(null);

  const handleTouchStart = useCallback((event) => {
    startX.current = event.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (startX.current == null) return;
    const delta = event.changedTouches[0].clientX - startX.current;
    if (Math.abs(delta) >= threshold) {
      if (delta < 0) onSwipeLeft?.();
      if (delta > 0) onSwipeRight?.();
    }
    startX.current = null;
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: () => {
      startX.current = null;
    }
  };
}

// OnboardingWizard.jsx
const swipeHandlers = useSwipeNavigation({
  onSwipeLeft: () => currentStep < totalSteps && handleNext(),
  onSwipeRight: () => currentStep > 1 && handleBack()
});

return (
  <div className="flex-1 overflow-y-auto" {...swipeHandlers}>
    {renderStep()}
  </div>
);
```

---

## Phase 3: Haptic Hooks (Week 3)

> ❌ **NOT STARTED:** This phase has not been implemented. The `Card` component and [`DeckRitual.jsx:12-16`](../src/components/DeckRitual.jsx:12-16) still use inline vibrate patterns rather than a centralized hook.

The `Card` component already has a `vibrate` helper for swipe reveals [^9]. This needs to be centralized and expanded.

### Priority 3.1: Centralized Haptic Hook

**Implementation (TODO):**

```jsx
// hooks/useHaptic.js
const HAPTIC_PATTERNS = {
  tap: [10],           // Light tap feedback
  success: [15, 50, 15], // Confirmation pattern
  knock: [30],         // Ritual knock
  reveal: [10],        // Card reveal
  error: [50, 30, 50], // Error feedback
  selection: [5]       // UI selection
};

export function useHaptic() {
  const vibrate = useCallback((pattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const vibrationPattern = typeof pattern === 'string' 
        ? HAPTIC_PATTERNS[pattern] || HAPTIC_PATTERNS.tap
        : pattern;
      navigator.vibrate(vibrationPattern);
    }
  }, []);

  return { vibrate, patterns: HAPTIC_PATTERNS };
}
```

### Priority 3.2: Apply to DeckRitual

**Current state:** Knock and cut buttons have no haptic feedback [^10].

**Implementation:**

```jsx
// DeckRitual.jsx
import { useHaptic } from '../hooks/useHaptic';

export function DeckRitual({ onKnock, applyCut, ... }) {
  const { vibrate } = useHaptic();

  const handleDeckTap = useCallback(() => {
    vibrate('knock');
    onKnock();
  }, [onKnock, vibrate]);

  const handleCutConfirm = useCallback(() => {
    vibrate('success');
    applyCut(localCutIndex);
    setShowCutSlider(false);
  }, [applyCut, localCutIndex, vibrate]);

  // ... rest of component
}
```

### Priority 3.3: Apply to Card Interactions

**Current state:** Already has vibrate on swipe reveal [^9], but not on tap reveal or reflection save.

**Implementation:**

```jsx
// Card.jsx - Expand haptic coverage
const { vibrate } = useHaptic();

const handleReveal = useCallback(() => {
  vibrate('reveal');
  userInitiatedRevealRef.current = true;
  onReveal(index);
}, [onReveal, index, vibrate]);

const handleReflectionBlur = useCallback(() => {
  if (reflectionValue.trim() !== originalReflection.current) {
    vibrate('selection');
    // Save reflection...
  }
}, [reflectionValue, vibrate]);
```

---

## Phase 4: Responsive Spread Art (Week 4)

> ✅ **COMPLETE:** Responsive images generated and integrated via `<picture>` element with AVIF/WebP srcset.

**Implementation Details:**
- Responsive variants exist in `selectorimages/`: `{spread}-640.avif`, `{spread}-640.webp`, `{spread}-1280.avif`, `{spread}-1280.webp`
- [`SpreadSelector.jsx:12-46`](../src/components/SpreadSelector.jsx:12) imports all 30 responsive variants
- [`SpreadSelector.jsx:110-212`](../src/components/SpreadSelector.jsx:110) `SPREAD_ART_OVERRIDES` includes `sources` object with format/width info
- [`SpreadPatternThumbnail.jsx:17-44`](../src/components/SpreadPatternThumbnail.jsx:17) parses sources and uses `ResponsiveSpreadArt`
- [`ResponsiveSpreadArt.jsx`](../src/components/ResponsiveSpreadArt.jsx) renders `<picture>` with `<source>` elements for each format

**Previous state:** Spread artwork used 4096×4096px images directly [^11].

### Priority 4.1: Generate Responsive Variants ✅

**Build script (reference implementation):**

```javascript
// scripts/generate-responsive-images.js
import sharp from 'sharp';
import { glob } from 'glob';

const SIZES = [400, 800, 1200, 2048];
const INPUT_DIR = 'public/art/spreads';
const OUTPUT_DIR = 'public/art/spreads/responsive';

async function generateVariants() {
  const files = await glob(`${INPUT_DIR}/*.{png,jpg,jpeg}`);
  
  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    
    for (const width of SIZES) {
      // WebP variant
      await sharp(file)
        .resize(width, width, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(`${OUTPUT_DIR}/${basename}-${width}w.webp`);
      
      // JPEG fallback
      await sharp(file)
        .resize(width, width, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(`${OUTPUT_DIR}/${basename}-${width}w.jpg`);
    }
  }
}
```

### Priority 4.2: Responsive Image Component ✅

**Actual implementation:** [`ResponsiveSpreadArt.jsx`](../src/components/ResponsiveSpreadArt.jsx)

```jsx
// components/ResponsiveSpreadArt.jsx
export function ResponsiveSpreadArt({ 
  spreadKey, 
  alt, 
  className,
  sizes = "(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 300px" 
}) {
  const basePath = `/art/spreads/responsive/${spreadKey}`;
  
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`
          ${basePath}-400w.webp 400w,
          ${basePath}-800w.webp 800w,
          ${basePath}-1200w.webp 1200w,
          ${basePath}-2048w.webp 2048w
        `}
        sizes={sizes}
      />
      <source
        type="image/jpeg"
        srcSet={`
          ${basePath}-400w.jpg 400w,
          ${basePath}-800w.jpg 800w,
          ${basePath}-1200w.jpg 1200w,
          ${basePath}-2048w.jpg 2048w
        `}
        sizes={sizes}
      />
      <img
        src={`${basePath}-800w.jpg`}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
```

### Priority 4.3: Update SpreadSelector ✅

**Actual implementation:** [`SpreadPatternThumbnail.jsx`](../src/components/SpreadPatternThumbnail.jsx) handles the responsive rendering.

**Reference implementation:**

```jsx
// SpreadSelector.jsx
import { ResponsiveSpreadArt } from './ResponsiveSpreadArt';

// Replace direct image imports with responsive component
<ResponsiveSpreadArt
  spreadKey={spread.key}
  alt={spread.art?.alt || `${spread.name} spread artwork`}
  className="absolute inset-0 w-full h-full object-cover"
  sizes="(max-width: 480px) 90vw, (max-width: 768px) 45vw, 280px"
/>
```

---

## Implementation Schedule Summary

| Week | Focus Area | Components | Effort | Status |
|------|-----------|------------|--------|--------|
| 1 | Landscape layouts | WelcomeHero, JourneyBegin, TarotReading, GuidedIntentionCoach | Medium | ✅ Mostly Complete |
| 2 | Gesture modals | useSwipeDismiss, GuidedIntentionCoach, OnboardingWizard | Medium | ✅ Complete |
| 3 | Haptic feedback | useHaptic, DeckRitual, Card, MobileActionBar | Low | ❌ Not Started |
| 4 | Responsive art | ResponsiveSpreadArt, SpreadPatternThumbnail, SpreadSelector | Medium | ✅ Complete |

### Success Metrics

- **Landscape usability:** No critical content hidden; all actions accessible
- **Gesture discovery:** 60%+ of mobile users use swipe-to-dismiss within first session
- **Performance:** Spread selector LCP improved by 40%+ on 3G connections
- **Perceived polish:** User satisfaction score increase in post-reading feedback

#### Sources

[^1]: [`TarotReading.jsx`](../src/TarotReading.jsx) - Main reading flow with landscape handling
[^2]: [`WelcomeHero.jsx`](../src/components/onboarding/WelcomeHero.jsx) - Onboarding welcome with PRINCIPLES array
[^3]: [`JourneyBegin.jsx`](../src/components/onboarding/JourneyBegin.jsx) - Final onboarding step
[^4]: [`TarotReading.jsx`](../src/TarotReading.jsx) - Reading setup landscape layout
[^5]: [`GuidedIntentionCoach.jsx`](../src/components/GuidedIntentionCoach.jsx) - Modal with swipe dismiss
[^6]: [`MobileSettingsDrawer.jsx`](../src/components/MobileSettingsDrawer.jsx) - Settings drawer with swipe
[^7]: [`GuidedIntentionCoach.jsx`](../src/components/GuidedIntentionCoach.jsx) - Backdrop click and close
[^8]: [`OnboardingWizard.jsx`](../src/components/onboarding/OnboardingWizard.jsx) - Multi-step wizard with swipe navigation
[^9]: [`Card.jsx`](../src/components/Card.jsx) - Card reveal with inline vibrate
[^10]: [`DeckRitual.jsx`](../src/components/DeckRitual.jsx) - Ritual controls with inline haptics
[^11]: [`SpreadSelector.jsx`](../src/components/SpreadSelector.jsx) - Spread selection with large artwork images
