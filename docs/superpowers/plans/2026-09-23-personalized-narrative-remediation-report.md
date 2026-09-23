# Personalized Narrative remediation — implementation evidence

Implemented from [the specification](../specs/2026-09-23-personalized-narrative-remediation.md) on `codex/narrative-remediation`, based on `7e9170fb2b64184a6225940f4cbef7b9e92caced`. The worktree is `C:/Users/htper/.codex/worktrees/narrative-remediation/tarot`; the original checkout's unrelated work is preserved. This paragraph and the original tables below are the historical pre-integration record. See the current integration checkpoint at the end for committed candidates and release blockers.

## Result

The follow-up conversation now uses one persistent, opaque body portal across handset and desktop layouts. Closed chat is hidden and inert; one modal owner handles initial focus, trapping, background isolation, and restoration. Closing or changing layout preserves draft, history consent, messages, and an active response. Suggestions remain direct-submit native buttons, and a synchronous request guard prevents duplicate sends. A request from an older reading cannot update the next reading after an abort, including a late JSON limit-response body.

The dialog uses the effective VisualViewport height, one flexible message region, and a reachable composer. At short heights or enlarged text, the entire dialog scrolls. The character counter occupies its own line so enlarged input never overlaps it. Close/send controls are 48px; other affected controls use at least 44px targets.

Feedback uses initially empty native radio groups while preserving its payload, notes, limits, error retention, and announcements. Narrative headings are contextual h3–h6 beneath the h2 panel; chat/journal Markdown defaults and voice offsets are retained. Skip links follow mounted destinations and move focus explicitly. Light/dark source badges use opaque semantic colors and model-derived states/counts, and the reading's light panel and outer frame use theme tokens.

## Verification record

| Check | Result |
| --- | --- |
| `npm test` | 1,938 passed, zero failed. Baseline had 1,921. |
| Focused semantics/registration/section/model/stream tests | 26 passed; a final semantics/registration rerun passed 11 cases. |
| Particle lifecycle tests | Four passed: pending-load replacement, cancellation during initialization, detached completion, and cleanup after allocation then rejection without touching another owner. |
| Source-usage tests | 6 passed, including two different metadata fixtures. |
| Existing follow-up E2E | 9 passed across Chromium and mobile WebKit; added late-response isolation case passed separately. |
| Saved Intentions nested-modal E2E | Passed, including Escape/cancel return focus, resumed parent trap, removed-opener fallback, and final restoration. |
| Existing reading-hardening, visual-modal, and Saved Intentions regression | 16 Chromium cases passed together (1.8 minutes). The unchanged mid-stream failure test also passed three consecutive runs. |
| `npm run build` | Passed; existing large-bundle advisory remains. |
| `npm run gate:design` | Passed. |
| `npm run test:a11y` | Exit 0: all 24 token contrast pairs passed; static scan reported zero errors and 1,156 advisories. This is not a rendered accessibility verdict. |
| `npm run test:a11y:e2e -- --workers=1 --reporter=line` | 15 Chromium cases passed. |
| `npm run ci:narrative-check` | Passed: nine synthetic evaluation readings, all thresholds met, no flagged samples, prompt-assembly checks passed. This command used the configured provider; browser UI tests used intercepted services. |
| `npm run lint` | Fails with 146 errors and 37 warnings. The changed-file scan reports only the two pre-existing FollowUpChat effect-state rules, confirmed against HEAD. Existing source and historical output snapshots account for the full-repository failures. |
| `git diff --check` | Passed; line-ending notices only. |
| Independent code review | No unresolved actionable findings after fixing the stale limit-response race and cleaning up a particle container whose startup rejects after allocation. Also exercised long streamed answers at 200% text in Chromium and WebKit. |

All 31 distinct acceptance cases have passing final executions. The first full run passed 26; targeted reruns passed the five remaining cases after correcting fixture selection, awaiting the real opening animation, using native scrolling followed by the same center hit tests, and allowing 90 seconds for the repeated WebKit lifecycle case. No force clicks or reduced assertions were used. See the [exact run history and matrix](../../../output/narrative-remediation/acceptance-report.md).

| Case | Final automated result | Affected implementation and proof |
| --- | --- | --- |
| A01 foreground | Pass | FollowUpModal body portal, layer tokens, opaque surface; actual center hit tests at 320/390px in normal/reduced motion. |
| A02 lifecycle/focus | Pass | Shared modal ownership and explicit opener; three close cycles, Tab both directions, button/Escape/backdrop/Android Back simulation, closed accessibility snapshot, retained draft/history/messages and one streaming request. |
| A03 suggestions/guards | Pass | Native direct-submit buttons; Enter/Space/pointer request counts, auth/limits, IME/Shift+Enter, 500-character limit, error/retry and old-reading response isolation. |
| A04 source contrast/accuracy | Pass | Theme tokens and source presentation mapping; painted and computed contrast, two different source fixtures, four source-state distinctions. |
| A05 available height | Pass in simulation | VisualViewport helper and follow-up CSS; 1440×500, 200% text, 320/390px simulated keyboard, rotation/recovery and footer reachability. |
| A06 feedback | Pass | FeedbackPanel native fieldsets/radios; Tab/arrows/Space, unchanged payload fields, initially empty state, required ratings, 750-character notes, failure retention and success. |
| A07 headings | Pass | Narrative header/body, contextual Markdown, peer panels and preserved page h1; full/focused/expanded/collapsed outline, deeper headings, shared renderer defaults and voice-offset tests. |
| A08 targets/reflow | Pass | 48px chat close/send, 44px suggestions/labels; no horizontal overflow at 320px and 200% text, visible separate focus, nonoverlapping counter. |
| A09 mounted skip links | Pass | TarotReading/SkipLink and narrative target registration; mounted setup/reading/narrative destinations receive focus without resetting or generating a reading. |

The existing streaming-error regression exposed an asynchronous particle-canvas race: the installed React adapter could leave a style observer behind when a load resolved after cleanup. A debugger pause identified the observer loop; a control removing only ParticleLayer cleared the failure with the complete heading/navigation implementation retained. The canvas now uses one shared initialization promise, serialized ownership, an explicit DOM host, and cancellation cleanup. The original error regression passes without changing its assertions. Four delayed-loader unit tests cover lifecycle and rejection cleanup. A final seven-case browser run passed normal-motion lifecycle and A07/A09 checks across Chromium and mobile WebKit (3.3 minutes).

## Rendered re-audit

All nine specified findings are closed by the linked local automated and rendered evidence. No unresolved P1 finding remains in the affected experience. This evidence-based local re-audit meets the 18/20 acceptance floor; the residual limits below prevent claiming the intended 19/20 or full accessibility certification.

| Dimension | Baseline | Final | Basis and residual limit |
| --- | --- | --- | --- |
| Accessibility | 1/4 | 3/4 | Native semantics, contrast, keyboard operation, focus, headings and mounted navigation pass. Spoken screen-reader validation remains unavailable. |
| Performance | 3/4 | 3/4 | Comparable baseline/final traces preserve single requests and responsive interactions; the particle observer race is fixed and covered. No controlled benchmark or comprehensive heap/listener audit. |
| Responsive behavior | 2/4 | 4/4 | Narrow/short/enlarged-text, normal/reduced motion, breakpoint/coarse-pointer and simulated keyboard recovery pass. Physical keyboard/device evidence is explicitly separate. |
| Theming | 2/4 | 4/4 | Actual light/dark surfaces, source states, painted contrast, fields, focus and reading frame verified. |
| Implementation integrity | 2/4 | 4/4 | State retention, abort/request identity, modal ownership, contextual headings, native feedback and mounted targets covered; required gates run and existing lint debt disclosed. |
| **Total** | **10/20** | **18/20** | **All A01–A09 passed; physical-device and spoken assistive-technology checks remain limitations.** |
## Rendered proof

- [Complete light reading](../../../output/narrative-remediation/01-light-reading.png) and [complete dark reading](../../../output/narrative-remediation/01-dark-reading.png).
- [390px light chat](../../../output/narrative-remediation/02-mobile-follow-up-light.png), [390px dark chat](../../../output/narrative-remediation/02-mobile-follow-up-dark.png), and [320px focus state](../../../output/narrative-remediation/04-narrow-focus.png).
- [1440×500 chat](../../../output/narrative-remediation/03-short-desktop-chat.png), [200% text header](../../../output/narrative-remediation/05-short-enlarged-text-header.png), and [200% text footer](../../../output/narrative-remediation/05-short-enlarged-text.png).
- [Simulated keyboard viewport at 200% text](../../../output/narrative-remediation/06-simulated-keyboard.png).
- [Capture metadata](../../../output/narrative-remediation/capture-metadata.json), [interaction trace](../../../output/narrative-remediation/interaction-trace.zip), [baseline interaction comparison](../../../output/narrative-remediation/baseline-interaction-comparison.json), and [test logs/metrics](../../../output/narrative-remediation/checks).
- [Theme measurements and two-fixture proof](2026-09-23-narrative-theme-report.md), [semantics and shared-modal evidence](2026-09-23-narrative-semantics-report.md).

Rendered badge text contrast is 5.785–11.589:1 in light mode and 4.750–10.253:1 in dark mode. Icons/borders share those foregrounds and exceed 3:1. The theme matrix includes 320px at 200% text without horizontal overflow. The real Inter and Source Serif 4 fonts were loaded in the final captures.

## Evidence boundaries

Browser evidence comes from local Chromium and emulated iPhone WebKit using synthetic jobs/SSE, authentication, journal, and feedback services. Keyboard height is simulated with VisualViewport; no physical handset or spoken screen-reader pass was available. DOM/axe/keyboard assertions do not substitute for those checks. Live TTS, journal persistence, production AI integration, deployment, and publication are not established by this work.

The [original v2 mockup package](../../../output/imagegen/narrative-remediation/README.md) and specification are included together in this worktree so their relative links remain usable. The generated evaluation files were copied into evidence where useful and restored in `data/evaluations`; they are not application changes.

## Current integration checkpoint — 2026-09-23

Source candidate: `051064c59cb0891ee47d6543c37fdf7a02650060`, after merging
master `3946e1ada5fda13d93d82c34719ce267881f9825`. The preservation commit
`2a855b8` retains the original 115-path work. The integration found a real WebKit
200%-text issue: suggested-question `transition-all` animated font-size and moved
the focused textarea beneath the simulated keyboard. Limiting that transition
to colors fixed it; all four keyboard regressions passed, followed by the entire
focused browser suite. No other new interface redesign was added.

| Current check | Result |
| --- | --- |
| Root unit tests on `051064c` | 2,017 passed, no failures/skips. |
| Narrative/follow-up/Saved Intentions browser suite | 42 passed across Chromium and handset WebKit, normal/reduced motion, 320/390/1440px, short/enlarged text and simulated keyboard. |
| Rendered accessibility | 15 passed on `051064c`. |
| Build and design gate | Passed again on `051064c`. |
| Unchanged adapter/deploy/journal gates after master merge | Adapter 17 pass / one Windows SIGTERM skip, deploy 11 pass, journal browser four pass. |
| Cloudflare lint and static accessibility | Passed; static advisory output remains distinct from rendered proof. |
| Full lint | 146 errors / 37 warnings, matching clean master. Only message difference is line numbering in an unchanged FollowUpChat hydration effect. |
| Full frontend suite | Not passing/completed. Journal-filter assertions failed; the first failure also reproduces on clean master. Stopped after confirmed failures; no unrelated journal remediation added. |
| Narrative quality gate | Local-composer fails on the Spanish sample, identically on clean master. No live provider was used or thresholds lowered in this integration pass. |
| Vision quality gate | No completed result yet; retained as a release gate, not inferred from unchanged source. |

Fresh capture ran successfully on the exact source candidate, against its owned
verification server: eight rendered states plus one continuous interaction trace.
Desktop light, 390px dark chat and the 200%-text simulated keyboard capture were
visually inspected. The images show the implemented app using synthetic services;
physical keyboard/device and spoken screen-reader validation remain unavailable.

Current local evidence is under
`C:/Users/htper/AppData/Local/Temp/tarot-integration-b3d08059115b417aa797f86583e7d874`:
`narrative-unit-final.txt`, `narrative-browser-final.txt`,
`rendered-accessibility.txt`, `narrative-frontend-full.txt`,
`master-journal-filter-baseline.txt`, `lint-comparison.json`, and
`narrative-current-captures/` (images, capture metadata and interaction trace).
Earlier image links and provider-quality claims above remain historical evidence;
they are not substituted for this candidate's incomplete full gates.

Fresh source review found no Critical narrative issue. This checkpoint is local:
no push, PR, merge to master, production migration or deployment occurred. Refresh
and verify the eventual combination of candidate branches before publication.
