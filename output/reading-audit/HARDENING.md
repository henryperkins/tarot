# Personalized reading hardening

Implemented on the existing `master` checkout at base `4f0e125`. The incumbent Tableu design and existing streaming work were preserved. No commit, push, deployment, or migration was performed.

## Changes

- **Visible content through interrupted motion.** Routes render the current location directly. Page entrance motion only translates already-visible content. Scene transitions animate the background and cancel cleanly; reading content no longer fades to zero or remains at 0.88 opacity. The loading panel also starts fully visible.
- **Recoverable errors.** A failed reading renders an explicit error heading and alert. Desktop has a Retry narrative button; mobile retains its existing retry action. Both retry the same cards and question. Failed readings do not show completion feedback or render through the success narrative component.
- **Truthful generation states.** Partial server text cannot announce completion or trigger the narrative completion callback. Visual generation controls wait for the completed reading. Loading now presents its status first, and changes to a neutral extended-wait message after 12 seconds. Timer-driven steps and “almost there” claims were removed, along with redundant bounce and progress animations.
- **Keyboard continuity.** Loading, narrative, and error headings receive focus when the previous control disappears or becomes disabled. A user who moves focus elsewhere while waiting keeps that focus.
- **Narrow-screen resilience.** Removed cumulative mobile gutters and nested prose framing. Long words wrap, and question text supports bidirectional isolation. In-app Chromium measurements increased the paragraph width from about 147 to 283 px at a 390 px viewport, and from about 107 to 229 px at 320 px. Desktop remained about 591 px at 1440 px.

## Verification

| Check | Result |
| --- | --- |
| Initial regression run | All 9 original cases failed against the audited implementation, reproducing the visibility, announcement, and recovery failures |
| New browser regression suite | **12 passed**, Chromium; held SSE connections, 320/390/1440 px, motion preference changes, delayed responses, partial text, mid-stream errors, 401/403/429/500 retries, focus retention, long unbroken text and Arabic/CJK/emoji |
| `npm test` | **1,921 passed**, no failures or skips |
| Production build | **Passed**; existing large-chunk advisory remains |
| ESLint | **Passed** for changed JavaScript/JSX files |
| `git diff --check` | **Passed** |
| Rendered review | Desktop loading/error/completion; mobile loading/partial/completion; 320 px prose; reduced-motion change during loading |
| Scoped axe WCAG 2 A/AA and 2.1 AA scans | **0 violations** on desktop and mobile completion; layered-background contrast remains incomplete (59 desktop and 47 mobile nodes), not certified |

Browser responses were local fixtures, not live model/provider calls. These checks do not establish production deployment, real-device, or screen-reader behavior. The full E2E suite and model-quality gates were not run for this frontend hardening pass.

## Review material

- [Scoped patch](HARDENING.patch): 18 source files and the new regression suite. In the already-modified `ReadingContext.jsx`, this pass changes only four screen-reader announcement strings; earlier streaming changes are excluded from the patch.
- [Regression suite](../../e2e/reading-hardening.spec.js)
- [Browser results](harden-e2e.log), [unit results](harden-unit-tests.log), [build results](harden-build.log)
- [Desktop loading](harden-loading-desktop.png), [desktop error](harden-error-desktop.png), [desktop reading](harden-reading-desktop.png)
- [Mobile reduced-motion loading](harden-loading-mobile-reduced.png), [mobile partial text](harden-partial-mobile.png), [mobile completion](harden-reading-mobile.png), [320 px prose](harden-reading-320.png)
- [Desktop axe results](harden-axe-desktop.json), [mobile axe results](harden-axe-mobile.json)

The original [audit](AUDIT.md) remains the historical baseline. Its separate visual refinements remain: simplifying the decorative loader further, moving the mobile question anchor ahead of the prose, enlarging secondary touch targets, and correcting light-theme scene surfaces.
