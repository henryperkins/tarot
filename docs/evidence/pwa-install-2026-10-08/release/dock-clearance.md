PR #102 dock clearance review, 2026-10-08.

The bot's proposed landscape offset cause is refuted on the rendered path. `MobileActionBar` sets inline `bottom: 0`; Chromium and WebKit compute `bottom: 0px` despite the landscape stylesheet's safe-area offset. Its measured `offsetHeight` already includes bottom safe-area padding. Adding that inset again to `TarotReading` would reserve it twice. The page continues to own clearance once in its main; the shell has zero bottom padding.

A separate measurement defect is confirmed. The default `ResizeObserver` watches the content box. Increasing only safe-area padding grows the fixed dock without notifying that observer, so page clearance remains based on the old height. Reading and Pricing now observe the border box, preserving the existing window-resize fallback when `ResizeObserver` is unavailable.

The unchanged head `04403a3` was built as `app-DBO6rHdL.js`. Guest fixture runs used actual Chromium and WebKit with touch-first contexts, blocked service workers, and synthetic bottom insets. Reading was completed in portrait before rotating to 844 × 390. A positive gap means the install button ends above the dock.

| Browser / text | Bottom inset | Actual dock height | Published height before fix | Gap before fix |
| --- | ---: | ---: | ---: | ---: |
| Chromium / 100% | 34px | 108.59px | 77px | -19.77px |
| WebKit / 100% | 34px | 108.59px | 77px | -15.77px |
| Chromium / 200% | 64px | 168.19px | 109px | -35.23px |
| WebKit / 200% | 64px | 168.19px | 109px | -35.23px |

All four reading regressions failed the unchanged build when safe-area padding grew. All four Pricing regressions also failed, using a synthetic 100px bottom inset to exceed the page's minimum clearance. Those failures came from five-point hit testing of the real install button, not source-text assertions.

Final geometry snapshots publish 109px and reserve 121px in main at 100% text / 34px inset; the button clears the dock by about 12.23px in both engines. At 200% text / 64px inset they publish 168px and reserve 192px, with about 23.77px clearance. All five points activate the install button in those snapshots. A sequential text/viewport stress probe had one WebKit five-second hit-test timeout before its next snapshot settled; its eventual geometry is not counted as an uninterrupted passing test run.

The rebuilt observer changes passed the first ten-case Chromium/WebKit run, covering normal/enlarged text, reading/pricing inset growth, guide interaction, focus return, and a fresh enlarged landscape reading. The fresh-mount case also passes the baseline; it protects existing behavior and is not evidence of another repaired defect. Scoped ESLint and `git diff --check` passed.

A repeated WebKit 200% reading run subsequently passed seven times and failed once after Escape. Focus returned to the install button, but scroll restoration moved the page upward and all five hit points failed. That is separate from dock measurement: the published height remained 168px. This file does not qualify that scroll-restoration path as fixed; the release review records its subsequent diagnosis and verification separately.

No physical-device installation, native browser offer timing, physical iOS keyboard, or spoken screen-reader behavior was verified by these synthetic geometry tests. The Browser plugin was unavailable; validation used the repository's Playwright engines.
