---
applyTo: "src/components/**/*.jsx"
---

# React Component Guidelines

## Component Structure
- Use functional React components with hooks only
- Keep components presentational—receive props, avoid global side effects
- Export components as named exports unless they are the main entry point

## Styling
- Use Tailwind CSS utilities as the primary styling approach
- Reference existing utility classes from `src/styles/tarot.css` (e.g., `.modern-surface`, `.ai-panel-modern`, `.tarot-card-*`)
- Use CSS variable suit accents for card-related components
- Avoid inline styles; prefer composing existing Tailwind classes

## Accessibility
- Maintain proper ARIA labels and roles
- Preserve existing focus-visible ring styles for interactive elements
- Respect `prefers-reduced-motion` for animations
- Ensure touch targets are at least 44×44px for mobile (use `min-h-touch min-w-touch`)

## Motion & Animation
- A global CSS kill-switch in `tarot.css` disables all animations/transitions for `prefers-reduced-motion: reduce` — this is the safety net.
- For simple class toggling, use Tailwind `motion-safe:animate-*` / `motion-reduce:transition-none` variants. Do **not** import `useReducedMotion()` just to conditionally apply a CSS class.
- Reserve the `useReducedMotion()` hook for JS-level logic: changing `setTimeout` durations, skipping multi-step choreography, adjusting physics parameters, or conditionally rendering animated vs static components.

## Responsive
- Use existing touch-target tokens: `min-h-touch` (44px), `min-h-cta` (52px), `min-h-nav` (56px).
- Content padding pattern: `px-3 xxs:px-4 sm:px-6` for standard horizontal padding.
- Apply safe-area utilities (`pb-safe`, `pt-safe`, `px-safe`) on fixed/sticky elements.
- Prefer `useHandsetLayout()` over `useSmallScreen()` when Safari "Request Desktop Site" must be handled.

## Card Components
- `Card.jsx` expects `.tarot-card-*` CSS hooks
- Keep the back/face split logic intact
- Preserve upright vs reversed class handling
- Maintain `isMinor`/`getMinorPipCount` logic

## Layout
- Use Celtic Cross grid utilities (`.cc-grid` + `.cc-*` areas) for 10-card layouts
- Don't re-encode grid rules in JSX—lean on existing responsive CSS

## Theming
- Theme toggling is done by toggling `light` class on `<html>`
- Add light-mode overrides in `tarot.css` alongside existing ones
