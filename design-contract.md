# Tableu Design Contract
## Responsive Layout & Accessibility Foundations

**Version:** 2.0  
**Last Updated:** 2026-01-30  
**Scope:** Breakpoints, Safe Areas, Typography, Touch Targets, Motion

---

## 1. Breakpoint Architecture

### Screen Width Breakpoints

| Token | Width | Trigger | Layout Density | Type Scale | Primary Use Case |
|-------|-------|---------|----------------|------------|------------------|
| `xxs` | 320px | `min-width` | Ultra-compact | Base 16px | iPhone SE, older Android |
| `xs` | 375px | `min-width` | Compact | Base 16px | iPhone mini/standard |
| `mobile-sm` | ≤360px | `max-width` | Ultra-compact | Base 16px | Hide optional UI elements |
| `mobile-md` | ≤400px | `max-width` | Compact | Base 16px | Reduce spacing/gaps |
| `mobile-lg` | ≤440px | `max-width` | Standard mobile | Base 16px | Standard mobile |
| `sm` | 640px | `min-width` | Tablet start | Base 16px | Grid transitions |
| `md` | 768px | `min-width` | Tablet | Base 16px | Multi-column layouts |
| `lg` | 1024px | `min-width` | Desktop | Base 16px | Full desktop experience |
| `xl` | 1280px | `min-width` | Wide desktop | Base 16px | Extended sidebars |
| `2xl` | 1536px | `min-width` | Ultra-wide | Base 16px | Maximum content width |

### Viewport Height & Orientation Breakpoints

| Token | Query | Behavior |
|-------|-------|----------|
| `landscape` | `(orientation: landscape) and (max-height: 500px)` | Compact controls, hide labels, reduce padding |
| `portrait` | `(orientation: portrait)` | Standard mobile layout |
| `short` | `(max-height: 600px)` | Reduced chrome, smaller deck pile |

### Breakpoint Usage Rules

1. **Mobile-first:** Default styles target mobile; use `sm:`, `md:`, etc. for larger screens
2. **Max-width variants** (`mobile-sm`, `mobile-md`, `mobile-lg`): Use sparingly for progressive enhancement **downward**
3. **Orientation queries:** Always pair with viewport checks to avoid desktop landscape false positives
4. **Height queries:** Use `short` for foldables and tablets in landscape

---

## 2. Touch Target Standards

### Token Definitions (CSS Custom Properties)

```css
:root {
  --touch-target: 44px;      /* WCAG 2.2 SC 2.5.8 minimum */
  --touch-target-cta: 52px;  /* Primary actions, call-to-action buttons */
}
```

### Tailwind Utilities

| Utility | Value | Use Case |
|---------|-------|----------|
| `min-h-touch` | `var(--touch-target, 44px)` | All interactive elements |
| `min-w-touch` | `var(--touch-target, 44px)` | Icon-only buttons, toggles |
| `min-h-cta` | `var(--touch-target-cta, 52px)` | Primary CTAs, submit buttons |

### Compliance Rules

1. **All interactive elements** must have minimum 44×44px touch target
2. **Icon-only buttons** must use both `min-h-touch` and `min-w-touch`
3. **Primary actions** should use `min-h-cta` (52px) for prominence
4. **Inline links** in prose are exempt (text provides sufficient target)
5. **Adjacent targets** must have ≥8px spacing or overlap protection

---

## 3. Safe Area Implementation

### CSS Custom Properties

```css
:root {
  --safe-pad-top: env(safe-area-inset-top, 0px);
  --safe-pad-bottom: env(safe-area-inset-bottom, 0px);
  --safe-pad-left: env(safe-area-inset-left, 0px);
  --safe-pad-right: env(safe-area-inset-right, 0px);
  --safe-pad-x: max(var(--safe-pad-left), var(--safe-pad-right));
}
```

### Tailwind Utilities

| Utility | Computed Value | Use Case |
|---------|----------------|----------|
| `pt-safe` / `p-safe-top` | `max(0.75rem, var(--safe-pad-top))` | Fixed headers |
| `pb-safe` / `p-safe-bottom` | `max(1rem, var(--safe-pad-bottom))` | Fixed footers |
| `pl-safe` / `p-safe-left` | `max(1rem, var(--safe-pad-left))` | Side navigation |
| `pr-safe` / `p-safe-right` | `max(1rem, var(--safe-pad-right))` | Side navigation |
| `px-safe` | Both left & right | Horizontal safe padding |
| `py-safe` | Both top & bottom | Vertical safe padding |

### Component-Specific Tokens

| Token | Purpose |
|-------|---------|
| `--mobile-action-bar-height` | Dynamic height of floating action bar |
| `--mobile-action-bar-offset` | Offset for content above action bar |
| `--keyboard-offset` | Virtual keyboard avoidance offset |

### Implementation Rules

1. **Fixed bottom elements** must use `pb-safe` or `pb-safe-action`
2. **Modals/drawers** must account for all four insets
3. **Full-screen overlays** must use `px-safe pt-safe pb-safe-bottom`
4. **Action bar** must set `--mobile-action-bar-height` via ResizeObserver
5. **Keyboard avoidance** uses `useKeyboardOffset()` hook with `visualViewport` API

---

## 4. Typography System

### Base Scale

| Context | Mobile (≤639px) | Desktop (≥640px) |
|---------|-----------------|------------------|
| Body base | 16px (`1rem`) | 16px (`1rem`) |
| Prose containers | 15px (`--text-sm-mobile`) | 16px (`1rem`) |
| Form inputs | 16px (prevents iOS zoom) | 16px |
| Small text | 14px (`text-xs-plus`) | 14px |

### Extended Font Sizes

| Token | Value | Line Height | Use Case |
|-------|-------|-------------|----------|
| `text-xs-plus` | 0.875rem (14px) | 1.4 | Improved mobile readability over `text-xs` |
| `text-sm-mobile` | `var(--text-sm-mobile)` (15px) | 1.5 | Mobile body text in prose |

### Prose Container Scoping

```css
/* ONLY these containers get mobile typography adjustments */
.narrative-stream__text p,
.narrative-stream__text li,
.journal-prose p,
.journal-prose li,
.prose p,
.prose li,
.reading-content p,
.reading-content li {
  font-size: var(--text-sm-mobile); /* 15px */
  line-height: 1.6;
}
```

### Typography Rules

1. **Never** set form inputs below 16px (causes iOS zoom on focus)
2. **Chips/badges/menus** are exempt from prose scaling
3. **Responsive headings** should use `clamp()` or breakpoint variants
4. **Journal prose** uses fluid scaling: `clamp(0.95rem, 0.92rem + 0.25vw, 1.05rem)`

---

## 5. Motion System

### Duration Scale

| Token | Value | Use Case |
|-------|-------|----------|
| `--duration-fast` | 160ms | Hover states, focus indicators |
| `--duration-normal` | 200ms | Standard transitions |
| `--duration-medium` | 260ms | Card transforms, reveals |
| `--duration-slow` | 400ms | Complex animations |
| `--duration-slower` | 600ms | Card dealing, major reveals |

### Easing Functions

| Token | Value | Use Case |
|-------|-------|----------|
| `--ease-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Most transitions (Material standard) |
| `--ease-in-out` | `ease-in-out` | Symmetric transitions |

### Animation Classes

| Class | Duration | Easing | Use Case |
|-------|----------|--------|----------|
| `animate-fade-in` | `--duration-normal` | `--ease-out` | Element appearance |
| `animate-slide-up` | `--duration-medium` | `--ease-out` | Bottom sheets, drawers |
| `animate-slide-down` | `--duration-normal` | `--ease-out` | Dropdown menus |
| `animate-pop-in` | `--duration-normal` | `--ease-out` | Modals, popovers |
| `animate-slide-in-right` | `--duration-medium` | `--ease-out` | Side panels |
| `animate-fade-in-up` | `--duration-slower` | `--ease-out` | Onboarding steps |
| `animate-ink-spread` | `--duration-slow` | `--ease-out` | Narrative text reveal |
| `animate-float-gentle` | 6s | `ease-in-out` | Decorative illustrations |
| `animate-pulse-slow` | 4s | `ease-in-out` | Status indicators |

### Reduced Motion Handling

**CSS approach:**
```css
@media (prefers-reduced-motion: reduce) {
  .mobile-action-bar {
    transition: opacity 0.1s ease-out !important;
  }
  .mobile-drawer,
  .mobile-drawer-overlay {
    animation: none !important;
    transition: none !important;
  }
}
```

**React approach:**
```jsx
import { useReducedMotion } from '../hooks/useReducedMotion';

const prefersReducedMotion = useReducedMotion();
// Conditionally apply animation classes
className={prefersReducedMotion ? '' : 'animate-fade-in'}
```

**Tailwind `motion-safe:` variant:**
```jsx
className="motion-safe:animate-fade-in"
className="motion-safe:animate-spin"
```

### Motion Rules

1. **Every significant animation** must be gated by `useReducedMotion()` or `motion-safe:`
2. **Duration consistency:** Use CSS custom properties, not hardcoded values
3. **CSS fallbacks:** Use `@media (prefers-reduced-motion: reduce)` for non-React styles
4. **Loading spinners** should use `motion-safe:animate-spin`
5. **Decorative animations** (float, pulse) must have reduced-motion fallbacks

---

## 6. Inconsistency Findings

| ID | Component | Issue | Current | Proposed Fix | Effort |
|----|-----------|-------|---------|--------------|--------|
| R-1 | `QuickIntentionCard.jsx:76` | Hardcoded touch target below 44px | `min-h-[40px] min-w-[40px]` | `min-h-touch min-w-touch` | Low |
| R-2 | `JournalFilters.jsx:951,966` | Hardcoded touch target below 44px | `min-h-[40px]` | `min-h-touch` | Low |
| R-3 | `CardModal.jsx:98` | Hardcoded touch target below 44px | `min-h-[40px]` | `min-h-touch` | Low |
| R-4 | `AuthModal.jsx:337,389` | Hardcoded touch target at exactly 40px | `min-w-[40px] min-h-[40px]` | `min-w-touch min-h-touch` | Low |
| R-5 | `WelcomeHero.jsx:208` | CTA button at 46px instead of 52px | `min-h-[46px]` | `min-h-cta` | Low |
| R-6 | `ReadingGrid.jsx:536,550` | Inconsistent width token | `min-w-[48px]` | `min-w-touch` (consolidate) | Low |
| R-7 | `CarouselDots.jsx:181,193` | Inconsistent width token | `min-w-[48px]` | `min-w-touch` (consolidate) | Low |
| R-8 | `CardSymbolInsights.jsx:462-469` | Desktop tooltip close missing touch target | `rounded-full` (no size) | Add `min-h-touch min-w-touch p-2` | Medium |
| R-9 | `ExperienceSettings.jsx:51` | Using `56px` instead of `cta` token | `min-h-[56px]` | Keep (56px > 52px, compliant) | None |
| R-10 | Multiple components | Inconsistent duration hardcoding | `duration-200`, `duration-300` | Prefer `duration-[var(--duration-*)]` | Medium |
| R-11 | `MobileSettingsDrawer.jsx` | Body scroll lock via inline style | `document.body.style.overflow = 'hidden'` | Use `useModalA11y` consistently | Low |
| R-12 | Various animations | Missing `motion-safe:` prefix | Direct `animate-*` class | Add `motion-safe:` or `useReducedMotion()` gate | Medium |

---

## 7. Standardization Recommendations

### A. Consolidate Height Tokens

**Current state:** Mix of `min-h-[40px]`, `min-h-[44px]`, `min-h-[46px]`, `min-h-[48px]`, `min-h-[52px]`, `min-h-[56px]`, `min-h-touch`, `min-h-cta`

**Proposed token set:**

| Token | Value | Use Case |
|-------|-------|----------|
| `min-h-touch` | 44px | All interactive elements (minimum) |
| `min-h-cta` | 52px | Primary call-to-action buttons |
| `min-h-[56px]` | 56px | Keep for nav bars, settings tiles (larger touch targets are fine) |

**Rule:** Never use `min-h-[40px]` or `min-h-[46px]` — use `min-h-touch` or `min-h-cta`.

### B. Standardize Duration Tokens

**Replace inline Tailwind durations with CSS variables:**

| Current | Replace With |
|---------|--------------|
| `duration-150` | `duration-[var(--duration-fast)]` |
| `duration-200` | `duration-[var(--duration-normal)]` |
| `duration-300` | `duration-[var(--duration-medium)]` |
| `duration-500` | `duration-[var(--duration-slow)]` |

**Note:** This is a medium-effort change due to prevalence. Consider a codemod.

### C. Motion Safety Patterns

**Pattern 1: CSS-only (no JS needed)**
```jsx
// Use when element either shows or doesn't (no conditional logic)
className="motion-safe:animate-fade-in"
```

**Pattern 2: React hook (conditional rendering)**
```jsx
const prefersReducedMotion = useReducedMotion();
className={prefersReducedMotion ? '' : 'animate-fade-in'}
```

**Pattern 3: Scroll behavior**
```jsx
el.scrollTo({
  left: scrollTarget,
  behavior: prefersReducedMotion ? 'auto' : 'smooth'
});
```

### D. Safe Area Composition Pattern

For fixed positioned elements that need multiple safe area considerations:

```css
.pb-safe-action {
  padding-bottom: calc(
    max(1rem, var(--safe-pad-bottom, 0px)) +
    var(--mobile-action-bar-height, 0px) +
    var(--keyboard-offset, 0px)
  );
}
```

---

## 8. Regression Checklist

Use this checklist when making UI changes:

### Touch Targets
- [ ] All buttons have `min-h-touch` (44px minimum)
- [ ] Icon-only buttons have both `min-h-touch` and `min-w-touch`
- [ ] Primary CTAs use `min-h-cta` (52px)
- [ ] Adjacent interactive elements have ≥8px spacing

### Safe Areas
- [ ] Fixed bottom elements use `pb-safe` or `pb-safe-action`
- [ ] Modals/drawers use `px-safe pt-safe pb-safe-bottom`
- [ ] Action bars set `--mobile-action-bar-height` dynamically
- [ ] Landscape mode accounts for side safe areas

### Typography
- [ ] Form inputs are ≥16px (no iOS zoom)
- [ ] Prose containers use scoped selectors (not global)
- [ ] Chips/badges/menus are not affected by prose scaling

### Motion
- [ ] Significant animations use `useReducedMotion()` or `motion-safe:`
- [ ] Duration uses CSS variables (`--duration-*`), not hardcoded
- [ ] Loading spinners use `motion-safe:animate-spin`
- [ ] `@media (prefers-reduced-motion: reduce)` covers CSS-only animations

### Responsive Layout
- [ ] Mobile-first approach (base styles are mobile)
- [ ] Tested at 320px (xxs), 375px (xs), 640px (sm), 768px (md)
- [ ] Landscape mode (≤500px height) doesn't break layout
- [ ] Content doesn't overflow or require horizontal scroll

### Accessibility
- [ ] Focus states visible (`focus-visible:ring-*`)
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 graphics)
- [ ] Interactive elements have appropriate roles

---

## 9. Component Reference

### Compliant Components (Use as Reference)

| Component | Patterns Demonstrated |
|-----------|----------------------|
| `MobileActionBar.jsx` | Keyboard offset, safe areas, landscape adaptation, touch targets |
| `MobileSettingsDrawer.jsx` | Drawer safe areas, scroll lock, drag-to-dismiss, reduced motion |
| `ExperienceSettings.jsx` | Touch target tiles, info button sizing, responsive grid |
| `CardSymbolInsights.jsx` | Mobile bottom sheet, focus trap, touch targets |
| `ReadingGrid.jsx` | Landscape adaptation, carousel, reduced motion scroll |

### CSS Class Reference

| Class | Location | Purpose |
|-------|----------|---------|
| `.mobile-action-bar` | `tarot.css:592` | Fixed bottom action bar |
| `.mobile-drawer` | `tarot.css:2000+` | Bottom sheet container |
| `.mobile-drawer__footer` | `tarot.css:613` | Drawer footer with safe area |
| `.pb-safe-action` | `tarot.css:370` | Composite bottom padding |
| `.panel-mystic` | `tarot.css:848` | Shared panel styling |
| `.cc-grid` | `tarot.css:791` | Celtic Cross grid layout |

---

## 10. Implementation Priority

### Immediate (P0) - WCAG Compliance
1. Fix touch targets below 44px (R-1 through R-4, R-8)
2. Add missing `motion-safe:` prefixes to critical paths

### Short-term (P1) - Consistency
3. Consolidate `min-w-[48px]` → `min-w-touch` (R-6, R-7)
4. Update CTAs from 46px → 52px (R-5)
5. Audit and fix any remaining hardcoded 40px targets

### Medium-term (P2) - Maintainability
6. Create codemod for `duration-*` → `duration-[var(--duration-*)]`
7. Document token usage in component library
8. Add ESLint rule to flag hardcoded touch target values

---

## Appendix: Z-Index Scale

| Token | Value | Use Case |
|-------|-------|----------|
| `--z-base` | 0 | Default layer |
| `--z-content` | 1 | Content above pseudo-elements |
| `--z-dropdown` | 10 | Dropdowns, tooltips |
| `--z-sticky` | 20 | Sticky headers |
| `--z-fixed` | 50 | Fixed positioning |
| `--z-modal-backdrop` | 60 | Modal/drawer backdrops |
| `--z-modal` | 70 | Modals and drawers |
| `--z-skip-link` | 80 | Skip links (highest) |

---

## Appendix: Color Contrast Reference (from theme.css)

| Token | Value | Contrast Ratio | Compliance |
|-------|-------|----------------|------------|
| `--text-muted` | #CCC5B9 | 5.2:1 on #0F0E13 | AA ✓ |
| `--text-muted-high` | #DDD7CD | 6.5:1 on #0F0E13 | AA ✓ |
| `--brand-secondary` | #A89D92 | 4.5:1 on #0F0E13 | AA ✓ |
| Light mode `--text-muted` | #555555 | 7:1 on #FAFAFA | AAA ✓ |
| Light mode `--brand-primary` | #7D623B | 5.46:1 on #FAFAFA | AA ✓ |
