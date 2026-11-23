# Impeccable audit of expanded saved journal entries

**17/20 · Good**, up from 15/20 on November 22. The November 23, 2026 pass exercised the merged journal on `/journal` as a guest and as an active Pro reader. Two P2 issues remain on the open entry. The pattern web clips long names at enlarged text, and the guest copy action can open the system share sheet. [Audited merge of #164](https://github.com/henryperkins/tarot/commit/5753a32c64b372999807b64cf6c7fea5c5077a46)

## Score

| Dimension | Score | Browser and source evidence |
| --- | ---: | --- |
| Accessibility | 3/4 | The follow-up heading hierarchy, copy/share status, and note-confirmation focus now work. The guest action name describes only its clipboard behavior. |
| Performance | 3/4 | The open fan loaded all ten images, four eager and six lazy. Markdown loads on demand. Graph placement uses bounded layout measurements. This pass covered interaction and loading on a local desktop browser. |
| Theming | 4/4 | The icon buttons, menu, reversed badge, and thumbnails resolved to the theme shadows. The three sampled text roles cleared 4.5:1 in both themes. |
| Responsive design | 3/4 | Touch picks a covered card and still allows scrolling. The page fits at 320px, including at 200% text, where two graph labels run past the card edge. |
| Implementation integrity | 4/4 | **Pass.** The expanded question keeps its context, saved prose shares one heading hierarchy, and the relationship list names every connection in the drawing. The scoped Impeccable detector returned zero findings. |

**Open-entry findings by severity** · 0 P0, 0 P1, 2 P2, 0 P3. The local validation failures are recorded separately below.

## What changed after #164

| Original finding | Result on the merged entry |
| --- | --- |
| Covered cards in the fan | All ten center taps selected the intended card on the 320px guest entry at 200% text and the 390px Pro entry. Chrome hit-tested The Fool above The Magician’s center, but tapping there selected and focused **The Magician**. Right Arrow moved focus to The World. A vertical swipe scrolled the page and kept the selection. A desktop mouse click selected the hovered card. [Selected card on a phone viewport](expanded-journal-entry-evidence/covered-card-selected.png) |
| Pattern-web names | The Fool, The Magician, and The World had **zero pairwise text overlap** in every tested layout. The list retained both the three-card pattern and the Fool–Magician pair. The enlarged-text clipping is described below. |
| Follow-up headings and links | The question was an `h3`. Both the narrative and the latest answer rendered Markdown `#` and `##` as Source Serif `h4` and `h5`. The follow-up link had `target="_blank"` and `rel="noopener noreferrer"`. |
| Context | “Career” was visible on the collapsed row and beside “Celtic Cross” in the open header for both readers. |
| Copy and share announcements | Guest clipboard success and Pro link creation each produced one matching `role="status"` with `aria-live="polite"` and no enclosing live region. This verifies the accessibility tree. Screen-reader speech was outside this pass. |
| Note removal | In both sessions, choosing **Edit** and then **Remove note** put focus on **Keep note**. Escape returned focus to the edit action and preserved the note. |
| Shadows | The icon button and menu used `--ui-elevated-shadow`. The thumbnail and reversed badge used `--ui-card-shadow-soft`. In light mode the computed colors were `rgba(77, 59, 42, 0.2)` and `rgba(125, 98, 59, 0.2)` respectively. |

## Signed-in Pro

**Share composer.** Opening **Create share link** focused the selected **7 days** radio. All four expiry choices were available. Left Arrow selected **24 hours**. Escape and Cancel each returned focus to the trigger. Choosing or canceling sent zero create requests. In a separate clipboard run, confirming the 24-hour option returned HTTP 201 and one “Share link copied” message. The local shared response contained the question and omitted the saved narrative and reflection. Revoking the test link changed its response from 200 to 404. [Share composer with 24 hours selected](expanded-journal-entry-evidence/pro-share-composer.png)

**Cloud follow-up limit.** With nine saved turns, the entry showed **9/10** and **Ask a follow-up** opened an editable chat with “1 question left.” A second entry had ten actual saved turns in local D1. It showed **10/10**, disabled **Limit reached**, and kept **Open full chat** available. The chat displayed the first and tenth questions, explained the limit, and exposed neither a question field nor a Send button. Opening these states made zero generation requests. [Capped entry](expanded-journal-entry-evidence/pro-follow-up-limit.png) · [Notice inside the open chat](expanded-journal-entry-evidence/pro-chat-limit.png)

## Remaining findings

### P2 · Enlarged pattern names clip at the entry edge

At 320px with a 32px root font, the label boxes fit inside the plot, but the words overflow those boxes. In light mode the article’s right edge was at 274px. “The Magician” extended to 310px and “The World” to 290px. The article clipped about 35px and 16px of their text. Both accounts and both themes showed the same problem. The list below spells out all three names, so readers can still recover the relationship. [320px capture at 200% text](expanded-journal-entry-evidence/pattern-web-320-200.png)

Use `/impeccable adapt` to give these words enough room or move the names to the list when the plot is too narrow. Verify the painted text against the article edge as well as against neighboring labels. The placement code measures the constrained span boxes. [CardRelationshipGraph.jsx](../../../src/components/charts/CardRelationshipGraph.jsx)

### P2 · The guest “Copy summary” action invokes native sharing

With Web Share enabled, activating **Copy summary** called Chrome’s native share API and left the button pending while it waited for the system picker. With Web Share disabled, the same action copied immediately and produced “Summary copied (single reading).” A reader choosing Copy can reasonably expect to paste the result without selecting a destination. The browser run ended before any native share destination was chosen.

Use `/impeccable clarify` to align the action and its feedback. **Copy summary** should write directly to the clipboard, or the native-sharing path should say **Share summary** and report sharing or cancellation accurately. After both P2 fixes, use `/impeccable polish` to recheck the phone layout and both feedback paths. [Guest action label](../../../src/components/journal/entry-card/EntryHeader/ComfortableHeader.jsx) · [Summary delivery](../../../src/lib/journalInsights.js) · [Status text](../../../src/components/journal/entry-card/hooks/useEntryActions.js)

## Coverage and verification

- **Browser.** Headless Chrome 158.0.8127.37 on Windows, served by a local Wrangler Worker built from the merge commit. Both accounts covered 320×720 dark, 390×844 dark, 1280×800 dark, and 1440×900 light. Both also covered 320×720 at 200% root text in light and dark. The two desktop sizes used reduced motion and the entry’s slide animation computed to `none`. Phone input used synthesized touch. Physical devices, native share completion, spoken output, and other subscription tiers remain untested.
- **Data and authentication.** The guest used a synthetic ten-card Celtic Cross in local storage. The reusable credential file was absent on this host. The Pro pass used the documented reviewer identity provisioned in a disposable local D1 database. Each authenticated browser context performed a real password login, confirmed `pro` and `active` at `/api/auth/me`, and loaded the cloud journal from the Worker. Logout returned 200 and the subsequent identity check returned 401. [Local reviewer procedure](../../local-reviewer-account.md)
- **Accessibility and contrast.** Impeccable 4.8.0 scanned the entry-card directory, journal, graph, label placement helper, and inline status. Rendered axe-core 4.14.0 flagged the visible **Rev** badges on two buttons whose accessible names say **Reversed**. This is a voice-control follow-up, with no confirmed speech-input failure. The proposed W3C test excludes abbreviated labels. Painted-background samples for the context text, follow-up link, and share privacy copy respectively measured **10.04:1, 9.09:1, 12.03:1** in dark mode and **7.46:1, 5.70:1, 12.63:1** in light mode. [W3C test applicability](https://www.w3.org/WAI/standards-guidelines/act/rules/2ee8b8/proposed/)
- **Local checks.** The app built successfully and all **18** focused fan, graph, label-separation, and heading tests passed. The full `npm test` run had **6,657 passed, 8 failed, 32 skipped**. Five reading-cue validation tests failed because their source manifest omits the merged `labelSeparation.js` and `journalHeadings.js` imports. The cold-start test passed on the pre-merge parent. Add both paths to that manifest and rerun the runtime tests. The three locked plugin ZIP checks also failed on the pre-merge parent. [Validation source manifest](../../../scripts/lib/readingCueValidationSource.json)
- **Hosted checks.** Vercel reported a blocked account and supplied no preview. GitHub’s build and test jobs stopped before execution because of its billing lock. All browser evidence above is local. [Merged PR and checks](https://github.com/henryperkins/tarot/pull/164)
