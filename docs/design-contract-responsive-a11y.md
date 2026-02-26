Completed the responsive + a11y audit and applied the remediation updates below. This is the current design contract, standardization tokens, and regression checklist.

## Design Contract
- Base type: mobile body and prose are 16px via `--text-sm-mobile` / `text-sm-mobile` (`src/styles/tarot.css`, `tailwind.config.js`).
- Touch targets: minimum 44px with 52px for primary CTAs via `--touch-target` / `--touch-target-cta` (`src/styles/tarot.css`, `tailwind.config.js`).
- Safe area: sticky headers use `pt-[max(var(--safe-pad-top),0.75rem)]`; fixed bottoms use `pb-safe` (1rem baseline) plus `--mobile-action-bar-*` offsets (`tailwind.config.js`, `src/styles/tarot.css`).
- Motion: durations/easing use `--duration-*` / `--ease-out`; overlays gate animations with `motion-safe` or `useReducedMotion` (`src/styles/tarot.css`, `tailwind.config.js`, `src/hooks/useReducedMotion.js`).

| Breakpoint | Width | Layout Density | Type Scale | Touch Targets | Special Handling |
|------------|-------|----------------|------------|---------------|------------------|
| xxs | 320px | Ultra-compact; single column; tight gaps | Body 16px; prose 16px; meta 14px | 44px / 52px | Narrower carousel widths + tight padding via `xxs:` (`src/components/ReadingGrid.jsx`, `src/components/StreamingNarrative.jsx`) |
| xs | 375px | Compact mobile default | Body 16px; prose 16px | 44px / 52px | List view fallback for compact readings + spacing tweaks via `xs:` (`src/components/ReadingGrid.jsx`) |
| sm | 640px | Tablet baseline; allow 2+ columns | `text-sm`/`text-base`, `prose-base` | 44px / 52px | `sm:` grid fallback + spacing increases (`src/components/ReadingGrid.jsx`) |
| md | 768px | Desktop transition; comfortable spacing | `md:prose-lg`, larger headings | 44px / 52px | Larger content columns (`src/components/StreamingNarrative.jsx`) |
| landscape | height <=500px | Compact controls; reduced padding | Keep base sizes, reduce labels to `text-xs` | 44px / 52px | Hide step labels + shrink icons; compact action bar (`src/components/MobileActionBar.jsx`, `src/styles/tarot.css`) |
| short | height <=600px | Reduced chrome; tighter vertical padding | Same type sizes, tighter spacing | 44px / 52px | Use `short:` to reduce padding in narrative/sheets (`src/components/StreamingNarrative.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`) |

## Remediations Applied
| ID | Component | Resolution |
|----|-----------|------------|
| R-1 | Responsive system | Kept `mobile-sm/mobile-md/mobile-lg` max-width utility breakpoints in Tailwind for narrow viewport tuning, alongside `xxs/xs` min-width breakpoints. |
| R-2 | Responsive system | Aligned landscape threshold to 500 in `useLandscape` to match Tailwind/CSS. |
| R-3 | ReadingGrid | Replaced 480px with `xs` (375px) for very-small screen logic. |
| R-4 | ReadingGrid | Added `min-h-touch` to layout toggles. |
| R-5 | CardModal | Updated nav/close controls to `min-h-touch/min-w-touch`. |
| R-6 | Nudges + quick actions | Updated CTA heights to `min-h-cta` and secondary actions to `min-h-touch`. |
| R-7 | Headers | Standardized sticky headers on `pt-[max(var(--safe-pad-top),0.75rem)]`. |
| R-8 | Fixed bottoms | Standardized fixed bottom bars on `pb-safe` (1rem baseline). |
| R-9 | Motion | Tailwind animations and inline transitions now use motion tokens. |
| R-10 | Motion | Overlay animations gated via `motion-safe`/`useReducedMotion`. |

## Standardization Tokens
- Spacing: consolidate to "compact" (`px-3 py-2 gap-2`) and "comfortable" (`px-4 py-3 gap-3`) patterns already used in mobile shells (`src/components/MobileBottomNav.jsx`, `src/components/ExperienceSettings.jsx`).
- Heights: enforce `min-h-touch` / `min-h-cta` / `min-w-touch` for interactive elements; replace `min-h-[36px]` usages (`tailwind.config.js`, `src/components`).
- Motion: align `animate-*` durations and inline transitions to `--duration-*` / `--ease-out` and gate with reduced-motion (`tailwind.config.js`, `src/styles/tarot.css`, `src/components`).

## Regression Checklist
- Confirm all interactive elements use `min-h-touch/min-w-touch` and not `min-h-[36px]` (`tailwind.config.js`, `src/components`).
- Verify icon-only controls keep 44px targets + focus rings (`src/components/CardSymbolInsights.jsx`, `src/components/MobileActionBar.jsx`).
- Fixed bottom bars include safe-area + baseline padding (`tailwind.config.js`, `src/components/MobileBottomNav.jsx`, `src/pages/ShareReading.jsx`).
- Sticky headers include safe-area + baseline top padding (`src/pages/AccountPage.jsx`, `src/pages/ShareReading.jsx`, `src/components/onboarding/OnboardingWizard.jsx`).
- Drawers/sheets account for safe-area in max height and padding (`src/components/MobileSettingsDrawer.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`).
- Keyboard avoidance keeps actions visible via `--mobile-action-bar-offset` (`src/components/MobileActionBar.jsx`, `src/components/StreamingNarrative.jsx`).
- Breakpoint usage matches contract; avoid ad-hoc width thresholds (`tailwind.config.js`, `src/components/ReadingGrid.jsx`, `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardsDrawnSection.jsx`).
- Landscape/short behavior aligns between CSS utilities and JS hooks (`src/hooks/useLandscape.js`, `src/styles/tarot.css`).
- Prose containers use `text-sm-mobile` on mobile; metadata uses `text-xs-plus`; badges use `text-2xs` (`src/styles/tarot.css`, `tailwind.config.js`).
- Headings scale at `sm`/`md` where layouts widen (`src/components/StreamingNarrative.jsx`).
- Animations respect reduced-motion and durations use tokens (`src/styles/tarot.css`, `tailwind.config.js`, `src/components/MobileActionBar.jsx`).
