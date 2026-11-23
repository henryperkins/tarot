# Impeccable audit: expanded saved journal entries

Recorded November 22, 2026 (America/Chicago). This is the audit of open saved journal entries. It documents findings and does not change the application.

An open saved journal entry is in good technical shape: **15/20, Good**. Guest Chrome covered dark and light, 320px through 1440px, 200% text, and reduced motion. Signed-in Pro was not available in this environment, so the share composer and cloud follow-up limits were reviewed from the component only.

Audit performed with Impeccable v4.5.1. v4.10.0 was available at the time of this audit.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Action status is announced twice, and a follow-up heading can become a page-level `h1` |
| 2 | Performance | 3 | Narrative markdown and later card images load on demand; no layout loop |
| 3 | Theming | 3 | Dark and light text meet WCAG AA; a few shadows stay black in both themes |
| 4 | Responsive Design | 3 | No horizontal overflow, including at 320px and 200% text; a 10-card fan leaves some cards almost untappable |
| 5 | Implementation Integrity | 3 | The detector is clean; context disappears on open, and pattern-web names collide |
| **Total** | | **15/20** | **Good** |

## Implementation Integrity Verdict

**Pass, with isolated gaps.** The open entry is one Tableu surface: a serif question, tracked section labels, hairline sections, deck art, and the reading’s own “What resonates for you now?” prompt. It is not a generic card list.

The mechanical detector reported **zero findings** across `src/components/journal/entry-card/`, `src/components/charts/CardRelationshipGraph.jsx`, and `src/components/Journal.jsx`. The same detector does report issues on other files, so this empty result is a real scan. Rendered checks found problems the regex scan cannot see.

## Executive Summary

- Audit Health Score: **15/20** (Good)
- Issues: **0 P0, 0 P1, 6 P2, 1 P3**
- Top issues:
  1. On a phone, several cards in a 10-card fan have almost no tappable face.
  2. “The Fool” and “The Magician” overlap on the pattern web at 390px and at 1440px.
  3. A markdown heading in a follow-up becomes a 36px `h1`, above the entry’s own question.
  4. “Career” is on the collapsed row and gone once the entry is open.
  5. Copying a summary is announced twice.
- Next step: `/impeccable adapt` for the fan and the pattern-web names, then `/impeccable typeset` for follow-up headings.

Coverage: guest session, real `/journal` on Vite, local saved entries, Chrome headless (not a physical device). Viewports 320×720, 390×844, 1280×800, and 1440×900. Dark and light. Root text at 100% and 200%. `prefers-reduced-motion: reduce` on the desktop pass. Touch emulation below 700px wide. The reviewer credential file and local account database are not on this machine, and the Worker was not running, so signed-in Pro was not opened in the browser.

## Detailed Findings

### [P2] Buried cards in the open fan are barely tappable

- **Location**: `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardFan.jsx`, `fanGeometry.js`
- **Category**: Responsive
- **Impact**: On a Celtic Cross at 390px, sampling the Magician’s button hit the card on about 4% of points. The Knight’s visible face was about 20px wide; at 320px it was about 15px, and about 12px at 320px with 200% text. A tap lands on whichever card is painted on top. Arrow keys still move the selection and bring that card forward.
- **WCAG/Standard**: Misses Tableu’s 44px target. WCAG 2.5.8 (24px) is a 2.2 criterion; the product target is 2.1 AA, where this is not an automatic failure. Overlap is an intentional fan, and the full card box stays at least 44px on its long side.
- **Recommendation**: Keep the overlap. Make a tap select the covered card from its full box, which already stays at least 44px on its long side, instead of the card painted on top. A visible 24px strip would meet only the WCAG 2.5.8 floor and would remain an exception to Tableu’s 44px target, because a 10-card fan at 320px cannot give every card a non-overlapping 44px face.
- **Suggested command**: `/impeccable adapt`

### [P2] Pattern-web names sit on top of each other

- **Location**: `src/components/charts/CardRelationshipGraph.jsx` (`labelStyle`), used by `KnowledgeGraphSection.jsx`
- **Category**: Responsive
- **Impact**: With The Fool, The Magician, and The World, “The Fool” and “The Magician” occupy the same pixels: about 15×6px of overlap at 390px and about 8×4px at 1440px. The names are `aria-hidden` and the list underneath is readable, so screen readers get the relationships. The drawing itself is hard to scan.
- **WCAG/Standard**: Visual overlap of text. Not a contrast failure.
- **Recommendation**: Place each name in a lane that cannot intersect another name, or drop the drawing labels when the circle is crowded and keep the list.
- **Suggested command**: `/impeccable adapt`

### [P2] Follow-up markdown can insert a page-level heading

- **Location**: `EntrySections/FollowUpSection.jsx` renders `JournalMarkdown` without `journalHeadings`. `JournalMarkdown.jsx` only remaps headings, and only the saved narrative opts in.
- **Category**: Accessibility
- **Impact**: A follow-up that starts with `# Start over from the top` renders a real `h1` at 36px in Inter, larger than the entry’s serif question and ahead of it in the heading list. The saved narrative correctly becomes `h4` “Opening” and `h5` “The story”. On a phone only the latest turn is shown, so an older heading stays hidden until that turn is in the preview. The follow-up link is brass and underlined, but it opens in the same tab; narrative links open in a new tab.
- **WCAG/Standard**: 1.3.1 Info and Relationships, 2.4.6 Headings and Labels. Also the Two Voices rule: serif for headings.
- **Recommendation**: Run follow-up answers through the same heading remap and link treatment as the saved narrative.
- **Suggested command**: `/impeccable typeset`

### [P2] Opening an entry drops its context

- **Location**: `EntryHeader/ComfortableHeader.jsx` expanded branch; `hooks/useEntryMetadata.js` (`buildThemeInsights`)
- **Category**: Implementation Integrity
- **Impact**: Collapsed, the sample row reads “Career”. Expanded, that word is gone. Key themes are written not to repeat context because the header is supposed to name it. The open header names the time, the deck, the question, and the full spread, and not the context.
- **WCAG/Standard**: None. The reader has to collapse the entry to see why it was tagged.
- **Recommendation**: Keep the context in the open header beside the spread and time.
- **Suggested command**: `/impeccable clarify`

### [P2] “Summary copied” is announced twice

- **Location**: `JournalEntryCard.jsx` wraps `InlineStatus` in `aria-live="polite"`. `InlineStatus.jsx` is already `role="status"` with its own `aria-live`.
- **Category**: Accessibility
- **Impact**: After Copy summary, both nodes contained “Summary copied (single reading).” Screen readers can speak it twice. Errors are worse: the inner region is `assertive` and the outer one is `polite`.
- **WCAG/Standard**: 4.1.3 Status Messages.
- **Recommendation**: Keep a single live region. Let `InlineStatus` own it.
- **Suggested command**: `/impeccable harden`

### [P2] Removing a note focuses “Remove note”

- **Location**: `EntrySections/ReflectionsSection.jsx` (`confirmRef` on the Remove note button)
- **Category**: Accessibility
- **Impact**: After Edit, then Remove, focus lands on “Remove note”. Enter deletes the note. The share-link confirmation in the same entry focuses “Keep link” instead. Escape does cancel the note removal.
- **WCAG/Standard**: 2.4.3 Focus Order. The safer control should take focus.
- **Recommendation**: Focus “Keep note” when the confirmation opens, matching the share-link confirm.
- **Suggested command**: `/impeccable harden`

### [P3] Open-entry shadows stay black in the light theme

- **Location**: `EntryCard.primitives.js` (`iconButton`, `menu`, `reversedBadgeSolid`); `CardThumbnail.jsx`
- **Category**: Theming
- **Impact**: These shadows are fixed `rgba(0,0,0,…)` values. Light mode is specified to use the warm, low-opacity elevation tokens. Text contrast is unaffected: muted text measured 10.04:1 on the dark card and 7.46:1 on white; brass links measured 9.09:1 and 5.70:1.
- **WCAG/Standard**: None.
- **Recommendation**: Use `--ui-elevated-shadow` and `--ui-card-shadow-soft`.
- **Suggested command**: `/impeccable polish`

## Patterns

- Section labels such as “READING NARRATIVE” are 11px with 0.3em tracking. That is the journal label floor, contrast is strong, and it did not overflow. Leave it.
- Phone entries open with the narrative and the card fan collapsed. That is the existing phone behavior, and both controls expose `aria-expanded`.
- The action menu’s `aria-controls` target is absent while the menu is closed, and present while it is open.

## Positive Findings

- No horizontal page overflow at 320, 390, or 1440px, including 200% text in dark and light.
- All 10 card images loaded. Focus rings on the fan stayed inside the entry; the ring extent was smaller than the space reserved around the cards.
- Card buttons are named with the card, the position, and “Reversed” or “Upright”. The “Rev” badge is extra, not the only cue.
- Reduced motion sets the open-entry slide to `animation: none` and leaves the reading visible.
- Escape on the entry menu returns focus to “Open entry actions…”. At 320px and 200% text the menu stayed inside the viewport.
- The destination bar did not cover “Sign in to ask” after scrolling. That button is 44px tall, and the page’s bottom padding is 57px.
- An entry with no notes shows “What resonates for you now?” and a 44px “Add a reflection” action.
- Saved narrative headings stay under the entry’s `h3`.

## Recommended Actions

1. **[P2] `/impeccable adapt`**: Let a tap select a covered card from its full box, which already meets the 44px target on its long side, and separate The Fool from The Magician on the pattern web.
2. **[P2] `/impeccable typeset`**: Demote follow-up headings the same way the saved narrative already does, and keep them in the serif reading voice.
3. **[P2] `/impeccable clarify`**: Keep the context label in the open header.
4. **[P2] `/impeccable harden`**: Use one live region for copy and share status, focus “Keep note” when confirming removal, and open follow-up links in a new tab as the narrative links do.
5. **[P3] `/impeccable polish`**: Switch the open entry’s black shadows to the theme elevation tokens.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
