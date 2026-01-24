# Tableu Responsive + A11y Design Contract

Scope: Breakpoints (Tailwind + custom raw queries), mobile typography, safe-area padding, reduced-motion behavior, and component expectations (touch targets, text sizing, motion toggles).

## Breakpoint Guarantees

### Tailwind Screens
- **xxs (>= 320px)**
  - Layout: single-column only.
  - Type: body base 16px; content paragraphs 15px.
  - Touch: interactive targets >= 44px (tap-safe minimum).
  - Density: compact padding; avoid multi-column grids.

- **xs (>= 375px)**
  - Layout: single-column with limited two-column subgrids if space allows.
  - Type: same mobile base (16px body; 15px paragraph for long-form).
  - Touch: >= 44px; CTAs may use 48–52px height.

- **sm (>= 640px)**
  - Layout: tablet start; multi-column grids allowed.
  - Type: standard text sizes; larger headings and card titles ok.
  - Density: increase padding and spacing; avoid mobile-only clamps.

- **md (>= 768px)**
  - Layout: tablet/desktop; full grid layouts and sidebars ok.
  - Type: comfortable line lengths; standard card sizes.

- **lg (>= 1024px)**
  - Layout: desktop; wide grids and multi-panel layouts ok.
  - Type: full scale; no mobile-only reductions.

### Custom Raw Queries (Tailwind `extend.screens`)
- **landscape (orientation: landscape AND max-height: 500px)**
  - Layout: compact header/action bar; reduced vertical padding.
  - Cards: smaller card shells; reduced min-heights.
  - Motion: avoid large transforms or tall animations.

- **short (max-height: 600px)**
  - Layout: height-limited; reduce vertical padding in panels.
  - Cards: cap tall cards and panels to avoid viewport overflow.

## Typography Contract (Mobile)
- **Base body**: 16px (`body` font-size on <= 639px).
- **Long-form content**: 15px (`.narrative-stream__text p`, `.journal-prose p`, `.reading-content p`).
- **Minimum body text**: 14px (avoid lower except for non-essential metadata).
- **Line-height**: 1.5–1.75 for paragraphs; keep consistent across content blocks.

## Safe-Area Handling Contract
- All fixed/sticky headers, footers, sheets, and modals must include safe-area insets.
- Use consistent safe-area tokens for top/bottom/left/right.
- Avoid mixing inline `max()`/`calc()` rules with Tailwind safe-area utilities in the same layout.

## Motion Contract
- Prefer motion-safe utilities for decorative animation.
- Reduced motion must disable:
  - animation loops
  - non-essential transforms
  - smooth scrolling
  - auto-animated transitions
- JS animations should also respect reduced motion (single source of truth).

## Component Expectations
- **Touch targets**: >= 44px minimum width/height everywhere.
- **CTAs**: 48–52px preferred min-height.
- **Text sizing**: use standardized tokens (e.g., `text-xs-plus`, `text-sm-mobile`, `text-base`), avoid ad-hoc `text-[..]` unless unavoidable.
- **Motion toggles**: always gate with `prefers-reduced-motion` or `motion-safe` utilities.

## Inconsistencies to Address
1. Breakpoint drift: Tailwind screens vs tarot.css max-width rules (330/360/400/440/479/520).
2. Mixed min-width and max-width patterns across the system.
3. `short` screen defined but unused; parallel height rules exist in tarot.css.
4. Safe-area padding handled inconsistently (utilities vs inline styles).
5. `.safe-area-padding` and `.pb-safe` are partial or static and overlap with Tailwind safe utilities.
6. `.touch-target` exists but is unused; some buttons are < 44px tall.
7. Typography tokens (`sm-mobile`) exist but are unused; ad-hoc sizes appear in components.
8. Reduced-motion hook strategy is inconsistent (custom hook vs framer-motion hook).

## Minimal Tokens / Utilities to Standardize
- **Spacing / Safe Area**
  - CSS vars: `--safe-pad-top`, `--safe-pad-bottom`, `--safe-pad-x`
  - Tailwind utilities: `pt-safe`, `pb-safe`, `px-safe`

- **Touch Targets**
  - CSS vars: `--touch-target: 44px`, `--touch-target-cta: 52px`
  - Utilities: `min-h-touch`, `min-w-touch`, `min-h-cta`

- **Motion**
  - Use existing `--duration-*` and `--ease-out` tokens
  - Map Tailwind `duration-*` to these vars for consistency
  - Single motion source: prefer `MotionConfig reducedMotion="user"` at app root

## Regression Checklist
- Verify layouts at 320 / 375 / 640 / 768 / 1024 widths.
- Verify landscape compact behavior at max-height 500.
- Verify short viewport handling at max-height 600.
- Validate safe-area padding on iOS notches for headers, footers, modals.
- Confirm base type sizes on mobile (16px body, 15px long-form).
- Ensure all interactive elements >= 44px.
- Verify prefers-reduced-motion disables animations and smooth scroll.
- Check motion toggles for JS-driven animations.
