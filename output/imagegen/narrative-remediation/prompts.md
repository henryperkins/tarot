# Narrative remediation mockup prompts — reviewed v2

Reviewed September 23, 2026 against the nine audit findings, current components, PRODUCT.md, DESIGN.md, and image-generation prompting guidance.

**Status:** these corrected prompts have now been used to generate the three v2 PNGs. See [generation-v2.md](generation-v2.md) for the final files and visual review, and [generation-v2.json](generation-v2.json) for the exact calls and targeted revisions. The original unversioned PNGs remain associated with [prompts.generated-v1.md](prompts.generated-v1.md). See [prompt-review.md](prompt-review.md) for the independent review that led to v2.

The user's acceptance goal is an implemented, re-audited result of at least 18/20. An image model can illustrate visible remedies; it cannot fix or certify the application, its accessibility, or its score.

## How to run this file

1. Use the built-in image generation tool. Make three separate generation calls, in order 01, 02, 03.
2. For each call, concatenate the **Shared visual brief** with exactly one numbered **Prompt** block. Attach only that prompt's listed reference images in the listed order. Do not submit the entire document as one prompt.
3. Resolve reference paths against this file's directory: `C:/Users/htper/tarot/output/imagegen/narrative-remediation/`. The six original audit screenshots have been copied into `references/` so replay does not depend on OS temporary files.
4. Inspect references before use. These are current-app identity/content references and, where identified, examples of defects to remove. They are not images to reproduce unchanged. If a reference is unavailable, restore it or recapture the named state rather than guess.
5. Inspect each output at its intended CSS viewport scale. Pixel dimensions requested in prose are compositional targets, not guaranteed tool controls. Record actual dimensions; check aspect ratio and scale before inferring any control size.
6. The v2 outputs are saved as `01-light-reading-v2.png`, `02-mobile-follow-up-v2.png`, and `03-short-desktop-chat-v2.png`. For another run, use the next available version suffix and retain earlier files and provenance. If a targeted image edit is needed, attach its actual output as image 1, identify it as the edit target, name the one defect, and restate the invariants. Do not automatically replay historical edit prompts.

## Shared visual brief — include in each generation call

```text
Use case: ui-mockup.
Produce one high-fidelity screenshot-like proposal for the existing Tableu app after the specified visual remedies. It is a product UI, not a marketing page, collage, poster, or device presentation. No browser chrome, device frame, audit annotations, score badges, implementation terms, or claims that tests passed.

Preserve Tableu's "Midnight Reading Room": contemplative, scholarly, intimate, warm paper and brass. Use Source Serif 4-like regular/medium type for interpretation and major headings; Inter-like type for controls, metadata, and prose. Do not turn operational labels into oversized serif headings. Narrative title 30 logical px, subsections 24, reading prose 18 desktop and 16 mobile; UI labels 14–16, mobile form text 16. Keep a clear title > subsection > body hierarchy. Use a 4px spacing rhythm, 12px control corners, 14–16px supporting panels, and about 24px for the main reading panel. Warm hairlines and restrained atmospheric depth; no neon purple, heavy blur, or glow on every surface.

Light palette: canvas #FAFAFA, surfaces #FFFFFF/#F5F5F5, main text #1A1A1A, supporting text #555555, brass #7D623B, focus ring #8A6B3B. Dark palette: canvas #0F0E13, opaque modal surface #1C1A22, raised controls #2A2730, main text #E8E6E3, supporting text #CCC5B9, brass #D4B896, focus ring #E8DAC3. Focus is a distinct 2px ring with 2px offset; selected fill alone is not focus. Render one focused control at a time.

Desktop navigation labels are exactly "Spread", "Question", "Ritual (optional)", "Reading", with the existing line icons and Reading selected. Do not invent step names or numbers. Keep the warm identity in light mode; remove the erroneous dark outer frame from the light reading.

Render supplied copy verbatim; add no helper text, predictions, sources, metrics, or claims. All sample data in this brief is a synthetic review fixture, not a claim about a real person's reading. Never change user-authored question text.

Priority order: correct state and content; readable type and visible controls; necessary scrolling; then decorative spacing. Do not shrink controls, text, or safety copy to satisfy a canvas-height preference. Do not invent behavior from a visual cue.
```

## Prompt 01 — light reading, source provenance, and feedback

Attach these references in order:

1. [references/desktop-light-narrative.png](references/desktop-light-narrative.png) — incumbent reading hierarchy, copy, navigation, and identity; remove its dark light-theme outer frame.
2. [references/desktop-light-inputs.png](references/desktop-light-inputs.png) — actual source rows and supporting actions; correct the pale status labels.
3. [references/desktop-light-feedback.png](references/desktop-light-feedback.png) — feedback components and controls; improve focus and selected-state distinction.

```text
Asset 01: a LIGHT-theme full-page desktop reading, logical width 1440px and approximately 3200px of page height. This is a full-page capture, not a claim that everything fits one viewport. Keep the column and text at normal CSS scale; let the page grow if required. Center the main panel at about 1040px wide and prose at about 700px. Use one continuous reading surface with quiet separators.

Fixture state: reading complete; insight panels visible; reading not yet saved; narration stopped; zero saved media; chat closed; feedback expanded. A user has already selected rating 4 in all three groups and has keyboard focus on Accuracy's 4. Notes are empty, feedback is not submitted, and a request ID exists, so Submit feedback is enabled. These selections depict an interaction state, not a new default.

Reading panel, in this order:
- "Your Personalized Narrative", a small sparkle icon, and the secondary "Focus on narrative" button.
- "Anchor: How can I find a sustainable balance between work and rest?"
- A compact but readable note with all three lines:
  "This narrative braids together your spread positions, card meanings, and reflections into a single through-line."
  "Use what resonates, and set aside what does not."
  "Reflective guidance only. Not medical, mental health, legal, financial, or safety advice."
- Heading "Opening"; paragraph "Your question invites a gentler balance between steady effort and room to rest. The cards offer perspectives to consider while leaving the next choice with you."
- Heading "The Story of Your Cards"; paragraph "Notice how the past connects with patterns you recognize in the present. You can take a small practical step without needing certainty about everything ahead."
- Heading "Synthesis"; paragraph "There is room for both patience and change. Keep what feels useful, question what does not, and let your own experience guide the meaning you take from this reading."
- Heading "Practical Guidance"; bullets "Choose one commitment you can keep this week.", "Leave a little space before answering the next request.", "Notice what helps you feel grounded."
- Heading "Reflection"; paragraph "What would a sustainable next step look like for you?"
- Actions "Read this aloud", primary "Save to Journal", and "View Journal". Primary action 52px high; secondary actions at least 44px. Keep all labels.

Supporting surfaces, stacked in the current application's order:
1. "Visual Companion Studio"; "Generate artwork and cinematic motion that stay anchored to this reading."; button "Open visual studio".
2. "Spread Insights"; subordinate "Highlights"; "Deck scope: Full deck (Major + Minor Arcana)."
3. "Continue the conversation"; "Open a private chat window to explore this reading."; button "Open chat".
4. "Reading Inputs Used"; "Which sources shaped this interpretation."; summary badges "3 used" and "2 requested not used". A two-column, three-row source grid with exactly these entries:
   - "Spread & cards" — check icon and "Used"; no helper text.
   - "Vision uploads" — "Not requested"; no helper text.
   - "User context" — check icon and "Used"; "Used: question, tone".
   - "Traditional wisdom" — check icon and "Used"; "semantic mode, 2/3 passages".
   - "Ephemeris" — "Requested not used"; no helper text.
   - "Forecast" — "Skipped"; "Reason: budget limit".
   Use opaque #2F6A3B text/icons on #EDF4EE for all Used badges, including the summary; at least 14px semibold. Status remains intelligible through words and icons. Use dark amber #854D0E on pale #FEF3C7 for requested-not-used/skipped statuses; gray ink for Not requested. No invented source descriptions.
5. "Recent media"; "Saved visuals from this reading flow · 0 saved items"; button "View recent media".
6. "Draw new reading" as the existing reset action, with less visual prominence than Save to Journal.
7. Expanded feedback panel with a clearly operable header "How did this reading land?", subtitle "Share quick ratings to tune quality.", and an upward chevron indicating it can collapse. Keep three rating groups as vertically stacked rows:
   "Accuracy" / "Did it match the cards?"
   "Coherence" / "Did it flow naturally?"
   "Actionability" / "Can you use this?"
   Each group has five 44px circular controls labeled 1, 2, 3, 4, 5, with only 4 selected in brass and a white numeral. Only Accuracy's selected 4 has the separate light-theme focus ring. No blue focus ring.
   Legend "1 Poor · 2 Fair · 3 Good · 4 Great · 5 Excellent".
   Label "Additional notes (optional)", a three-row notes field with placeholder "What resonated or felt off?", counter "0 / 750", and "Submit feedback".

Preserve the five narrative sections and all listed controls. No blank placeholder sections or ellipses in place of content. If page height is tight, extend the page rather than miniaturize ratings, omit content, reorder actions, or turn the three feedback rows into a cramped three-column layout. This view illustrates visual hierarchy, contrast, and a keyboard-focus state; it does not demonstrate radio-keyboard behavior or document semantics.
```

## Prompt 02 — dark mobile follow-up drawer

Attach these references in order:

1. [references/mobile-dark-narrative.png](references/mobile-dark-narrative.png) — dark reading and mobile page identity only.
2. [references/desktop-dark-chat.png](references/desktop-dark-chat.png) — chat controls and dark palette; do not copy its undersized targets.

```text
Asset 02: DARK-theme mobile follow-up drawer at logical 390 × 844px, portrait ratio 390:844, rendered sharply. The on-screen keyboard is closed. A signed-in Pro account has "0/10 used"; the existing journal-history setting is checked. Suggestions are open, conversation is empty, input is empty, counter is "0/500", there is no loading or error state. The user has tabbed to the first suggestion, which alone has the keyboard focus ring.

Show a uniformly dimmed reading in only the top 78 logical pixels. An opaque, full-width foreground sheet starts around y=78 and ends at y=844. The entire sheet is above all page content. No background Save/Chat/New reading dock or reading text overlays the sheet.

Lay out three regions within the available 766px: a compact fixed header, a middle region that may scroll, and a complete pinned composer. Preserve 20px side padding. Prioritize readable controls and footer visibility over showing all optional context at once.

Header: small grabber; existing "Follow-up" eyebrow; "Follow-up chat" title around 22px; subtitle "Ask deeper questions and stay anchored to this spread."; 48 × 48 close-button outline containing a 20px X. Place "0/10 used" on a separate line if needed so it never squeezes the title or close control. Do not shrink the close outline below 48px.

Scrollable middle: show three full-width outlined suggestion buttons with 16px left-aligned text, 12px corners, 12–16px padding, 8px gaps, and at least 64px height, growing with wrapped text:
"How does the Present bridge the Past and Future?"
"How do these cards change each other's meaning?"
"What is one practical step I can take this week?"
Use the dark-theme 2px offset focus ring on the first button only. No newly invented YOUR QUESTION or Explore this reading panel; the fixed header already establishes context. If the questions overflow, show a scroll cue and let only this region scroll; do not shrink text or touch targets.

Pinned opaque composer, fully inside the sheet:
- Label "Your follow-up".
- Textarea about 96px high with placeholder "Ask a follow-up question..." and counter "0/500".
- A 48 × 48 send-arrow button beside it, visibly DISABLED because the input is empty. Use a subdued warm-gray fill and muted icon; no active brass emphasis or focus ring. Keep the full control size.
- Small helper "Shift+Enter for a new line".
- A checked checkbox and "Include insights from my journal history", wrapping naturally into a 48px-or-taller touch row.
- At least 16px bottom padding, with safe-area space kept clear.

All footer content and the close button must remain visible. Give any excess content to the scroll region. The sheet is opaque #1C1A22; the backdrop dims uniformly. This screenshot represents the keyboard-closed state only; do not claim it proves on-screen-keyboard handling or modal focus management.
```

## Prompt 03 — light desktop dialog in a short window

Attach these references in order:

1. [references/short-pro-chat.png](references/short-pro-chat.png) — existing light chat and the footer-clipping defect to remove; do not reproduce its overflow.
2. [references/desktop-light-narrative.png](references/desktop-light-narrative.png) — exact underlying reading identity, labels, and copy; replace its dark exterior frame with the shared light surfaces.

```text
Asset 03: LIGHT-theme desktop follow-up dialog in a logical 1440 × 500px viewport, ratio 2.88:1. Use the same signed-in Pro fixture as 02: "0/10 used", checked existing journal-history setting, suggestions open, empty conversation, empty textarea, "0/500", no loading or error. This frame shows the state after a pointer opened the dialog, with no keyboard-only focus ring.

Use a neutral dimming backdrop over the actual light reading. Background navigation is exactly "Spread", "Question", "Ritual (optional)", "Reading", with existing line icons and Reading selected. The partially obscured heading is "Your Personalized Narrative". Use actual reference copy wherever readable; do not invent background reading text. No dark nested frame, numbered steps, or "Draw and reflect" label.

Center an opaque dialog 740px wide and 452px high at x=350, y=24, leaving 24px above and below. Use 20px corners, a thin warm border, white/warm-paper surfaces, and restrained shadow. Its vertical budget is:
- Header: 100px.
- Scrollable middle: 156px.
- Pinned footer: 196px.
These sum to 452px; all padding belongs inside those regions.

Header: 20px horizontal padding; speech-bubble icon; "Follow-up chat" in 22px semibold sans-serif; "Clarify symbols, positions, or next steps."; usage "0/10 used"; and a 48 × 48 close-button outline with a 20px X. Never scale the close control down.

Middle: 8px vertical and 20px horizontal padding; three 56px-high outlined question buttons with 8px gaps:
"How does the Present bridge the Past and Future?"
"How do these cards change each other's meaning?"
"What is one practical step I can take this week?"
The content is 200px tall including padding, so it genuinely exceeds the 156px region. At the initial scroll position show the first two buttons fully and only the beginning of the third, with a scrollbar consistent with that amount of overflow. Clip only the scroll-region contents at its boundary. Do not compress all three into view or draw a fake scrollbar with no overflowing content.

Pinned footer: solid light surface, top divider, 20px side padding. Inside its 196px total height allocate 16px top padding, a 20px "Your follow-up" label, 8px gap, 76px textarea row, 18px helper, a 44px checkbox row, and 14px bottom padding.
Textarea placeholder "Ask a follow-up question..." and counter "0/500"; beside it a 48 × 48 send-arrow button, visibly DISABLED with subdued warm-gray fill because the input is empty. Helper "Shift+Enter for a new line". Checked checkbox label "Include insights from my journal history". The entire checkbox row and bottom padding are visible inside the dialog.

Keep text readable and the footer fixed. Do not solve short-window overflow by cropping the footer, omitting the journal control, shortening labels, shrinking buttons, or extending the dialog beyond the window. This image illustrates a bounded layout and overflow; actual independent scrolling must be implemented and verified.
```

## Coverage of the nine findings — implementation contract, not image text

| Finding | What the image model can illustrate | Required implementation evidence |
| --- | --- | --- |
| 1. Mobile drawer behind the page | 02: opaque, dominant sheet; no overlapping page dock. | Defined modal layer/portal and pointer hit tests on every control at 320px and 390px. |
| 2. Invisible keyboard targets after close | Open-state pictures cannot demonstrate closed-state inertness. | Correct boolean inert or unmounting; open focus trap; Escape dismissal; focus returned to the opener; no closed descendants in the Tab sequence. |
| 3. Suggestions lose button roles | 02/03: obvious buttons with visible focus where applicable. | Native buttons, optional enclosing list items, no role override; Enter/Space work; role-related accessibility scan violations cleared. |
| 4. Light success contrast | 01: opaque dark sage on pale sage, text plus checkmark. | Measure actual rendered colors, including alpha/background blending; normal text at least 4.5:1. Proposed opaque pair #2F6A3B / #EDF4EE calculates to 5.78:1. |
| 5. Short-window footer clipping | 03: real overflowing middle and completely visible footer. | Verify actual scroll behavior at 1440 × 500, enlarged text, and mobile keyboard sizes; fall back to whole-dialog scrolling if fixed regions cannot fit. |
| 6. Feedback keyboard interaction | 01: one selected value per group; distinct single focus ring. | Native radios or correct roving behavior; Tab enters/leaves each group once, arrows change selection, Space selects. No default 4/5 ratings. |
| 7. Heading hierarchy | 01: title visibly above all five narrative subsection headings. | Page h1, narrative/peer panels h2, narrative subsections h3; verify the accessibility tree. Font sizes do not establish semantic levels. |
| 8. Small chat targets | 02/03: full 48px close/send outlines, ample suggestion buttons. | Measure CSS hit areas: at least 44 × 44, preferably 48 × 48 for close/send, at supported widths. Raster measurements are not DOM evidence. |
| 9. Dead Skip to spreads target | No skip link is visible in the selected screenshot focus states. | Offer a focus-visible Skip to narrative link to a mounted, focusable target; omit links to unmounted sections. Verify activation and focus transfer. Never show both a focused skip link and a focused rating in one screenshot. |

These three states are representative views, not an exhaustive state inventory. Also verify 320px layouts, both themes, 200% text, open/closed overlays, an on-screen keyboard, reduced motion, loading/error/retry, and existing voice/media/journal flows in the implemented application. Keep performance claims outside image evaluation.

## Output review — before calling the new mockups accepted

- Check copy against the literal strings above, including all five narrative headings, the full safety text, source states, mobile subtitle, feedback chevron, notes counter, and exact navigation.
- Check selected versus focused versus disabled states. Empty inputs must not appear to have an active Send action. Feedback's three selected 4s represent deliberate sample user input, not defaults.
- Reject undersized close/send outlines, shrunken text, clipped fixed footers, an extra mobile context card that crowds the composer, or a scrollbar inconsistent with the specified overflow.
- Confirm each image's aspect ratio and plausible relative sizing. Assess at a consistent scale; do not claim exact CSS dimensions, font metrics, contrast, hit testing, or responsive proof from generated pixels.
- Inspect the rendered app after implementation to award any score. A successful image generation does not change the previous 10/20 audit result.
