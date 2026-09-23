# Personalized reading layout

Implemented locally on `master`, base `4f0e125`, on 2026-09-23.

The reading path is title, question, guidance, prose, then supporting actions. The page owns the mobile gutter; the reading wrappers no longer add horizontal insets below 640px. The existing desktop measure and visual language remain intact.

## Changes

- Give the reading and completed scenes a scoped layout class. Remove their nested phone frames, horizontal padding, and prose width caps. Preserve safe areas by adding only the inset beyond the page gutter.
- Render the question once, before the reading on every viewport. The compact version uses unboxed text with bidi isolation and long-word wrapping. Empty questions still render no anchor.
- Apply the existing 44px touch token to narration, journal, focus, chat, typing-effect, voice-consent, journal-status, and subscription-recovery controls.
- Make Spread Insights use the same handset decision for its toggle and content. This fixes the missing toggle between 640px and 768px and preserves keyboard expansion.

## Rendered evidence

Local Vite preview with deterministic reading fixtures in the Codex in-app browser. Dimensions include the browser's approximately 15px scrollbar. This is local UI evidence, not a live model or production deployment check.

| Viewport/state | Prose width | Prose left edge | Question before prose | Supporting reading targets |
| --- | ---: | ---: | --- | --- |
| 320 x 740 | 272.7px | 16px | Once | At least 44px tall and wide |
| 390 x 844 | 342.7px | 16px | Once | At least 44px tall and wide |
| 768 x 1024 | 468.7px | 142px | Once | At least 44px tall and wide |
| 1440 x 1000 | 591.0px | 416.8px | Once | At least 44px tall and wide |
| 844 x 390 | 544.7px | 142px | Once | At least 44px tall and wide |
| 390px, doubled root text size | 310.7px | 32px | Once | Grow and wrap |
| 390px, simulated 44px safe areas | 286.7px | 44px | Once | At least 44px tall and wide |

The earlier hardening baseline measured about 229px of prose at 320px and 283px at 390px. This pass recovers roughly 44px and 60px respectively. The desktop prose measure remains about 591px.

- Hierarchy and grouping: title, question, guidance, and prose remain distinct in the top screenshots; supporting controls follow the narrative. The phone title, question, and prose align at the page gutter. Paragraph spacing and section dividers preserve the reading rhythm.
- Adaptation and density: phone wrappers use the available width while desktop retains its bounded reading measure. The mobile action dock remains separate, and the final controls can scroll above it.
- Dynamic and localized content: the question mixes English, Arabic, Japanese, and emoji. Long-content regressions pass. Text scaling was emulated by doubling the root font size, not by changing browser zoom. Safe-area values were simulated and then restored.
- Keyboard and accessibility order: the question precedes the prose in the DOM and visually. At 768px, Spread Insights collapses by click and expands with Enter while retaining focus. Its native button exposes the expanded state. Existing focus and motion regressions pass; no screen-reader session was performed.
- Conditional targets: source review confirms the same touch utilities on Stop, voice-consent actions, View entry, typing replay, and subscription recovery. Ordinary completed-reading controls and the mobile dock were measured in the browser; no live narration, journal persistence, or billing request was sent.

Screenshots: [320px reading](phone-320-top.png), [390px reading](phone-390-top.png), [mobile controls](phone-390-controls.png), [tablet insights](tablet-768-insights.png), [desktop](desktop-1440.png), [landscape](landscape-844.png), [doubled text sizing](phone-390-text-size-200.png).

Raw measurements: [measurements.json](measurements.json).

## Verification

- Scoped ESLint for all changed JavaScript/JSX files: passed.
- `npm run build`: passed. The existing large-chunk warning remains; see [build.log](build.log).
- `npx playwright test e2e/reading-hardening.spec.js --project=chromium --workers=1 --reporter=line`: **12 passed**, covering partial streams, completion, interrupted motion, errors and retry, delayed responses, focus preservation, and narrow mixed-script content. See [e2e.log](e2e.log).
- Impeccable layout detector: zero findings before and after. See [final scan](layout-scan-after.json).
- `git diff --check`: passed; line-ending notices only.
- The full unit suite was not repeated for this layout pass; the preceding hardening pass recorded 1,921 passing unit tests.

The [scoped patch](LAYOUT.patch) compares the 12 changed files with the copies saved immediately before this layout pass. It excludes prior hardening and unrelated working-tree edits. No commit, push, deployment, or migration was performed.
