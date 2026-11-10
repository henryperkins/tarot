---
target: skeleton when reading is being generated
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/home/ubuntu/tarot/src/components/reading/ReadingPreparationScreen.jsx"
target_fingerprint: "sha256:9c64e058d712fc5af1f63b03a4629b88b7c007364993b727ccfeab4fc8a146e9"
target_path: /home/ubuntu/tarot/src/components/reading/ReadingPreparationScreen.jsx
timestamp: 2026-10-20T22-09-54Z
slug: ents-reading-readingpreparationscreen-jsx-070eb89a
closed: true
---
Method: dual-agent (A: /root/skeleton_design · B: /root/skeleton_evidence).

The generation screen is calm and legible, but it loses the personal connection established by the card reveal. The strongest improvement is to keep the question, a compact reminder of the actual draw, and reliable status and cancellation together throughout the wait.

The active target is [ReadingPreparationScreen.jsx](../../src/components/reading/ReadingPreparationScreen.jsx#L10), rendered by InterludeScene. The older NarrativeSkeleton.jsx is no longer imported into the app.

The visual language fits Tableu: literary serif headings, warm brass, and quiet ink surfaces. The composition is less distinctive: a centered spinner and fixed document outline could serve many generated-report products. Tableu's real reading content should carry more of this moment.

This review scores the waiting UI and its adjacent recovery states at **25/40 — Acceptable**. Assessment A scored 24/40 independently; the combined score adds one point for error recovery after Assessment B exercised the error, retry, and completion states successfully.

| Heuristic | Score | Assessment |
|---|---:|---|
| Visibility of system status | 2/4 | Clear initially; disappears when inspecting cards. |
| Match with the real world | 3/4 | Plain language; empty outline circles suggest progress or tasks. |
| User control and freedom | 2/4 | Safe cancellation exists, but is absent from the card view. |
| Consistency and standards | 3/4 | Coherent palette and type; static outline looks interactive. |
| Error prevention | 3/4 | Generation replaces its trigger; cancellation preserves the draw. |
| Recognition rather than recall | 2/4 | Question and actual cards are hidden in the waiting view. |
| Flexibility and efficiency | 2/4 | Card inspection requires a view switch and mobile scrolling. |
| Aesthetic and minimalist design | 3/4 | Restrained and readable; the full outline consumes too much space. |
| Error recovery | 3/4 | Failure offers a focused error, preserved question, and working retry. |
| Help and documentation | 2/4 | Explains the pending result, but gives little useful long-wait guidance. |
| **Total** | **25/40** | **Focused improvements needed.** |

The strongest parts are worth preserving:

- The initial message distinguishes what is complete from what is pending: cards are drawn and the interpretation is being prepared. It supplies no invented percentage or finishing time.
- Typography and color remain calm and readable. Sampled text contrast ranged from 10.16:1 to 15.43:1. Reduced motion left zero running animations in the captured generation states.
- Recovery works in the exercised UI: cancelling retained all cards and the question; a controlled failure offered Retry interpretation; completion moved focus to Your reading.

Four issues deserve priority:

1. **[P1] Keep status, cancellation, and keyboard focus available in both views.** Opening View drawn cards removes the visible generation status and every Cancel generation button. On a 390×844 phone viewport, the return-to-status action sat more than 1,000px down the card view. Entering generation and switching between cards and status also left keyboard focus on BODY. Keep a persistent status/action area around both views, and move focus to an appropriate heading when a trigger is removed. The new preparation heading currently lacks the focus-target attributes used by the surrounding scene controller. Evidence: [card-view branch](../../src/components/reading/ReadingPreparationScreen.jsx#L19), [focus restoration](../../src/components/ReadingDisplay.jsx#L169). Suggested commands: `impeccable harden`, `impeccable adapt`.

2. **[P2] Put useful actions before the long outline.** Celtic Cross shows nine fixed chapter rows before either action. At 390×844 after the extended-wait message, View drawn cards began at y898 and Cancel generation at y966; both were below the first viewport. Move these controls above the outline and collapse or shorten the preview. Replace the empty circular markers with an unmistakably informational list treatment: they look like checkpoints, but never advance. Evidence: [outline and action order](../../src/components/reading/ReadingPreparationScreen.jsx#L35), Celtic Cross mobile capture (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/a/pro-celtic-mobile-late.png`, local artifact). Suggested commands: `impeccable distill`, `impeccable layout`.

3. **[P2] Keep the question and actual draw visible during preparation.** The transition from revealed cards to a spinner removes the most meaningful material just as anticipation peaks. Repeat the question and include a compact row or summary of the drawn cards. Deeper card inspection can remain optional. This also creates continuity with the finished reading, which already begins with the question and cards. Evidence: [default preparation view](../../src/components/reading/ReadingPreparationScreen.jsx#L26), [finished reading structure](../../src/components/reading/narrative/ReadingDocument.jsx#L40). Suggested commands: `impeccable layout`, `impeccable polish`.

4. **[P2] Make the extended-wait message useful and proportionate.** Every spread gets longer than usual after a fixed twelve seconds. That timer knows elapsed time, but has no measured normal-duration baseline or job phase. The wording introduces concern without a new explanation or action. Use calm continued-preparation copy, connect it to reviewing the cards, and explain that cancelling retains the draw. Reserve claims about unusual duration for evidence that supports them. Evidence: [timer and status copy](../../src/components/reading/ReadingPreparationScreen.jsx#L14). Suggested commands: `impeccable clarify`, `impeccable harden`.

Cognitive load is moderate: three of the eight checklist items fail—chunking, working memory, and progressive disclosure. There are only two actual actions; the nine outline entries are passive content, not nine competing choices. Emotionally, the card reveal establishes a personal connection, the generic waiting composition drops it, and the twelve-second warning increases concern. Keeping the draw present would make preparation a more continuous part of the reading.

For a first-time reader, the empty circles and delay warning create uncertainty. For a keyboard user, removed controls and BODY focus interrupt orientation. For a distracted phone user, the long outline and card view put recovery controls outside the first viewport. These are specific journey problems rather than reasons to replace the visual identity.

There are two smaller polish issues. The bordered mobile shell has no horizontal inner padding: at 390px its border begins at x16 and outline text begins at x17. Restoring an inner gutter would make the composition feel less pressed against its frame. The single-card sentence also currently produces Your 1 cards are drawn, confirmed in source.

The source detector returned zero findings for the active component and scene. The injected browser detector returned two warnings: cramped-padding was confirmed by geometry; radial-halo was a page-level false positive for this opaque preparation surface. The overlay existed only in the automated review browser, which was closed afterward. Detector evidence (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/b/browser-detector.json`, local artifact).

Rendered coverage used local Chromium at 1440×1000, 390×844, and 320×740, separate guest and real signed-in Pro/active sessions, Three-Card Story and Celtic Cross, initial and extended waits, normal and reduced motion, card inspection, cancellation, and controlled error/retry/completion. Auth and entitlements were real; generation used a held synthetic stream with provider calls disabled. This is browser evidence, with no physical-device, actual screen-reader, light-theme, or other-tier qualification. Both authenticated review sessions logged out; task-owned browsers and temporary servers were stopped. Application source and existing configuration edits were preserved.

Useful captures: desktop (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/a/guest-desktop-initial.png`, local artifact), three-card mobile wait (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/a/guest-mobile-late.png`, local artifact), Celtic Cross mobile wait (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/a/pro-celtic-mobile-late.png`, local artifact), card inspection (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/a/guest-mobile-cards.png`, local artifact), geometry and contrast (`/home/ubuntu/tarot/output/playwright/skeleton-critique-20261020/b/geometry-contrast.json`, local artifact).

The useful design questions are what the person should gain from the wait—reassurance, time to study their draw, or a preview of the document—and how much of the existing outline supports that purpose.

> Portability note (23 October 2026): local evidence paths above identify artifacts on the original review host. Those files are not included in this Git handoff. Repository source links are relative.
