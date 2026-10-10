# iPhone 14 Pro Max: Safari, VoiceOver and touch validation preparation

Prepared 2026-10-09 by read-only source inspection of the isolated qualification worktree. Observed HEAD: `a7eb324a003c3f9d2f6be77aa049b0913a44216b`; this is a preparation reference, not the eventual immutable validation build. No browser, assistive technology, model inference, device, credentials or network was accessed. Only this preparation document was written.

**Physical Safari/VoiceOver/touch validation: PENDING.** No device-reachable isolated validation URL is approved/provisioned yet. Never use the original live beta or the original 8787/5175/8789 services as a substitute. Complete model qualification and expired/failed re-annotation work first; fill the runtime/build/source fields below before collecting physical evidence.

## Record the actual test environment

| Evidence field | Value to fill at execution |
| --- | --- |
| Device | iPhone 14 Pro Max (user confirmed) |
| Device OS version / build | Pending |
| Browser and context | Safari, ordinary browser tab; installed app needs a separate result if tested |
| Approved isolated URL / route | Pending; none currently available |
| Immutable source commit / runtime build identifier | Pending |
| Qualified model / qualification run / manifest digest | Pending |
| Reading case / exact prose hash / cue-ledger revision | Pending |
| Source lane | Qualified independent model output, recorded replay of that output, controlled cue fixture, or authored study; select one |
| Delivery | Paced SSE, burst SSE, final-only, or saved restore; record the real lane |
| Identity / tier | Guest or real signed-in Pro; mocked fixture identity is not real auth/tier coverage |
| Motion / text settings | Reduce Motion off/on; Safari page zoom; display/text settings; orientation |
| Network / device conditions | Record connection, Low Power Mode if enabled, and visible performance symptoms |
| Evidence | Recording/photo/log path; do not include credentials, private tokens, or browser session state |

Use nonprivate test prose and supplied notes so spoken/recorded evidence can be shared safely. Record exact audible output when useful, with timestamp and control/phrase identity. A screen recording without captured speech does not establish announcements; add a contemporaneous transcript or an audio-capable recording. Preserve failure clips as well as passes. Source changes after this pass require rechecking affected cases on the new build.

## Expected DOM semantics to compare with actual speech

These are intended accessible names/states derived from current source. VoiceOver wording, role order and whether it speaks a live-region update must be observed, not inferred from this table.

| Area | Source-derived semantics / text |
| --- | --- |
| Companion | `aside` named `Your cards`; `SpreadCompanion.jsx:154` |
| Shelf button | `<position>: <card name>, upright/reversed`, with `aria-current=true` when associated; unavailable controls disabled. No shelf `aria-pressed` attribute is currently provided. `SpreadCompanion.jsx:9–10,164–166` |
| Focus card | Same position/name/orientation label, native button, `aria-pressed` reflecting held state; one button per card in a pair. `SpreadCompanion.jsx:139–143` |
| Complete supported phrase | One inline `span role=button`, `tabIndex=0`, `aria-pressed=false/true`; accessible name from its own visible words (no `aria-label`; Task 14). Click, Enter and Space toggle; Escape releases; focusing it alone does not hold. Identity-only phrases remain ordinary text. `MarkdownRenderer.jsx` `GesturePhrase`; `narrativeCardLinks.js` gesture wrapper |
| Narrative status | Polite atomic status: `Your reading is still being prepared.`, optionally `Narrative is revealing. Use Show all now to reveal it immediately.`, then `Narrative ready.`; prose container itself has `aria-live=off`. `StreamingNarrative.jsx:516–525,626–628` |
| Optional show-all control | Native button with accessible name `Show full narrative immediately`; only when that reveal mode supplies it. `StreamingNarrative.jsx:564–574` |
| Departing art | Departing layer is `aria-hidden` and inert; it must not add duplicate navigable cards during a handoff. `SpreadCompanion.jsx:130–143` |
| Context | Question appears with `Your question` and exact supplied wording. Current cue quote has `aria-live=off`; automatic cues are not implemented as spoken detail announcements. `NarrativeQuestionAnchor.jsx:10–14`; `SpreadCompanion.jsx:177` |
| Restored reading | Stable provider; complete prose, zero automatic replay, static manual inspection including with Reduce Motion off. `RestoredReadingGestures.jsx:16,43–49`; `narrative-card-touch.css:511–520` |

## Physical checklist

For each row record **PASS / FAIL / NOT RUN**, route/case/lane, actual spoken text where applicable, and recording timestamp. Activation means a normal tap with VoiceOver off and a VoiceOver double-tap with VoiceOver on. A VoiceOver swipe only explores; it must not hold a cue by itself.

| ID | Action on the actual handset | Expected outcome / recordable evidence |
| --- | --- | --- |
| P1 | With VoiceOver off and Reduce Motion off, open the approved Star case in portrait. Read and scroll normally while prose/cues arrive. Repeat with Safari bars expanded/collapsed. | Prose stays readable and scroll is under reader control. Shelf/detail window does not cover the current lines or shift their position on decode or cue adoption. Record first/second pour legibility, both lower rivulets, unintended jumps, clipping and overflow. |
| P2 | Tap the actual visible text line for the pool phrase, then continue scrolling/reading while more text/cues arrive. Tap the same phrase again; hold it again and tap the focus card to release. | Correct pool detail is held; subsequent prose still arrives without replacing the held association. Same target toggles off; focus-card release works without a hardware Escape key. Distinguish tapped line from a multiline bounding-box center. |
| P3 | Tap the land phrase and `Neither pitcher gets dropped.`; in the five-card case tap Ace/Queen relationship, the two reversals, then a later return to an earlier detail. | Distinct pool/land details and meaningful two-detail/two-card views remain legible. Both relationship targets are present; actual drawn orientation is preserved. Later return works without changing delivered prose or forcing scroll. Record compact pairs and repeated inspection. |
| P4 | Tap a shelf card, then tap it again. Inspect a reversed card and a whole-card fallback for an unsupported edition if supplied. | Whole-card identity inspection clears prior detail emphasis and toggles through the same selection contract. Labels/orientation match the actual spread occurrence. Unsupported edition retains usable prose/whole-card inspection without borrowed RWS crops. |
| P5 | Turn on VoiceOver. Explore the reading with left/right swipes and the headings/buttons rotor; try continuous reading from before an associated phrase. | Heading/paragraph/list order stays coherent. Each complete supported phrase is one control, not a word-by-word series; identity phrases remain prose. Exact original prose remains understandable in continuous reading. Record each phrase's spoken name and any omission, substitution, repetition or confusing order. |
| P6 | During paced arrival, explore an incomplete phrase; remain on a completed phrase while the remaining prose and late cue metadata arrive. Navigate without activating, then double-tap the phrase twice. | Partial arrived text is readable but does not expose an unfinished/future control. Exploration does not create a hold. Completed phrase has button semantics and its pressed/unpressed state is discoverable; activation toggles the matching detail. Focus remains on the intended target during appends, completion and metadata updates. Record any focus reset/disappearance. |
| P7 | With VoiceOver active, navigate shelf and focus-card buttons. Double-tap a shelf identity, then a complete paired phrase; explore both focus-card buttons and release by double-tapping one. | Position/card/orientation is available for each control. Selected shelf state is discoverable where `aria-current` changes. Focus cards reflect held state. Departing art supplies no extra navigable duplicate; unavailable art does not behave as an active future card. Record actual speech separately for shelf, phrase and focus card. |
| P8 | Listen while a reading starts and completes; keep VoiceOver focus in the prose during automatic cue changes. Check a no-reflection case and a supplied-question/reflection case. | Preparation/completion status is usable and does not repeatedly interrupt reading. Automatic visuals do not take focus or announce every word. Question and supplied notes remain reachable as text; absent notes are not invented. A detail is explained by the original associated passage; no additional spoken detail announcement is currently promised. |
| P9 | In device Accessibility/Motion settings enable Reduce Motion, return to the same tab, and repeat literal/pair/identity inspection. Repeat a fresh load with Reduce Motion already enabled. | Static associations retain the same meaning, detail targets, pair and hold/release controls. No water flow, glints, lift, entrance/exit crossfade or automatic replay. Preference changes preserve current focus/hold/prose progress. Record actual visual behavior; DOM zero-animation proof belongs to an instrumented browser lane. |
| P10 | With an active or held Star detail, switch tabs/apps, lock/unlock, then return. Repeat after the passage/art has been scrolled away and with back/forward navigation if the isolated route supports it. | No running invisible motion is inferred from a recording alone. On return inspect visible behavior: prose position/hold survives appropriately; unheld completed cues do not replay in a backlog, and held art resumes only if eligible. Record navigation type and any reload. Performance/animation-state instrumentation is separate evidence. |
| P11 | Rotate to landscape, expand/collapse Safari chrome, then set Safari page zoom to 200% and inspect a multiline phrase and pair; return to default zoom. Repeat a short reading section with VoiceOver. | Readable wrapping, reachable controls, no horizontal prose overflow, no clipped orientation/context labels, no sticky companion trapping the reading below it. Focused text/control can be brought into view. Confirm touch targets individually; enlarged text must remain readable, not merely fit a fixed art box. |
| P12 | Save while cues are pending, reload and open the saved reading; inspect a phrase and release. Repeat with the repaired expired/failed re-annotation path and with annotations unavailable/offline as the supplied isolated case permits. | Prose save/open is immediate and usable. Restored cues and manual revisit stay static even with Reduce Motion off. Re-annotation repairs attach to the same exact saved prose; unavailable annotations preserve readable prose. New repair/error/retry controls and status messages must be appended to this checklist after implementation; their names/behavior cannot be certified from current source. |
| P13 | Repeat applicable application cases in a separate guest context and a real signed-in Pro context, then log out. | Record real authentication/tier coverage. A study fixture has no actual account/tier evidence. A controlled cue response proves rendering/lifecycle only; qualify the independent model and record actual model output/provenance separately. |
| P14 | Scroll the full five-card/long-reading case repeatedly while cues arrive and revisit details; watch image decode, touch latency and stutter, including a cold load. | Record visible failures, pauses or slow responses and their timestamps. Smooth-looking footage is qualitative only. Safari/Web Inspector profiling, when separately available, must state measured decode/painting/memory/dropped-frame evidence; this high-end phone does not establish a mid-range-device performance gate. |

Optional external-keyboard lane: Tab focuses without holding; Enter/Space toggles; Escape releases; shelf ArrowLeft/ArrowRight/Home/End traverse available occurrences in spread order without advancing prose or unexpectedly scrolling. Record separately from touch and VoiceOver touch gestures; no keyboard was supplied or tested here.

## Source concern found in preparation, addressed in source by Task 14

Task 14 removed the separate label: each phrase control is now named by its visible words, and a Chromium regression checks that no phrase control's accessible name differs from its text in the authored and dynamic lanes. Whether VoiceOver reads the phrase continuously inside its sentence is still to be observed in P5. The original preparation note follows for the record.

The authored Star pool cue has visible quote `one pitcher into a pool` but label `The pitcher and the pool` (`output/reading-motion/fixtures/gesture-sidecars.json:41,55`). `src/lib/narrativeCardLinks.js:689` chooses that label for the control, and `src/components/MarkdownRenderer.jsx:36–37` applies it as `aria-label`. This is a source-confirmed accessible-name/visible-phrase mismatch in the authored study lane. The dynamic aligner also supplies card-name labels (`src/lib/narrativePassageAligner.js:174`). Check P5 for replaced/omitted spoken prose and label-in-name usability. Do not transfer this finding to the qualified independent-model lane without inspecting its actual emitted label. No markup was fixed and no spoken behavior was observed.

The current shelf does not expose `aria-pressed`, and current automatic cue changes do not have a dedicated spoken detail announcement. Record their discoverability/meaning in P7–P8; absence of an unsolicited announcement alone is not a demonstrated defect. The planned compact question disclosure is not present in the inspected companion; P8 should verify actual question/notes reachability without pretending that disclosure already exists.

## Intended semantics after Task 14 (automation-checked in Chromium; speech unobserved)

- **Phrase controls:** named by their visible words; Tab or focus explores without holding; Enter, Space or a tap toggles the hold; Escape releases. Arriving prose and late cues do not move focus.
- **Stage cards:** keyboard focus inside the companion stage (`:focus-visible`) pauses automatic turns until focus leaves, so the card under that cursor is not replaced. A pointer click or tap that holds and releases a stage card does not pause later turns. Whether a VoiceOver cursor move produces DOM focus at all is unknown and is part of P5/P7.
- **Motion preference:** switching Reduce Motion while a phrase is held keeps the hold, focus and prose position and stops motion; later connections appear as static meaning in the same order.
- **Layout:** compact landscape and doubled page zoom keep phrase controls and shelf labels reachable without horizontal overflow (Chromium viewports 844 × 390 and 550 × 500). Physical 200% text zoom remains P11.
- **Retry and status (Task 11, integrated):** a saved reading whose card connections failed, expired or went missing shows a polite `role=status` line ("Your reading is saved. Card connections are unavailable." / "… are being prepared." / "Card connections are ready.") and one native button named "Retry card connections" only when a retry is eligible. Activating it by keyboard ends with focus on the status, including when the repair completes at once; a failure is shown in place and leaves focus on the button. Copy names no model, binding or transport. Verified in Chromium and WebKit automation (136/136 on the integrated revision); spoken output is P12.

## Automation boundary

| Can be automated in a separate authorized isolated-browser run | Requires physical/user evidence |
| --- | --- |
| DOM names/roles/pressed/current/disabled/inert states; coherent Markdown/source hashes and ranges; one complete phrase target; keyboard toggles and focus retention; native emulated touch coordinate activation | Actual iOS Safari VoiceOver speech, rotor/order, explore-by-touch accuracy, double-tap activation, continuous-reading omissions and focus survival with real AT |
| Emulated viewport/zoom/orientation overflow and phrase/window bounding boxes; no scripted scroll jumps; stable held selection through source append; reduced-motion media-query changes and visible animation-handle counts | Physical touch targets with Safari chrome/safe areas, device zoom/text settings, real app background/lock/back-forward behavior, actual orientation transitions |
| Controlled pending save/reload/static restore and later repaired expiry/failure flows; deterministic no-annotation/offline fallback; browser engine regression checks | Real isolated runtime authentication/tier and handset network behavior unless the automated run actually uses those real services; physical graphics/decode/memory/performance |
| `e2e/reading-gestures.spec.js`, `e2e/reading-visual-handoff.spec.js`, `e2e/reading-cue-qualification.spec.js`, `e2e/journal-visual-restoration.spec.js` describe relevant existing test lanes; this preparation did not run them | iPhone 14 Pro Max result needs actual user/device observations. Playwright/WebKit or Chromium emulation, screenshots, axe/DOM checks, and source inspection do not constitute VoiceOver/device acceptance |

## Completion record

- Automation result/run/build: pending; state mocks and engine explicitly.
- Physical Safari/touch result: pending.
- VoiceOver result and exact speech evidence: pending.
- Reduced Motion off/on physical result: pending.
- Guest/real Pro application coverage: pending; study-only results recorded separately.
- Expired/failed re-annotation device result: pending implementation and actual execution.
- Failures and any new-build retest: pending.

Preparation used repository `AGENTS.md`, imagery/motion spec, React bridge/model-qualification plans, current renderer/companion/restoration markup and existing E2E source. This document is preparation, not a test pass, code review, production qualification or deployment artifact.


## Portable archival reference

Historical physical-device checklist retained from the finished round; preparation only. Historical inspected HEAD `a7eb324a003c3f9d2f6be77aa049b0913a44216b` is unchanged. See the [round closeout](2026-10-10-reading-cue-round-closeout.md) and its restricted original archive; no temporary file or private credential is needed to read this preparation. Physical execution, new inference and production rollout remain pending.
