# Tableu Responsive + Accessibility Design Contract

Senior front-end audit focused on responsive + accessibility foundations. Scope limited to breakpoints, touch targets, safe area handling, typography scaling, and motion rules.

## Design Contract (Mobile-First)

| Breakpoint | Width / Condition | Layout Density | Type Scale | Touch Targets | Special Handling |
|---|---|---|---|---|---|
| xxs | min 320 | Ultra-compact; tighten padding/widths via `xxs:` (see `src/components/ReadingGrid.jsx:187`, `src/components/StreamingNarrative.jsx:302`) | Base 16 + prose 15 via `--text-sm-mobile` (see `src/styles/tarot.css:322`) | >=44 via `min-h-touch/min-w-touch` (see `tailwind.config.js:97`) | Allow 2-col grid for small spreads (`src/components/ReadingGrid.jsx:426`) |
| xs | min 375 | Baseline phone; small density bumps with `xs:` (see `src/components/ExperienceSettings.jsx:48`) | Microcopy via `text-xs-plus` (see `tailwind.config.js:93`) | >=44 via `min-h-touch/min-w-touch` (see `tailwind.config.js:97`) | Heading step-ups with `xs:` where needed (`src/components/ReadingDisplay.jsx:836`) |
| sm | min 640 | Tablet start; switch to grid layouts (`src/components/ReadingGrid.jsx:392`) | Narrative text increases at 640 (`src/styles/tarot.css:3188`) | >=44 via `min-h-touch/min-w-touch` (see `tailwind.config.js:97`) | Wider narrative containers (`src/components/StreamingNarrative.jsx:330`) |
| md | min 768 | Desktop transition; larger padding shells (`src/components/ReadingDisplay.jsx:833`) | Prose scale via `md:prose-lg` (`src/components/StreamingNarrative.jsx:330`) | >=44 via `min-h-touch/min-w-touch` (see `tailwind.config.js:97`) | Desktop density begins (`src/components/ReadingDisplay.jsx:833`) |
| landscape | orientation landscape + height <= 500 (target) | Compact controls; hide step labels, smaller icons (`src/components/MobileActionBar.jsx:59`) | Use smaller labels where needed (`src/components/MobileActionBar.jsx:62`) | >=44 via `min-h-touch/min-w-touch` (see `tailwind.config.js:97`) | Reduced action-bar padding (`src/styles/tarot.css:677`) |
| short | max-height 600 | Reduce vertical spacing (`tailwind.config.js:45`) | No scale change; spacing-only adjustments | >=44 via `min-h-touch/min-w-touch` (see `tailwind.config.js:97`) | `short:` spacing in sheets/narrative (`src/components/StreamingNarrative.jsx:279`, `src/components/ReadingJourney/JourneyMobileSheet.jsx:680`) |

## Safe Area Contract

- Use `pt-safe/pb-safe/px-safe` or safe-pad calcs on sticky headers and overlays (`tailwind.config.js:112`, `src/pages/CardGalleryPage.jsx:453`).
- Fixed bottom elements must include safe-area bottom and left/right (`src/styles/tarot.css:374`, `src/components/MobileBottomNav.jsx:38`, `src/pages/ShareReading.jsx:494`).
- Drawer/sheet internals should pad safe-area left/right and bottom (`src/styles/tarot.css:641`, `src/components/MobileSettingsDrawer.jsx:165`).
- Keyboard avoidance uses `--keyboard-offset` from `useKeyboardOffset` (`src/hooks/useKeyboardOffset.js:7`) and is consumed by fixed elements (`src/components/MobileActionBar.jsx:452`, `src/components/StreamingNarrative.jsx:283`).

## Typography Contract

- Mobile base 16 and prose 15 in content containers (`src/styles/tarot.css:322`).
- Journal prose uses clamp scaling (`src/styles/tailwind.css:32`).
- Tokens: `text-xs-plus` and `text-sm-mobile` (`tailwind.config.js:93`).
- Headings should scale across `xxs/xs/sm` where they act as section titles (`src/components/ReadingDisplay.jsx:836`).

## Touch Target Contract

- Minimum 44px via `min-h-touch` and `min-w-touch` (`tailwind.config.js:97`).
- Primary CTAs use `min-h-cta` (`tailwind.config.js:97`, `src/components/PhotoInputModal.jsx:52`).
- Icon-only controls include touch target classes and `touch-manipulation` (`src/components/CardSymbolInsights.jsx:82`).

## Motion Contract

- Use `--duration-*` and `--ease-out` (`src/styles/tarot.css:168`).
- Gate animations with `motion-safe:` or `useReducedMotion` (`src/components/MobileSettingsDrawer.jsx:145`, `src/components/MobileBottomNav.jsx:38`).
- Global reduced-motion fallback is in place (`src/styles/tarot.css:2736`).

## Inconsistency Findings (Minimum 8)

| ID | Component | Issue | Current | Proposed Fix | Effort |
|---|---|---|---|---|---|
| R-1 | Breakpoints | `mobile-sm/md/lg` are CSS-only; no Tailwind screens | `src/styles/tarot.css:958`, `tailwind.config.js:35` | Add screens or relabel as CSS-only in `tailwind.config.js` | Low |
| R-2 | Landscape | Threshold mismatch (500 vs 600) | `tailwind.config.js:42`, `src/hooks/useLandscape.js:8`, `src/styles/tarot.css:677` | Align on one threshold and update CSS/hook | Low |
| R-3 | ReadingGrid | xs boundary conflict (max 375 vs min 375) | `src/components/ReadingGrid.jsx:165`, `tailwind.config.js:35` | Use 374px max or shared breakpoint constant | Low |
| R-4 | QuickIntentionCard | Touch target below 44px | `src/components/QuickIntentionCard.jsx:76` | Use `min-h-touch min-w-touch` | Low |
| R-5 | OnboardingProgress | Mobile step buttons 32-36px | `src/components/onboarding/OnboardingProgress.jsx:55` | Increase to `min-h-touch min-w-touch` | Med |
| R-6 | ShareReading | Meta chips 36px height | `src/pages/ShareReading.jsx:22` | Use `min-h-touch` | Low |
| R-7 | PricingPage | Sticky CTA lacks safe-area padding | `src/pages/PricingPage.jsx:1022` | Add `pb-safe-bottom` or `pb-safe-action` + safe X padding | Low |
| R-8 | CardSymbolInsights | Bottom sheet lacks safe-area left/right | `src/components/CardSymbolInsights.jsx:238` | Add `px-safe` or `pl-safe-left pr-safe-right` | Low |
| R-9 | Typography | `text-sm-mobile` token unused; ad-hoc microcopy sizes | `tailwind.config.js:93`, `src/components/MobileSettingsDrawer.jsx:173` | Replace ad-hoc sizes with `text-sm-mobile`/`text-xs-plus` | Med |
| R-10 | Motion | Unconditional `animate-*` despite mixed gating | `src/components/ReadingGrid.jsx:414`, `src/components/ReadingGrid.jsx:425` | Use `motion-safe:animate-*` or hook gating | Low |

## Minimal Standardization Token Set

- Spacing scale: standardize compact (0.5rem), base (0.75-1rem), comfortable (1.25-1.5rem) using existing values (`src/styles/tarot.css:588`, `src/styles/tarot.css:677`, `src/components/MobileActionBar.jsx:220`).
- Height tokens: consolidate on `min-h-touch` / `min-h-cta` and avoid hardcoded smaller sizes (`tailwind.config.js:97`, `src/components/QuickIntentionCard.jsx:76`, `src/pages/ShareReading.jsx:22`, `src/components/onboarding/OnboardingProgress.jsx:55`). Keep offsets via `--mobile-action-bar-height` (`src/styles/tarot.css:191`, `src/components/MobileActionBar.jsx:474`).
- Motion tokens: use `--duration-*` and `--ease-out` everywhere (`src/styles/tarot.css:168`, `tailwind.config.js:128`) and gate animations with `motion-safe`/`useReducedMotion` (`src/components/MobileSettingsDrawer.jsx:145`, `src/components/MobileBottomNav.jsx:38`).

## Regression Checklist (10-12)

1. Touch targets >= 44px for all interactive elements (`tailwind.config.js:97`).
2. Primary CTAs use `min-h-cta` (`tailwind.config.js:97`, `src/components/PhotoInputModal.jsx:52`).
3. Icon-only controls include `min-h-touch/min-w-touch` (`src/components/CardSymbolInsights.jsx:82`).
4. Fixed bottom bars include safe-area padding (`src/styles/tarot.css:374`, `src/components/MobileBottomNav.jsx:38`).
5. Sticky headers include safe-area top + X padding (`src/pages/CardGalleryPage.jsx:453`).
6. Drawers/sheets pad safe-area left/right + bottom (`src/styles/tarot.css:641`, `src/components/MobileSettingsDrawer.jsx:165`).
7. Mobile prose uses `--text-sm-mobile` in content containers (`src/styles/tarot.css:322`).
8. Heading scales use `xxs/xs/sm` where they are primary titles (`src/components/ReadingDisplay.jsx:836`).
9. Landscape compact behavior uses the agreed threshold (`src/hooks/useLandscape.js:8`, `src/styles/tarot.css:677`).
10. Short-height spacing uses `short:` utilities (`tailwind.config.js:45`, `src/components/StreamingNarrative.jsx:279`).
11. Horizontal carousels include safe-area scroll padding (`src/components/ReadingGrid.jsx:402`).
12. Animations are gated or motion-safe and respect reduced motion (`src/components/MobileSettingsDrawer.jsx:145`, `src/styles/tarot.css:2736`).
