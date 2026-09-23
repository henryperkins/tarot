# Narrative remediation acceptance evidence

Date: September 23, 2026. Workspace: `C:\Users\htper\.codex\worktrees\narrative-remediation\tarot`. Tests use the local Vite application at `http://localhost:5173` with intercepted APIs; they do not establish production or live-service behavior.

## Result and execution history

All 31 distinct acceptance cases have passing relevant executions across the full run and focused reruns. This is **not a single clean 31-test run**. The exact sequence was:

| Execution | Result | Artifacts under `C:\Users\htper\.codex\tmp\` |
| --- | --- | --- |
| Full acceptance suite, one worker, traces on | 26 passed, 5 failed; 14.4 minutes | `narrative-remediation-final` |
| A01/A05/coarse-pointer/A07 focused rerun after fixture and actionability corrections | 14 passed, 1 timed out; 6.5 minutes | `narrative-remediation-final-height-layer` |
| 390px normal-motion repeated lifecycle with a 90-second test budget | 1 passed; 1.1 minutes | `narrative-remediation-final-normal-lifecycle` |
| Explicit initial Ask/Continue focus assertion, desktop and 390px reduced-motion representatives | 2 passed; 35.1 seconds | `narrative-remediation-final-intent-focus` |

The full run's five failures were mobile cases: two normal-motion foreground/lifecycle cases waiting in Playwright's scroll action, a duplicate visible Draw selector at 980px, a simulated-keyboard scroll action before the viewport update settled, and a heading-mode toggle scroll action after resizing WebKit. The focused rerun resolved those paths; its remaining timeout occurred at the final reopen of the long 390px lifecycle case. The trace showed preceding actions succeeded and individual normal-motion WebKit click waits accumulated to the 60-second whole-test limit. That repeated lifecycle case now allows 90 seconds and passed without forced clicks or removed assertions.

The helper waits for the dialog's actual opening animation to finish and for two animation frames. Foreground assertions use native instant scrolling followed by a real `document.elementFromPoint()` check at the rendered control center, avoiding WebKit's automation scroll command waiting on stale emulated viewport bounds. Simulated keyboard cases wait until the dialog fits the updated visible viewport before interacting. Focus-mode controls are activated with native focus and Enter. The actual click, request-count, focus-loop, restoration, hidden-state, and hit-testing assertions remain in place.

Earlier fixture transport failures were corrected by blocking the application service worker during intercepted tests and allowing the actual request headers on the local SSE server. The fixtures intercept the current jobs/stream API, not the retired reading endpoint.

[Collected tests](checks/narrative-acceptance-collection.log): **17 Chromium desktop and 14 mobile WebKit**. Mobile cases carry `@mobile`, matching the repository configuration. Scoped ESLint and whitespace checks passed for the new suite and all three helpers. Whole-repository gates and shared-consumer regression results belong to the [integration report](../../docs/superpowers/plans/2026-09-23-personalized-narrative-remediation-report.md).

## A01–A09 checklist

| Case | Automated result | What was exercised |
| --- | --- | --- |
| A01 foreground | Pass | Actual center hit tests for close, suggestion, textarea, and send; real clicks; 320px, 390px, and desktop; normal and reduced motion. One active dialog and no extra reading generation during chat interaction. |
| A02 lifecycle | Pass | Tab/Shift+Tab loop, button/Escape/backdrop closes, hidden and boolean-inert closed DOM, absent closed dialog in the accessible snapshot, opener restoration including a 350ms delayed-focus check, narrative-heading fallback when the opener disappears, retained draft/history preference/messages/suggestions, and one in-flight response across close/reopen/resize. Browser history Back is exercised on mobile emulation. Initial Ask/Continue focus representatives are listed separately above. |
| A03 suggestions and submission | Pass | Native button roles and accessible names; Enter, Space, and pointer each submit once; scoped axe role/name/label rules; loading/authentication/server-limit guards; empty/whitespace input; Enter and Shift+Enter; synthetic IME composition guard; 500-character limit; failed-send draft retention and retry. Full original narrative and selected question remain in the payload. |
| A04 source status | Pass | Two metadata fixtures in both themes; six source rows, summary counts and details; used, requested-but-unused, skipped, and not-requested states; disclosure collapse/reopen; actual composited text and icon contrast. |
| A05 available height | Pass | Real long-message overflow at 1440×500, final message reachability, composer and history-row reachability, 200% root text, whole-dialog fallback, simulated 340px VisualViewport on both phone widths, rotation and resize recovery. Textarea and character counter rectangles do not overlap. |
| A06 feedback | Pass | Three initially empty native radio groups, one Tab stop per group, arrow navigation and Space selection, 44px label targets, exact payload fields/values, pending-submit guard, failed-submit ratings/notes retention, identical retry payload, and success status announcement. Desktop and mobile. |
| A07 headings | Pass | Preserved page h1, stable narrative h2/focus ID, five complete narrative sections, deeper Markdown levels through h6, supporting h2/h3 hierarchy, collapsed/expanded panels and focused mode across resize. Chat retains its default Markdown levels. Journal rendering and voice/section-offset checks are separate shared-consumer tests recorded in the integration report. |
| A08 targets and reflow | Pass | Close/send minimum 48×48 CSS pixels; suggestion, checkbox-row and radio-label minimum 44×44; narrow wrapping; no horizontal overflow at 320px and 200% text; visible focused controls. |
| A09 navigation | Pass | Every offered skip target is mounted, receives focus, and lands within the viewport in setup, partial streaming, completed reading, and focus mode. Hidden setup does not offer a spread skip link, and navigation does not restart generation. Desktop and mobile. |

The fixture includes all five narrative sections plus deeper headings, an authenticated Pro account, controllable real HTTP SSE streams, and request counters. The reference source fixture produces **3 used / 2 requested not used**; the alternate produces **2 used / 1 requested not used**. Both retain all six source rows and exercise different source combinations.

Actual text contrast minima were **5.7849:1 in light mode** and **4.7501:1 in dark mode** for both fixtures. Light caution measured 6.1526:1; dark caution 6.3825:1. Not-requested labels measured 11.589:1 light and 10.253:1 dark. Badges are opaque and their icons also exceed 3:1. Measurements are attached to the A04 traces; the complementary [theme verification data](theme/rendered-verification.json) includes labels, fonts, colors, and bounds.

## Rendered matrix

| Environment | Evidence |
| --- | --- |
| 1440×1000 Chromium | Complete reading in both themes; all five sections and deeper headings; expanded source/feedback panels; selected feedback is an explicit capture interaction, not a default. Chat, feedback, source and skip assertions. |
| 1440×500 Chromium | Normal/reduced-motion height tests; long-message middle scrolling; 200% text; reachable footer; continuous interaction trace. |
| 390×844 mobile WebKit | Both-theme chat captures; normal/reduced lifecycle and height cases; suggestions, feedback, headings and skip links. |
| 320×740 mobile WebKit | Normal/reduced lifecycle and height cases; narrow focused composer; 200% text and simulated keyboard reachability. |
| 768px / 769px | Chromium crosses the existing width breakpoint while preserving one active dialog, draft, history preference, suggestions, and in-flight response. |
| 980×800 coarse pointer/no hover | Mobile WebKit verifies the existing handset rule and usable chat controls. |

Captured states:

- [Complete light reading](01-light-reading.png) and [complete dark reading](01-dark-reading.png).
- [390px light follow-up](02-mobile-follow-up-light.png) and [390px dark follow-up](02-mobile-follow-up-dark.png), with a focused suggestion and empty composer.
- [1440×500 short chat](03-short-desktop-chat.png), showing actual suggestion overflow and the complete footer.
- [320px focused composer](04-narrow-focus.png).
- [200% text header](05-short-enlarged-text-header.png) and [scrolled 200% text footer](05-short-enlarged-text.png).
- [Simulated keyboard with 200% text](06-simulated-keyboard.png), clipped to the simulated 340 CSS-pixel visible area. The counter is below the textarea.

[Capture metadata](capture-metadata.json) confirms the selected theme, actual loaded Inter Variable and Source Serif 4 Variable fonts, one reading request per scene, no page errors, and no failed HTTP resources in all eight captured states. Recorded warnings are the intentional blocked service worker/reduced-motion notices and unsupported headless audio; this is not audio playback proof. The light whole-frame colors and enlarged counter were inspected after the corresponding application fixes.

## Interaction trace and baseline

[Final continuous trace](interaction-trace.zip) covers opening chat, submitting a question, a partial SSE response, closing while it is in flight, completing the same response while closed, reopening, scrolling older/newer messages, and resizing to handset then short desktop. [Trace inspection](interaction-trace-inspection.json) records exactly **one jobs POST and one follow-up POST**, with no failed actions. The captured desktop open/close/reopen commands took approximately 1216/117/151ms and the two resize commands 184/25ms, including Playwright waits. These numbers are not a runtime benchmark, physical-device latency measurement, or proof of listener/heap behavior. The final trace was refreshed after the last ParticleLayer lifecycle fix; the eight existing font-verified image states were preserved.

A [comparable baseline trace](baseline-interaction-trace.zip) was captured against clean commit `7e9170fb2b64184a6225940f4cbef7b9e92caced` in `C:\Users\htper\tarot-pr74`, using a separate temporary Vite server on port 5176. Both traces use Chromium, normal motion, an initial 1440×500 viewport, the same synthetic jobs/SSE reading and follow-up response, then 390×844 and back to 1440×500. One baseline capture was sufficient; no fixture retry, forced click, alternate submit, or baseline source edit was needed. The temporary server was stopped, and the baseline checkout remained clean.

The [compact comparison](baseline-interaction-comparison.json) and [full observations](baseline-interaction-observations.json) distinguish preserved behavior from observed defects:

| Observation | Clean baseline | Remediated evidence |
| --- | --- | --- |
| Requests and response retention | One jobs POST and one follow-up POST. The response survived close/reopen and both resizes. | Same request counts and successful continuous flow; A02 also checks retained draft/preferences/messages. |
| Message scrolling | Real log scroll position moved from 0 to 524. | Both trace wheel actions complete; A05 verifies real middle overflow and reachable final content. |
| Closed dialog | Still connected with `inert === false`; the required inert assertion failed. React also warned about the empty-string boolean attribute. | A02 verifies boolean inert, hidden/accessible state and focus restoration. |
| Short desktop footer after reopening | Dialog bottom was 460.5px with `overflow-y: hidden`; textarea bottom was 527.1px and history-row bottom 606.1px. Both centers failed hit testing. | Final trace textarea hit test passes after returning to the short viewport; A05 verifies the complete composer/history controls. |
| Resized 390px chat | One dialog and retained response existed, but close, textarea, send and history centers all failed hit testing because the reading painted above the drawer. | Final continuous resize retains one active dialog; A01 passes real foreground hit tests at 320px and 390px in both motion modes. |
| Control size | Desktop close was 34×34px, send 52×40px and history row 24px high. | A08 verifies 48×48px close/send and at least 44px history labels. |

The [baseline short-dialog response screenshot](baseline-short-desktop-response.png) shows the clipped composer/footer; the [baseline handset-resize screenshot](baseline-handset-resize.png) shows the reading above the chat. An [initial baseline short-dialog screenshot](baseline-short-desktop-open.png) is also included. Baseline Inter and Source Serif fonts loaded; page errors and failed HTTP resources were both zero. The failed inert assertion is retained as a product failure, while geometry/hit observations expose the additional height/layer defects. These paired local traces are qualitative runtime comparison, not repeated performance measurements or a listener/heap audit.

Pre-fix failures reproduced before the relevant implementations landed:

- Closed chat had `inert === false` after a valid reading/open/close flow: `C:\Users\htper\.codex\tmp\narrative-remediation-baseline`.
- Light used-state badge contrast measured approximately **2.507:1** in the rendered fixture; there were zero native feedback radio inputs; the narrative h2 was absent; and a spread skip link targeted unmounted content: `C:\Users\htper\.codex\tmp\narrative-remediation-baseline-semantics`. A portable [baseline source panel](theme/baseline-light-source-panel.png) and [measurement](theme/baseline-light-source-panel.json) are included.
- No mobile foreground case was captured during the initial red/green implementation sequence. The later clean-baseline Chromium resize comparison above reproduces the foreground failure without changing the baseline checkout.

## Reproduction and limits

```powershell
npx playwright test e2e/narrative-remediation.spec.js --workers=1 --reporter=line --trace=on
npx playwright test e2e/narrative-remediation.spec.js --workers=1 --reporter=line --grep='A01|A05|coarse-pointer|A07' --trace=on
npx playwright test e2e/narrative-remediation.spec.js --workers=1 --project=mobile --reporter=line --grep='foreground.*390px no-preference' --trace=on
node e2e/helpers/captureNarrativeRemediation.mjs
# With the clean baseline already served on temporary port 5176:
node e2e/helpers/captureNarrativeBaseline.mjs
```

The [suite](../../e2e/narrative-remediation.spec.js), [jobs/SSE fixture helpers](../../e2e/helpers/narrativeFixtures.js), [final capture script](../../e2e/helpers/captureNarrativeRemediation.mjs), and [baseline capture script](../../e2e/helpers/captureNarrativeBaseline.mjs) contain the reproducible checks. A final trace-only capture can set `NARRATIVE_CAPTURE_TRACE_ONLY=1`; it preserves existing image metadata. The final image capture script deliberately selects the theme through the application's persisted preference and uses actual loaded fonts.

No physical handset, hardware Android Back button, spoken screen reader, live AI, TTS, journal persistence, or production deployment was verified here. VisualViewport and IME-composition checks are explicitly simulated. Accessible roles, names, focus and status nodes were verified through browser automation; that does not substitute for a spoken assistive-technology pass. Full accessibility certification, complete runtime leak profiling, and a numeric re-audit score are outside this acceptance report.
