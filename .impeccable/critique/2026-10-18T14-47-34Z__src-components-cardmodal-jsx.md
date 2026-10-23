---
target: Mobile card selection within a reading
total_score: 22
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/home/ubuntu/tarot/src/components/CardModal.jsx"
target_fingerprint: "sha256:39f5b561ebecb833cab762bd8f69edda221258be77432ef5f33bdae209d3d76c"
target_path: /home/ubuntu/tarot/src/components/CardModal.jsx
timestamp: 2026-10-18T14-47-34Z
slug: src-components-cardmodal-jsx
---
Method: dual-agent (A: /root/card_flow_design; B: /root/card_flow_browser).

# Mobile card-selection review — 2026-10-18

The card artwork and Tableu's quiet visual style work well. A brief inspection takes too many steps, and nested dismissal can leave the reading unable to scroll. Repair interaction ownership first, then simplify the viewer.

## Scope and evidence

- User-supplied iPhone screenshots: the in-reading card pair (Photo 3), full card viewer (Photo 1), and Symbols sheet (Photo 2). Exact copies are in `output/playwright/card-selection-review-20261018/provided-*.jpg`.
- Current primary-checkout source: `ac14077e`, with pre-existing unrelated dirty journal/export/config work preserved. This review made no application-source changes.
- Current source UI served through local Vite on port 5178; local Worker authentication on port 8787. Controlled synthetic narrative delivery through `createNarrativeFixture`; no new model-generated reading was required.
- Real local Pro session verified through `/api/auth/me` (tier pro, status active), with a separate cookie-free guest context whose guest auth response was fixture-controlled. Chromium viewports 390x700 and 320x568; reduced motion and touch emulation. WebKit 390x700 Pro independently covered all three close paths; `nested-webkit-observations.json` records the results. Browser Back was exercised through history navigation, not a physical edge gesture.
- Assessment A independently inspected supplied photos, DESIGN.md, source, and three current-render captures. Assessment B independently exercised browser behavior and ran the scoped detector. Findings were synthesized only after A's initial assessment finished.
- Current captured sample cards differ from the supplied reading. Reproduced defects are distinguished from the exact supplied iPhone content; local emulation does not establish live-deployment parity.

## Flow

| Step | Health | Evidence |
| --- | --- | --- |
| 1. Tap a card beside a passage | Needs refinement | Photo 3; `pro-390-inline.png`; `ReadingSpread.jsx:8-24` |
| 2. Inspect the selected card | Understandable, cramped on short screens | Photo 1; `pro-390-card.png`; `pro-320-card.png` |
| 3. Expand Symbols and open Card symbols | Excess navigation; keyboard focus fails | Photo 2; `pro-390-symbols-expanded.png`; `pro-390-symbol-sheet.png` |
| 4. Return to the reading | Fails for simultaneous nested dismissal | `pro-390-after-escape.png`; `nested-observations.json` |

## Priority findings

### 1. P1 — Nested dismissal can freeze the reading and bypass the active sheet

Chromium Pro and guest sessions and WebKit Pro sessions reproduce the same problem: opening the Symbols sheet and then pressing Escape once or browser Back dismisses the two visible overlays but leaves body `position: fixed` and `overflow: hidden`. A subsequent Chromium wheel attempt or WebKit direct-scroll diagnostic does not move the reading. Closing the sheet with its X first, then closing the card viewer, restores normal scrolling.

The sheet also cannot own keyboard focus in Chromium or WebKit. Focus is redirected to the parent viewer's Next card control; six Tab presses cycle through parent controls and do not reach the sheet's Close button. This is a confirmed keyboard interaction defect. Screen-reader behavior remains untested.

Code supports the observed mechanism: the card viewer uses `useModalA11y` with a fixed body scroll lock, while the Symbols portal manages a separate focus trap and simple body lock. The parent trap continues to treat the sheet as outside its container. See `src/components/CardModal.jsx:195`, `src/components/CardSymbolInsights.jsx:177`, `src/hooks/useModalA11y.js:150`, and `src/hooks/useBodyScrollLock.js:43`.

Recommendation: give the visible layer one focus, dismissal, and scroll owner. A single card inspector containing inline symbol explanations would remove the conflicting nested layer. If nesting remains, register the sheet with the existing modal ownership system and avoid a second independent body lock. Acceptance must cover X, Escape, Back, scroll recovery, and opener focus.

### 2. P2 — Symbols is an unnecessary detour and becomes harder to read

The current path is card viewer → Symbols disclosure → Card symbols button → separate sheet. Photo 2 and the current capture show the artwork blurred while descriptions refer to its details. The sheet's explanatory text renders at 12px, much smaller than the reading. Its body portal also escapes the full viewer's typography enlargement.

Recommendation: place symbol explanations directly in the card inspector behind one disclosure, keep the artwork available, and use the established mobile reading scale for substantive explanations. Preserve the existing original artwork and orientation. The sheet's decorative drag handle has no drag-dismiss implementation in this component; either support the promised gesture or remove that cue.

Sources: `CardModal.jsx:489-493`; `CardSymbolInsights.jsx:115-165,177-261,431-442`.

### 3. P2 — The viewer spends its initial height before reaching meaning

At 390x700, Prev/Next and Back to reading wrap into a 104px header, and the full image places the meaning and Symbols below the initial view. After scrolling to the Symbols trigger, the header is entirely above the viewer's visible bounds (measured top -118px, bottom -13px). Photo 1 shows the same pressure, with Symbols at the bottom edge.

Recommendation: keep a compact identity/return row visible, with the card's position, orientation, and short meaning easy to reach. Preserve full artwork access, but fit its default presentation to short viewports. Let the detail content scroll beneath the persistent return control.

Source: `CardModal.jsx:330-415`.

### 4. P2 — Passage cards are squeezed and only partly interactive

Photo 3 splits The Empress mid-word. The current 390px capture repeats the issue with Temperance. The image is the button; the adjacent name, position, and orientation are outside its target. This makes the entire composition look like a captioned illustration even though readers can inspect it.

Recommendation: make each image-and-label group one coherent target. Stack the card groups before narrow columns require internal word breaks. Preserve position and reversed/upright labels and provide a restrained visible inspection cue.

Sources: `src/components/reading/narrative/ReadingSpread.jsx:8-24,49-54`; `src/styles/reading-screen.css:144-152`.

## Strengths to preserve

- Recognizable full artwork, correct reversed presentation, and the established dark reading-room identity.
- Position, card name, orientation, and a short meaning within the card viewer.
- Useful Prev/Next, count, and Back to reading labels.
- The sheet's Close target measures 44x44px; its visual size is not the keyboard failure.

## Design rubric

These are qualitative review scores, not measured accessibility conformance.

| Heuristic | Score / 4 | Reason |
| --- | --- | --- |
| System status | 3 | Card count, orientation, and selected context are clear. |
| Match to real world | 3 | Familiar card artwork and labels. |
| User control | 1 | Nested dismissal can lock the reading. |
| Consistency | 2 | Parent and child overlays use different interaction ownership. |
| Error prevention | 2 | Some dismissal paths have unintended consequences. |
| Recognition | 2 | Split names and blurred reference artwork increase recall. |
| Efficiency | 2 | Duplicate disclosure before the symbol content. |
| Minimalism | 3 | Visual style remains restrained. |
| Recovery | 1 | A closed overlay can leave the underlying page locked. |
| Help and explanation | 3 | Useful explanatory content is present but too small. |

Total: 22/40. No heuristics marked not applicable. P0: 0; P1: 1 grouped finding; P2: 3 grouped findings.

Cognitive load is moderate: related information is separated across layers, and users must remember the image while reading its symbols. The emotional journey starts with useful curiosity and becomes a reference lookup detour. It should end at the same readable passage with working scroll.

## Recommended direction

Tap the card image or its label → one inspector with persistent return, identity, meaning, full artwork access, and inline Symbols → return to the same passage with restored focus and scroll. Reuse existing passage text when providing context; this does not require generating a new interpretation.

## Limits

The supplied screenshots establish the visible iPhone states, while new local browser checks establish the reported interaction failures. This is not production version verification, a physical-device interaction test, VoiceOver acceptance, or a full WCAG audit. Safari toolbar expansion, native gestures, dynamic text, light-theme contrast, signed-in Free/Plus, and inactive subscriptions were not comprehensively tested. No application fixes, commits, pushes, or deployment were performed.

## Mechanical scan

Individual Impeccable scans of CardModal.jsx, CardSymbolInsights.jsx, and SpreadCompanion.jsx returned zero findings and exit 0. This did not detect the reproduced runtime focus and scroll failures. No live detector overlay was injected. All real Pro sessions logged out with HTTP 200, and all review browser contexts were closed.
