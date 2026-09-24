# Your Personalized Narrative — remediation specification

**Status:** Ready for review and implementation. This document specifies changes; it does not report them as implemented.

**Date:** September 23, 2026  
**Product:** Tableu  
**Baseline source:** `7e9170fb2b64184a6225940f4cbef7b9e92caced`  
**Baseline audit:** 10/20; nine findings, comprising four P1 and five P2 issues.  
**Acceptance:** All nine findings closed, no unresolved P1 findings in the affected experience, and a rendered re-audit score of at least **18/20**. The intended outcome is **19/20**.

## 1. Outcome and scope

A person finishing a reading can comfortably read the complete narrative, inspect its supporting inputs, listen, save, open related media, ask a follow-up question, and provide feedback. These actions remain usable with a keyboard, assistive technology, enlarged text, a narrow phone, and a short desktop window, in both themes.

The remediation preserves Tableu's Midnight Reading Room identity and its agency-centered, private reflection framing. Follow [PRODUCT.md](../../../PRODUCT.md) for product meaning and [DESIGN.md](../../../DESIGN.md) for the incumbent visual system. This specification defines the remediation behavior and measurable acceptance criteria. The v2 images illustrate its visual direction; generated pixels do not override semantic, sizing, contrast, or state requirements.

### Surfaces included

| Surface | Main implementation locations | Required treatment |
| --- | --- | --- |
| Reading navigation and layout | [TarotReading.jsx](../../../src/TarotReading.jsx), [ReadingDisplay.jsx](../../../src/components/ReadingDisplay.jsx) | Valid skip destinations, narrative focus target, conditional setup section, overlay/action-bar coordination. |
| Narrative title, body, streaming, and actions | [NarrativePanelHeader.jsx](../../../src/components/reading/narrative/NarrativePanelHeader.jsx), [NarrativeBody.jsx](../../../src/components/reading/narrative/NarrativeBody.jsx), [StreamingNarrative.jsx](../../../src/components/StreamingNarrative.jsx), [MarkdownRenderer.jsx](../../../src/components/MarkdownRenderer.jsx) | Correct heading levels; complete content; readable measure; preserve streaming, retry, voice, focus mode, and save behavior. |
| Supporting reading panels | [SpreadPatterns.jsx](../../../src/components/SpreadPatterns.jsx), [ReadingInputUsageSection.jsx](../../../src/components/reading/complete/ReadingInputUsageSection.jsx) | Proper peer/child headings, readable data-driven status badges, accurate disclosure content. |
| Follow-up entry points and conversation | [ContinueConversationSection.jsx](../../../src/components/reading/complete/ContinueConversationSection.jsx), [FollowUpModal.jsx](../../../src/components/FollowUpModal.jsx), [FollowUpDrawer.jsx](../../../src/components/FollowUpDrawer.jsx), [FollowUpChat.jsx](../../../src/components/FollowUpChat.jsx) | Layering, visibility, focus, layout, targets, native suggestion semantics, and retained conversation state. |
| Feedback | [FeedbackPanel.jsx](../../../src/components/FeedbackPanel.jsx) | Native keyboard-operable rating groups and intact submission behavior. |
| Shared foundations | [useModalA11y.js](../../../src/hooks/useModalA11y.js), [useHandsetLayout.js](../../../src/hooks/useHandsetLayout.js), [useKeyboardOffset.js](../../../src/hooks/useKeyboardOffset.js), [tailwind.config.js](../../../tailwind.config.js), [theme.css](../../../src/styles/theme.css), [tarot.css](../../../src/styles/tarot.css) | Scoped token, viewport, and accessibility changes with regression checks for other consumers. |
| Visual studio and recent media | Existing entry points and dialogs, including [VisualCompanionModal.jsx](../../../src/components/reading/VisualCompanionModal.jsx) | Retain working behavior and state; check them when changing shared modal infrastructure. |

This work does not change narrative generation prompts, retrieval, card interpretation, subscriptions, privacy permissions, API contracts, persistence, database schemas, or the deck/reveal experience. It is not a global redesign. Images and this spec alone do not constitute deployment or live-service evidence.

## 2. V2 visual guidance

The [mockup package](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/README.md), [corrected prompts](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/prompts.md), [prompt review](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/prompt-review.md), and [generation notes](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/generation-v2.md) provide provenance. Use the final files with the `-v2` suffix; retain v1 only as history.

### Figure 1 — Complete light-theme reading

![V2 light reading: complete narrative, source status badges, supporting actions, and stacked feedback ratings.](https://github.com/henryperkins/tarot/raw/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/01-light-reading-v2.png)

[Open full-size light reading](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/01-light-reading-v2.png).

Adopt the quiet daytime surfaces, clear narrative hierarchy, readable status labels, complete action set, and vertically stacked feedback groups. The image is a full-page composition, not a single desktop viewport. Preserve the actual reading's complete text and section structure. Its five sections and selected rating of 4 are sample content, not new application defaults.

### Figure 2 — Mobile follow-up conversation

![V2 mobile follow-up: opaque sheet above the reading, wrapped question buttons, empty composer, disabled Send, and visible journal-history option.](https://github.com/henryperkins/tarot/raw/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/02-mobile-follow-up-v2.png)

[Open full-size mobile follow-up](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/02-mobile-follow-up-v2.png).

Use **390 × 844 CSS pixels** as the reference viewport. Adopt the foreground sheet, subdued and noninteractive background, natural label wrapping, clear composer, and complete journal-history row. The keyboard-closed state does not prescribe initial focus: opening explicitly to ask a question still focuses the enabled textarea. The highlighted question illustrates a later focus state. Rendered close/send hit areas must be 48 × 48 CSS pixels, regardless of the raster's proportions.

### Figure 3 — Follow-up in a short desktop window

![V2 short desktop follow-up: a constrained dialog with an independently scrolling question area and a fully reachable composer and journal-history control.](https://github.com/henryperkins/tarot/raw/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/03-short-desktop-chat-v2.png)

[Open full-size short desktop chat](https://github.com/henryperkins/tarot/blob/f18b26d9f8465e49fc86f78a785fbc7a95257aa1/output/imagegen/narrative-remediation/03-short-desktop-chat-v2.png).

Use **1440 × 500 CSS pixels** as the reference viewport. The middle area visibly overflows while the composer and history option remain reachable. A roughly 740px-wide dialog with 24px outer margins is guidance, not a fixed-height template. The generated close control is oversized; use the specified 48px hit area. A partial third suggestion must result from real overflow and scrolling, not a decorative scrollbar or deliberate text crop.

### What the images cannot demonstrate

Validate DOM roles, focus containment/restoration, hidden-state behavior, exact hit areas, composited contrast, viewport/keyboard handling, and performance in the implementation. Use application copy and data rather than transcribing generated background text. The images do not establish a new score.

## 3. Findings and required fixes

| ID | Priority | Observed issue | Required outcome | Acceptance evidence |
| --- | --- | --- | --- | --- |
| NAR-01 | P1 | The mobile follow-up drawer painted behind the page; visible controls failed hit testing. `z-modal` was used without a Tailwind mapping. | Portal the drawer outside reading stacking contexts and use a defined modal layer. Make the background noninteractive while open. | A01: At 320px and 390px, control-center hit tests and actual clicks reach the drawer; no reading action fires through it. |
| NAR-02 | P1 | Closed dialogs retained invisible keyboard targets; React 19 received an empty string instead of boolean `inert`. | Coordinate real boolean inert, visibility, focus containment, background isolation, and restoration. Preserve chat state on ordinary close. | A02: Closed dialog descendants are absent from tab order and the accessibility tree; repeated open/close restores the opener without losing state. |
| NAR-03 | P1 | Suggestion buttons used `role="listitem"`, overriding their native button role. | Use native buttons, optionally inside `ul > li`; retain immediate-submit behavior. | A03: Accessible role is button; Enter and Space each submit exactly once; no relevant role violations. |
| NAR-04 | P1 | Light-theme success status text measured about 2.31:1. | Add normal light-theme semantic colors and readable, data-driven badges. | A04: Actual rendered badge text is at least 4.5:1; meaningful icons/control boundaries meet applicable 3:1 requirements in both themes. |
| NAR-05 | P2 | At 1440 × 500, the dialog's fixed content exceeded its bounded container and clipped the footer. | Let the middle scroll and shrink; keep the composer/history control reachable, with whole-dialog scrolling as an extreme-height fallback. | A05: All content and controls remain reachable at the short viewport, enlarged text, and keyboard-open phone sizes. |
| NAR-06 | P2 | Every custom rating radio was tabbable and arrow keys did not work. | Use native radio groups with proper labels and one group tab stop. | A06: Arrow keys, Space, Tab, selection, submission, and announcements work for all three groups. |
| NAR-07 | P2 | Narrative and supporting headings had inconsistent semantic levels. | Preserve the page h1; provide h2 panel titles and appropriately nested content headings. | A07: The accessibility outline reflects the visible hierarchy without changing stored narrative text or other Markdown consumers. |
| NAR-08 | P2 | Some chat controls were 34–40px tall. | Provide at least 44 × 44px interactive areas; use 48 × 48px for close/send. | A08: DOM rectangles and spacing pass at 320px, 390px, desktop, and enlarged text. |
| NAR-09 | P2 | “Skip to spreads” linked to an unmounted setup section. | Offer only mounted destinations and a working narrative destination when available. | A09: Each visible skip link moves focus to its real target in setup, streaming, completed, and focus-mode states. |

## 4. Conversation behavior and lifecycle

### Layering and background isolation

- Keep the existing desktop portal; portal the drawer to an appropriate root outside transformed reading ancestors. Do not portal into a subtree made inert by the overlay.
- Use the established `--z-modal-backdrop: 60` and `--z-modal: 70` tokens. They already exist; define missing Tailwind utilities or reference the variables directly. Preserve the intended auth, toast, and tooltip layers.
- While chat is open, isolate the reading/app background from pointer, keyboard, and assistive-technology interaction. Apply inert to the correct siblings and restore their prior state on close; do not blanket-inert an ancestor containing the dialog.
- Render only one active chat dialog and focus trap. Preserve the existing mobile action-bar suppression. A viewport change must not duplicate a request, trap, or conversation.
- Provide a labeled dialog with `aria-modal="true"` and a stable title relationship. The backdrop closes chat through the same close path as its button.

### Closed state, focus, and state retention

Keep `FollowUpChat` mounted for normal open/close cycles, using actual boolean inert and a coordinated hidden/visibility state. An alternative unmounting implementation is acceptable only if it first preserves all relevant state outside the presentation wrapper. Merely unmounting to remove hidden targets would lose the current locally held draft and conversation state.

Closing must immediately prevent new focus/pointer entry into the disappearing content. Remove it from the accessibility tree once closed, regardless of animation preference. When restoring focus, first restore background interactivity, then focus the opener; if the opener no longer exists, focus the narrative heading. No deferred child autofocus may pull focus back afterward.

Use one owner for initial focus. The current modal hook and chat component use separate delayed focus actions; coordinate or replace those timers. An explicit **ask** action focuses the enabled textarea. A **continue/view** action may focus the close control or dialog without forcing the keyboard open. If the composer is unavailable, use an enabled, meaningful fallback. Initial focus must not submit a suggested question.

Tab and Shift+Tab stay within the active dialog. Escape, the close button, backdrop activation, and the existing Android Back handling close through a consistent path. A nested higher-priority overlay owns its own trap and Escape handling; shared changes must preserve that behavior.

Preserve messages, unsent text, journal-history preference, suggestion state, turn accounting, and an in-flight response across ordinary close/reopen. Do not post the question again on reopening. Clear or replace conversation state only when the existing reading-identity/reset rules require it. A desktop/handset presentation change must retain the same conversation; hoist the minimum state needed rather than introducing an unrelated global overlay rewrite.

### Submit and entitlement behavior

- Suggestions remain direct-submit actions, not composer-prefill actions. Each activation produces at most one request.
- Preserve existing reading/authentication/request-identity guards, turn limits, streaming payload, and journal permissions. The mockups' `0/10` is a Pro example; Free/Plus/Pro limits remain data-driven.
- Keep the 500-character question limit, counter, Enter-to-send, Shift+Enter newline, and IME composition guard. Empty or whitespace-only input cannot send. Loading, authentication, invalid-reading, and limit states retain their existing guards and explanatory UI.
- Keep “Include insights from my journal history” and its current user-selected state. Only send journal context when existing entitlement and preference conditions allow it. Do not infer consent or a new default from the checked mockup.
- Preserve message-log announcements and the current scroll-follow rule: new content follows the bottom only when the person is already there. Reading older messages must not be interrupted by forced scrolling.

## 5. Responsive layout and targets

### Dialog layout

Use a bounded flex column with a nonshrinking header, one normal scrolling middle region (`min-height: 0`), and a composer/history footer. Give content room to grow; do not fix the suggestion or message region to the mockup's pixel height.

At the ordinary 1440 × 500 case, the middle shrinks enough to expose real overflow while the footer remains visible. For 200% text or a keyboard-reduced viewport where header plus footer cannot fit, permit the complete dialog to scroll within the visible viewport. No control may become unreachable below an `overflow: hidden` boundary. Ensure focused fields and validation/error messages can be scrolled into view.

Preserve the existing `useHandsetLayout` decision rather than choosing a new breakpoint from the pictures:

```css
(max-width: 768px), ((hover: none) and (pointer: coarse) and (max-height: 960px))
```

Coordinate `dvh`, safe-area insets, and `useKeyboardOffset`/VisualViewport using one effective available-height calculation. Do not subtract the keyboard twice through both reduced viewport height and additional padding. Remove listeners and restore shared CSS state on teardown. Desktop resize, device rotation, and keyboard dismissal must leave the layout usable.

### Geometry and typography

| Element | Requirement |
| --- | --- |
| All interactive controls | Minimum 44 × 44 CSS-pixel hit area, without overlapping neighboring targets. |
| Close and send controls | 48 × 48px hit area; approximately 20px icon. Selected, focus, hover, and disabled states remain distinguishable. |
| Suggested questions | At least 44px tall; approximately 56px desktop and 64px handset is the reference treatment. Grow for wrapping and enlarged text. Never ellipsize the question. |
| Journal checkbox | Entire associated label row is an activation target at least 44px tall; label wraps without colliding with its checkbox. |
| Mobile composer/body | At least 16px text. Preserve a visible label, readable counter, and adequate line height. |
| Essential secondary UI | Generally 14px or larger; badges remain legible without depending on font size to excuse contrast failures. |
| Narrative measure | Approximately 65–75 characters per line at desktop sizes; comfortable full-width reflow with page padding on phones. |
| Focus treatment | Visible ring, approximately 2px with 2px offset, with at least 3:1 contrast against adjacent colors. Never communicate focus only by selection fill. |

Use Source Serif 4 for established reading/headline typography and Inter for UI. Retain the existing spacing scale, restrained brass, warm thin borders, and modest corners. Do not add heavy blur/glow or a separate card around every paragraph. No horizontal scrolling is acceptable at 320px or the specified text enlargement.

## 6. Theming, source inputs, headings, and navigation

### Theme and source-status contract

The normal light theme needs its own semantic success foreground/background; the existing high-contrast media override does not fix ordinary light mode. Prefer opaque status pairs whose contrast is predictable. Candidate values:

| Role | Foreground | Background | Treatment |
| --- | --- | --- | --- |
| Light success | `#2F6A3B` | `#EDF4EE` | Calculated 5.78:1; verify the actual rendered pair. |
| Light caution / requested but unused | `#854D0E` | `#FEF3C7` | Candidate pair; measure in the rendered badge. |
| Light brass action | `#7D623B` | `#FFFFFF` | Calculated 5.70:1; also check hover/focus surfaces. |
| Dark brass action | `#D4B896` | `#1C1A22` | Calculated 9.09:1; retain coherent dark surfaces. |

Pair status text with meaningful icons where useful; never encode usage solely by color. Keep summary counts, individual labels, and helper text driven by the source-usage model. A requested-but-unused/skipped state must not look like “Used,” and a source not requested must not claim supplied context. Do not change backend usage metadata to match the picture.

Make the reading's light-mode frame coherent with its light contents. The existing hardcoded dark reading-panel gradient requires a theme-aware treatment scoped to `.scene-shell--reading .scene-stage__panel`; do not restyle the ritual or reveal stages. Verify light/dark fields, borders, text, status badges, focus rings, and overlays using computed styles and rendered pixels, including opacity/blending.

### Heading and content contract

Keep the existing page h1 (“Tableu”). “Your Personalized Narrative” becomes an h2 with a stable id and programmatic focus support; retain `data-reading-focus-target` for existing reading focus behavior. Use h2 for peer supporting panels and h3 for their immediate subsections, including Highlights under Spread Insights. A collapsible panel uses a heading containing a button, with accurate expanded/control relationships.

Map generated Markdown headings relative to the narrative panel through a contextual renderer option. Top-level narrative sections become h3, with deeper levels nested appropriately. Handle all supported heading levels. Do not globally demote the shared Markdown renderer's headings in chat or journal, rewrite stored Markdown, or alter narrative text to fit the mockup. Preserve section detection, streaming word offsets, voice highlighting, and the existing HTML handling policy.

Keep the full reading and all existing actions: focus/show insight panels, read aloud, Save to Journal, View Journal, visual studio, Continue conversation/Open chat, Reading Inputs Used, recent media, and Draw new reading. Their visibility and enabled state follow current product logic.

Preserve these framing and safety sentences:

> This narrative braids together your spread positions, card meanings, and reflections into a single through-line.
>
> Use what resonates, and set aside what does not.
>
> Reflective guidance only. Not medical, mental health, legal, financial, or safety advice.

### Skip navigation

Render “Skip to spreads” only when its setup/spread destination is actually mounted. Render “Skip to reading” only when `#step-reading` is mounted. Add “Skip to narrative” when the narrative heading exists. The destination needs programmatic focus and an appropriate scroll offset beneath sticky navigation.

Activation must move focus as well as the viewport. Do not reset a reading, launch generation, restore hidden setup, or steal focus later merely to satisfy a fragment link. If setup is hidden in focused reading mode, omit that unavailable destination. Explicit skip activation may move focus; unrelated rerenders may not.

## 7. Feedback contract

Retain the three stacked groups: **Accuracy**, **Coherence**, and **Actionability**, preserving the existing payload fields `overallAccuracy`, `narrativeCoherence`, and `practicalValue`. Prefer native radio inputs grouped with `fieldset` and `legend`; each group has a distinct name shared by its five members.

Labels remain **1 Poor, 2 Fair, 3 Good, 4 Great, 5 Excellent**. New feedback starts unselected as today; the image's selected 4s are only an example. Tab enters a group once, arrows move and select within it, Space selects the focused option, and the next Tab leaves it. Selection and keyboard focus must have visibly different treatments.

Preserve the disclosure's expanded state/relationship, notes field, three-row starting height, “What resonated or felt off?” prompt, 750-character limit/counter, and existing request-identity and all-ratings-required submission guards. Preserve disabled/submitted states and announce success or errors. A failed submission must retain the ratings and notes for correction or retry.

## 8. State coverage and invariants

| State | Required result |
| --- | --- |
| Narrative loading / streaming | Existing progress and partial-content behavior remain; content is visible under reduced motion; headings and focus targets appear only when mounted. |
| Narrative failure / retry | Error and retry remain usable; retry does not create duplicate generation or erase unrelated user input. |
| Completed reading, light/dark | Complete content and eligible supporting actions remain; source and feedback disclosures work. |
| Chat closed | No interactive or announced hidden dialog; draft, preference, and conversation retained. |
| Chat open, empty | Suggestions and composer are available when eligible; empty-input Send is disabled; full history label visible. |
| Chat open, typing / keyboard visible | Counter and wrapping work; field and send/history controls remain reachable; IME does not accidentally submit. |
| Chat requesting / streaming | One request per action; existing guards prevent duplicate sends; closing and reopening retains the response. |
| Chat error | Existing error/retry behavior remains accessible; no duplicate turn consumption or fabricated success. |
| Signed out / missing reading / turn limit | Existing gate and explanation remain; no extra permissions or unguarded submission are introduced. |
| Feedback untouched / focused / selected | No default rating; one tab stop per group; focus is distinct from selection. |
| Feedback submitting / failed / submitted | Correct disabled and announcement states; failure retains input; success retains current product behavior. |
| Studio / recent media / nested overlay | Entry points, return focus, polling/state preservation, and overlay ownership still work. Do not unmount paid-generation state as a side effect of shared modal changes. |

Use synthetic fixtures for repeatable UI checks. The v2 question is “How can I find a sustainable balance between work and rest?” Its five sections—Opening, The Story of Your Cards, Synthesis, Practical Guidance, Reflection—demonstrate completeness; they do not impose a five-section backend schema.

The source-usage fixture contains Spread & cards Used; Vision uploads Not requested; User context Used with “Used: question, tone”; Traditional wisdom Used with “semantic mode, 2/3 passages”; Ephemeris Requested not used; and Forecast Skipped with “Reason: budget limit.” Its model-derived summary is three used and two requested but unused. Include another fixture with different source states so the implementation cannot pass by hardcoding these values.

## 9. Verification and acceptance

### Focused acceptance cases

| Case | Verification required |
| --- | --- |
| A01 — Foreground drawer | At 320 × 740 and 390 × 844, after the drawer reaches its open state, `elementFromPoint` at close, suggestion, textarea, and send centers resolves to the control or a descendant. Click enabled controls; assert no underlying reading action. A disabled Send must still occupy its intended foreground hit area. |
| A02 — Lifecycle and focus | Run at least three open/close cycles with normal and reduced motion. Inspect tab order and accessibility tree closed; trap both Tab directions open. Close by button, Escape, backdrop, and supported Android Back. Verify restoration, no delayed focus steal, retained draft/preferences/messages, and a single request across close/reopen while streaming. |
| A03 — Suggestions | Check button roles and accessible names. Activate by Enter, Space, and pointer; assert one request with the chosen question each time. Check loading/auth/limit guards and no role violations. |
| A04 — Contrast and source accuracy | Measure actual light/dark badge foreground/background after composition. Check text at 4.5:1 minimum and relevant nontext indicators at 3:1. Inspect used, requested-unused, skipped, and not-requested states and model-derived counts with two fixtures. |
| A05 — Available height | At 1440 × 500, scroll the real middle region to its final content and use the complete composer/history row. Repeat with 200% text and narrow phones with the keyboard open. Verify fallback scrolling, rotation/resize recovery, and no clipped focused element. |
| A06 — Feedback | For each initially empty group, enter by Tab, navigate/select by arrows, select with Space, and leave by Tab. Assert correct payload fields and values, notes retention after failure, submission guards, and announced result. |
| A07 — Headings | Inspect the accessible heading outline in full and focused narrative modes, including collapsed/expanded panels. Verify the existing h1, panel h2s, and correctly nested generated sections. Exercise a fixture with deeper Markdown headings; confirm chat/journal rendering and voice/section offsets are unaffected. |
| A08 — Targets and reflow | Measure all affected interactive rectangles, including suggestion and checkbox labels. Close/send are 48px square; all others are at least 44px in both axes. Verify complete wrapped text, separate focus/selection, and no horizontal overflow at 320px and 200% text. |
| A09 — Skip links | In setup, streaming, completed, and focused reading modes, enumerate visible-on-focus skip links. Each target exists and receives focus on activation, remains visible below sticky navigation, and causes no reading reset/generation. Hidden setup has no spread skip link. |

### Rendered coverage matrix

| Environment | Coverage |
| --- | --- |
| 1440 × 1000 desktop | Complete reading, all supporting disclosures/actions, feedback, open/closed chat; both themes. |
| 1440 × 500 desktop | Short dialog overflow, footer reachability, long suggestions/messages, errors, and 200% text. |
| 390 × 844 handset | Full reading and drawer, all nine relevant checks, both themes, keyboard closed/open, normal/reduced motion. |
| 320 × 740 handset | Narrowest layout, wrapped labels, target rectangles, hit testing, focus, errors, enlarged text, and keyboard reachability. |
| 768px / 769px widths | Cross the existing handset-width boundary; preserve a single active dialog and retained conversation. |
| 980 × 800 with coarse pointer/no hover | Exercise the existing short coarse-pointer handset rule rather than assuming desktop presentation. |

Run the critical focus/layer/height cases with both motion preferences. Respect existing motion tokens; reduced motion removes ornamental transitions without delaying content, leaving invisible targets, or disabling controls. Do not add per-streaming-word listeners or layout measurement loops.

Use automated role, focus, request-count, rectangle, and accessibility checks alongside visual inspection. The normal Playwright configuration defaults to reduced motion, so explicitly opt into normal motion for those cases. Its mobile project selects `@mobile` tests; confirm the intended tests are collected and actually run. The accessibility-only configuration currently enables Chromium and does not by itself establish phone/WebKit coverage.

### Implementation checks to run and record

The following are **future implementation validation**, not results of this documentation task:

- Add focused cases for A01–A09, preferably in a proposed `e2e/narrative-remediation.spec.js`, using appropriate desktop/mobile tags and deterministic reading fixtures.
- Preserve [reading-hardening.spec.js](../../../e2e/reading-hardening.spec.js), [follow-up-questions.spec.js](../../../e2e/follow-up-questions.spec.js), [reading-visual-modals.spec.js](../../../e2e/reading-visual-modals.spec.js), and [accessibility.spec.js](../../../e2e/accessibility.spec.js) coverage. If modifying the shared modal hook, include [saved-intentions-modal.spec.js](../../../e2e/saved-intentions-modal.spec.js) and other affected consumers.
- Align fixtures to the current jobs/stream route used by the application. Some existing follow-up mocks use the older `/api/tarot-reading` endpoint; a passing test must prove it reached the intended valid reading/chat state. The hardening suite demonstrates jobs/SSE interception.
- Run relevant source-usage, narrative-section/model, and follow-up state/stream tests for the actual code touched. Run `npm test`, `npm run lint`, `npm run build`, `npm run gate:design`, `npm run test:a11y`, and `npm run test:a11y:e2e`, recording any failures with their scope. Static contrast/WCAG scripts alone do not prove the rendered fixes.
- Run focused Playwright tests in both configured desktop and mobile projects, verifying collection. Broaden to other consumers when shared code changes. Follow the repository's requirement to run `npm run ci:narrative-check` for narrative changes, and `npm test` before any eventual push; do not silently waive a required gate.
- Inspect a runtime trace of opening/closing chat, streaming a response, scrolling messages, and resizing the short dialog against the baseline. Check for duplicate requests/listeners, avoidable layout loops, and new animation/scroll stalls. The audit's performance score was source-based, not a measured runtime benchmark.
- Verify keyboard-open behavior on a real handset when available. Clearly label VisualViewport emulation or desktop device emulation as simulated, and report real-device evidence separately. Check keyboard-only and at least one screen-reader pass for headings, dialogs, ratings, and announcements.

The earlier audit's 15 passing focused tests are regression context, not evidence that these new acceptance cases pass. Local intercepted APIs are not live AI, TTS, journal persistence, or production proof. Report evidence at the level actually tested.

### Scoring and completion rule

| Dimension | Audited baseline | Intended result | Evidence needed |
| --- | ---: | ---: | --- |
| Accessibility | 1/4 | 4/4 | Semantics, contrast, keyboard, focus, headings, navigation, and assistive-technology checks. |
| Performance | 3/4 | 3/4 | No new runtime regression in the affected interactions; distinguish measured evidence from the source-only baseline. |
| Responsive behavior | 2/4 | 4/4 | Narrow, short, enlarged-text, breakpoint, and keyboard-open coverage. |
| Theming | 2/4 | 4/4 | Real light/dark surfaces, status states, fields, and focus treatment. |
| Implementation integrity | 2/4 | 4/4 | Correct state/lifecycle, request guards, mounted navigation targets, and regression coverage. |
| **Total** | **10/20** | **19/20** | **At least 18/20 after re-audit, with all nine findings closed and no unresolved P1 findings in scope.** |

A numeric score cannot compensate for an open acceptance case. If a category remains below its target, document the residual limitation and evidence; the floor is acceptable only when the issue-closure and severity conditions also hold. Do not award points for mockup appearance or a successful build alone.

## 10. Delivery and review package

Implement in small, reviewable groups: overlay lifecycle/layering and height; controls/feedback/navigation semantics; then theme and narrative hierarchy. Adjust that order for dependencies, and validate affected shared consumers as changes land.

The implementation handoff must contain:

1. An A01–A09 evidence checklist with pass/fail status, affected source, commands, and links to rendered proof.
2. Actual screenshots matching the three v2 reference states, plus 320px, dark/light, focus, and enlarged-text examples where they demonstrate a fix. Include short interaction evidence for behavior a screenshot cannot show.
3. Results for required checks and a re-audit table, including any remaining limitations and the distinction between simulated/local and live/device evidence.
4. This spec and the referenced v2 assets together so local links remain usable. The current mockup directory is an output artifact; include it deliberately in any later handoff rather than assuming it has been published.

This specification and its companion images are the reviewable design deliverable. Application changes, a passing remediation re-audit, publication, and deployment remain separate work.
