# Narrative remediation — theme and source-usage evidence

Task 3 implementation is complete in the isolated `codex/narrative-remediation` worktree. This report covers the source panel and its supporting theme/layer rules; the integrated acceptance report owns the full A01–A09 verdict and repository-wide gates.

## Changes

- `src/styles/theme.css`: normal light success `#2F6A3B` / `#EDF4EE` and caution `#854D0E` / `#FEF3C7`; opaque dark counterparts retain the existing sage/amber foregrounds.
- `tailwind.config.js`: semantic badge backgrounds and the existing `--z-modal-backdrop: 60` / `--z-modal: 70` mappings. Higher overlay mappings are unchanged.
- `src/styles/tarot.css`: reading-only frame gradient uses the existing light/dark panel tokens. Reading-stage decorative blooms stay inside their bounds in mobile stable mode; no new clipping is applied to controls or focus rings. Ritual/reveal selectors are unchanged. At the semantics agent's request, skip links are viewport-anchored and reveal immediately on `:focus`; that agent owns A09 verification.
- `ReadingInputUsageSection.jsx`: an h2 contains the native disclosure button, initially expanded, with valid expanded/control/description relationships. Source labels, help, and status text are at least 14px. Native inline text wrapping, bounded narrow gutters, and distinct icons support enlarged text. Opaque badges paint above decorative panel grain.
- `sourceUsageSummary.js`: presentation classes only. Source state, detail, and count derivation remain unchanged.
- `tests/sourceUsageSummary.test.mjs`: two explicit source models protect the four status distinctions, details, and different aggregate totals; no backend metadata changed to match a fixture.

## Reproduced defects

The acceptance agent measured the baseline light “3 used” badge at **2.507:1**. The local baseline capture also recorded 11px status labels and the dark reading-frame gradient in light mode: [baseline styles](../../../output/narrative-remediation/theme/baseline-light-source-panel.json), [baseline image](../../../output/narrative-remediation/theme/baseline-light-source-panel.png).

At 320px, the completed reading originally had a 333px document width. The stable-mode rule exposed an out-of-bounds decorative pseudo-element: disabling pseudo-elements reduced the width to 320px. Moving only the reading-stage bloom anchors inside their stage fixes that cause without clipping content. Enlarged-text checks also exposed the badges' flex min-content width; native inline wrapping now gives subsequent text lines their full available width.

## Rendered results

The final run uses local Chromium, `http://localhost:5173`, real jobs/SSE fixture interception, and reduced motion. Both **Inter Variable** and **Source Serif 4 Variable** were confirmed loaded and font requests returned successful statuses. Earlier fallback-font captures were superseded after the preview-server dependency allowlist was corrected.

| Theme / state | Foreground | Opaque background | Text and icon contrast |
| --- | --- | --- | --- |
| Light used | `#2F6A3B` | `#EDF4EE` | 5.785:1 |
| Light requested-unused / skipped | `#854D0E` | `#FEF3C7` | 6.153:1 |
| Light not-requested | `#333333` | `#F5F5F5` | 11.589:1 |
| Dark used | `#6B9E78` | `#1B2C21` | 4.750:1 |
| Dark requested-unused / skipped | `#F59E0B` | `#392B17` | 6.383:1 |
| Dark not-requested | `#DDD7CD` | `#2A2730` | 10.253:1 |

Badge opacity is 1 through its ancestors; backgrounds are opaque. Borders and icons use their badge foreground, meeting the 3:1 nontext target. Pixel sampling of the four colored badge screenshots confirms exact foreground and background RGB pixels after painting: [pixel evidence](../../../output/narrative-remediation/theme/rendered-badge-pixels.json).

**Seven rendered cases pass:** light/dark at 1440×1000 with each of two fixtures; light 320×740; dark 390×844; and light 320×740 at 200% root text size. The reference fixture renders 3 used / 2 requested not used; the alternate renders 2 used / 1 requested not used. Every case verifies:

- The h2/button relationship, existing controlled element, correct expanded state, and at least 44×44px disclosure hit area.
- Enter closes the rows, removes their list from accessible role lookup, and Space reopens them.
- Model-derived totals, opaque colors, text/icon/border contrast, and at least 14px status/help text.
- No overflowing source text and no document horizontal overflow. Narrow document widths are exactly 320, 390, and 320px respectively.
- No Vite error overlay or uncaught page errors; both expected font families loaded.

The desktop frame resolves to `#FFFFFF → #F5F2EE` in light mode and `#0D0A14 → #151020` in dark mode. The existing transparent mobile-frame override remains active.

Full values and reproducible local verification are in [rendered verification JSON](../../../output/narrative-remediation/theme/rendered-verification.json) and [verification script](../../../output/narrative-remediation/theme/verify.mjs).

## Commands and limits

- `node --test tests/sourceUsageSummary.test.mjs` — 6/6 pass.
- `npx eslint src/components/reading/complete/ReadingInputUsageSection.jsx src/components/reading/complete/sourceUsageSummary.js tests/sourceUsageSummary.test.mjs` — pass.
- `node --check tailwind.config.js` — pass. The repository ESLint configuration ignores this config file, so its initial ignored-file warning was not treated as config lint coverage.
- Scoped `git diff --check` — pass; existing LF/CRLF conversion warnings only.
- `node output/playwright/narrative-theme/verify.mjs` — all 7 cases pass.
- One Impeccable detector pass completed. It reported existing broad `tarot.css` palette/radius/type advisories and motion warnings; it is not a claim that the full stylesheet has no findings. The token pairs here follow the accepted remediation specification.

No full suite or build was run by this agent concurrently with integration. The parent/acceptance tasks own WebKit, normal-motion coverage, shared modal regression checks, full gates, and A09 confirmation. These are local synthetic-service results, not physical-device, spoken screen-reader, live AI, persistence, or deployment evidence.

## Rendered artifacts

- [Light reference, 1440px](../../../output/narrative-remediation/theme/light-reference-1440.png)
- [Dark reference, 1440px](../../../output/narrative-remediation/theme/dark-reference-1440.png)
- [Light alternate fixture](../../../output/narrative-remediation/theme/light-alternate-1440.png)
- [Dark alternate fixture](../../../output/narrative-remediation/theme/dark-alternate-1440.png)
- [Light 320px](../../../output/narrative-remediation/theme/light-reference-320.png)
- [Dark 390px](../../../output/narrative-remediation/theme/dark-reference-390.png)
- [Light 320px, 200% text](../../../output/narrative-remediation/theme/light-reference-320-200percent.png)

The narrow component captures retain the application's fixed navigation/action bars. Their overlap in a tall element screenshot is not used as evidence that every row fits simultaneously in the viewport; the reading remains vertically scrollable.

