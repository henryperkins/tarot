---
target: Saved Intentions journal functionality and UI
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\htper\\tarot\\src\\components\\SavedIntentionsModal.jsx"
target_fingerprint: "sha256:8c684930a3674b44b8ac477f23bc64408ceabd7c49d65ed136f4b4950ba60311"
target_path: "C:\\Users\\htper\\tarot\\src\\components\\SavedIntentionsModal.jsx"
timestamp: 2026-11-23T03-31-31Z
slug: src-components-savedintentionsmodal-jsx
---
⚠️ DEGRADED: single-context (design review, detector, and browser evidence were gathered in this session before the sub-agent gate; isolation was not restarted)

Target: Saved Intentions — `src/components/SavedIntentionsModal.jsx`, `src/components/SavedIntentionsList.jsx`, the note variant in `src/components/CoachSuggestion.jsx`, the Journal trigger in `src/components/Journal.jsx`, and the shared history in `src/lib/coachStorage.js`. Mode: Operate. Guest review on Vite at `http://localhost:5173/journal`, dark and light, 1440×900, 390×844, and 320×700, reduced motion and no-preference. `/api` stubbed. No signed-in Pro session: the local reviewer credential file is not on this machine. Owner scoping was checked in code and in `tests/coachStorage.test.mjs` (21/21 passed), not in a live signed-in browser.

**Verdict:** The paper notes are the right object for Tableu. The frame around them is a recent-questions bin presented as a saved journal, and it breaks when a question is long or the phone is narrow.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Save feedback exists on the question field; the list never says it is this device only, capped at 10, or that an older question was dropped. |
| 2 | Match System / Real World | 2 | The heading says intentions; the cards say "GUIDED COACH" and "Use suggestion"; the icon is a refresh glyph. |
| 3 | User Control and Freedom | 3 | Escape, close, Keep it, and Not yet work, and focus returns. No undo after delete, and no recovery for the evicted 11th. |
| 4 | Consistency and Standards | 2 | The coach calls the same list Recent questions and applies in one tap. The Journal calls it Saved Intentions and confirms first. |
| 5 | Error Prevention | 2 | Delete names the question. The 10-item cap drops the oldest with no warning. A failed delete is silent. |
| 6 | Recognition Rather Than Recall | 3 | A wrapping question is shown in full, in serif, with its date. The empty state does not show how to save one. |
| 7 | Flexibility and Efficiency | 2 | Reuse takes a card tap plus a full-screen confirm. The question field's Return chip is the faster path to the same data. |
| 8 | Aesthetic and Minimalist Design | 2 | The notes are quiet and specific. The pager collides with the title, and a long token paints across the next card. |
| 9 | Error Recovery | 2 | Use and delete can be cancelled. Storage failure on delete is not announced. Dropped history cannot be restored. |
| 10 | Help and Documentation | 1 | The only explanation, "From Guided Intention Coach", is incomplete and sometimes false. |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** The notes are authored for this product. Warm ruled paper, a brass tape strip, a curled corner, and Source Serif questions belong in the Midnight Reading Room and would look wrong in a generic task app. The frame does not. A circular-arrow icon, a repeated "GUIDED COACH" kicker, a "1 / 2" pager squeezed into the title, and a warning-triangle confirm could ship unchanged in any notes app. The worse miss is voice: Tableu's job is a question the reader keeps and returns to. This surface calls that question a suggestion, attributes every save to the coach, and treats reuse as a hazard.

**Deterministic scan:** `impeccable detect --json` on `SavedIntentionsModal.jsx`, `SavedIntentionsList.jsx`, `SaveIntentionButton.jsx`, `CoachSuggestion.jsx`, and `QuestionExamples.jsx` returned `[]` (exit 0). It did not catch the overflow, the clipped pager, or the paper-note contrast. Those need layout and painted pixels. No false positives to reject. No live overlay was injected; evidence is Playwright screenshots, not an in-page overlay.

## Overall Impression

The happy path at desktop, with ordinary questions, is the best of this surface: six paper notes, the question in serif, a date, a close button that takes focus. The single biggest opportunity is to make the list honest and direct. It is recent questions on this device, ten at most, shared with the coach. Say that, let a tap return the question, and stop the notes from escaping their cards.

## What's Working

- The note itself is the right artifact. Serif question, tracked label, date, tape, and curl read as something kept, not a database row. Title contrast on the paper is about 11:1. Arabic questions render right-to-left without extra work.
- Dialog mechanics are careful. Focus starts on Close saved intentions, Escape closes, the nested confirm hides the parent from assistive tech, and focus returns to the card, the delete control, or the Journal button. That is already covered by `e2e/saved-intentions-modal.spec.js`.
- Owner isolation in storage is real. History keys are `tarot_coach_history_${userId}` or `_anon`. A write that does not stick is reported as failure on the question field's Save intention control, and the unit tests hold that line.

## Priority Issues

### [P1] A long question escapes the card and hides the one beside it

**Why it matters:** Grid items default to `min-width: auto`, `.coach-note` is `overflow: visible`, and `.coach-note__title` does not break long tokens (`overflow-wrap: normal`). One pasted URL or unbroken word stretches the column. At 1440px the token paints across the next note, so two intentions become unreadable. At 390px the column grew to 1756px and the dialog clipped every card, including ordinary questions. The supported 320px width does the same.

**Fix:** Give the grid `minmax(0, 1fr)`, set `overflow-wrap: anywhere` on the question, and clip the note to its radius. Keep the curl as decoration inside the card, not as a reason to leave overflow visible.

**Suggested command:** `/impeccable layout`

### [P1] The list is recent coach history, presented as a saved journal

**Why it matters:** `recordCoachQuestion` writes one 10-item array. The Journal button, the question field's Save intention, every applied coach question, and the Journey "Save intention" actions all share it. The coach panel calls the same rows Recent questions. The Journal calls them Saved Intentions, stamps every card GUIDED COACH, and accessible names say "Use suggestion" and "Delete this suggestion". A reader who never opened the coach still sees that label. The 11th save drops the oldest with no count, no notice, and no undo. Nothing here syncs with the cloud journal or leaves with an export, including for a signed-in Pro reader. The empty state is one line, "No saved intentions yet.", in a full-height phone sheet, with no path to the question field.

**Fix:** Name the list for what it is, or split explicit saves from automatic history. On the current list: drop the coach kicker unless the row came from the coach; say "On this device · 10 most recent"; announce when an older question is replaced; point the empty state at Save intention on the question field. Replace `JournalRefreshIcon` with the bookmark icon that already exists. Align the accessible names with "intention".

**Suggested command:** `/impeccable clarify`

### [P1] Reuse is staged as a warning

**Why it matters:** Tapping a note opens "Use this intention?" with a warning triangle and an amber Start Reading. On a phone that confirm is a second full-screen sheet. The action fills the question and goes to the reading setup. It is reversible. The coach's Recent questions list applies the same text in one tap. The warning chrome tells a careful reader they might lose something, and it adds a step to the reason the list exists.

**Fix:** Keep a confirm only if leaving the Journal mid-filter is the risk, and then say that in plain language without the warning icon. Otherwise match Recent questions: one tap returns the wording. If a confirm stays, use the secondary reading button, not the danger/warning pair, and do not take the whole phone to ask.

**Suggested command:** `/impeccable quieter`

### [P1] At 320px the pager is clipped under the close button

**Why it matters:** The title and the pager share one non-wrapping row. With 7 items at 390px the header overflows by 31px and "1 / 2" stacks into a broken label between Prev and Next. At 320px the header overflows by 101px, the sheet's content is 307px in a 262px scroller, and Next is painted as "N" under the close control. Prev/Next are 63×27px, under Tableu's 44px target (they clear WCAG 2.5.8's 24px floor, so this is a product and clipping failure, not a target-size fail). A 10-item list does not need pages of 6; the sheet already scrolls.

**Fix:** Put the count on its own line under the title. Drop the pager and let the sheet scroll, or move Prev/Next to a 44px row that cannot sit under the close button.

**Suggested command:** `/impeccable adapt`

### [P2] Dates and the delete icon fail on the paper

**Why it matters:** Computed contrast of the note ink on the paper gradient: the question is about 11:1. The date, `rgba(90, 80, 65, 0.7)` at 12px, is 3.40:1 on `#f5efdf`, 3.29:1 mid-card, and 3.11:1 on `#e8dcc8`. Small text needs 4.5:1 (WCAG 1.4.3). The trash icon at 0.6 alpha is about 2.6:1, under the 3:1 non-text floor (WCAG 1.4.11), on the control that removes a private question. The "GUIDED COACH" label at 0.85 alpha falls to 4.23:1 on the lower paper.

**Fix:** Use opaque ink for the date and the delete icon. Keep the paper; drop the alpha.

**Suggested command:** `/impeccable colorize`

## Persona Red Flags

**Casey (distracted, phone):** At 320px Next is clipped into the close button. Choosing a note opens a full-screen warning sheet for a tap that should have filled the question. A pasted link makes every card slide out from under the dialog edge.

**Jordan (first visit):** The empty sheet says the list comes from the Guided Intention Coach and nothing else. There is no link to the question field, where Save intention actually lives. The refresh icon, beside "Local only · this browser", reads as sync.

**Mara (returning practitioner, from the product brief):** She saved a question on her phone and opened the Journal on her laptop. It is not there. She saved an 11th and the first is gone, with the list still titled Saved. The card she did find is labeled a coach suggestion.

## Minor Observations

- Delete failure from `deleteCoachHistoryItem` is ignored. The card stays and nothing is announced.
- The use confirm and the delete confirm share one `ConfirmModal` title id, `confirm-modal-title`. Only one is open at a time, so it works, and it will break if that assumption slips.
- Hover-only delete on a fine pointer is acceptable because focus reveals it and touch always shows it. The icon contrast is the defect, not the reveal.
- Six-up pagination plus a scrolling sheet is two navigation systems for at most ten rows.
- The mystic panel, safe-area padding, and nested-confirm focus handoff should stay. They are not the problem.

## Questions to Consider

- If this list is recent questions, why does the Journal alone treat them as a curated saved set?
- What would change if the note itself were the action, and delete were the only thing that asked?
- Should the 11th save replace the oldest, or should the reader be the one who makes room?

## Cognitive load

Four of eight checks failed: single focus (title, pager, and kicker compete with the notes), visual hierarchy on narrow widths, one decision at a time (a second full-screen confirm), and minimal choices (six notes, each with a hidden delete, plus a pager). Grouping, working memory on the confirm, and progressive disclosure of delete are fine. Moderate load on the happy path; high when the pager and a long token arrive together.

## Emotional journey

Arrival at a populated desktop dialog feels kept and literary. The valley is the warning sheet, and the empty ending offers no next step. The peak should be returning to one's own wording. That peak currently lives on the question field's Return chip, not here.
