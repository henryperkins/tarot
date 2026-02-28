# Motion Strategy

Single source of truth for reduced motion across the app.

## Canonical Sources

- **Framer Motion:** No global `MotionConfig` wrapper is currently used; reduced-motion behavior is enforced per-component.
- **React components:** Use the custom `useReducedMotion` hook from `src/hooks/useReducedMotion.js`.
- **CSS:** Use `@media (prefers-reduced-motion: reduce)`.
- **Tailwind:** Prefer `motion-safe:` and `motion-reduce:` utilities for decorative effects.

## Guidelines

- Avoid importing `useReducedMotion` from `framer-motion`; use the custom hook instead.
- Gate JS-driven animations with the custom hook (durations, layout transitions, autoplay).
- Motion toggles must respect the user preference and never re-enable reduced motion.

## Mobile compositing guardrail (iOS/WebKit)

- On constrained handsets, enable stable mode via [`shouldUseMobileStableMode()`](../src/lib/mobileStableMode.js:10) and apply the app-shell class in [`TarotReading()`](../src/TarotReading.jsx:863).
- Stable mode must disable stacked blur/compositing layers on scene surfaces ([`.scene-stage__panel`](../src/styles/tarot.css:299), [`.narrative-panel--stable`](../src/components/NarrativePanel.jsx:218)) and remove decorative narrative pseudo-layers ([`.narrative-atmosphere::before`](../src/styles/tarot.css:3456), [`.narrative-atmosphere::after`](../src/styles/tarot.css:3469)).
- For mobile WebKit, keep a fallback that forces opaque/non-blurred scene surfaces using the `@supports (-webkit-touch-callout: none)` block in [`src/styles/tarot.css`](../src/styles/tarot.css:966).
- In stable mode, narrative/complete scene particles should be gated in [`SceneShell()`](../src/components/scenes/SceneShell.jsx:244) to avoid compositor seam artifacts.
