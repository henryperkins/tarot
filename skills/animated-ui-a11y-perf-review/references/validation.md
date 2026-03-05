# Validation

## Core Commands

```bash
npm run lint
node --test tests/cinematicEnhancements.test.mjs tests/spreadTablePresentation.test.mjs tests/mobileStableMode.test.mjs
npm run test:a11y
```

## UI Regression Path

```bash
npm run test:e2e -- e2e/tarot-reading.spec.js
```

## Build Safety

```bash
npm run build
```

## Manual Browser Checks

- Safari/WebKit: reduced-motion path and focus visibility.
- Mobile viewport: long narrative rendering and image loading behavior.