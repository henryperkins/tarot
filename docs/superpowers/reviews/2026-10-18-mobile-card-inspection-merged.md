# Mobile card inspection review

Date: October 18, 2026

The card references help readers connect a passage to their spread, but inspecting them on a phone takes too many steps. Two failures take priority: adjacent-card navigation can make the inspector invisible with motion enabled, and dismissing the inspector while Symbols is open can leave the reading unable to scroll.

Use one handset inspector with persistent identity and return controls, stable artwork, readable inline Symbols, and deliberate navigation. Preserve the full artwork, explicit reversed orientation, and the return to the original passage.

This is the consolidated review. It incorporates the earlier local review and the supplied merged audit, preserves finding IDs F-01 through F-16, and does not authorize or implement application changes.

## Evidence and source identity

| Source | Scope | Evidence status |
| --- | --- | --- |
| Original local review | Two independent design and browser assessments at `ac14077e`; supplied iPhone screenshots; Chromium at 390×700 and 320×568; WebKit Pro at 390×700; reduced motion | Browser artifacts are available locally. Real local Pro authentication was verified; guest used a separate cookie-free context with a fixture-controlled guest auth response. |
| Supplied review | Runtime audit and separate source/screenshot review at `ec484808f885229e89195c6ec61b9d8df7f9e707`; Chromium and WebKit phone profiles from 320–430px, landscape at 874×360, desktop at 1280×800, motion, slow images, contrast, and synthesized gestures | Results are imported from the supplied report. Its referenced run ledger, harness, and raw evidence folder were not attached to this merge. They were not independently rerun here. |
| Merge checks | Source comparison anchored at `ec484808f885229e89195c6ec61b9d8df7f9e707` | Twelve relevant component, hook, style, motion, and test files are byte-identical between the two review commits. Source identity supports combining the findings; it does not make the browser runs identical. |

Evidence labels used below:

- **Local observation:** reproduced in the original local browser review.
- **Supplied observation:** runtime result reported by the supplied audit.
- **Screenshot:** visible in the three user-provided iPhone images.
- **Code:** supported by source inspection.
- **Recommendation:** a proposed improvement rather than a reproduced defect.

The original review and its 22/40 qualitative score remain a historical snapshot of its smaller scope. That score has not been carried forward as a rating of this broader review.

## Principal journey

| Step | Current behavior | Health | Findings |
| --- | --- | --- | --- |
| 1. Find a card beside a passage | Two compact figures show artwork, role, name, and orientation | Useful, but labels fragment at narrow widths | F-10 |
| 2. Activate the reference | The thumbnail opens details; its caption is outside the button | Works, but the apparent row is only partly interactive | F-14 |
| 3. Inspect the selected card | Artwork comes before identity; an 80dvh panel scrolls its controls away | Cramped, especially on short screens and in landscape | F-05, F-08, F-13 |
| 4. Explore Symbols | Expand Symbols, find Card symbols, then open a separate sheet | Excess navigation, small text, and conflicting modal ownership | F-03, F-04, F-07, F-09, F-12, F-15 |
| 5. Browse adjacent cards | Prev/Next or a swipe navigates the revealed spread | Broken in the reported motion-enabled path; gestures can misfire | F-01, F-06, F-16 |
| 6. Return to reading | Closing normally restores the reference and reading position | Works through the ordinary close sequence; fails when both nested layers close together | F-02 |

## P1 failures

### F-01 Adjacent navigation makes the dialog invisible

**Evidence:** Supplied observation in Chromium and WebKit at 402×724, plus desktop Chromium. The original local review used reduced motion and did not exercise this branch.

With motion enabled, Next, Previous, or a swipe reportedly leaves the backdrop and panel at computed opacity 0 after roughly 240ms, persisting for at least 1.5 seconds. The dialog remains mounted and the page remains locked; pointer hits still land on its invisible content. Further navigation accumulates paused animations. Before the persistent failure, the full entrance animation also replays, briefly revealing the reading behind it.

The supplied animation trace reports paused animations at time 0 retaining the initial opacity. Code inspection confirms that the entrance effect depends on `card` and its cleanup calls `.pause()`. The trace, rather than an independent runtime check during this merge, supports the detailed animation diagnosis. See [CardModal.jsx](../../../src/components/CardModal.jsx).

Run the entrance animation when the inspector opens. If card changes animate, transition the content without restarting the backdrop. Review cancellation and cleanup in both the entrance effect and `CollapsibleSection`; do not leave completed animations retaining obsolete initial values.

**Acceptance:** With motion enabled, browse forward, backward, and with a deliberate artwork swipe. Check computed opacity and retained animations after settling, in both engines and on a device. The content must remain visibly painted and interactive.

### F-02 Dismissing both nested layers freezes the reading

**Evidence:** Local observation in Chromium Pro and guest, and WebKit Pro; independently reported by the supplied audit. Escape and browser history navigation were exercised. Physical Android Back and the iOS edge gesture remain untested.

Opening Symbols and then dismissing the card leaves no visible inspector but retains `position: fixed`, a negative `top`, and `overflow: hidden` on the body. Chromium wheel input and the WebKit direct-scroll diagnostic cannot advance the reading. Closing the Symbols sheet with its X first and then closing the card restores normal scrolling.

The parent owns a fixed body lock through `useModalA11y`; the sheet takes a second, independent simple lock. During simultaneous cleanup, the sheet can restore the locked styles it captured from the parent. See [CardSymbolInsights.jsx](../../../src/components/CardSymbolInsights.jsx), [useModalA11y.js](../../../src/hooks/useModalA11y.js), [useBodyScrollLock.js](../../../src/hooks/useBodyScrollLock.js), and [ReadingOverlays.jsx](../../../src/components/reading/ReadingOverlays.jsx).

Prefer removing the nested Symbols dialog. If it remains, register it with shared modal ownership, avoid a second document lock, and give its Back behavior the correct place in the stack.

**Acceptance:** Exercise X, backdrop, Escape, and history Back with Symbols open. Verify which layer closes, restored body styles, working scroll, and focus on the original reference. Confirm native Back and edge gestures separately.

## P2 interaction and readability findings

### F-03 The Symbols sheet cannot own keyboard focus

**Evidence:** Local observation in Chromium and WebKit, plus supplied observation. When the sheet opens, focus returns to Previous or Next in the parent. Six local Tab presses cycle through parent controls without reaching the sheet's Close button. Both dialogs remain exposed in the accessibility tree.

The body's portal is outside the parent dialog, whose focus trap remains active. Fix the visible layer's focus and dismissal ownership along with F-02. This is a keyboard-focus defect relevant to WCAG 2.4.3; VoiceOver and TalkBack behavior has not been established.

**Acceptance:** Focus enters the visible sheet, Tab remains inside it, dismissal affects the intended layer, and focus returns to the trigger. Verify with assistive technology separately.

### F-04 Symbols requires redundant disclosure and hides its visual reference

**Evidence:** Local and supplied observations, screenshots, and code.

The path is card viewer → Symbols disclosure → Card symbols button → second dialog. In the supplied audit, the newly revealed button sits 28–29px below the visible panel edge on narrower phones and about 10px below it at 430px, so expansion initially changes only the chevron. The second backdrop obscures the artwork while the explanations refer to details such as “above” or “on head.”

The sheet repeats the name, orientation, and keywords but omits the spread role. Local text measures 12px for substantive explanations, versus 14px for its title; the supplied audit reports 11–14px across styles. The body portal escapes the full inspector's larger text treatment. Spatial labels can also describe upright artwork while the displayed image is reversed.

Use one inline Symbols disclosure in the inspector's scroll region. Keep the artwork available for comparison, retain the spread role, remove unnecessary repeated keywords, use the established body scale, and make spatial descriptions unambiguous for the displayed orientation. See [CardSymbolInsights.jsx](../../../src/components/CardSymbolInsights.jsx).

**Acceptance:** One tap exposes explanations; enlarged text remains usable; artwork and explanations can be compared without another backdrop.

### F-05 Identity and return controls disappear while inspecting

**Evidence:** Local and supplied observations, screenshots, and code.

At 390×700, the local header wraps to 104px and the full artwork puts meaning and Symbols below the initial view. Scrolling to the Symbols trigger places the header entirely above the viewport of the panel. The supplied audit reports the same pattern at 320–430px; at 874×360, the panel is 288px tall and the name appears about two panel-heights down.

The supplied audit also reports that the inspector retains its internal scroll offset across Next, showing a new card part-way down. The reading's own scroll position and the inspector's internal offset are separate concerns.

Below `sm`, use a near-full-height presentation with one set of safe-area insets. Put name, orientation, and spread role before the artwork; keep Back and navigation outside the scrolling content or sticky. Reset the inspector to its new card's top without moving the reading. A default artwork height around 45dvh is a design starting point to validate, not a fixed requirement. See [CardModal.jsx](../../../src/components/CardModal.jsx).

**Acceptance:** At 320, 360, 390, 402, and 430px, in landscape and with enlarged text, identity and return remain reachable. Browse after scrolling and verify the new card starts predictably.

### F-06 Scrolling and sheet gestures can navigate the card

**Evidence:** Supplied observation from synthesized Chromium CDP touch events, supported by code. A flick with dx −70px, dy −261px over 84ms changed the card. A 242px swipe on the Symbols sheet changed the card behind it and replaced the sheet's content. These are emulation results, not physical gesture evidence.

The current handler checks only horizontal distance greater than 50px within 300ms across the whole panel. It does not track vertical displacement, a specific touch, cancellation, or multiple touches. Portal events can reach the parent's handlers. See [CardModal.jsx](../../../src/components/CardModal.jsx).

Keep explicit Prev/Next. Limit any optional swipe to the artwork, track one touch, require clear horizontal intent, and cancel on multi-touch, selection, cancellation, controls, or a start outside the intended surface. A horizontal-to-vertical ratio of 1.5 is the supplied design proposal and needs device validation.

**Acceptance:** A deliberate artwork swipe moves exactly one card. Vertical, diagonal, slow, cancelled, multi-touch, selection, and edge gestures do not change cards. Preserve scrolling and pinch zoom.

### F-07 Supplementary Symbols text has reported contrast failures

**Evidence:** Supplied computed-color measurements composited over the sheet surface in Chromium at 402px. These ratios were not remeasured during the merge. The original review measured text size but made no contrast claim.

| Theme | Reported contrast ratios below 4.5 to 1 |
| --- | --- |
| Light | Symbol positions 2.53; element badge 2.60; palette meaning 3.05; keywords and section heading 3.74; archetype and orientation 4.22 |
| Dark | Symbol positions 4.08; element badge 4.47 |

At the reported 11–12px sizes, these are failures under the supplied audit's WCAG 1.4.3 assessment. That audit measured the main card text at 7.46–13.82:1 in both themes. Use solid semantic text colors and readable sizing, then remeasure; increasing ordinary body text to 14px alone does not remove the contrast requirement.

This consolidated review retains the supplied P2 classification for supplementary content. The supplied Impeccable severity rubric would classify an AA failure as P1; the difference is prioritization, not a passing result.

### F-08 Slow artwork loading creates layout shifts and a card identity mismatch

**Evidence:** Supplied observation in Chromium at 360×740, 2× density, with image requests delayed 2.5 seconds and reduced motion.

On first open, the image reportedly has zero height until loading, then grows to about 365px and moves the title from y=380 to y=625. After Next, the new heading can remain above the previous card's artwork until the new scan arrives; applying the new rotation to the old image also misrepresents its orientation.

This narrows any blanket claim that navigation has no stale content: meaning and Symbols recompute, but the artwork can lag. The original local review did not test delayed images. In full mode, code gives the image no reserved ratio or dimensions, loads it lazily, and reuses the element across cards. See [CardModal.jsx](../../../src/components/CardModal.jsx).

Reserve the frame ratio and dimensions, ensure the visible art belongs to the selected card, and use an appropriate eager loading and decoding strategy. The supplied cached-WebP-first/full-scan-later proposal should be validated against actual cache availability and identity. A per-card image key is a candidate safeguard, not proof of acceptance on its own.

**Acceptance:** Under throttled loading, identity and layout stay stable, the previous card's art never appears beneath a new name, and displayed rotation matches the visible card. Fix this before removing preload behavior under F-11.

### F-09 Wide touch viewports can immediately close the Symbols popover

**Evidence:** Supplied observation in touch-enabled Chromium at 874×360. A tap opens through mouseenter and then closes through click-toggle, leaving nothing visible. iOS behavior and desktop clipping were not verified.

The component chooses mobile behavior at 640px by viewport width and enables hover opening on the other branch. Nested overflow containers also create a code-supported clipping risk. Choose hover behavior by input capability and keep explicit tap behavior reliable, or remove this branch from the inspector by showing Symbols inline. See [CardSymbolInsights.jsx](../../../src/components/CardSymbolInsights.jsx).

**Acceptance:** Symbols remains available on wide touch screens, tablets, and phone landscape. Check fine-pointer hover separately.

## P3 presentation and supporting improvements

### F-10 and F-14 References fragment names and expose only part of the row as an action

**Evidence:** Screenshots show “The Em- / press”; the local 390px render repeats the problem with “Temperance.” The supplied audit reports other fragments at 360px. Code puts only the artwork inside the button.

The original review grouped these as P2. This report adopts the supplied P3 classification: the 60×103px thumbnail already meets the project's touch-target size, while readability and affordance still deserve repair alongside the inspector work. Caption exclusion is not a claim that the thumbnail is too small.

Use full-width compact rows at narrow widths, wrap names at word boundaries, and make artwork plus caption one action with one keyboard stop. See [ReadingSpread.jsx](../../../src/components/reading/narrative/ReadingSpread.jsx) and [reading-screen.css](../../../src/styles/reading-screen.css).

**Acceptance:** Caption taps open the same card, enlarged names remain readable, and scrolling over a reference does not activate it.

### F-11 The collapsed overview downloads unnecessarily large scans

**Evidence:** Supplied observation on 3× phone profiles. All ten overview images reportedly load 825px JPEGs while the disclosure is closed, about 3MB per reading versus roughly 0.6MB for the compared WebPs. These are the supplied fixture's transfer estimates, not field performance measurements.

The reported `sizes` declaration overestimates rendered card width, and images load eagerly inside closed details. Correct responsive sizing and defer hidden work after F-08 is fixed: the current preload can mask stale-artwork behavior on high-density screens. See [ReadingSpread.jsx](../../../src/components/reading/narrative/ReadingSpread.jsx).

**Acceptance:** Record selected sources and transfer sizes at fixed viewport and density, with the overview closed and opened. Confirm that inspection remains stable with cold or slow image requests.

### F-12 The drag handle promises an unavailable gesture

**Evidence:** Screenshot and original code review, plus supplied emulation where dragging down leaves the sheet open. Remove the handle unless drag-to-dismiss is supported. Removing the nested sheet under F-04 may resolve this without another gesture.

### F-13 Landscape insets consume space inside a centered panel

**Evidence:** Supplied emulation with a 59px safe-area override. The centered panel reportedly applies 59px on both sides while the outer edge container uses 16px, leaving a 330px content column. This does not establish behavior on a real notched device.

Apply edge insets once at the edge frame, rather than repeating full notch padding inside a panel already away from the screen edge. Validate the final frame on an actual landscape device. See [CardModal.jsx](../../../src/components/CardModal.jsx).

### F-15 Symbol truncation can omit an important part of the meaning

**Evidence:** Recommendation from the supplied audit, with the truncation and annotation confirmed in source during the merge. `buildCardInsights` keeps only the first three symbols. For Ten of Swords, this omits “dawn light — new beginning coming” while the reversed meaning includes “slowly rising again.”

Provide a way to reveal the complete curated symbol list or choose a defensible summary that preserves the card's meaning. Avoid presenting the first three entries as comprehensive. This is an editorial recommendation, not evidence that the drawn card or orientation is wrong. See [cardInsights.js](../../../src/lib/cardInsights.js) and [symbolAnnotations.js](../../../shared/symbols/symbolAnnotations.js).

### F-16 The counter does not identify its navigation scope

**Evidence:** Screenshot and code in both reviews. A passage shows two referenced cards, while its inspector says “1 of 10” because navigation follows the revealed spread order. No wrong-card selection was established.

Label the sequence, for example “Card 1 of 10 · Your spread.” Preserve the original reference as the return target after browsing rather than moving focus to the last inspected card's source. See [useReadingSelection.js](../../../src/hooks/useReadingSelection.js).

## Recommended repair order

1. **Restore visible navigation and safe dismissal.** Address F-01, F-02, and F-03. Verify motion on and off, visible painting after card changes, top-layer ownership, and scrolling after every dismissal route.
2. **Consolidate the handset inspector.** Address F-04, F-05, F-07, F-09, F-12, and F-13 with one disclosure surface, persistent controls, identity before art, readable text, and one set of insets. Preserve larger-screen behavior except where the same defect applies.
3. **Make artwork and gestures reliable.** Address F-08 and F-06 under slow loading and touch input. Then reduce hidden image work under F-11; reversing that order exposes the currently masked artwork defect.
4. **Improve entry references and explanation.** Address F-10, F-14, F-15, and F-16 in the same scoped pass where practical.

The intended flow is: tap artwork or caption → one inspector with identity, meaning, full artwork access, and inline Symbols → browse intentionally → return to the original reference with functioning scroll. Existing passage text can provide context without generating another interpretation.

## Verification coverage and test gaps

| Scenario | Consolidated evidence | Remaining acceptance |
| --- | --- | --- |
| Ordinary close and original opener | Local and supplied observations support focus restoration; ordinary close permits scrolling | Preserve the path after browsing. Local Chromium measured a 6px offset difference in the nested X-then-parent control case; WebKit restored exactly, so do not generalize exact pixel parity across every engine and route. |
| Nested Escape and history Back | Both reviews reproduce frozen scrolling; local Pro and guest plus WebKit Pro | Physical Android Back, iOS edge swipe, and all final close routes |
| Sheet focus | Both reviews reproduce focus behind the sheet; local Tab trace confirms inaccessible sheet Close | VoiceOver and TalkBack |
| Adjacent navigation with motion | Supplied audit reports invisible inspector in both engines and desktop | Reproduce against the repair with computed opacity and animation-state assertions |
| Small phones and landscape | Supplied 320, 360, 402, 430px and landscape profiles; local 390px and 320px captures | 375px, enlarged text, physical rotation, browser toolbar changes |
| Swipe intent | Supplied Chromium synthesized flick and sheet-swipe failures | A deliberate one-card swipe, WebKit gestures, cancellation, selection, pinch, multi-touch, and native edges |
| Slow and missing art | Supplied delayed-image layout shift and stale art; image-failure status is code-supported | Exercise missing art, cold cache, background/resume, and final responsive source selection |
| Text and controls | Local 12px sheet text and 44×44px Close; supplied contrast ratios in both themes and passing target dimensions | Remeasure final colors and enlarged text; do not infer full WCAG conformance |
| Entitlements | Original local real Pro active plus isolated guest; supplied runtime used mocked fixtures | Signed-in Free, Plus, and inactive tiers when the changes affect their behavior |

Code inspection during the merge confirms the important test distinction:

- [playwright.config.js](../../../playwright.config.js) defaults to reduced motion, but [playwright.reading-purpose.config.js](../../../playwright.reading-purpose.config.js) includes motion-enabled projects. It is inaccurate to say the repository only tests reduced motion.
- The extended reading matrix includes navigation coverage in [spread-insights.spec.js](../../../e2e/spread-insights.spec.js). Its existing navigation assertions check text, attributes, and disabled state without a computed-opacity assertion. The supplied audit reports that visibility assertions did not detect opacity 0.
- Direct card-touch close coverage does not establish nested Symbols dismissal or delayed artwork behavior. Programmatically focusing Back can scroll it into view and does not establish persistent availability during ordinary touch scrolling.
- Required regression assertions cover visible opacity after navigation, retained animation state, body-style cleanup, restored focus and scroll, direction-aware gestures, inspector offset reset, and slow-image identity.

This merge ran no browser suites or model calls. It checked source identity, relevant implementation and test configuration, documentation links, and preservation of the original review.

## Evidence files and reconciliation notes

- [Original local review](../../../.impeccable/critique/2026-10-18T14-47-34Z__src-components-cardmodal-jsx.md), preserved unchanged.
- Supplied review (`../../../output/playwright/card-selection-review-20261018/supplied-review-2026-10-18.md`, local artifact), preserved verbatim. Its A/B labels refer to its own runtime and source reviewers, not the original review's two local agents.
- Source comparison (`../../../output/playwright/card-selection-review-20261018/merge-provenance.json`, local artifact), including hashes for the twelve compared files and both input reports.
- Local Chromium nested-dismissal results (`../../../output/playwright/card-selection-review-20261018/nested-observations.json`, local artifact), local WebKit results (`../../../output/playwright/card-selection-review-20261018/nested-webkit-observations.json`, local artifact), and initial browser observations (`../../../output/playwright/card-selection-review-20261018/browser-observations.json`, local artifact).

The supplied audit adds the motion failure, synthesized gesture failures, measured contrast, delayed-artwork behavior, wide-touch popover failure, and responsive-image downloads. It reinforces the independently reproduced nested-lock and focus defects. Its F-10/F-14 severity is adopted with the reason recorded above. Its 375/390px coverage gap is narrowed by the original local 390px run; 375px and enlarged text remain open.

The supplied warning that the main checkout had Tailwind 3.4 is historical. At merge time, installed `tailwindcss` and `@tailwindcss/postcss` are both 4.3.3 and match the declared `^4.3.3` ranges. No dependency repair was performed, and that current check does not establish the dependency versions used by an earlier run.

Mechanical scans are also scoped separately: the original three-component scan returned no findings; the supplied audit reports twelve advisory hits in `reading-screen.css`. Neither result overrides the runtime failures.

Neither review establishes physical-device gestures, assistive-technology acceptance, field performance, or production version parity. Only this review document and local evidence copies were added; application source, existing dirty work, Git integration, and deployment were left untouched.

> Portability note (23 October 2026): local evidence paths above identify artifacts on the original review host. Those files are not included in this Git handoff. Repository source links are relative.
