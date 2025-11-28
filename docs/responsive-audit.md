# Responsive Design Audit: Mystic Tarot Application

**Date:** 2025-11-27
**Scope:** Spread layouts, reading narrative display, onboarding wizard, general responsive patterns

---

## Executive Summary

This audit identifies **15+ responsive design issues** across the application, with critical breakage occurring at 320px screens and inconsistent safe area handling on notched devices. The most severe issues affect the Celtic Cross spread carousel, card aspect ratios, and onboarding wizard layouts.

### Severity Distribution
- **Critical (Breaking):** 4 issues
- **High Priority (UX Degradation):** 5 issues
- **Medium Priority (Polish):** 6+ issues

---

## 1. Spread Layout Issues

### 1.1 Celtic Cross Grid - Inconsistent Breakpoint Handling

**File:** `src/styles/tarot.css`
**Lines:** 595-669

**Current Code:**
```css
@media (max-width: 639px) {
  .cc-grid {
    display: flex;
    overflow-x-auto;
    scroll-snap-type: x mandatory;
    gap: 1rem;
    padding: 0 1rem 1.5rem;
    grid-template-areas: none;
    grid-template-columns: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .cc-grid>* {
    flex: 0 0 85vw;
    width: 85vw;
    scroll-snap-align: center;
  }
}
```

**Problem:**
- At 320px-360px (xxs/small mobile), cards occupy 85vw creating cramped carousel with limited padding
- On iPad/tablet at 640px-767px, switches to 2-column grid without appropriate card size scaling
- Celtic Cross layout breaks awkwardly at tablet sizes (640-768px)

**Suggested Fix:**
- Add explicit breakpoint for 320-374px with narrower card width (70-75vw)
- Add `overflow: hidden` on `.cc-grid` carousel to prevent layout shift
- Smooth transition at 640px with specific max-width constraints

---

### 1.2 Card Sizing - Inconsistent Aspect Ratio

**File:** `src/styles/tarot.css`
**Lines:** 686-719

**Current Code:**
```css
.tarot-card-shell {
  width: clamp(12rem, 65vw, 18rem);
  height: clamp(18rem, 97.5vw, 27rem);
  min-height: 18rem;
}

@media (min-width: 640px) and (max-width: 1023px) {
  .tarot-card-shell {
    max-width: 9rem;
    height: 13.5rem;
  }
}

@media (min-width: 768px) {
  .tarot-card-shell {
    width: 8rem;
    height: 12rem;
  }
}
```

**Problem:**
- Using `clamp()` with percentage-based `vw` units creates inconsistent aspect ratios
- At 375px width: height clamp reaches 97.5vw (~365px) which is nearly square
- Tablet range (640-768px) has inconsistent gap where cards snap to max-width suddenly
- Card aspect ratio (2:3) not properly maintained

**Suggested Fix:**
- Switch from vw-based height to `aspect-ratio: 2/3` property
- Use explicit pixel values at each breakpoint
- Add explicit 375px breakpoint: width 65vw, max-width 260px

---

### 1.3 Spread Card Carousel - Content Overflow on Ultra-Small Phones

**File:** `src/styles/tarot.css`
**Lines:** 422-461

**Current Code:**
```css
.spread-card {
  min-height: var(--spread-card-height-mobile, 18rem);
  max-height: calc(100vh - 10rem);
  max-height: calc(100svh - 10rem);
  padding: 1rem 1.15rem 1.35rem;
}

@media (max-width: 374px) {
  .spread-card {
    --spread-card-height-mobile: 16rem;
  }
}
```

**Problem:**
- At 320px width with title, description, and image, content overflows
- No `xxs` (320px) specific breakpoint to reduce padding
- Card description uses 3-line clamp but text size doesn't scale
- Spread card artwork `aspect-[16/10]` doesn't account for 320px constraint

**Suggested Fix:**
- Add `@media (max-width: 320px)` with reduced padding (0.75rem)
- Reduce description text size with `text-xs` at ultra-narrow widths
- Use `max-height: unset` on artwork to prevent squashing

---

## 2. Reading Narrative Issues

### 2.1 MarkdownRenderer - Poor Prose Width Control

**File:** `src/components/MarkdownRenderer.jsx`
**Lines:** 14-16

**Current Code:**
```jsx
<div className="text-main space-y-4 xs:space-y-5 md:space-y-6 max-w-prose mx-auto text-left px-1">
```

**Problem:**
- `px-1` (0.25rem) padding insufficient on 320px screens
- `max-w-prose` (~65 chars) doesn't adjust width for mobile
- List items use `pl-5` fixed padding - too large for 320px
- Inline code padding cramped at 320px

**Suggested Fix:**
- Change to `px-2 sm:px-4 lg:px-6` for proper scaling
- Use conditional: `max-w-xs sm:max-w-prose`
- Adjust list padding: `pl-4 sm:pl-5`

---

### 2.2 StreamingNarrative - Prose Container Width

**File:** `src/components/StreamingNarrative.jsx`
**Lines:** 235, 274

**Current Code:**
```jsx
<div className="prose prose-sm sm:prose-base md:prose-lg max-w-full sm:max-w-[65ch] w-full min-h-[8rem] xs:min-h-[10rem] px-1 sm:px-0 mx-auto">
```

**Problem:**
- `prose-sm` still too large at 320px
- `px-1` (0.25rem) insufficient at 320px
- `min-h-[8rem]` creates unnecessary white space on mobile
- `max-w-full` at mobile causes text to run edge-to-edge

**Suggested Fix:**
- Add explicit breakpoint: `text-sm px-2` for 320px
- Change to: `max-w-xs sm:max-w-[65ch]`
- Set `min-h-[6rem] xs:min-h-[8rem]`

---

### 2.3 Narrative Container - Padding Issues

**File:** `src/components/ReadingDisplay.jsx`
**Lines:** 341

**Current Code:**
```jsx
<div className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-5xl mx-auto ${isLandscape ? 'p-3' : 'p-4 sm:p-6 md:p-8'}`}>
```

**Problem:**
- `p-4` (1rem) at mobile compresses narrative with 12px gutters
- No specific handling for 320px screens
- Heading sizing doesn't step down for ultra-small phones

**Suggested Fix:**
- Add conditional: `max-w-full sm:max-w-5xl`
- Change padding: `px-3 py-4 sm:p-6 md:p-8`
- Add heading scaling: `text-lg sm:text-xl md:text-2xl`

---

## 3. Onboarding Wizard Issues

### 3.1 OnboardingWizard Modal - Safe Area Issues

**File:** `src/components/onboarding/OnboardingWizard.jsx`
**Lines:** 205-239

**Current Code:**
```jsx
<header className={`relative z-10 flex items-center justify-between px-4 pt-safe-top sm:px-6 ${isLandscape ? 'py-1.5' : 'py-4'}`}>
...
<main className={`relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth ${isLandscape ? 'px-3 py-3 sm:px-4' : 'px-4 py-6 sm:px-8 sm:py-8'}`}>
```

**Problem:**
- `px-4` at 320px leaves only 16px for content
- No `pt-safe-top` applied to main content - overlap on notched devices
- Landscape mode `px-3 py-3` too cramped
- No max-width constraint on modal content

**Suggested Fix:**
- Apply existing safe area utilities: `pl-safe-left pr-safe-right`
- Change to: `px-3 sm:px-4 md:px-6`
- Add `pt-safe-top` to main content

---

### 3.2 SpreadEducation - Image Sizing

**File:** `src/components/onboarding/SpreadEducation.jsx`
**Lines:** 104-213

**Current Code:**
```jsx
<div className={`grid gap-4 ${isLandscape ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
  ...
  <div className="relative aspect-[16/10] bg-gradient-to-br from-surface to-main overflow-hidden">
```

**Problem:**
- At 320px, 3-column grid doesn't kick in until 640px
- `aspect-[16/10]` creates 1.6 ratio - too tall at mobile
- Card height at 320px becomes excessive
- No control for when to hide descriptions on ultra-small screens

**Suggested Fix:**
- Update to `grid-cols-1 md:grid-cols-3`
- Change aspect ratio: `aspect-video sm:aspect-[16/10]`
- Hide descriptions on 320px: add `hidden sm:block`

---

### 3.3 QuestionCrafting Textarea - Touch Target

**File:** `src/components/onboarding/QuestionCrafting.jsx`
**Lines:** 80-87

**Current Code:**
```jsx
<textarea
  rows={isLandscape ? 2 : 3}
  className="w-full bg-surface border border-primary/40 rounded-xl px-4 py-3 text-base text-main placeholder-muted resize-none ..."
/>
```

**Problem:**
- No `min-height` fallback - may compress at 320px
- `py-3` is 0.75rem padding - WCAG 2.5.5 suggests 44x44px minimum
- Textarea should have explicit min-height at mobile

**Suggested Fix:**
- Add: `min-h-[7rem] sm:min-h-[8rem]`
- Change rows: `rows={isLandscape ? 2 : 4}`

---

### 3.4 SpreadEducation - Button Touch Targets

**File:** `src/components/onboarding/SpreadEducation.jsx`
**Lines:** 292-310

**Current Code:**
```jsx
<button className="flex items-center justify-center gap-1 min-h-[48px] px-4 py-3 rounded-xl border ...">
  <ArrowLeft className="w-4 h-4" />
  <span className="hidden xs:inline">Back</span>
</button>
```

**Problem:**
- `min-h-[48px]` is good (WCAG compliant)
- But `px-4` with hidden text creates narrow button (~2rem total)
- At 320px, 2 buttons + gap = ~8rem needed
- No responsive padding adjustment

**Suggested Fix:**
- Add conditional: `px-2 xs:px-3 sm:px-4`
- Icon-only buttons: `min-w-11 min-h-11 rounded-full` to maintain 44px touch target

---

### 3.5 WelcomeHero - Experience Buttons Layout

**File:** `src/components/onboarding/WelcomeHero.jsx`
**Lines:** 154-174

**Current Code:**
```jsx
<div className="flex flex-wrap gap-2">
  {EXPERIENCE_OPTIONS.map((option) => {
    return (
      <button className={`min-h-[44px] px-4 py-2 rounded-full border text-sm ...`}>
        {option.label}
      </button>
    );
  })}
</div>
```

**Problem:**
- `gap-2` (0.5rem) between 3 buttons + `px-4` padding creates layout issues at 320px
- Total width needed: ~16rem but only ~20rem available
- Buttons wrap awkwardly creating 2 rows at 320px

**Suggested Fix:**
- Change to: `flex-col sm:flex-row` to stack on mobile
- Add responsive padding: `px-3 sm:px-4` with `min-w-full sm:min-w-fit`
- Or use `gap-1 sm:gap-2` and `px-2.5 sm:px-4`

---

### 3.6 OnboardingProgress - Indicator Readability

**File:** `src/components/onboarding/OnboardingProgress.jsx`

**Problem:**
- Progress component uses small dots/text at 320px
- No explicit check for min-width constraints
- Text labels may get cut off or overlap

**Suggested Fix:**
- Add responsive font size: `text-xs sm:text-sm`
- Hide labels on mobile: show numbers only

---

## 4. General Responsive Pattern Issues

### 4.1 Inconsistent Breakpoint Usage

**Affected Files:**
- `src/components/Card.jsx` (line 34)
- `src/components/ReadingGrid.jsx` (line 145)
- `src/components/ReadingDisplay.jsx` (line 117)

**Problem:**
- `useSmallScreen(640)` vs `useSmallScreen()` (default varies)
- Some use `sm:` (640px) as breakpoint, others use `xs:` (375px)
- `isLandscape` hook only checks `max-height: 500px`

**Suggested Fix:**
- Standardize `useSmallScreen()` to always use 640px threshold
- Document breakpoint strategy in constants file
- Use consistent naming: `isCompact` for < 640px

---

### 4.2 Missing xxs (320px) Responsive Classes

**File:** `tailwind.config.js` (line 16)

**Problem:**
- `xxs: 320px` defined but rarely used throughout codebase
- Content not optimized for 320px screens
- Hard-coded values like `px-4` don't scale down

**Suggested Fix:**
- Add `xxs:` prefixed utilities throughout:
  - Headings: `xxs:text-lg sm:text-xl`
  - Padding: `xxs:px-2 sm:px-4`
  - Font sizes: `xxs:text-xs sm:text-sm`

---

### 4.3 Touch Target Size Inconsistencies

**Files with Issues:**
- `src/styles/tarot.css` line 1328-1332 (close button: 44x44px ✓)
- `src/components/onboarding/SpreadEducation.jsx` line 236 (min-h-48px ✓)
- `src/components/Card.jsx` line 414 (min-h-44px ✓)
- Various small icon buttons missing explicit min-width

**Problem:**
- Some buttons only have `min-height`, missing `min-width`
- Icon buttons sometimes only ~24px wide
- Swipe hit targets not explicitly sized

**Suggested Fix:**
- Apply `min-h-11 min-w-11` (Tailwind's 44px) to all interactive elements systematically

---

### 4.4 Landscape Mode Content Compression

**File:** `src/styles/tarot.css`
**Lines:** 232-265

**Current Code:**
```css
@media (max-height: 500px) and (orientation: landscape) {
  .mobile-action-bar { padding-top: 0.5rem; }
  .header-sticky { padding-top: 0.25rem !important; }
  .app-shell { padding-bottom: 0.75rem; }
  .deck-pile { transform: scale(0.85); }
}
```

**Problem:**
- Only one landscape breakpoint (max-height 500px)
- iPad landscape (500px-700px height) has no optimization
- Deck pile scaled to 0.85 makes interaction difficult
- No viewport height consideration for card rendering

**Suggested Fix:**
- Add intermediate breakpoints:
  - `@media (max-height: 500px)` - phones
  - `@media (min-height: 501px) and (max-height: 700px)` - tablets
  - `@media (min-height: 700px)` - large tablets

---

### 4.5 Hard-Coded Pixel Values

**Locations:**
- `.mystic-heading-wrap::before` width `22px`
- `.tarot-card-back-symbol::before` inset `12%`
- `.spread-panel-footnote` margin `0.6rem`

**Problem:**
- Decorative elements don't respond to container size changes
- When content area shrinks at mobile, decorations stay fixed
- Creates visual imbalance

**Suggested Fix:**
- Use CSS custom properties with media queries
- Replace pixel values with `clamp()` for fluid scaling

---

## 5. Safe Area Handling Gaps

### 5.1 Inconsistent Safe Area Coverage

**Files:**
- `src/styles/tarot.css` (supports `@supports`)
- `src/components/onboarding/OnboardingWizard.jsx` (uses `pt-safe-top`)

**Current Implementation:**
```css
@supports (padding: max(0px)) {
  .app-shell { padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 1.5rem)); }
  .pb-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom, 1rem)); }
}
```

**Problem:**
- Only `.app-shell` and `.pb-safe` classes covered
- Modals with buttons at bottom don't use safe area padding
- Sticky bottom action bars might overlap notches
- Left/right safe areas not consistently applied

**Suggested Fix:**
- Add safe area to all full-screen components using existing utilities (`pt-safe-top`, `pb-safe`, etc.)
- Update drawer footer with proper safe area handling

---

## 6. Specific Breakpoint Issues

### 6.1 Missing 640px-768px Optimization

**Problem:**
- Many layouts jump from `sm` (640px) to `md` (768px) without smooth transition
- Card grid: `sm:gap-8` jumps to huge gap at 640px
- Typography: `sm:text-xl` but no intermediate size
- Padding: `sm:p-6` might be too much at 640px

**Suggested Fix:**
- Add `@media (min-width: 640px) and (max-width: 767px)` rules
- Use more `clamp()` functions for fluid scaling

---

### 6.2 375px (iPhone SE/6) Breakpoint Underutilized

**Problem:**
- `xs: 375px` defined but underutilized (~20% of components)
- Should use: text-xs → text-sm scaling, px-2 → px-3

**Suggested Fix:**
- Add `xs:` to all responsive classes systematically
- Create design pattern document for breakpoint usage

---

## Summary Table

| Issue | Severity | Breakpoint | Impact | File |
|-------|----------|------------|--------|------|
| Celtic Cross carousel cramped | Critical | 320px | Unusable card view | tarot.css |
| Card aspect ratio breaks | Critical | All mobile | Distorted display | tarot.css |
| Onboarding modal safe area | Critical | Notched phones | Content overlap | OnboardingWizard.jsx |
| Spread card content overflow | Critical | 320px | Cards cutoff | SpreadEducation.jsx |
| Narrative container padding | High | Mobile | Text hard to read | MarkdownRenderer.jsx |
| Experience buttons wrap | High | Mobile | Layout broken | WelcomeHero.jsx |
| Inconsistent useSmallScreen | High | 640px/375px | Unpredictable | Multiple |
| Missing xxs classes | High | 320px | Not optimized | All |
| Touch targets < 44px | Medium | All | Hard to tap | Multiple |
| Landscape single breakpoint | Medium | Landscape | Compressed | tarot.css |

---

## Recommended Fix Priority

### Immediate (Breaking Issues)
1. Fix Celtic Cross carousel at 320px
2. Add xxs breakpoint utilities throughout
3. Fix card aspect ratio with `aspect-ratio` property
4. Add safe area to modal and drawer components

### High Priority (UX Degradation)
1. Standardize breakpoint usage across hooks
2. Fix narrative container responsive padding
3. Optimize onboarding wizard layout at 320px
4. Ensure all touch targets 44x44px minimum

### Medium Priority (Polish)
1. Add 640-768px breakpoint rules
2. Optimize landscape mode with more breakpoints
3. Scale decorative elements responsively
4. Reduce hard-coded pixel values

---

## Appendix: Tailwind Breakpoints Reference

```javascript
// tailwind.config.js
screens: {
  'xxs': '320px',   // Ultra-small phones
  'xs': '375px',    // iPhone SE, small phones
  'sm': '640px',    // Large phones, small tablets
  'md': '768px',    // Tablets
  'lg': '1024px',   // Laptops
  'xl': '1280px',   // Desktops
  '2xl': '1536px',  // Large desktops

  // Special breakpoints
  'landscape': { 'raw': '(orientation: landscape) and (max-height: 500px)' },
  'portrait': { 'raw': '(orientation: portrait)' },
  'short': { 'raw': '(max-height: 600px)' },
}
```
