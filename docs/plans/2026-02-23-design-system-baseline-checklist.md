# Design System Baseline And Gate Checklist (2026-02-23)

This document captures the current design-system drift baseline and the PR checklist enforced by `npm run gate:design`.

## Baseline Source

- Gate script: `scripts/evaluation/verifyDesignContract.js`
- Baseline file: `scripts/evaluation/design-contract-baseline.json`
- Command to refresh baseline intentionally:

```bash
node scripts/evaluation/verifyDesignContract.js --write-baseline
```

## Current Baseline Metrics

- `arbitraryTextPx.count`: `0`
- `arbitraryTextAny.count`: `219`
- `arbitraryMinHeight.count`: `36`
- `focusVisibleRings.total`: `688`
- `focusVisibleRings.uniqueCount`: `30`
- `productHexColorLiterals.count`: `0`
- `componentButtonClassConstants.count`: `0`
- `rawRgbaColorLiterals.count`: `26`
- `nonTokenTailwindColors.total`: `0`
- `nonTokenProseColors.total`: `0`

## Step 1 PR Checklist

Run these checks before opening a PR that touches UI code:

```bash
npm run gate:design
npm run test:contrast
```

A PR should be blocked if any of these increase versus baseline:

- Arbitrary text utilities (`text-[...]`)
- Arbitrary min-height utilities (`min-h-[...]`)
- Focus ring token total or unique variant count
- Product-file hard-coded hex literals
- Feature-local `*BUTTON_CLASS` constant declarations
- Raw `rgba(...)` arbitrary color literals
- Non-token Tailwind palette color usage

## Working Rules During Baseline Period

- Do not add new hard-coded hex colors in `src/components`, `src/contexts`, `src/lib`, `src/pages`, or `src/TarotReading.jsx`.
- Prefer semantic token classes and shared style utilities over local class constants.
- If a baseline change is intentional, include rationale in the PR and regenerate baseline in the same PR.
