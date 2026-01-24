# Motion Strategy

Single source of truth for reduced motion across the app.

## Canonical Sources

- **Framer Motion:** `MotionConfig reducedMotion="user"` is applied at the app root.
- **React components:** Use the custom `useReducedMotion` hook from `src/hooks/useReducedMotion.js`.
- **CSS:** Use `@media (prefers-reduced-motion: reduce)`.
- **Tailwind:** Prefer `motion-safe:` and `motion-reduce:` utilities for decorative effects.

## Guidelines

- Avoid importing `useReducedMotion` from `framer-motion`; use the custom hook instead.
- Gate JS-driven animations with the custom hook (durations, layout transitions, autoplay).
- Motion toggles must respect the user preference and never re-enable reduced motion.
