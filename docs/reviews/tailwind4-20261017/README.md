# Tailwind 4 migration verification

Tailwind 4.3.3 requires its PostCSS plugin and migrated utilities; the dependency-only PR #94 was insufficient. This migration follows the [official upgrade guide](https://tailwindcss.com/docs/upgrade-guide) and preserves the existing application theme, stylesheet precedence, blur sizes, white/black utility values, and transition behavior. Explicit application variables retain their original meanings. Tooltip collision corrections disable the independent translate property so it cannot apply a second offset.

Local checks: build and lint passed; root tests 4,229 passed and two skipped; 21 reading-reference browser cases passed across Chromium desktop/phone and WebKit phone, including 200% text, focus restoration, cancellation, journal navigation, and Axe checks. Token contrast passed 24/24. The static WCAG scanner reported zero errors and 1,128 warnings; it is heuristic, and those warnings are not a clean accessibility certification.

Independent review reproduced the tooltip regression by removing only the translate overrides in memory, then verified both viewport edges, arrow alignment, Escape, and retained focus with the final compiled CSS in Chromium and WebKit. Compiled style probes also verified gallery positioning, blur, literal colors, explicit theme variables, and all ten custom transition property lists.

The screenshots use controlled narrative fixtures and a fixed clock/card selection. Twenty-four captures covered setup and reading at 320, 390, and 1280 pixels in dark and light themes. No horizontal overflow occurred and measured reading-panel widths/padding matched the baseline. These are browser render checks, not physical-device, screen-reader, live-provider, or production deployment proof.

| View | Tailwind 3 baseline | Tailwind 4 |
| --- | --- | --- |
| 320px dark reading | [Before](before-320-dark-reading.png) | [After](after-320-dark-reading.png) |
| 1280px light reading | [Before](before-1280-light-reading.png) | [After](after-1280-light-reading.png) |
