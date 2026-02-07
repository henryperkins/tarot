# Tableu Design Contract

Responsive, accessibility, and motion foundations.
Audit date: 2026-02-05 | Covers `src/`, `src/styles/`, `tailwind.config.js`

---

## 1. Breakpoint Architecture

### Defined Breakpoints

| Token | Width | Direction | Tailwind Usage | Purpose |
|-------|-------|-----------|----------------|---------|
| `xxs` | 320px | min-width | ~18 occ / 10 files | Ultra-compact (iPhone SE 1st gen) |
| `xs` | 375px | min-width | ~38 occ / 15 files | Small phone (iPhone SE 2nd/3rd gen) |
| `mobile-sm` | 360px | **max-width** | CSS only (`tarot.css`) | iPhone SE, older devices |
| `mobile-md` | 400px | **max-width** | CSS only (`tarot.css`) | iPhone 15/16 standard |
| `mobile-lg` | 440px | **max-width** | CSS only (`tarot.css`) | iPhone Plus/Pro Max |
| `sm` | 640px | min-width | **439 occ / 74 files** | Primary mobile/tablet break |
| `md` | 768px | min-width | 36 occ / 18 files | Tablet |
| `lg` | 1024px | min-width | 46 occ / 23 files | Desktop |
| `xl` | 1280px | min-width | 7 occ / 5 files | Wide desktop |
| `landscape` | orientation + max-h 500px | raw query | Hook-based (`useLandscape`) | Cramped landscape phones |
| `short` | max-height 600px | raw query | Minimal | Foldables, small tablets |

### Breakpoint Strategy

```
          xxs    xs     mobile-*   sm        md      lg      xl
          320    375    360-440    640       768     1024    1280
  --------+------+------+---------+---------+-------+-------+--------
  Mobile compact  |  Mobile standard  |  Tablet  | Desktop  | Wide
                  |                   |          |          |
  Touch-first     |  Primary design   |  Hybrid  | Pointer  |
  Dense layout    |  target           |          | layout   |
```

**Rules:**
- `sm:` (640px) is the primary mobile-to-tablet transition. All components must have `sm:` variants for layout shifts.
- `xxs:` and `xs:` are for fine-grained mobile density (padding, gap, icon sizes). Not required for every component.
- `mobile-sm/md/lg` (max-width) are CSS-only, used in `tarot.css` for progressive enhancement of spread cards and drawers. Do not mix with Tailwind min-width utilities in the same declaration.
- `landscape` and `short` are consumed via `useLandscape()` and `useHandsetLayout()` hooks in JS, not directly in className strings.

### JS-Based Breakpoint Hooks

| Hook | Source | Breakpoint | Used By |
|------|--------|------------|---------|
| `useLandscape()` | `src/hooks/useLandscape.js` | matchMedia orientation + max-height 500px | MobileActionBar, ReadingGrid, Card |
| `useSmallScreen(bp)` | `src/hooks/useSmallScreen.js` | matchMedia max-width (caller sets bp) | Journal, CardsDrawnSection |
| `useHandsetLayout()` | `src/hooks/useHandsetLayout.js` | matchMedia max-width 639px | GuidedIntentionCoach |
| `useReducedMotion()` | `src/hooks/useReducedMotion.js` | matchMedia prefers-reduced-motion | 15+ components |

**Note:** `useSmallScreen` accepts arbitrary pixel values (375, 480, 640, 768). Default to 640px when the distinction is "mobile vs not."

---

## 2. Design Contract Table

| Breakpoint | Width | Layout Density | Type Scale | Touch Targets | Special Handling |
|------------|-------|----------------|------------|---------------|------------------|
| xxs | 320px | Tight: `gap-1.5`, `px-3`, `py-2` | body 16px, secondary 14px (`text-xs-plus`), micro 12px (`text-xs`), badge 11px (`text-2xs`) | 44px (`min-h-touch`) / 52px (`min-h-cta`) | Wrap flex items aggressively; hide tertiary labels |
| xs | 375px | Compact: `gap-2`, `px-3`, `py-2` | Same as xxs; allow `text-sm` for UI chrome | 44px / 52px | iPhone SE baseline; test all layouts here |
| sm | 640px | Standard: `gap-3`, `px-4`, `py-3` | body 16px (`text-base`), prose 16px, secondary 14px | 44px / 52px | Primary responsive break; grid layouts expand |
| md | 768px | Comfortable: `gap-4`, `px-6`, `py-4` | body 16px, prose 16-18px | 44px / 52px | Desktop transition; sidebars may appear |
| lg | 1024px | Spacious | prose 16-18px | 44px / 52px | Multi-column layouts; max-width containers |
| landscape | max-h 500px | Compact vertical: reduce padding, hide step labels | body 16px; no size reduction | 44px (never reduce) | `useLandscape()` gates layout; smaller icons (`w-3.5 h-3.5`) |
| short | max-h 600px | Reduced chrome | Same as landscape | 44px | Foldables; hide non-essential UI chrome |

---

## 3. Touch Target Compliance (WCAG 2.5.8)

### Tokens

| Token | CSS Variable | Value | Use For |
|-------|-------------|-------|---------|
| `min-h-touch` / `min-w-touch` | `--touch-target` | 44px | All interactive elements |
| `min-h-cta` | `--touch-target-cta` | 52px | Primary action buttons |

**Coverage:** 258+ usages across 71+ files.

### Reference Patterns

```jsx
// Icon-only button
<button className="min-w-touch min-h-touch flex items-center justify-center">
  <Icon size="md-touch" />
</button>

// CTA button
<button className="min-h-cta px-4 py-2 ...">Begin Reading</button>

// Navigation button (exceeds minimum)
<button className="min-h-[56px] ...">Tab</button>
```

### Non-Compliant Elements

| ID | Component | Element | Current | Fix |
|----|-----------|---------|---------|-----|
| T-1 | `Journal.jsx` | Pagination/filter pill buttons (3x) | `min-h-[32px]` | `min-h-touch` |
| T-2 | `MoonPhaseIndicator.jsx` | Phase indicator | `min-h-[36px] min-w-[36px]` | `min-h-touch min-w-touch` |
| T-3 | `ReadingDisplay.jsx` | Connection retry button | `min-h-[32px]` | `min-h-touch` |

---

## 4. Safe Area Implementation

### Configuration

- `viewport-fit=cover` in `index.html:7`
- CSS variables in `tarot.css:198-203`:
  ```css
  --safe-pad-top: env(safe-area-inset-top, 0px);
  --safe-pad-bottom: env(safe-area-inset-bottom, 0px);
  --safe-pad-left: env(safe-area-inset-left, 0px);
  --safe-pad-right: env(safe-area-inset-right, 0px);
  ```
- Tailwind utilities: `pt-safe`, `pb-safe`, `px-safe`, `py-safe` (plugin in `tailwind.config.js:149-166`)
- Composite utility: `.pb-safe-action` combines safe area + action bar height + keyboard offset (`tarot.css:378-384`)

### Bottom Offset Formula

```css
padding-bottom: calc(
  max(1rem, var(--safe-pad-bottom, 0px)) +
  var(--mobile-action-bar-height, 0px) +
  var(--keyboard-offset, 0px)
);
```

All fixed bottom bars must use this formula (via `.pb-safe-action` or equivalent inline calc).

### Coverage

| Component | Position | Status |
|-----------|----------|--------|
| `MobileActionBar` | fixed bottom | Correct |
| `MobileBottomNav` | fixed bottom | Correct |
| `Header (sticky)` | sticky top | Correct |
| `UserMenu FAB` | fixed top-right | Correct |
| `AuthModal`, `CardModal`, `OnboardingWizard` | fixed overlay | Correct |
| `JournalFloatingControls` | fixed | Correct |
| Native `ScreenContainer` | SafeAreaView | Correct |

### Missing Safe Area

| ID | Component | Issue | Fix |
|----|-----------|-------|-----|
| S-1 | `PricingPage.jsx:1022` | Fixed bottom CTA bar, no `pb-safe` | Add `pb-[max(0.75rem,var(--safe-pad-bottom))]` |
| S-2 | `StoryIllustration.jsx:511` | Upgrade modal uses `p-4` only | Add safe area to padding |
| S-3 | `UpgradeNudge.jsx:125` | Fixed overlay, no safe area | Add `px-safe pt-safe` |

---

## 5. Typography Scaling

### Type Scale

| Token | Size | Line Height | Use Case |
|-------|------|-------------|----------|
| `text-2xs` | 0.6875rem (11px) | 1.4 | Non-essential metadata only. Apple HIG minimum. Never for interactive elements. |
| `text-xs` | 0.75rem (12px) | 1.4 | Captions, badges, tertiary labels |
| `text-xs-plus` | 0.875rem (14px) | 1.4 | Improved mobile readability for secondary text |
| `text-sm` | 0.875rem (14px) | 1.5 | Default small text |
| `text-sm-mobile` | 1rem (16px) | 1.5 | Mobile body text (comfortable reading) |
| `text-base` | 1rem (16px) | 1.5 | Default body |

### Mobile Rules (`tarot.css:326-369`)

- Base body: `1rem` (16px) -- prevents iOS zoom
- Prose containers: Scoped to `p`, `li`, `dd` within `.narrative-stream__text`, `.journal-prose`, `.prose`, `.reading-content`. Does **not** resize chips, badges, or menus.
- Form inputs: Forced to `1rem` on mobile, including when Tailwind `text-*` classes are applied. Prevents iOS zoom on focus.
- Journal prose: `clamp(0.95rem, 0.92rem + 0.25vw, 1.05rem)` for fluid scaling.

### Font Families

| Family | Token | Use Case |
|--------|-------|----------|
| Cormorant Garamond | `font-serif` | Headings, card names, ritual text |
| Inter | `font-sans` | Body text, UI controls, labels |

### Sub-12px Text (Intentional Decorative)

| Selector | Size | Acceptable? |
|----------|------|-------------|
| `.mobile-drawer__eyebrow` | 0.7rem (11.2px) | Yes -- uppercase, wide tracking |
| `.prepare-card__badge` | 0.7rem | Yes -- decorative badge |
| `.coach-note__label` | 10px | **No** -- below 11px minimum; fix to 0.6875rem |

---

## 6. Motion System

### Duration Tokens (`tarot.css:164-168`)

| Token | Value | Use For |
|-------|-------|---------|
| `--duration-fast` | 160ms | Hover, focus, micro-interactions |
| `--duration-normal` | 200ms | Standard transitions |
| `--duration-medium` | 260ms | Card transforms, reveals |
| `--duration-slow` | 400ms | Complex animations |
| `--duration-slower` | 600ms | Card dealing, major reveals |

### Easing

| Token | Value |
|-------|-------|
| `--ease-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-in-out` | `ease-in-out` |

### Reduced Motion

**CSS:** Global override kills all animations (`tarot.css:2839-2892`):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Plus 10 component-specific `prefers-reduced-motion` blocks.

**JS:** `useReducedMotion()` hook in 15+ components. Framer-motion uses `duration: reduceMotion ? 0 : N`.

---

## 7. Inconsistency Findings

| ID | Component | Issue | Current | Proposed Fix | Effort |
|----|-----------|-------|---------|--------------|--------|
| R-1 | `Journal.jsx` | Touch targets below 44px on filter/pagination buttons | `min-h-[32px]` (3x) | `min-h-touch` | Low |
| R-2 | `MoonPhaseIndicator.jsx` | Touch target below 44px | `min-h-[36px] min-w-[36px]` | `min-h-touch min-w-touch` | Low |
| R-3 | `ReadingDisplay.jsx` | Connection retry button undersized | `min-h-[32px]` | `min-h-touch` | Low |
| R-4 | `PricingPage.jsx:1022` | Fixed bottom CTA missing safe-area-inset-bottom | `py-3` only | Add `pb-[max(0.75rem,var(--safe-pad-bottom))]` | Low |
| R-5 | `StoryIllustration.jsx:511` | Upgrade modal overlay missing safe area | `p-4` | Safe area padding | Low |
| R-6 | `UpgradeNudge.jsx:125` | Fixed overlay missing safe area | None | Add `px-safe pt-safe` | Low |
| R-7 | `tarot.css:4034` | `.coach-note__label` at 10px, below 11px HIG minimum | `font-size: 10px` | `font-size: 0.6875rem` | Low |
| R-8 | `FollowUpChat.jsx` | `scrollIntoView({ behavior: 'smooth' })` not gated by reduced motion | Always smooth | Check `useReducedMotion()`; use `'auto'` | Low |
| R-9 | Multiple | Hardcoded `min-h-[56px]` instead of token | 5+ instances | Add `--touch-target-nav: 56px` token or use `min-h-cta` | Low |
| R-10 | `useSmallScreen` callers | Inconsistent mobile breakpoint values (375, 480, 640, 768) | Per-component | Document default 640px; use named constant | Low |
| R-11 | `tarot.css:2745` | `.reduced-effects` class defined but never wired to a preference | Unused CSS | Remove or wire to user setting | Low |
| R-12 | Safe area utilities | Mix of inline `max()` patterns and Tailwind `pb-safe` utilities | Two patterns | Add `pl-safe`, `pr-safe` utilities; standardize | Low |
| R-13 | `ReadingBoard.jsx` | Card index badge at 9.6px, well below 11px minimum | `text-[0.6rem]` | `text-2xs` (11px) | Low |
| R-14 | `RitualControls.jsx` | Multiple labels at 10.4-11.2px using ad-hoc sizes | `text-[0.65rem]`, `text-[0.68rem]`, `text-[0.7rem]` | `text-2xs` or `text-xs` | Low |
| R-15 | `ExperienceSettings.jsx` | Select dropdown uses `text-[0.65rem]`; may bypass iOS 16px zoom prevention | `text-[0.65rem]` on `<select>` | Use `text-xs` or ensure 16px on mobile | Medium |

---

## 8. Standardization Token Set

### Proposed Consolidations

**Nav height token** (replaces 5+ hardcoded `min-h-[56px]`):
```css
:root { --touch-target-nav: 56px; }
```
```js
// tailwind.config.js minHeight
nav: 'var(--touch-target-nav, 56px)',
```

**Safe area directional utilities** (add to tailwind.config.js plugin):
```js
'.pl-safe': { 'padding-left': SAFE_INSET_LEFT },
'.pr-safe': { 'padding-right': SAFE_INSET_RIGHT },
```

**Mobile density convention** (document, not new tokens):
```
< 375px: gap-1.5, px-3, py-2
375-639px: gap-2, px-4, py-2.5
640px+: gap-3, px-6, py-3
```

**No new motion tokens needed.** The five-step duration scale covers all cases.

---

## 9. Regression Checklist

For future UI changes, verify:

1. Touch targets >= 44px on all `<button>`, `<a>`, `[role="button"]`, `onClick` elements. Use `min-h-touch min-w-touch` or `min-h-cta`.
2. Safe area insets on all `fixed` and `sticky` elements. Bottom bars: `pb-safe` or `pb-safe-action`. Top headers: `pt-[max(var(--safe-pad-top),0.75rem)]`.
3. Form inputs >= 16px font size on mobile. Global CSS handles this (`tarot.css:350-362`); verify no component overrides.
4. `prefers-reduced-motion` respected for new animations. CSS animations handled globally; JS animations must check `useReducedMotion()`.
5. `text-2xs` (11px) is the minimum visible text size. Never go smaller.
6. `sm:` breakpoint variant exists for any layout change between mobile and tablet.
7. Color contrast maintained: `--text-muted` 5.2:1, `--text-muted-high` 6.5:1, `--brand-secondary` 4.5:1. Run `npm run test:contrast`.
8. Focus visibility on all interactive elements: `focus-visible:ring-2 focus-visible:ring-primary/60`.
9. `touch-manipulation` on tappable elements (prevents 300ms delay).
10. Landscape handling for reading-flow components via `useLandscape()`.
11. Body scroll lock when modals/drawers open. Verify no scroll-through on iOS Safari.
12. `viewport-fit=cover` remains in `index.html`. Required for `env(safe-area-inset-*)`.

---

## 10. Apple HIG Alignment

- **Color:** Dark/light modes via `theme.css`. `prefers-contrast: more` increases borders and text contrast (`theme.css:176-196`). `prefers-reduced-transparency: reduce` replaces translucent surfaces with opaque (`tarot.css:255-261`).
- **Typography:** Minimum 11px (`text-2xs`), matching Apple's 11pt iOS minimum. Default body 16px (Apple recommends 17pt; 1px difference acceptable for web vs native pt).
- **Web App:** `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`, and four `apple-touch-icon` sizes properly configured in `index.html`.
